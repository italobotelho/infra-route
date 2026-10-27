"""
Controlador HTTP (FastAPI Router) para Autenticação Corporativa (`login.html`).
"""

from dataclasses import asdict
from fastapi import APIRouter, status

from backend.models.schemas import (
    LoginRequestSchema,
    LoginResponseSchema,
    RegistroRequestSchema,
)
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


@router.post(
    "/register",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um engenheiro e vincula a conta à empresa de demonstração",
)
def registrar_colaborador(payload: RegistroRequestSchema) -> LoginResponseSchema:
    sessao = workspace_store.registrar_usuario(
        nome=payload.nome,
        email=payload.email,
        senha=payload.senha,
        telefone=payload.telefone,
        cpf=payload.cpf,
        crea=payload.crea,
    )
    return LoginResponseSchema(**asdict(sessao))
