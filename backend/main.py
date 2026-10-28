"""
Ponto de entrada da API InfraRoute (FastAPI) com tratamento global de exceções de domínio.
"""

from fastapi import FastAPI, Request
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(InfraRouteError)
async def infraroute_domain_exception_handler(
    request: Request, exc: InfraRouteError
) -> JSONResponse:
    """
    Intercepta exceções de domínio (Multi-tenant, RBAC, CREA, Topologia)
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
