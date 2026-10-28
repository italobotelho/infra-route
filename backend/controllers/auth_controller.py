"""
Controlador HTTP (FastAPI Router) para Autenticação Corporativa, Cadastro com
Criptografia `bcrypt`, Validação de Sessão via Token JWT (`Bearer`), Revogação no
Logout (`Denylist`), Verificação de E-mail via OTP e Trilha de Auditoria.
"""

from dataclasses import asdict
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.schemas import (
    EventoAuditoriaSchema,
    LoginRequestSchema,
    LoginResponseSchema,
    MensagemSegurancaResponseSchema,
    ReenviarCodigoRequestSchema,
    RegistroRequestSchema,
    VerificarEmailRequestSchema,
)
from backend.services.exceptions import NaoAutenticadoError
from backend.services.workspace_store import SessaoAutenticada, workspace_store

router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticação, Criptografia e Governança de Sessão"],
)

bearer_scheme = HTTPBearer(auto_error=False)


def obter_sessao_opcional(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[SessaoAutenticada]:
    """
    Se o cabeçalho `Authorization: Bearer <token>` for enviado, valida a assinatura
    HMAC-SHA256, a expiração e a lista de revogação (Denylist) do token JWT.
    """
    if credenciais is None:
        return None
    if credenciais.scheme.lower() != "bearer" or not credenciais.credentials:
        raise NaoAutenticadoError("Esquema de autenticação inválido. Utilize Bearer token.")
    return workspace_store.validar_token_sessao(credenciais.credentials)


def exigir_sessao_autenticada(
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> SessaoAutenticada:
    """Exige um token JWT Bearer válido e não revogado na requisição."""
    if sessao is None:
        raise NaoAutenticadoError("Autenticação obrigatória. Envie o cabeçalho Authorization: Bearer <token>.")
    return sessao


@router.post(
    "/login",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Autentica o colaborador (bcrypt + Rate Limiting) e emite token JWT assinado (HS256)",
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
    summary="Cadastra um engenheiro com senha em bcrypt, gera código OTP de e-mail e retorna sessão JWT",
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


@router.post(
    "/logout",
    response_model=MensagemSegurancaResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Revoga imediatamente o token JWT atual no servidor (Token Denylist)",
)
def encerrar_sessao(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> MensagemSegurancaResponseSchema:
    if credenciais is None or not credenciais.credentials:
        raise NaoAutenticadoError("Token Bearer não informado para logout.")
    workspace_store.revogar_token_sessao(credenciais.credentials)
    return MensagemSegurancaResponseSchema(
        mensagem="Sessão encerrada e token JWT revogado com sucesso."
    )


@router.post(
    "/verificar-email",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Valida o código OTP de 6 dígitos e confirma o e-mail corporativo do engenheiro",
)
def verificar_email(payload: VerificarEmailRequestSchema) -> LoginResponseSchema:
    sessao = workspace_store.verificar_email_usuario(
        email=payload.email,
        codigo=payload.codigo,
    )
    return LoginResponseSchema(**asdict(sessao))


@router.post(
    "/reenviar-codigo",
    response_model=MensagemSegurancaResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Gera e envia um novo código OTP de 6 dígitos para verificação de e-mail",
)
def reenviar_codigo_verificacao(
    payload: ReenviarCodigoRequestSchema,
) -> MensagemSegurancaResponseSchema:
    codigo = workspace_store.reenviar_codigo_verificacao(payload.email)
    return MensagemSegurancaResponseSchema(
        mensagem="Novo código de verificação gerado com sucesso.",
        email_verificado=False,
        codigo_verificacao_dev=codigo,
    )


@router.get(
    "/auditoria",
    response_model=List[EventoAuditoriaSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista a trilha de auditoria de segurança (Logins, Falhas, Cadastros, Logout e Verificações)",
)
def listar_trilha_auditoria(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> List[EventoAuditoriaSchema]:
    eventos = workspace_store.listar_eventos_auditoria(id_usuario_autor=sessao.id_usuario)
    return [EventoAuditoriaSchema(**asdict(ev)) for ev in eventos]
