"""
Ponto de entrada da API InfraRoute (FastAPI) com tratamento global de exceções de domínio,
CORS restrito e cabeçalhos HTTP de segurança (Padrão OWASP).
"""

import os
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.controllers.auth_controller import router as auth_router
from backend.controllers.projetos_controller import router as projetos_router
from backend.controllers.topologia_controller import router as topologia_router
from backend.services.exceptions import InfraRouteError

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


@app.middleware("http")
async def adicionar_security_headers_owasp(request: Request, call_next) -> Response:
    """
    Injeta cabeçalhos de proteção OWASP em todas as respostas da API.
    """
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
    if request.url.path.startswith("/api/auth"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(InfraRouteError)
async def infraroute_domain_exception_handler(
    request: Request, exc: InfraRouteError
) -> JSONResponse:
    """
    Intercepta exceções de domínio (Multi-tenant, RBAC, CREA, Topologia, Rate Limit, JWT)
    e retorna payload padronizado sem vazar stack traces internos.
    """
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
