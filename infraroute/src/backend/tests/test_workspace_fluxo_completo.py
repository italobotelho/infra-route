"""
Teste de Integração de Ponta a Ponta do Fluxo de Workspace (`WorkspaceStoreService`):
Simula todas as ações das telas `login.html` e `index.html`.
"""

import unittest

from backend.services.exceptions import (
    PermissaoInsuficienteError,
    ValidacaoDominioError,
    ViolacaoIntegridadeTopologicaError,
    ViolacaoMultiTenantError,
)
from backend.services.prim_service import StatusPontoProjeto
from backend.services.workspace_store import WorkspaceStoreService


class TestWorkspaceFluxoCompleto(unittest.TestCase):
    def setUp(self) -> None:
        self.store = WorkspaceStoreService()

    def test_01_login_corporativo_sucesso_e_falha(self) -> None:
        sessao = self.store.autenticar_usuario("engenheiro@empresa.com.br", "123456")
        self.assertEqual(sessao.id_usuario, 1)
        self.assertTrue(sessao.eh_engenheiro)
        self.assertEqual(sessao.crea, "SP-5060708090")
        self.assertEqual(sessao.nivel_acesso, "Administrador")

        with self.assertRaises(ViolacaoMultiTenantError):
            self.store.autenticar_usuario("engenheiro@empresa.com.br", "senha_errada")

        with self.assertRaises(ViolacaoMultiTenantError):
            self.store.autenticar_usuario("inexistente@empresa.com.br", "123456")

    def test_registro_cadastra_usuario_com_vinculo_e_login(self) -> None:
        sessao = self.store.registrar_usuario(
            nome="Ana Engenheira",
            email="ana@empresa.com.br",
            senha="SenhaForte123!",
            telefone="(19) 98888-2222",
            cpf="321.654.987-00",
            crea="1234567890",
        )

        self.assertEqual(sessao.id_usuario, 3)
        self.assertEqual(sessao.id_empresa_padrao, 1)
        self.assertEqual(sessao.nivel_acesso, "Projetista")
        self.assertEqual(
            self.store.autenticar_usuario("ANA@EMPRESA.COM.BR", "SenhaForte123!"),
            sessao,
        )

        with self.assertRaisesRegex(ValidacaoDominioError, "e-mail"):
            self.store.registrar_usuario(
                nome="Outra Engenheira",
                email="ana@empresa.com.br",
                senha="SenhaForte123!",
                telefone="(19) 98888-3333",
                cpf="456.789.012-34",
                crea="1098765432",
            )

    def test_atualizar_coordenadas_de_ponto_persistido(self) -> None:
        ponto = self.store.atualizar_coordenadas_ponto(
            id_projeto=1,
            id_ponto=101,
            latitude=-22.706,
            longitude=-46.983,
            id_usuario_autor=1,
        )

        self.assertEqual(ponto.latitude, -22.706)
        self.assertEqual(ponto.longitude, -46.983)
        ponto_salvo = next(
            point for point in self.store.pontos_por_projeto[1]
            if point.id_ponto == 101
        )
        self.assertEqual(ponto_salvo, ponto)

    def test_02_fluxo_completo_workspace_cadastro_ponto_prim_e_soft_delete(self) -> None:
        # 1. Lista projetos iniciais
        projetos = self.store.listar_projetos(id_empresa=1, id_usuario_autor=1)
        self.assertEqual(len(projetos), 2)

        proj_inicial = self.store.obter_projeto(id_projeto=1, id_usuario_autor=1)
        metragem_antes = proj_inicial.metragem_total
        custo_antes = proj_inicial.custo_estimado
        self.assertGreater(metragem_antes, 0.0)

        # 2. Cadastra um novo Ponto_Rede (Poste #103 com CTO Furukawa) no Projeto 1
        novo_ponto = self.store.adicionar_ponto_rede(
            id_projeto=1,
            descricao="Poste Concreto #103",
            latitude=-22.7062,
            longitude=-46.9838,
            status_fisico="Projetado",
            id_tipo_equipamento=1,  # CTO Furukawa (R$ 380,00)
            id_usuario_autor=1,
        )
        self.assertEqual(novo_ponto.custo_equipamento, 380.00)

        # 3. Clica em "Gerar Traçado Óptico" (Recalcula MST via Algoritmo de Prim)
        res_mst = self.store.recalcular_mst_projeto(id_projeto=1, id_usuario_autor=1)
        self.assertTrue(res_mst.grafo_conexo)
        self.assertEqual(len(res_mst.trechos_mst), 2)

        # 4. Verifica que a Memoização na tabela Projeto foi atualizada automaticamente
        proj_depois = self.store.obter_projeto(id_projeto=1, id_usuario_autor=1)
        self.assertGreater(proj_depois.metragem_total, metragem_antes)
        self.assertGreater(proj_depois.custo_estimado, custo_antes)

        # 5. Tenta Soft Delete do novo ponto SEM autorizar recálculo da MST -> Bloqueio RESTRICT (409)
        with self.assertRaises(ViolacaoIntegridadeTopologicaError):
            self.store.aplicar_soft_delete_ponto(
                id_projeto=1,
                id_ponto=novo_ponto.id_ponto,
                id_usuario_autor=1,
                novo_status_ponto=StatusPontoProjeto.REMOVIDO,
                forcar_recalculo_mst=False,
            )

        # 6. Executa Soft Delete COM recálculo automático da MST -> Sucesso e volta para 1 trecho!
        ponto_removido = self.store.aplicar_soft_delete_ponto(
            id_projeto=1,
            id_ponto=novo_ponto.id_ponto,
            id_usuario_autor=1,
            novo_status_ponto=StatusPontoProjeto.REMOVIDO,
            forcar_recalculo_mst=True,
        )
        self.assertEqual(ponto_removido.status_ponto, "Removido")
        proj_apos_remocao = self.store.obter_projeto(id_projeto=1, id_usuario_autor=1)
        self.assertAlmostEqual(proj_apos_remocao.metragem_total, metragem_antes, places=2)
        self.assertAlmostEqual(proj_apos_remocao.custo_estimado, custo_antes, places=2)

    def test_03_bloqueio_rbac_visualizador_no_workspace(self) -> None:
        # Usuário 2 é Visualizador na Empresa 1: pode listar projetos, mas não pode adicionar ponto
        projetos = self.store.listar_projetos(id_empresa=1, id_usuario_autor=2)
        self.assertEqual(len(projetos), 2)

        with self.assertRaises(PermissaoInsuficienteError):
            self.store.adicionar_ponto_rede(
                id_projeto=1,
                descricao="Tentativa Visualizador",
                latitude=-22.705,
                longitude=-46.985,
                id_usuario_autor=2,
            )


if __name__ == "__main__":
    unittest.main()
