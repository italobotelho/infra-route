"""
Controlador HTTP (FastAPI Router) para Autenticação Corporativa (`login.html`).
"""

from dataclasses import asdict
from fastapi import APIRouter, status

from backend.models.schemas import LoginRequestSchema, LoginResponseSchema
from backend.services.workspace_store import workspace_store

router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticação e Sessão Multi-Tenant"],
)


@router.post(
    "/login",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Autentica o colaborador e retorna perfil, CREA e vínculo corporativo (RBAC)",
)
def autenticar_colaborador(payload: LoginRequestSchema) -> LoginResponseSchema:
    sessao = workspace_store.autenticar_usuario(
        email=payload.email,
        senha=payload.senha,
    )
    return LoginResponseSchema(**asdict(sessao))

