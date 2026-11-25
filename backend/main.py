"""
Ponto de entrada da API InfraRoute (FastAPI) com tratamento global de exceções de domínio,
CORS restrito e cabeçalhos HTTP de segurança (Padrão OWASP).
"""

import os
import time
try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    pass
from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.controllers.auth_controller import exigir_sessao_autenticada, router as auth_router
from backend.controllers.projetos_controller import router as projetos_router
from backend.controllers.topologia_controller import router as topologia_router
from backend.services.exceptions import (
    InfraRouteError,
    LimiteRequisicoesExcedidoError,
    NaoAutenticadoError,
    PermissaoInsuficienteError,
    ViolacaoIntegridadeTopologicaError,
    ViolacaoMultiTenantError,
)
from backend.services.security_service import decodificar_token_acesso
from backend.services.workspace_store import SessaoAutenticada, workspace_store

app = FastAPI(
    title="InfraRoute API",
    description="API para planejamento geoespacial, governança multi-tenant e otimização de redes ópticas.",
    version="0.1.0",
)

cors_origins_env = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
)
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


_ROTAS_SEM_LOG_REQUISICAO = (
    "/api/auth/auditoria",
    "/api/auth/auditoria/stream",
    "/api/auth/auditoria/stream-ticket",
    "/api/auth/opcoes-filtro-auditoria",
    "/api/auth/me",
)


def _extrair_claims_request(request: Request):
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        raw_token = auth_header[7:].strip()
        try:
            return decodificar_token_acesso(raw_token, verificar_revogacao=False)
        except Exception:
            return None
    return None


@app.middleware("http")
async def adicionar_security_headers_e_telemetria_owasp(request: Request, call_next) -> Response:
    """
    Injeta cabeçalhos de proteção OWASP e registra telemetria HTTP (método, rota,
    status HTTP e latência em ms) no Painel de Requisições / Log_Auditoria.
    """
    caminho = str(request.url.path)
    metodo = str(request.method).upper()
    ip_cliente = request.client.host if request.client else None

    eh_stream = caminho.endswith("/auditoria/stream")
    if eh_stream:
        response: Response = await call_next(request)
    else:
        inicio = time.perf_counter()
        token_ctx = workspace_store.iniciar_contexto_http_telemetria(
            metodo_http=metodo,
            caminho_http=caminho,
            ip_origem=ip_cliente,
        )
        claims = _extrair_claims_request(request)
        registrar_fallback = (
            metodo != "OPTIONS"
            and caminho.startswith("/api/")
            and caminho not in _ROTAS_SEM_LOG_REQUISICAO
        )
        status_resp = 500
        try:
            response = await call_next(request)
            status_resp = int(response.status_code)
        finally:
            duracao_ms = round((time.perf_counter() - inicio) * 1000.0, 2)
            workspace_store.finalizar_contexto_http_telemetria(
                token_ctx,
                status_http=status_resp,
                duracao_ms=duracao_ms,
                registrar_se_vazio=registrar_fallback,
                id_usuario=claims.id_usuario if claims else None,
                email_usuario=claims.email if claims else None,
                id_empresa=claims.id_empresa if claims else None,
            )

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
    if caminho.startswith("/api/auth"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(InfraRouteError)
async def infraroute_domain_exception_handler(
    request: Request, exc: InfraRouteError
) -> JSONResponse:
    """
    Intercepta exceções de domínio (Multi-tenant, RBAC, CREA, Topologia, Rate Limit, JWT)
    e retorna payload padronizado sem vazar stack traces internos, registrando
    tentativas bloqueadas de segurança e governança em `Log_Auditoria`.
    """
    acao_bloqueio: str | None = None
    if isinstance(exc, PermissaoInsuficienteError):
        acao_bloqueio = "ACESSO_NEGADO_RBAC"
    elif isinstance(exc, ViolacaoMultiTenantError) and not request.url.path.endswith("/login"):
        acao_bloqueio = "VIOLACAO_MULTI_TENANT"
    elif isinstance(exc, ViolacaoIntegridadeTopologicaError):
        acao_bloqueio = "BLOQUEIO_INTEGRIDADE"
    elif isinstance(exc, LimiteRequisicoesExcedidoError):
        acao_bloqueio = "LIMITE_REQUISICOES"
    elif isinstance(exc, NaoAutenticadoError) and request.url.path != "/api/auth/me":
        acao_bloqueio = "AUTENTICACAO_NEGADA"

    if acao_bloqueio is not None:
        uid = None
        email = None
        emp = None
        claims = _extrair_claims_request(request)
        if claims is not None:
            uid = claims.id_usuario
            email = claims.email
            emp = claims.id_empresa
        workspace_store.registrar_evento_seguranca_bloqueio(
            acao=acao_bloqueio,
            id_usuario=uid,
            email_usuario=email,
            id_empresa=emp,
            status_http=exc.codigo_http,
            detalhes=f"{request.method} {request.url.path}: {exc}",
        )

    return JSONResponse(
        status_code=exc.codigo_http,
        content={
            "erro": exc.__class__.__name__,
            "detalhe": str(exc),
            "caminho": str(request.url.path),
        },
    )


app.include_router(auth_router)
app.include_router(projetos_router)
app.include_router(topologia_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


@app.get("/api/health/db", tags=["Health"])
def database_health_check(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
):
    """Verifica a conectividade ativa com o banco relacional SQL respeitando RBAC e Multi-Tenant."""
    return workspace_store.obter_saude_banco(id_usuario_autor=sessao.id_usuario)
