"""
Controlador HTTP (FastAPI Router) para Autenticação Corporativa, Cadastro com
Criptografia `bcrypt` e Validação de Sessão via Token JWT (`Bearer`).
"""

from dataclasses import asdict
from typing import Optional
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.schemas import (
    LoginRequestSchema,
    LoginResponseSchema,
    RegistroRequestSchema,
)
from backend.services.exceptions import NaoAutenticadoError
from backend.services.workspace_store import SessaoAutenticada, workspace_store

router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticação e Sessão Multi-Tenant"],
)

bearer_scheme = HTTPBearer(auto_error=False)


def obter_sessao_opcional(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[SessaoAutenticada]:
    """
    Se o cabeçalho `Authorization: Bearer <token>` for enviado, valida a assinatura
    HMAC-SHA256 e a expiração do token JWT.
    """
    if credenciais is None:
        return None
    if credenciais.scheme.lower() != "bearer" or not credenciais.credentials:
        raise NaoAutenticadoError("Esquema de autenticação inválido. Utilize Bearer token.")
    return workspace_store.validar_token_sessao(credenciais.credentials)


def exigir_sessao_autenticada(
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> SessaoAutenticada:
    """Exige um token JWT Bearer válido na requisição."""
    if sessao is None:
        raise NaoAutenticadoError("Autenticação obrigatória. Envie o cabeçalho Authorization: Bearer <token>.")
    return sessao


@router.post(
    "/login",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Autentica o colaborador (bcrypt) e emite token JWT assinado (HS256)",
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
    summary="Cadastra um engenheiro com senha criptografada em bcrypt e retorna sessão JWT",
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


@router.get(
    "/me",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Valida o token JWT Bearer atual e retorna os dados da sessão autenticada",
)
def obter_usuario_atual(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> LoginResponseSchema:
    return LoginResponseSchema(**asdict(sessao))
