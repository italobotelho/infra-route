"""
Testes de Integração SQL, POO (`DatabaseManagerBase`), Integridade Referencial
e CRUD Completo (4ª Entrega — Bancos de Dados Relacionais + Programação Web).
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sqlite3
import tempfile
import unittest

from backend.controllers.projetos_controller import _montar_projeto_resumo
from backend.database_manager import (
    DatabaseManagerBase,
    PostgresDatabaseManager,
    SQLiteDatabaseManager,
    criar_database_manager,
)
from backend.repositories.sql_repository import InfraRouteSQLRepository
from backend.services.exceptions import (
    PermissaoInsuficienteError,
    ViolacaoIntegridadeTopologicaError,
)
from backend.services.prim_service import StatusFisicoPonto, StatusPontoProjeto
from backend.services.workspace_store import WorkspaceStoreService


class TestDatabaseSQLIntegracao(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self._tmpdir.name) / "test_infraroute.db")
        self.db_manager = SQLiteDatabaseManager(db_path=self.db_path)
        self.repo = InfraRouteSQLRepository(db_manager=self.db_manager)
        self.store = WorkspaceStoreService(
            persistir_arquivo=False,
            persistir_banco=True,
            sql_repo=self.repo,
        )

    def tearDown(self) -> None:
        self._tmpdir.cleanup()

    def test_01_poo_heranca_polimorfismo_e_transacao_acid(self) -> None:
        self.assertIsInstance(self.db_manager, DatabaseManagerBase)
        pg_mgr = PostgresDatabaseManager(
            database_url="postgresql+psycopg2://postgres:segredo_oculto@localhost:5432/infraroute"
        )
        self.assertIsInstance(pg_mgr, DatabaseManagerBase)
        self.assertEqual(pg_mgr.motor, "postgresql")
        self.assertIn("PostgresDatabaseManager", str(pg_mgr))
        self.assertNotIn("segredo_oculto", str(pg_mgr))
        self.assertIn("SQLiteDatabaseManager", str(self.db_manager))
        self.assertEqual(
            self.db_manager,
            SQLiteDatabaseManager(db_path=self.db_path),
        )
        self.assertNotEqual(self.db_manager, pg_mgr)

        mgr_factory_pg = criar_database_manager(
            db_engine="postgresql",
            database_url="postgresql://postgres:postgres@localhost:5432/infraroute",
        )
        self.assertEqual(mgr_factory_pg, pg_mgr)

        with self.assertRaises(ValueError):
            criar_database_manager(db_engine="mysql")

        mgr_factory = criar_database_manager(db_engine="sqlite", sqlite_db_path=self.db_path)
        self.assertEqual(mgr_factory, self.db_manager)

        # Testa rollback automático do __exit__ quando ocorre exceção dentro do bloco with
        with self.assertRaises(RuntimeError):
            with self.db_manager as db:
                db.execute_query(
                    "INSERT INTO Empresa (ID_Empresa, CNPJ, Razao_Social) VALUES (%s, %s, %s)",
                    (99, "11.222.333/0001-44", "Empresa Rollback Ltda"),
                )
                raise RuntimeError("Erro simulado para validar ROLLBACK ACID")

        with self.db_manager as db:
            encontrada = db.fetch_one("SELECT * FROM Empresa WHERE ID_Empresa = %s", (99,))
            self.assertIsNone(encontrada)

    def test_02_persistencia_sql_ponta_a_ponta_sobrevive_reinstanciamento(self) -> None:
        # 1. Cadastra engenheiro e confirma e-mail via OTP
        sessao = self.store.registrar_usuario(
            nome="Mariana Souza",
            email="mariana@infraroute.com.br",
            senha="SenhaForte#2026",
            telefone="(19) 99876-5432",
            cpf="321.654.987-00",
            crea="77889900",
        )
        self.store.verificar_email_usuario("mariana@infraroute.com.br", sessao.codigo_verificacao_dev)

        # 2. Cria projeto e renomeia (CRUD Create + Update)
        novo_proj = self.store.criar_projeto(
            nome="Anel Óptico Barão Geraldo",
            id_empresa=sessao.id_empresa_padrao,
            id_engenheiro=sessao.id_usuario,
            id_usuario_autor=sessao.id_usuario,
        )
        renomeado = self.store.renomear_projeto(
            id_projeto=novo_proj.id_projeto,
            novo_nome="Anel Óptico Barão Geraldo v2",
            id_usuario_autor=sessao.id_usuario,
        )
        self.assertEqual(renomeado.nome, "Anel Óptico Barão Geraldo v2")

        # 3. Adiciona 3 pontos, calcula AGM de Prim e aplica Soft Delete em 1 ponto
        p1 = self.store.adicionar_ponto_rede(
            id_projeto=novo_proj.id_projeto,
            descricao="OLT Central",
            latitude=-22.8200,
            longitude=-47.0800,
            id_tipo_equipamento=3,
            id_usuario_autor=sessao.id_usuario,
        )
        p2 = self.store.adicionar_ponto_rede(
            id_projeto=novo_proj.id_projeto,
            descricao="CTO #01",
            latitude=-22.8210,
            longitude=-47.0810,
            id_tipo_equipamento=1,
            id_usuario_autor=sessao.id_usuario,
        )
        p3 = self.store.adicionar_ponto_rede(
            id_projeto=novo_proj.id_projeto,
            descricao="Poste #02",
            latitude=-22.8220,
            longitude=-47.0820,
            id_tipo_equipamento=None,
            id_usuario_autor=sessao.id_usuario,
        )
        res_mst = self.store.recalcular_mst_projeto(
            id_projeto=novo_proj.id_projeto,
            id_usuario_autor=sessao.id_usuario,
        )
        self.assertTrue(res_mst.grafo_conexo)
        self.assertEqual(len(res_mst.trechos_mst), 2)

        self.store.aplicar_soft_delete_ponto(
            id_projeto=novo_proj.id_projeto,
            id_ponto=p3.id_ponto,
            id_usuario_autor=sessao.id_usuario,
            novo_status_ponto=StatusPontoProjeto.REMOVIDO,
            forcar_recalculo_mst=True,
        )

        # 4. Cria uma NOVA instância de repositório + store simulando reinício do servidor
        novo_repo = InfraRouteSQLRepository(db_manager=SQLiteDatabaseManager(db_path=self.db_path))
        store_reiniciado = WorkspaceStoreService(
            persistir_arquivo=False,
            persistir_banco=True,
            sql_repo=novo_repo,
        )
        proj_recuperado = store_reiniciado.obter_projeto(
            id_projeto=novo_proj.id_projeto,
            id_usuario_autor=sessao.id_usuario,
        )
        self.assertEqual(proj_recuperado.nome, "Anel Óptico Barão Geraldo v2")
        self.assertGreater(proj_recuperado.metragem_total, 0.0)
        self.assertEqual(len(store_reiniciado.trechos_por_projeto[novo_proj.id_projeto]), 1)

        pontos_salvos = store_reiniciado.pontos_por_projeto[novo_proj.id_projeto]
        status_p3 = next(pt.status_ponto for pt in pontos_salvos if pt.id_ponto == p3.id_ponto)
        self.assertEqual(status_p3, "Removido")

        # 5. Valida VIEW SQL e health summary
        saude = novo_repo.obter_resumo_saude_sql()
        self.assertEqual(saude["status"], "connected")
        self.assertGreaterEqual(saude["tabelas"]["projetos"], 3)
        self.assertTrue(any(v["Nome_Projeto"] == "Anel Óptico Barão Geraldo v2" for v in saude["vw_resumo_projetos"]))

        # Garante que projeto Concluído bloqueia renomeação (Imutabilidade Seção 3.3)
        store_reiniciado.atualizar_status_projeto(
            id_projeto=novo_proj.id_projeto,
            novo_status="Concluído",
            id_usuario_autor=sessao.id_usuario,
        )
        with self.assertRaises(ViolacaoIntegridadeTopologicaError):
            store_reiniciado.renomear_projeto(
                id_projeto=novo_proj.id_projeto,
                novo_nome="Tentativa Inválida",
                id_usuario_autor=sessao.id_usuario,
            )

    def test_03_integridade_referencial_sql_check_e_foreign_keys(self) -> None:
        # CHECK (Origem_ID <> Destino_ID) e FOREIGN KEY ON DELETE RESTRICT no banco SQL
        with self.assertRaises(sqlite3.IntegrityError):
            with self.db_manager as db:
                db.execute_query(
                    "INSERT INTO Trecho_Rede (Geometria_WKT, Distancia_Metros, Custo_Trecho, Origem_ID, Destino_ID, idProjeto, idTipo_Cabo) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    ("SRID=4326;LINESTRING(-46.98 -22.70, -46.98 -22.70)", 10.0, 45.0, 101, 101, 1, 1),
                )

        with self.assertRaises(sqlite3.IntegrityError):
            with self.db_manager as db:
                db.execute_query("DELETE FROM Ponto_Rede WHERE ID_Ponto = %s", (101,))

    def test_04_edicao_completa_ponto_restauracao_e_catalogo_cabos(self) -> None:
        ponto = self.store.adicionar_ponto_rede(
            id_projeto=1,
            descricao="Poste Provisório #1",
            latitude=-22.7060,
            longitude=-46.9860,
            id_tipo_equipamento=None,
            id_usuario_autor=1,
        )
        self.assertEqual(ponto.custo_equipamento, 0.0)

        editado = self.store.atualizar_ponto_rede(
            id_projeto=1,
            id_ponto=ponto.id_ponto,
            descricao="CTO Consolidada #1",
            status_fisico=StatusFisicoPonto.INSTALADO.value,
            id_tipo_equipamento=1,
            atualizar_tipo_equipamento=True,
            id_usuario_autor=1,
        )
        self.assertEqual(editado.descricao, "CTO Consolidada #1")
        self.assertEqual(editado.status_fisico, "Instalado")
        self.assertEqual(editado.id_tipo_equipamento, 1)
        self.assertEqual(editado.custo_equipamento, 380.0)

        removido = self.store.aplicar_soft_delete_ponto(
            id_projeto=1,
            id_ponto=ponto.id_ponto,
            id_usuario_autor=1,
            novo_status_ponto=StatusPontoProjeto.REMOVIDO,
            forcar_recalculo_mst=False,
        )
        self.assertEqual(removido.status_ponto, "Removido")

        restaurado = self.store.aplicar_soft_delete_ponto(
            id_projeto=1,
            id_ponto=ponto.id_ponto,
            id_usuario_autor=1,
            novo_status_ponto=StatusPontoProjeto.ATIVO,
            forcar_recalculo_mst=False,
        )
        self.assertEqual(restaurado.status_ponto, "Ativo")

        novo_cabo = self.store.cadastrar_tipo_cabo(
            descricao_modelo="Fibra AS-160 36FO",
            custo_por_metro=8.2,
            limite_distancia_metros=3500.0,
            id_usuario_autor=1,
        )
        self.assertEqual(novo_cabo.descricao_modelo, "Fibra AS-160 36FO")

        with self.assertRaises(PermissaoInsuficienteError):
            self.store.cadastrar_tipo_cabo(
                descricao_modelo="Cabo Não Autorizado",
                custo_por_metro=5.0,
                limite_distancia_metros=1000.0,
                id_usuario_autor=2,
            )

        resumo = _montar_projeto_resumo(self.store.obter_projeto(1, id_usuario_autor=1))
        self.assertEqual(resumo.engenheiro_nome, "Engenheiro Responsável")
        self.assertEqual(resumo.engenheiro_crea, "SP-5060708090")

        novo_repo = InfraRouteSQLRepository(db_manager=SQLiteDatabaseManager(db_path=self.db_path))
        store_reiniciado = WorkspaceStoreService(
            persistir_arquivo=False,
            persistir_banco=True,
            sql_repo=novo_repo,
        )
        ponto_sql = next(
            pt for pt in store_reiniciado.pontos_por_projeto[1] if pt.id_ponto == ponto.id_ponto
        )
        self.assertEqual(ponto_sql.descricao, "CTO Consolidada #1")
        self.assertEqual(ponto_sql.status_fisico, "Instalado")
        self.assertEqual(ponto_sql.status_ponto, "Ativo")

    def test_05_multi_perfis_auditoria_multi_tenant_e_since_id(self) -> None:
        s_admin = self.store.autenticar_usuario("engenheiro@empresa.com.br", "123456")
        s_proj = self.store.autenticar_usuario("projetista@empresa.com.br", "123456")
        s_view = self.store.autenticar_usuario("auditor@empresa.com.br", "123456")
        s_e2 = self.store.autenticar_usuario("gestor@conectasul.com.br", "123456")

        self.assertEqual(s_admin.nivel_acesso, "Administrador")
        self.assertEqual(s_proj.nivel_acesso, "Projetista")
        self.assertEqual(s_view.nivel_acesso, "Visualizador")
        self.assertEqual(s_e2.id_empresa_padrao, 2)

        # Empresa 2 enxerga apenas seu projeto isolado
        projetos_e2 = self.store.listar_projetos(id_empresa=2, id_usuario_autor=s_e2.id_usuario)
        self.assertEqual([p.nome for p in projetos_e2], ["Backbone Sul Curitiba"])

        # Projetista pode criar projeto/ponto e recalcular MST, mas é bloqueado em catálogo global
        p_proj = self.store.criar_projeto(
            nome="Projeto Ramal Marina",
            id_empresa=1,
            id_engenheiro=s_proj.id_usuario,
            id_usuario_autor=s_proj.id_usuario,
        )
        self.store.adicionar_ponto_rede(
            id_projeto=p_proj.id_projeto,
            descricao="OLT Ramal",
            latitude=-22.8800,
            longitude=-47.0500,
            id_tipo_equipamento=3,
            id_usuario_autor=s_proj.id_usuario,
        )
        self.store.adicionar_ponto_rede(
            id_projeto=p_proj.id_projeto,
            descricao="CTO Ramal",
            latitude=-22.8810,
            longitude=-47.0510,
            id_tipo_equipamento=1,
            id_usuario_autor=s_proj.id_usuario,
        )
        self.store.recalcular_mst_projeto(
            id_projeto=p_proj.id_projeto,
            id_usuario_autor=s_proj.id_usuario,
        )
        with self.assertRaises(PermissaoInsuficienteError):
            self.store.cadastrar_tipo_cabo(
                descricao_modelo="Modelo Bloqueado Projetista",
                custo_por_metro=5.0,
                limite_distancia_metros=1000.0,
                id_usuario_autor=s_proj.id_usuario,
            )

        self.store.registrar_evento_seguranca_bloqueio(
            acao="ACESSO_NEGADO_RBAC",
            id_usuario=s_proj.id_usuario,
            id_empresa=1,
            detalhes="Teste de bloqueio RBAC registrado.",
        )

        logs_e1 = self.store.listar_eventos_auditoria(id_usuario_autor=s_view.id_usuario)
        acoes_e1 = {ev.acao for ev in logs_e1}
        self.assertIn("PROJETO_CRIADO", acoes_e1)
        self.assertIn("PONTO_CRIADO", acoes_e1)
        self.assertIn("MST_CALCULADA", acoes_e1)
        self.assertIn("ACESSO_NEGADO_RBAC", acoes_e1)

        # Isolamento multi-tenant nos logs de auditoria: Empresa 2 não vê eventos da Empresa 1
        logs_e2 = self.store.listar_eventos_auditoria(id_usuario_autor=s_e2.id_usuario)
        self.assertTrue(all(ev.id_empresa in (2, None) for ev in logs_e2))
        self.assertFalse(any("Projeto Ramal Marina" in ev.detalhes for ev in logs_e2))

        # Polling incremental via since_id retorna apenas novos eventos
        ultimo_id = max(ev.id_evento for ev in logs_e1)
        self.assertEqual(
            self.store.listar_eventos_auditoria(id_usuario_autor=s_view.id_usuario, since_id=ultimo_id),
            [],
        )
        self.store.atualizar_status_projeto(
            id_projeto=p_proj.id_projeto,
            novo_status="Em Execução",
            id_usuario_autor=s_proj.id_usuario,
        )
        novos = self.store.listar_eventos_auditoria(
            id_usuario_autor=s_view.id_usuario, since_id=ultimo_id
        )
        self.assertEqual(len(novos), 1)
        self.assertEqual(novos[0].acao, "PROJETO_STATUS_ALTERADO")

    def test_06_concorrencia_multithread_sem_colisao_de_cursor(self) -> None:
        s_sa = self.store.autenticar_usuario("secops@infraroute.com.br", "123456")

        def tarefa_concorrente(indice: int) -> dict:
            if indice % 2 == 0:
                return self.store.obter_saude_banco(id_usuario_autor=s_sa.id_usuario)
            self.store.registrar_evento_seguranca_bloqueio(
                acao="TELEMETRIA_CONCORRENTE",
                id_usuario=s_sa.id_usuario,
                id_empresa=1,
                detalhes=f"Execução concorrente #{indice}",
            )
            return {"ok": True, "indice": indice}

        with ThreadPoolExecutor(max_workers=8) as pool:
            resultados = list(pool.map(tarefa_concorrente, range(32)))

        saudes = [r for r in resultados if "tabelas" in r]
        self.assertEqual(len(saudes), 16)
        self.assertTrue(all(r["status"] == "connected" for r in saudes))


if __name__ == "__main__":
    unittest.main()
