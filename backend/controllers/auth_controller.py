"""
Controlador HTTP (FastAPI Router) para Autenticação Corporativa, Cadastro com
Criptografia `bcrypt`, Validação de Sessão via Token JWT (`Bearer`), Revogação no
Logout (`Denylist`), Verificação de E-mail via OTP e Trilha de Auditoria.
"""

import asyncio
from dataclasses import asdict
import json
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.schemas import (
    EventoAuditoriaSchema,
    LoginRequestSchema,
    LoginResponseSchema,
    MensagemSegurancaResponseSchema,
    OpcoesFiltroAuditoriaSchema,
    ReenviarCodigoRequestSchema,
    RegistroRequestSchema,
    TicketStreamResponseSchema,
    VerificarEmailRequestSchema,
)
from backend.services.exceptions import NaoAutenticadoError
from backend.services.security_service import gerenciador_tickets_stream
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
    eh_producao = os.getenv("APP_ENV", "development").strip().lower() == "production"
    return MensagemSegurancaResponseSchema(
        mensagem="Novo código de verificação gerado com sucesso.",
        email_verificado=False,
        codigo_verificacao_dev=None if eh_producao else codigo,
    )


@router.get(
    "/opcoes-filtro-auditoria",
    response_model=OpcoesFiltroAuditoriaSchema,
    status_code=status.HTTP_200_OK,
    summary="Retorna empresas e funcionários visíveis para filtros do Painel de Logs (RBAC + Multi-Tenant)",
)
def obter_opcoes_filtro_auditoria(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> OpcoesFiltroAuditoriaSchema:
    dados = workspace_store.obter_opcoes_filtro_auditoria(sessao.id_usuario)
    return OpcoesFiltroAuditoriaSchema(**dados)


@router.post(
    "/auditoria/stream-ticket",
    response_model=TicketStreamResponseSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Emite ticket efêmero para conexão SSE evitando expor o JWT na URL",
)
def emitir_ticket_stream_auditoria(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> TicketStreamResponseSchema:
    workspace_store.governanca.validar_acesso_auditoria(sessao.id_usuario)
    ttl = gerenciador_tickets_stream.ttl_padrao_segundos
    ticket = gerenciador_tickets_stream.emitir_ticket(sessao.id_usuario, ttl_segundos=ttl)
    return TicketStreamResponseSchema(ticket=ticket, expira_em_segundos=ttl)


@router.get(
    "/auditoria",
    response_model=List[EventoAuditoriaSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista o Painel de Requisições e Trilha de Auditoria com filtros por empresa, funcionário e data/hora",
)
def listar_trilha_auditoria(
    since_id: int = Query(default=0, ge=0),
    limit: int = Query(default=150, ge=1, le=500),
    id_empresa: Optional[int] = Query(default=None, gt=0),
    id_usuario_filtro: Optional[int] = Query(default=None, ge=0),
    data_inicio: Optional[str] = Query(default=None),
    data_fim: Optional[str] = Query(default=None),
    severidade: Optional[str] = Query(default=None),
    metodo_http: Optional[str] = Query(default=None),
    status_familia: Optional[str] = Query(default=None),
    acao: Optional[str] = Query(default=None),
    busca: Optional[str] = Query(default=None),
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> List[EventoAuditoriaSchema]:
    eventos = workspace_store.listar_eventos_auditoria(
        id_usuario_autor=sessao.id_usuario,
        since_id=since_id,
        limit=limit,
        id_empresa_filtro=id_empresa,
        id_usuario_filtro=id_usuario_filtro,
        data_inicio_utc=data_inicio,
        data_fim_utc=data_fim,
        severidade=severidade,
        metodo_http=metodo_http,
        status_familia=status_familia,
        acao=acao,
        busca=busca,
    )
    return [EventoAuditoriaSchema(**asdict(ev)) for ev in eventos]


@router.get(
    "/auditoria/stream",
    summary="Stream Server-Sent Events (SSE) em tempo real para o Painel de Requisições e Auditoria",
)
async def stream_trilha_auditoria(
    request: Request,
    ticket: Optional[str] = Query(default=None),
    token: Optional[str] = Query(default=None),
    since_id: int = Query(default=0, ge=0),
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> StreamingResponse:
    sessao: Optional[SessaoAutenticada] = None
    if credenciais is not None and credenciais.credentials:
        sessao = workspace_store.validar_token_sessao(credenciais.credentials)
    elif ticket and ticket.strip():
        uid_ticket = gerenciador_tickets_stream.validar_ticket(ticket.strip())
        if uid_ticket is None or uid_ticket not in workspace_store.usuarios:
            raise NaoAutenticadoError("Ticket de stream SSE inválido ou expirado.")
        sessao = workspace_store._construir_sessao_usuario(workspace_store.usuarios[uid_ticket])
    elif token and token.strip():
        sessao = workspace_store.validar_token_sessao(token.strip())

    if sessao is None:
        raise NaoAutenticadoError("Autenticação obrigatória para acompanhar o stream de auditoria.")

    workspace_store.governanca.validar_acesso_auditoria(sessao.id_usuario)

    header_last_id = request.headers.get("last-event-id", "").strip()
    ultimo_id = max(since_id, int(header_last_id)) if header_last_id.isdigit() else since_id

    async def event_generator():
        nonlocal ultimo_id
        yield "retry: 2000\n\n"
        for tick in range(55):
            if await request.is_disconnected():
                break
            novos = workspace_store.listar_eventos_auditoria(
                id_usuario_autor=sessao.id_usuario,
                since_id=ultimo_id,
                limit=50,
            )
            if novos:
                for ev in reversed(novos):
                    ultimo_id = max(ultimo_id, ev.id_evento)
                    payload_json = json.dumps(asdict(ev), ensure_ascii=False)
                    yield f"id: {ev.id_evento}\nevent: audit\ndata: {payload_json}\n\n"
            elif tick % 10 == 0:
                yield ": keep-alive\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
