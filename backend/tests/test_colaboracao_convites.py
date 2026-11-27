"""
Testes automatizados para Colaboração Multi-Empresa, Convites (Grupo/Empresa e Projeto),
Aceite/Recusa/Cancelamento, Troca de Empresa Ativa, Permissões RBAC e Persistência SQLite.
"""

import os
import tempfile
import unittest

from backend.database_manager import SQLiteDatabaseManager
from backend.repositories.sql_repository import InfraRouteSQLRepository
from backend.services.exceptions import (
    PermissaoInsuficienteError,
    ValidacaoDominioError,
    ViolacaoMultiTenantError,
)
from backend.services.workspace_store import WorkspaceStoreService


class TestColaboracaoConvites(unittest.TestCase):
    def test_01_convite_empresa_aceite_multi_empresa_e_troca_ativa(self) -> None:
        store = WorkspaceStoreService()
        # Usuário 1 é Administrador da Empresa 1; Usuário 4 é Administrador da Empresa 2
        convite = store.criar_convite(
            id_usuario_convidante=1,
            id_empresa=1,
            tipo_convite="EMPRESA",
            email_convidado="gestor@conectasul.com.br",
            nivel_acesso="Projetista",
            mensagem="Bem-vindo ao grupo InfraTelecom.",
        )
        self.assertEqual(convite.status, "PENDENTE")
        self.assertEqual(convite.tipo_convite, "EMPRESA")

        recebidos = store.listar_convites_recebidos(4)
        self.assertEqual(len(recebidos), 1)

        conv_aceito, sessao_u4 = store.responder_convite(
            id_convite=convite.id_convite,
            id_usuario_convidado=4,
            aceitar=True,
            id_empresa_ativa_atual=2,
        )
        self.assertEqual(conv_aceito.status, "ACEITO")
        self.assertEqual(sessao_u4.id_empresa_padrao, 2)
        self.assertEqual(len(sessao_u4.empresas_vinculadas), 2)

        # Troca para a Empresa 1
        sessao_trocada = store.trocar_empresa_ativa(id_usuario=4, id_empresa_destino=1)
        self.assertEqual(sessao_trocada.id_empresa_padrao, 1)
        self.assertEqual(sessao_trocada.nivel_acesso, "Projetista")

        # Validar token preserva a empresa ativa selecionada (1)
        sessao_validada = store.validar_token_sessao(sessao_trocada.access_token)
        self.assertEqual(sessao_validada.id_empresa_padrao, 1)

        # Visão unificada (id_empresa=0) lista projetos das empresas 1 e 2
        store.criar_projeto(
            nome="Projeto ConectaSul",
            id_empresa=2,
            id_engenheiro=4,
            id_usuario_autor=4,
        )
        todos_projetos_u4 = store.listar_projetos(id_empresa=0, id_usuario_autor=4)
        empresas_nos_projetos = {p.id_empresa for p in todos_projetos_u4}
        self.assertEqual(empresas_nos_projetos, {1, 2})

    def test_02_convite_projeto_especifico_projetista_e_visualizador(self) -> None:
        store = WorkspaceStoreService()
        # Cria segundo projeto na Empresa 1 (id=3)
        proj_extra = store.criar_projeto(
            nome="Anel Privado Empresa 1",
            id_empresa=1,
            id_engenheiro=1,
            id_usuario_autor=1,
        )

        # Convida Usuário 4 (Empresa 2) apenas para o Projeto 1 como Projetista
        conv = store.criar_convite(
            id_usuario_convidante=1,
            id_empresa=1,
            tipo_convite="PROJETO",
            id_projeto=1,
            email_convidado="gestor@conectasul.com.br",
            nivel_acesso="Projetista",
        )
        store.responder_convite(
            id_convite=conv.id_convite,
            id_usuario_convidado=4,
            aceitar=True,
            id_empresa_ativa_atual=2,
        )

        # Usuário 4 passa a ver o Projeto 1 na sua listagem, mas NÃO vê o proj_extra
        projetos_u4 = store.listar_projetos(id_empresa=2, id_usuario_autor=4)
        ids_u4 = {p.id_projeto for p in projetos_u4}
        self.assertIn(1, ids_u4)
        self.assertNotIn(proj_extra.id_projeto, ids_u4)

        # Pode editar o Projeto 1 (adicionar ponto)
        ponto = store.adicionar_ponto_rede(
            id_projeto=1,
            descricao="CTO Convidado",
            latitude=-22.71,
            longitude=-46.98,
            id_usuario_autor=4,
        )
        self.assertEqual(ponto.descricao, "CTO Convidado")

        # Não pode acessar o proj_extra da Empresa 1
        with self.assertRaises(ViolacaoMultiTenantError):
            store.obter_projeto(proj_extra.id_projeto, id_usuario_autor=4)

        # Convite como Visualizador para proj_extra bloqueia escrita
        conv_vis = store.criar_convite(
            id_usuario_convidante=1,
            id_empresa=1,
            tipo_convite="PROJETO",
            id_projeto=proj_extra.id_projeto,
            email_convidado="gestor@conectasul.com.br",
            nivel_acesso="Visualizador",
        )
        store.responder_convite(
            id_convite=conv_vis.id_convite,
            id_usuario_convidado=4,
            aceitar=True,
            id_empresa_ativa_atual=2,
        )
        self.assertEqual(store.obter_projeto(proj_extra.id_projeto, id_usuario_autor=4).id_projeto, proj_extra.id_projeto)
        with self.assertRaises(PermissaoInsuficienteError):
            store.adicionar_ponto_rede(
                id_projeto=proj_extra.id_projeto,
                descricao="CTO Bloqueada",
                latitude=-22.72,
                longitude=-46.99,
                id_usuario_autor=4,
            )

    def test_03_bloqueios_rbac_e_cancelamento_recusa(self) -> None:
        store = WorkspaceStoreService()
        # Projetista (usuário 3) não pode enviar convite
        with self.assertRaises(PermissaoInsuficienteError):
            store.criar_convite(
                id_usuario_convidante=3,
                id_empresa=1,
                tipo_convite="EMPRESA",
                email_convidado="gestor@conectasul.com.br",
                nivel_acesso="Visualizador",
            )

        conv = store.criar_convite(
            id_usuario_convidante=1,
            id_empresa=1,
            tipo_convite="EMPRESA",
            email_convidado="gestor@conectasul.com.br",
            nivel_acesso="Visualizador",
        )
        # Duplicado pendente deve falhar
        with self.assertRaises(ValidacaoDominioError):
            store.criar_convite(
                id_usuario_convidante=1,
                id_empresa=1,
                tipo_convite="EMPRESA",
                email_convidado="gestor@conectasul.com.br",
                nivel_acesso="Visualizador",
            )

        # Outro usuário não pode aceitar convite que não é seu
        with self.assertRaises(PermissaoInsuficienteError):
            store.responder_convite(
                id_convite=conv.id_convite,
                id_usuario_convidado=3,
                aceitar=True,
            )

        # Cancelar convite pendente
        cancelado = store.cancelar_convite(id_convite=conv.id_convite, id_usuario_autor=1)
        self.assertEqual(cancelado.status, "CANCELADO")

    def test_04_persistencia_sqlite_convites_e_participacao(self) -> None:
        fd, caminho = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            repo1 = InfraRouteSQLRepository(SQLiteDatabaseManager(caminho))
            store1 = WorkspaceStoreService(persistir_banco=True, sql_repo=repo1)

            conv = store1.criar_convite(
                id_usuario_convidante=1,
                id_empresa=1,
                tipo_convite="PROJETO",
                id_projeto=1,
                email_convidado="gestor@conectasul.com.br",
                nivel_acesso="Projetista",
            )
            store1.responder_convite(
                id_convite=conv.id_convite,
                id_usuario_convidado=4,
                aceitar=True,
                id_empresa_ativa_atual=2,
            )

            # Reinstancia lendo do mesmo SQLite
            repo2 = InfraRouteSQLRepository(SQLiteDatabaseManager(caminho))
            store2 = WorkspaceStoreService(persistir_banco=True, sql_repo=repo2)
            self.assertIn((1, 4), store2.participantes_projeto)
            self.assertEqual(store2.convites[conv.id_convite].status, "ACEITO")
        finally:
            if os.path.exists(caminho):
                os.remove(caminho)


if __name__ == "__main__":
    unittest.main()
