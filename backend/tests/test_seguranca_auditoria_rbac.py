"""
Suíte de Testes de Segurança, Controle de Acesso a Logs (RBAC / LGPD),
Telemetria HTTP, Anti-Spoofing JWT, Filtros Avançados e Padronização UTC.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import urlencode

RAIZ_PROJETO = Path(__file__).resolve().parents[2]
if str(RAIZ_PROJETO) not in sys.path:
    sys.path.insert(0, str(RAIZ_PROJETO))

from backend.main import app  # noqa: E402
from backend.services.exceptions import PermissaoInsuficienteError  # noqa: E402
from backend.services.security_service import (  # noqa: E402
    mascarar_cpf_lgpd,
    normalizar_timestamp_utc_iso,
)
from backend.services.workspace_store import WorkspaceStoreService, workspace_store  # noqa: E402


async def _executar_asgi(
    method: str,
    path: str,
    *,
    headers: dict | None = None,
    json_body: dict | None = None,
    params: dict | None = None,
) -> tuple[int, dict, object]:
    body_bytes = json.dumps(json_body).encode("utf-8") if json_body is not None else b""
    raw_headers = [(b"host", b"testserver")]
    if json_body is not None:
        raw_headers.append((b"content-type", b"application/json"))
    for k, v in (headers or {}).items():
        raw_headers.append((k.lower().encode("latin-1"), str(v).encode("latin-1")))

    query_str = urlencode(params or {})
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": query_str.encode("ascii"),
        "headers": raw_headers,
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }

    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        return {"type": "http.disconnect"}

    status_code = 500
    resp_headers = {}
    chunks = []

    async def send(message):
        nonlocal status_code
        if message["type"] == "http.response.start":
            status_code = int(message["status"])
            resp_headers.update(
                {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in message.get("headers", [])}
            )
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    await app(scope, receive, send)
    raw_body = b"".join(chunks).decode("utf-8", errors="replace")
    try:
        parsed = json.loads(raw_body) if raw_body else None
    except json.JSONDecodeError:
        parsed = raw_body
    return status_code, resp_headers, parsed


class TestSegurancaAuditoriaRBAC(unittest.TestCase):
    def setUp(self) -> None:
        workspace_store.resetar_estado_padrao()

    def _req(
        self,
        method: str,
        path: str,
        *,
        headers: dict | None = None,
        json_body: dict | None = None,
        params: dict | None = None,
    ) -> tuple[int, dict, object]:
        return asyncio.run(
            _executar_asgi(
                method,
                path,
                headers=headers,
                json_body=json_body,
                params=params,
            )
        )

    def _login(self, email: str, senha: str = "123456") -> dict:
        status, _, body = self._req(
            "POST",
            "/api/auth/login",
            json_body={"email": email, "senha": senha},
        )
        self.assertEqual(status, 200, msg=str(body))
        return body

    def test_01_projetista_bloqueado_403_no_painel_de_logs_e_auditoria_registra_tentativa(self) -> None:
        sessao_proj = self._login("projetista@empresa.com.br")
        headers_proj = {"Authorization": f"Bearer {sessao_proj['access_token']}"}

        # Projetista NÃO pode consultar logs, opções de filtro, ticket SSE ou saúde SQL
        st_logs, _, body_logs = self._req("GET", "/api/auth/auditoria", headers=headers_proj)
        self.assertEqual(st_logs, 403)
        self.assertEqual(body_logs["erro"], "PermissaoInsuficienteError")

        st_opcoes, _, _ = self._req("GET", "/api/auth/opcoes-filtro-auditoria", headers=headers_proj)
        self.assertEqual(st_opcoes, 403)

        st_ticket, _, _ = self._req("POST", "/api/auth/auditoria/stream-ticket", headers=headers_proj)
        self.assertEqual(st_ticket, 403)

        st_health, _, _ = self._req("GET", "/api/health/db", headers=headers_proj)
        self.assertEqual(st_health, 403)

        store = WorkspaceStoreService(persistir_arquivo=False, persistir_banco=False)
        with self.assertRaises(PermissaoInsuficienteError):
            store.listar_eventos_auditoria(id_usuario_autor=3)

        # Admin da mesma empresa (E1) vê o bloqueio ACESSO_NEGADO_RBAC gerado pelo Projetista
        sessao_admin = self._login("engenheiro@empresa.com.br")
        st_adm, _, eventos_alerta = self._req(
            "GET",
            "/api/auth/auditoria",
            params={"severidade": "ALERTA"},
            headers={"Authorization": f"Bearer {sessao_admin['access_token']}"},
        )
        self.assertEqual(st_adm, 200)
        self.assertTrue(
            any(
                ev["acao"] == "ACESSO_NEGADO_RBAC"
                and ev["id_usuario"] == sessao_proj["id_usuario"]
                and ev["status_http"] == 403
                for ev in eventos_alerta
            )
        )

    def test_02_superadmin_visao_global_e_segregacao_de_funcoes_somente_leitura(self) -> None:
        self._login("engenheiro@empresa.com.br")
        self._login("gestor@conectasul.com.br")
        st_fail, _, _ = self._req(
            "POST",
            "/api/auth/login",
            json_body={"email": "desconhecido@externo.com.br", "senha": "errada"},
        )
        self.assertEqual(st_fail, 403)

        sessao_sa = self._login("secops@infraroute.com.br")
        self.assertEqual(sessao_sa["nivel_acesso"], "SuperAdmin")
        headers_sa = {"Authorization": f"Bearer {sessao_sa['access_token']}"}

        st_op, _, opcoes = self._req("GET", "/api/auth/opcoes-filtro-auditoria", headers=headers_sa)
        self.assertEqual(st_op, 200)
        self.assertTrue(opcoes["escopo_global"])
        self.assertEqual(len(opcoes["empresas"]), 2)

        # SuperAdmin enxerga eventos de E1, E2 e órfãos (id_empresa=None)
        st_all, _, todos = self._req(
            "GET", "/api/auth/auditoria", params={"limit": 200}, headers=headers_sa
        )
        self.assertEqual(st_all, 200)
        empresas_nos_logs = {ev["id_empresa"] for ev in todos}
        self.assertIn(1, empresas_nos_logs)
        self.assertIn(2, empresas_nos_logs)
        self.assertIn(None, empresas_nos_logs)

        # Filtro por Empresa 2
        st_e2, _, logs_e2 = self._req(
            "GET", "/api/auth/auditoria", params={"id_empresa": 2}, headers=headers_sa
        )
        self.assertEqual(st_e2, 200)
        self.assertTrue(len(logs_e2) >= 1)
        self.assertTrue(all(ev["id_empresa"] == 2 for ev in logs_e2))

        # Filtro por Funcionário (Gestor ConectaSul id=4)
        st_fn, _, logs_fn = self._req(
            "GET", "/api/auth/auditoria", params={"id_usuario_filtro": 4}, headers=headers_sa
        )
        self.assertEqual(st_fn, 200)
        self.assertTrue(all(ev["id_usuario"] == 4 for ev in logs_fn))

        # Segregação de Funções: SuperAdmin não pode criar projetos em cliente
        st_mut, _, _ = self._req(
            "POST",
            "/api/projetos",
            headers=headers_sa,
            json_body={"nome": "Projeto Indevido", "id_empresa": 1, "id_engenheiro": 1},
        )
        self.assertEqual(st_mut, 403)

    def test_03_isolamento_estrito_tenant_nos_logs_sem_vazar_orfaos_ou_outra_empresa(self) -> None:
        self._login("gestor@conectasul.com.br")
        self._req(
            "POST",
            "/api/auth/login",
            json_body={"email": "desconhecido@invasor.com.br", "senha": "errada"},
        )

        sessao_e1_view = self._login("auditor@empresa.com.br")
        headers_e1 = {"Authorization": f"Bearer {sessao_e1_view['access_token']}"}

        st_e1, _, logs_e1 = self._req(
            "GET", "/api/auth/auditoria", params={"limit": 200}, headers=headers_e1
        )
        self.assertEqual(st_e1, 200)
        self.assertTrue(len(logs_e1) >= 1)
        self.assertTrue(all(ev["id_empresa"] == 1 for ev in logs_e1))

        # Tentar filtrar explicitamente Empresa 2 gera 403 ViolacaoMultiTenantError
        st_cross, _, body_cross = self._req(
            "GET", "/api/auth/auditoria", params={"id_empresa": 2}, headers=headers_e1
        )
        self.assertEqual(st_cross, 403)
        self.assertEqual(body_cross["erro"], "ViolacaoMultiTenantError")

    def test_04_filtro_por_data_hora_utc_e_normalizacao_timestamps(self) -> None:
        ts_sqlite = normalizar_timestamp_utc_iso("2026-11-25 15:00:00")
        self.assertEqual(ts_sqlite, "2026-11-25T15:00:00+00:00")
        self.assertEqual(mascarar_cpf_lgpd("123.456.789-00"), "***.456.789-**")

        sessao_admin = self._login("engenheiro@empresa.com.br")
        headers_admin = {"Authorization": f"Bearer {sessao_admin['access_token']}"}

        agora = datetime.now(timezone.utc)
        inicio_ok = (agora - timedelta(minutes=5)).isoformat()
        fim_ok = (agora + timedelta(minutes=5)).isoformat()

        st_j, _, logs_j = self._req(
            "GET",
            "/api/auth/auditoria",
            params={"data_inicio": inicio_ok, "data_fim": fim_ok},
            headers=headers_admin,
        )
        self.assertEqual(st_j, 200)
        self.assertTrue(len(logs_j) >= 1)

        st_p, _, logs_p = self._req(
            "GET",
            "/api/auth/auditoria",
            params={
                "data_inicio": "2020-01-01T00:00:00+00:00",
                "data_fim": "2020-01-02T00:00:00+00:00",
            },
            headers=headers_admin,
        )
        self.assertEqual(st_p, 200)
        self.assertEqual(logs_p, [])

    def test_05_anti_spoofing_jwt_health_db_protegido_e_ticket_sse(self) -> None:
        st_unauth, _, _ = self._req("GET", "/api/health/db")
        self.assertEqual(st_unauth, 401)

        st_pub, _, body_pub = self._req("GET", "/health")
        self.assertEqual(st_pub, 200)
        self.assertEqual(body_pub, {"status": "ok"})

        sessao_e2 = self._login("gestor@conectasul.com.br")
        headers_e2 = {"Authorization": f"Bearer {sessao_e2['access_token']}"}
        st_h2, _, dados_health = self._req("GET", "/api/health/db", headers=headers_e2)
        self.assertEqual(st_h2, 200)
        self.assertEqual(dados_health["escopo_tenant"], 2)
        self.assertTrue(
            all(row["ID_Empresa"] == 2 for row in dados_health.get("vw_resumo_projetos", []))
        )

        # Anti-Spoofing: Projetista (id=3) tentando passar id_usuario_autor=1 é barrado com 403
        sessao_proj = self._login("projetista@empresa.com.br")
        headers_proj = {"Authorization": f"Bearer {sessao_proj['access_token']}"}
        st_spoof, _, _ = self._req(
            "POST",
            "/api/catalogos/cabos",
            headers=headers_proj,
            json_body={
                "descricao_modelo": "Cabo Spoof",
                "custo_por_metro": 4.0,
                "limite_distancia_metros": 1000,
                "id_usuario_autor": 1,
            },
        )
        self.assertEqual(st_spoof, 403)

        # Ticket efêmero SSE funciona para Admin sem precisar expor JWT na URL
        sessao_e1 = self._login("engenheiro@empresa.com.br")
        headers_e1 = {"Authorization": f"Bearer {sessao_e1['access_token']}"}
        st_tk, _, body_tk = self._req(
            "POST", "/api/auth/auditoria/stream-ticket", headers=headers_e1
        )
        self.assertEqual(st_tk, 201)
        self.assertTrue(len(body_tk["ticket"]) >= 16)

        # Telemetria HTTP registrada nas rotas autenticadas (GET /api/projetos)
        st_list, _, _ = self._req("GET", "/api/projetos", headers=headers_e1)
        self.assertEqual(st_list, 200)
        st_logs, _, logs_get = self._req(
            "GET", "/api/auth/auditoria", params={"metodo_http": "GET"}, headers=headers_e1
        )
        self.assertEqual(st_logs, 200)
        self.assertTrue(
            any(
                ev["caminho_http"] == "/api/projetos" and ev["status_http"] == 200
                for ev in logs_get
            )
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
