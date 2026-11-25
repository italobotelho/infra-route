"""
Controlador HTTP (FastAPI Router) para Gestão de Projetos, Catálogos 3FN,
Cadastro de Pontos de Rede (`Ponto_Rede`) e Exclusão Lógica (`Soft Delete`).
"""

from dataclasses import asdict
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from backend.controllers.auth_controller import obter_sessao_opcional
from backend.models.schemas import (
    AtualizarCoordenadasPontoRequestSchema,
    AtualizarProjetoRequestSchema,
    AtualizarStatusProjetoRequestSchema,
    CatalogosResponseSchema,
    CriarPontoRedeRequestSchema,
    CriarProjetoRequestSchema,
    CriarTipoCaboRequestSchema,
    PontoRedeSchema,
    ProjetoDetalhadoSchema,
    ProjetoResumoSchema,
    ResultadoMSTProjetoSchema,
    SoftDeletePontoRequestSchema,
    TipoCaboSchema,
    VizinhoAdjacenciaSchema,
)
from backend.services.exceptions import PermissaoInsuficienteError
from backend.services.prim_service import StatusPontoProjeto
from backend.services.workspace_store import SessaoAutenticada, workspace_store

router = APIRouter(
    prefix="/api",
    tags=["Projetos, Ativos (Ponto_Rede) e Governança"],
)


def _resolver_autor_query(
    sessao: Optional[SessaoAutenticada],
    id_usuario_query: Optional[int],
) -> int:
    if sessao is not None:
        if id_usuario_query is not None and id_usuario_query != sessao.id_usuario:
            raise PermissaoInsuficienteError(
                "Anti-Spoofing: o id_usuario_autor informado na query diverge da sessão JWT."
            )
        return sessao.id_usuario
    return id_usuario_query if id_usuario_query is not None else 1


def _resolver_autor_payload(
    sessao: Optional[SessaoAutenticada],
    payload: object,
) -> int:
    if sessao is not None:
        fields_set = getattr(payload, "model_fields_set", set())
        uid_payload = getattr(payload, "id_usuario_autor", sessao.id_usuario)
        if "id_usuario_autor" in fields_set and uid_payload != sessao.id_usuario:
            raise PermissaoInsuficienteError(
                "Anti-Spoofing: o id_usuario_autor do payload diverge da sessão JWT."
            )
        return sessao.id_usuario
    return int(getattr(payload, "id_usuario_autor", 1))


def _montar_projeto_resumo(projeto) -> ProjetoResumoSchema:
    engenheiro = workspace_store.usuarios.get(projeto.id_engenheiro)
    return ProjetoResumoSchema(
        **asdict(projeto),
        engenheiro_nome=engenheiro.nome if engenheiro else None,
        engenheiro_crea=engenheiro.crea if engenheiro else None,
    )


@router.get(
    "/catalogos",
    response_model=CatalogosResponseSchema,
    status_code=status.HTTP_200_OK,
    summary="Retorna os catálogos em 3FN de Tipo_Equipamento e Tipo_Cabo",
)
def listar_catalogos() -> CatalogosResponseSchema:
    return CatalogosResponseSchema(
        catalogo_equipamentos=[
            asdict(eq) for eq in workspace_store.catalogo_equipamentos.values()
        ],
        catalogo_cabos=[
            asdict(cb) for cb in workspace_store.catalogo_cabos.values()
        ],
    )


@router.post(
    "/catalogos/cabos",
    response_model=TipoCaboSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um novo modelo de cabo óptico na tabela normalizada Tipo_Cabo (Administrador)",
)
def cadastrar_cabo_catalogo(
    payload: CriarTipoCaboRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> TipoCaboSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    novo_cabo = workspace_store.cadastrar_tipo_cabo(
        descricao_modelo=payload.descricao_modelo,
        custo_por_metro=payload.custo_por_metro,
        limite_distancia_metros=payload.limite_distancia_metros,
        id_usuario_autor=autor_id,
    )
    return TipoCaboSchema(**asdict(novo_cabo))


@router.get(
    "/projetos",
    response_model=List[ProjetoResumoSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista os projetos da empresa ativa com métricas memoizadas O(1)",
)
def listar_projetos(
    id_empresa: int = Query(default=0, ge=0),
    id_usuario_autor: Optional[int] = Query(default=None, gt=0),
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> List[ProjetoResumoSchema]:
    autor_id = _resolver_autor_query(sessao, id_usuario_autor)
    empresa_alvo = id_empresa
    if empresa_alvo == 0 and sessao is not None:
        eh_sa = workspace_store.governanca.usuario_eh_super_admin(sessao.id_usuario)
        empresa_alvo = 0 if eh_sa else sessao.id_empresa_padrao
    elif empresa_alvo == 0:
        empresa_alvo = 1
    projetos = workspace_store.listar_projetos(
        id_empresa=empresa_alvo,
        id_usuario_autor=autor_id,
    )
    return [_montar_projeto_resumo(p) for p in projetos]


@router.post(
    "/projetos",
    response_model=ProjetoResumoSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um novo projeto validando Triângulo Multi-Tenant, CREA e RBAC",
)
def criar_projeto(
    payload: CriarProjetoRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> ProjetoResumoSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    projeto = workspace_store.criar_projeto(
        nome=payload.nome,
        id_empresa=payload.id_empresa,
        id_engenheiro=payload.id_engenheiro,
        id_usuario_autor=autor_id,
    )
    return _montar_projeto_resumo(projeto)


@router.patch(
    "/projetos/{id_projeto}",
    response_model=ProjetoResumoSchema,
    status_code=status.HTTP_200_OK,
    summary="Renomeia o projeto respeitando isolamento Multi-Tenant, RBAC e trava de imutabilidade",
)
def atualizar_projeto(
    id_projeto: int,
    payload: AtualizarProjetoRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> ProjetoResumoSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    projeto = workspace_store.renomear_projeto(
        id_projeto=id_projeto,
        novo_nome=payload.nome,
        id_usuario_autor=autor_id,
    )
    return _montar_projeto_resumo(projeto)


@router.patch(
    "/projetos/{id_projeto}/status",
    response_model=ProjetoResumoSchema,
    status_code=status.HTTP_200_OK,
    summary="Atualiza o status do ciclo de vida do projeto (Em Planejamento, Em Execução, Concluído, Cancelado)",
)
def atualizar_status_projeto(
    id_projeto: int,
    payload: AtualizarStatusProjetoRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> ProjetoResumoSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    projeto = workspace_store.atualizar_status_projeto(
        id_projeto=id_projeto,
        novo_status=payload.novo_status.value,
        id_usuario_autor=autor_id,
    )
    return _montar_projeto_resumo(projeto)


@router.get(
    "/projetos/{id_projeto}",
    response_model=ProjetoDetalhadoSchema,
    status_code=status.HTTP_200_OK,
    summary="Obtém os detalhes do projeto, nós cadastrados e trechos calculados da MST",
)
def obter_projeto_detalhado(
    id_projeto: int,
    id_usuario_autor: Optional[int] = Query(default=None, gt=0),
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> ProjetoDetalhadoSchema:
    autor_id = _resolver_autor_query(sessao, id_usuario_autor)
    projeto = workspace_store.obter_projeto(
        id_projeto=id_projeto,
        id_usuario_autor=autor_id,
    )
    engenheiro = workspace_store.usuarios.get(projeto.id_engenheiro)
    pontos = workspace_store.pontos_por_projeto.get(id_projeto, [])
    trechos = workspace_store.trechos_por_projeto.get(id_projeto, [])

    return ProjetoDetalhadoSchema(
        **asdict(projeto),
        engenheiro_nome=engenheiro.nome if engenheiro else None,
        engenheiro_crea=engenheiro.crea if engenheiro else None,
        pontos=[asdict(pt) for pt in pontos],
        trechos=[asdict(tr) for tr in trechos],
    )


@router.post(
    "/projetos/{id_projeto}/pontos",
    response_model=PontoRedeSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Registra um novo Ponto_Rede (nó) no escopo do projeto",
)
def adicionar_ponto_rede(
    id_projeto: int,
    payload: CriarPontoRedeRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> PontoRedeSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    novo_ponto = workspace_store.adicionar_ponto_rede(
        id_projeto=id_projeto,
        descricao=payload.descricao,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status_fisico=payload.status_fisico.value,
        id_tipo_equipamento=payload.id_tipo_equipamento,
        id_usuario_autor=autor_id,
    )
    return PontoRedeSchema(**asdict(novo_ponto))


@router.patch(
    "/projetos/{id_projeto}/pontos/{id_ponto}",
    response_model=PontoRedeSchema,
    status_code=status.HTTP_200_OK,
    summary="Atualiza atributos de um Ponto_Rede (coordenadas, descrição, status físico ou equipamento)",
)
def atualizar_coordenadas_ponto(
    id_projeto: int,
    id_ponto: int,
    payload: AtualizarCoordenadasPontoRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> PontoRedeSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    ponto_atualizado = workspace_store.atualizar_ponto_rede(
        id_projeto=id_projeto,
        id_ponto=id_ponto,
        latitude=payload.latitude,
        longitude=payload.longitude,
        descricao=payload.descricao,
        status_fisico=payload.status_fisico.value if payload.status_fisico else None,
        id_tipo_equipamento=payload.id_tipo_equipamento,
        atualizar_tipo_equipamento=payload.atualizar_tipo_equipamento,
        id_usuario_autor=autor_id,
    )
    return PontoRedeSchema(**asdict(ponto_atualizado))


@router.post(
    "/projetos/{id_projeto}/calcular-mst",
    response_model=ResultadoMSTProjetoSchema,
    status_code=status.HTTP_200_OK,
    summary="Executa o Algoritmo de Prim sobre os pontos armazenados no projeto e atualiza Memoização",
)
def recalcular_mst_do_projeto_armazenado(
    id_projeto: int,
    id_usuario_autor: Optional[int] = Query(default=None, gt=0),
    no_inicial_id: Optional[int] = Query(default=None, gt=0),
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> ResultadoMSTProjetoSchema:
    autor_id = _resolver_autor_query(sessao, id_usuario_autor)
    resultado = workspace_store.recalcular_mst_projeto(
        id_projeto=id_projeto,
        id_usuario_autor=autor_id,
        no_inicial_id=no_inicial_id,
    )
    return ResultadoMSTProjetoSchema(
        id_projeto=resultado.id_projeto,
        nos_ativos_processados=resultado.nos_ativos_processados,
        grafo_conexo=resultado.grafo_conexo,
        metragem_total=resultado.metragem_total,
        custo_estimado=resultado.custo_estimado,
        custo_total_cabos=resultado.custo_total_cabos,
        custo_total_equipamentos=resultado.custo_total_equipamentos,
        trechos_mst=[asdict(t) for t in resultado.trechos_mst],
        lista_adjacencia={
            id_no: [
                VizinhoAdjacenciaSchema(
                    destino_id=a.destino_id,
                    distancia_metros=a.distancia_metros,
                    id_tipo_cabo=a.id_tipo_cabo,
                    descricao_cabo=a.modelo_cabo,
                    custo_trecho=a.custo_trecho,
                )
                for a in adjs
            ]
            for id_no, adjs in resultado.lista_adjacencia.items()
        },
        metragem_malha_candidata=resultado.metragem_malha_candidata,
        economia_percentual=resultado.economia_percentual,
    )


@router.patch(
    "/projetos/{id_projeto}/pontos/{id_ponto}/soft-delete",
    response_model=PontoRedeSchema,
    status_code=status.HTTP_200_OK,
    summary="Inativa ou remove logicamente um Ponto_Rede no projeto (Soft Delete com trava RESTRICT)",
)
def inativar_ponto_no_projeto(
    id_projeto: int,
    id_ponto: int,
    payload: SoftDeletePontoRequestSchema,
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> PontoRedeSchema:
    autor_id = _resolver_autor_payload(sessao, payload)
    ponto_atualizado = workspace_store.aplicar_soft_delete_ponto(
        id_projeto=id_projeto,
        id_ponto=id_ponto,
        id_usuario_autor=autor_id,
        novo_status_ponto=StatusPontoProjeto(payload.novo_status_ponto.value),
        forcar_recalculo_mst=payload.forcar_recalculo_mst,
    )
    return PontoRedeSchema(**asdict(ponto_atualizado))
