"""
Suíte de Testes de Robustez do Backend:
- Isolamento Corporativo Multi-Tenant (Seção 2.1 e 3.4)
- Especialização Parcial e Exclusiva (p, d) de Engenheiro / CREA (Seção 2.3)
- Controle de Acesso Baseado em Papéis - RBAC (Seção 2.4)
- Governança de Exclusão Lógica (Soft Delete) e Bloqueio de Órfãos RESTRICT (Seção 3.3)
- Validação de Identificadores e Configuração de Banco (`database.py`)
"""

import unittest

from backend.database import inicializar_engine
from backend.services.exceptions import (
    PermissaoInsuficienteError,
    RecursoNaoEncontradoError,
    ValidacaoDominioError,
    ViolacaoEspecializacaoEngenheiroError,
    ViolacaoIntegridadeTopologicaError,
    ViolacaoMultiTenantError,
)
from backend.services.governanca_service import (
    Empresa,
    GovernancaMultiTenantService,
    NivelAcessoRBAC,
    ProjetoDominio,
    Usuario,
    VinculoCorporate,
)
from backend.services.prim_service import (
    PontoRede,
    StatusPontoProjeto,
    TrechoRedeMST,
)


class TestGovernancaBackendRobustez(unittest.TestCase):
    def setUp(self) -> None:
        self.empresa_a = Empresa(
            id_empresa=1,
            cnpj="12.345.678/0001-90",
            razao_social="ISP Fibra Norte S.A.",
        )
        self.empresa_b = Empresa(
            id_empresa=2,
            cnpj="98.765.432/0001-10",
            razao_social="Telecom Sul Ltda.",
        )

        # Engenheiro da Empresa A (com CREA)
        self.eng_empresa_a = Usuario(
            id_usuario=10,
            nome="Dra. Marina Engenheira",
            cpf="123.456.789-01",
            telefone="(19) 99999-1111",
            email="marina@fibranorte.com.br",
            crea="SP-50607080",
        )
        # Engenheiro da Empresa B (com CREA, mas de outro tenant)
        self.eng_empresa_b = Usuario(
            id_usuario=20,
            nome="Dr. Carlos Engenheiro",
            cpf="234.567.890-12",
            telefone="(11) 98888-2222",
            email="carlos@telecomsul.com.br",
            crea="SP-10203040",
        )
        # Analista administrativo da Empresa A (SEM CREA - não é Engenheiro)
        self.admin_sem_crea_a = Usuario(
            id_usuario=30,
            nome="Roberto Diretor",
            cpf="345.678.901-23",
            telefone="(19) 97777-3333",
            email="roberto@fibranorte.com.br",
            crea=None,
        )
        # Visualizador da Empresa A (com CREA, mas papel apenas de leitura)
        self.visualizador_a = Usuario(
            id_usuario=40,
            nome="Lucas Auditor",
            cpf="456.789.012-34",
            telefone="(19) 96666-4444",
            email="lucas@fibranorte.com.br",
            crea="SP-99887766",
        )

        self.vinculos = [
            VinculoCorporate(10, 1, NivelAcessoRBAC.PROJETISTA),
            VinculoCorporate(20, 2, NivelAcessoRBAC.ADMINISTRADOR),
            VinculoCorporate(30, 1, NivelAcessoRBAC.ADMINISTRADOR),
            VinculoCorporate(40, 1, NivelAcessoRBAC.VISUALIZADOR),
        ]

        self.governanca = GovernancaMultiTenantService(
            empresas=[self.empresa_a, self.empresa_b],
            usuarios=[
                self.eng_empresa_a,
                self.eng_empresa_b,
                self.admin_sem_crea_a,
                self.visualizador_a,
            ],
            vinculos=self.vinculos,
        )

    def test_01_criacao_projeto_valida_triangulo_multi_tenant(self) -> None:
        """
        Cenário legítimo: Administrador da Empresa A cria um projeto para a Empresa A
        assinado por uma Engenheira habilitada e vinculada à Empresa A.
        """
        projeto = ProjetoDominio(
            id_projeto=100,
            nome="Expansão Backbone Campinas",
            id_empresa=1,
            id_engenheiro=10,
        )
        validado = self.governanca.validar_criacao_projeto(
            id_usuario_autor=30, projeto=projeto
        )
        self.assertEqual(validado.id_projeto, 100)

    def test_02_bloqueio_dependencia_triangular_engenheiro_de_outra_empresa(self) -> None:
        """
        Seção 3.4 da Documentação:
        Bloqueia tentativa de criar o 'Projeto X' na Empresa A assinado por um
        Engenheiro pertencente apenas à Empresa B.
        """
        projeto_cruzado = ProjetoDominio(
            id_projeto=101,
            nome="Projeto Invasão Cross-Tenant",
            id_empresa=1,
            id_engenheiro=20,  # Engenheiro da Empresa B!
        )
        with self.assertRaises(ViolacaoMultiTenantError) as ctx:
            self.governanca.validar_criacao_projeto(
                id_usuario_autor=30, projeto=projeto_cruzado
            )
        self.assertEqual(ctx.exception.codigo_http, 403)

    def test_03_bloqueio_autor_sem_vinculo_com_empresa(self) -> None:
        """
        Impede que o usuário da Empresa B dispare a criação ou leitura de projetos
        na Empresa A.
        """
        projeto = ProjetoDominio(
            id_projeto=102,
            nome="Projeto Empresa A",
            id_empresa=1,
            id_engenheiro=10,
        )
        with self.assertRaises(ViolacaoMultiTenantError):
            self.governanca.validar_criacao_projeto(
                id_usuario_autor=20,  # Usuário da Empresa B tentando operar na Empresa A
                projeto=projeto,
            )

    def test_04_bloqueio_especializacao_usuario_sem_crea_assinando_projeto(self) -> None:
        """
        Seção 2.3 da Documentação (Especialização Parcial e Exclusiva p, d):
        Mesmo sendo Administrador da Empresa A, um Usuario comum sem registro CREA
        na subentidade Engenheiro NÃO pode ser responsável técnico por um Projeto.
        """
        projeto_sem_crea = ProjetoDominio(
            id_projeto=103,
            nome="Projeto Sem Engenheiro Habilitado",
            id_empresa=1,
            id_engenheiro=30,  # Roberto é Administrador na Empresa A, mas não tem CREA!
        )
        with self.assertRaises(ViolacaoEspecializacaoEngenheiroError) as ctx:
            self.governanca.validar_criacao_projeto(
                id_usuario_autor=30, projeto=projeto_sem_crea
            )
        self.assertEqual(ctx.exception.codigo_http, 422)

    def test_05_bloqueio_rbac_visualizador_tentando_escrever(self) -> None:
        """
        Seção 2.4 da Documentação (RBAC):
        Um colaborador com nível 'Visualizador' pode consultar a empresa, mas é
        bloqueado (HTTP 403) ao tentar criar projetos ou alterar a malha.
        """
        # Leitura permitida:
        vinc = self.governanca.validar_acesso_tenant(
            id_usuario=40, id_empresa=1, exigir_escrita=False
        )
        self.assertEqual(vinc.nivel_acesso, NivelAcessoRBAC.VISUALIZADOR)

        # Escrita bloqueada:
        projeto = ProjetoDominio(
            id_projeto=104,
            nome="Tentativa de Escrita por Visualizador",
            id_empresa=1,
            id_engenheiro=10,
        )
        with self.assertRaises(PermissaoInsuficienteError) as ctx:
            self.governanca.validar_criacao_projeto(
                id_usuario_autor=40, projeto=projeto
            )
        self.assertEqual(ctx.exception.codigo_http, 403)

    def test_06_soft_delete_e_protecao_contra_orfaos_restrict(self) -> None:
        """
        Seção 3.3 e Modelo Físico (ON DELETE RESTRICT):
        - Tentar remover logicamente um Ponto_Rede que ainda ancora um Trecho_Rede ativo
          deve disparar `ViolacaoIntegridadeTopologicaError` (HTTP 409).
        - Quando não há trechos dependentes (ou com recálculo topológico autorizado),
          realiza o Soft Delete alterando `status_ponto` sem apagar o registro histórico.
        """
        projeto = ProjetoDominio(1, "Malha Centro", id_empresa=1, id_engenheiro=10)
        ponto_ancora = PontoRede(101, "Poste #101", -22.70, -46.98)
        trecho_ativo = TrechoRedeMST(
            id_trecho=1,
            origem_id=101,
            origem_descricao="Poste #101",
            destino_id=102,
            destino_descricao="Poste #102",
            id_projeto=1,
            id_tipo_cabo=1,
            modelo_cabo="Fibra AS-80 12FO",
            distancia_metros=120.5,
            custo_trecho=542.25,
            geometria_wkt="SRID=4326;LINESTRING(-46.98 -22.7, -46.981 -22.701)",
        )

        # 1. Bloqueia remoção enquanto o trecho ativo depender do poste
        with self.assertRaises(ViolacaoIntegridadeTopologicaError) as ctx:
            self.governanca.aplicar_soft_delete_ponto_no_projeto(
                id_usuario_autor=10,
                projeto=projeto,
                ponto=ponto_ancora,
                trechos_ativos=[trecho_ativo],
                novo_status_ponto=StatusPontoProjeto.REMOVIDO,
                forcar_cascata_topologica=False,
            )
        self.assertEqual(ctx.exception.codigo_http, 409)

        # 2. Permite Soft Delete quando os trechos são recalculados ou não dependem do poste
        ponto_inativado = self.governanca.aplicar_soft_delete_ponto_no_projeto(
            id_usuario_autor=10,
            projeto=projeto,
            ponto=ponto_ancora,
            trechos_ativos=[],
            novo_status_ponto=StatusPontoProjeto.REMOVIDO,
        )
        self.assertEqual(ponto_inativado.status_ponto, StatusPontoProjeto.REMOVIDO.value)
        self.assertEqual(ponto_inativado.id_ponto, 101)

    def test_07_validacoes_de_dominio_cnpj_cpf_email_duplicidades(self) -> None:
        """
        Garante bloqueio contra CNPJ/CPF inválidos ou repetidos ('111.111.111-11'),
        CREA em branco ou duplicado e URLs de banco inválidas.
        """
        with self.assertRaises(ValidacaoDominioError):
            Empresa(1, "00.000.000/0000-00", "CNPJ Zerado")

        with self.assertRaises(ValidacaoDominioError):
            Usuario(1, "Teste", "111.111.111-11", "199999", "email@valido.com")

        with self.assertRaises(ValidacaoDominioError):
            Usuario(1, "Teste", "123.456.789-01", "199999", "email_sem_arroba")

        with self.assertRaises(ValidacaoDominioError):
            Usuario(1, "Teste", "123.456.789-01", "199999", "a@b.com", crea="   ")

        # Duplicidade de CREA entre engenheiros diferentes
        with self.assertRaises(ValidacaoDominioError):
            GovernancaMultiTenantService(
                empresas=[self.empresa_a],
                usuarios=[
                    self.eng_empresa_a,
                    Usuario(
                        id_usuario=99,
                        nome="Clone CREA",
                        cpf="999.888.777-66",
                        telefone="19999",
                        email="clone@fibranorte.com.br",
                        crea="SP-50607080",  # Mesmo CREA da Dra. Marina
                    ),
                ],
                vinculos=[],
            )

        # Validação de esquema de conexão em database.py
        with self.assertRaises(ValueError):
            inicializar_engine("mysql://usuario:senha@localhost/db_incompativel")


if __name__ == "__main__":
    unittest.main()

