"""
Controlador HTTP (FastAPI Router) para Colaboração Multi-Empresa,
Convites para Grupo/Empresa ou Projeto Específico e Troca de Empresa Ativa.
"""

from dataclasses import asdict
from typing import List
from fastapi import APIRouter, Depends, status

from backend.controllers.auth_controller import exigir_sessao_autenticada
from backend.models.schemas import (
    ConviteSchema,
    CriarConviteRequestSchema,
    EmpresaVinculadaSchema,
    LoginResponseSchema,
    MembrosEmpresaResponseSchema,
    ResponderConviteRequestSchema,
    ResponderConviteResponseSchema,
    TrocarEmpresaRequestSchema,
)
from backend.services.workspace_store import SessaoAutenticada, workspace_store

router = APIRouter(
    prefix="/api/colaboracao",
    tags=["Colaboração Multi-Empresa e Convites"],
)


@router.get(
    "/empresas",
    response_model=List[EmpresaVinculadaSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista todas as empresas/grupos vinculados ao usuário autenticado",
)
def listar_empresas_vinculadas(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> List[EmpresaVinculadaSchema]:
    itens = workspace_store.listar_empresas_usuario(
        id_usuario=sessao.id_usuario,
        id_empresa_ativa=sessao.id_empresa_padrao,
    )
    return [EmpresaVinculadaSchema(**item) for item in itens]


@router.post(
    "/trocar-empresa",
    response_model=LoginResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Alterna a empresa ativa na sessão e emite novo token JWT",
)
def trocar_empresa_ativa(
    payload: TrocarEmpresaRequestSchema,
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> LoginResponseSchema:
    nova_sessao = workspace_store.trocar_empresa_ativa(
        id_usuario=sessao.id_usuario,
        id_empresa_destino=payload.id_empresa,
    )
    return LoginResponseSchema(**asdict(nova_sessao))


@router.get(
    "/membros",
    response_model=MembrosEmpresaResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Lista os membros da empresa ativa e convidados externos em projetos",
)
def listar_membros_empresa(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> MembrosEmpresaResponseSchema:
    dados = workspace_store.listar_membros_empresa(
        id_empresa=sessao.id_empresa_padrao,
        id_usuario_autor=sessao.id_usuario,
    )
    return MembrosEmpresaResponseSchema(**dados)


@router.post(
    "/convites",
    response_model=ConviteSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Envia convite (Admin) para participar da empresa ou de um projeto específico",
)
def criar_convite(
    payload: CriarConviteRequestSchema,
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> ConviteSchema:
    convite = workspace_store.criar_convite(
        id_usuario_convidante=sessao.id_usuario,
        id_empresa=sessao.id_empresa_padrao,
        tipo_convite=payload.tipo_convite,
        email_convidado=payload.email_convidado,
        nivel_acesso=payload.nivel_acesso.value,
        id_projeto=payload.id_projeto,
        mensagem=payload.mensagem,
    )
    return ConviteSchema(**asdict(convite))


@router.get(
    "/convites/recebidos",
    response_model=List[ConviteSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista os convites recebidos pelo usuário autenticado",
)
def listar_convites_recebidos(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> List[ConviteSchema]:
    convites = workspace_store.listar_convites_recebidos(sessao.id_usuario)
    return [ConviteSchema(**asdict(c)) for c in convites]


@router.get(
    "/convites/enviados",
    response_model=List[ConviteSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista os convites enviados pela empresa ativa (apenas Administrador)",
)
def listar_convites_enviados(
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> List[ConviteSchema]:
    convites = workspace_store.listar_convites_enviados(
        id_empresa=sessao.id_empresa_padrao,
        id_usuario_autor=sessao.id_usuario,
    )
    return [ConviteSchema(**asdict(c)) for c in convites]


@router.post(
    "/convites/{id_convite}/responder",
    response_model=ResponderConviteResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Aceita ou recusa um convite recebido e retorna a sessão atualizada",
)
def responder_convite(
    id_convite: int,
    payload: ResponderConviteRequestSchema,
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> ResponderConviteResponseSchema:
    convite, nova_sessao = workspace_store.responder_convite(
        id_convite=id_convite,
        id_usuario_convidado=sessao.id_usuario,
        aceitar=payload.aceitar,
        id_empresa_ativa_atual=sessao.id_empresa_padrao,
    )
    return ResponderConviteResponseSchema(
        convite=ConviteSchema(**asdict(convite)),
        sessao=LoginResponseSchema(**asdict(nova_sessao)),
    )


@router.post(
    "/convites/{id_convite}/cancelar",
    response_model=ConviteSchema,
    status_code=status.HTTP_200_OK,
    summary="Cancela um convite pendente enviado pela empresa ativa (apenas Administrador)",
)
def cancelar_convite(
    id_convite: int,
    sessao: SessaoAutenticada = Depends(exigir_sessao_autenticada),
) -> ConviteSchema:
    convite = workspace_store.cancelar_convite(
        id_convite=id_convite,
        id_usuario_autor=sessao.id_usuario,
    )
    return ConviteSchema(**asdict(convite))
