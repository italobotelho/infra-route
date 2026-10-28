"""
Controlador HTTP (FastAPI Router) para Gestão de Projetos, Catálogos 3FN,
Cadastro de Pontos de Rede (`Ponto_Rede`) e Exclusão Lógica (`Soft Delete`).
"""

from dataclasses import asdict
from typing import List, Optional
from fastapi import APIRouter, Query, status

from backend.models.schemas import (
    AtualizarCoordenadasPontoRequestSchema,
    CatalogosResponseSchema,
    CriarPontoRedeRequestSchema,
    CriarProjetoRequestSchema,
    PontoRedeSchema,
    ProjetoDetalhadoSchema,
    ProjetoResumoSchema,
    ResultadoMSTProjetoSchema,
    SoftDeletePontoRequestSchema,
    VizinhoAdjacenciaSchema,
)
from backend.services.prim_service import StatusPontoProjeto
from backend.services.workspace_store import workspace_store

router = APIRouter(
    prefix="/api",
    tags=["Projetos, Ativos (Ponto_Rede) e Governança"],
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


@router.get(
    "/projetos",
    response_model=List[ProjetoResumoSchema],
    status_code=status.HTTP_200_OK,
    summary="Lista os projetos da empresa ativa com métricas memoizadas O(1)",
)
def listar_projetos(
    id_empresa: int = Query(default=1, gt=0),
    id_usuario_autor: int = Query(default=1, gt=0),
) -> List[ProjetoResumoSchema]:
    projetos = workspace_store.listar_projetos(
        id_empresa=id_empresa,
        id_usuario_autor=id_usuario_autor,
    )
    return [ProjetoResumoSchema(**asdict(p)) for p in projetos]


@router.post(
    "/projetos",
    response_model=ProjetoResumoSchema,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um novo projeto validando Triângulo Multi-Tenant, CREA e RBAC",
)
def criar_projeto(payload: CriarProjetoRequestSchema) -> ProjetoResumoSchema:
    projeto = workspace_store.criar_projeto(
        nome=payload.nome,
        id_empresa=payload.id_empresa,
        id_engenheiro=payload.id_engenheiro,
        id_usuario_autor=payload.id_usuario_autor,
    )
    return ProjetoResumoSchema(**asdict(projeto))


@router.get(
    "/projetos/{id_projeto}",
    response_model=ProjetoDetalhadoSchema,
    status_code=status.HTTP_200_OK,
    summary="Obtém os detalhes do projeto, nós cadastrados e trechos calculados da MST",
)
def obter_projeto_detalhado(
    id_projeto: int,
    id_usuario_autor: int = Query(default=1, gt=0),
) -> ProjetoDetalhadoSchema:
    projeto = workspace_store.obter_projeto(
        id_projeto=id_projeto,
        id_usuario_autor=id_usuario_autor,
    )
    pontos = workspace_store.pontos_por_projeto.get(id_projeto, [])
    trechos = workspace_store.trechos_por_projeto.get(id_projeto, [])

    return ProjetoDetalhadoSchema(
        **asdict(projeto),
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
) -> PontoRedeSchema:
    novo_ponto = workspace_store.adicionar_ponto_rede(
        id_projeto=id_projeto,
        descricao=payload.descricao,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status_fisico=payload.status_fisico.value,
        id_tipo_equipamento=payload.id_tipo_equipamento,
        id_usuario_autor=payload.id_usuario_autor,
    )
    return PontoRedeSchema(**asdict(novo_ponto))


@router.patch(
    "/projetos/{id_projeto}/pontos/{id_ponto}",
    response_model=PontoRedeSchema,
    status_code=status.HTTP_200_OK,
    summary="Atualiza as coordenadas de um ponto no projeto",
)
def atualizar_coordenadas_ponto(
    id_projeto: int,
    id_ponto: int,
    payload: AtualizarCoordenadasPontoRequestSchema,
) -> PontoRedeSchema:
    ponto_atualizado = workspace_store.atualizar_coordenadas_ponto(
        id_projeto=id_projeto,
        id_ponto=id_ponto,
        latitude=payload.latitude,
        longitude=payload.longitude,
        id_usuario_autor=payload.id_usuario_autor,
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
    id_usuario_autor: int = Query(default=1, gt=0),
    no_inicial_id: Optional[int] = Query(default=None, gt=0),
) -> ResultadoMSTProjetoSchema:
    resultado = workspace_store.recalcular_mst_projeto(
        id_projeto=id_projeto,
        id_usuario_autor=id_usuario_autor,
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
) -> PontoRedeSchema:
    ponto_atualizado = workspace_store.aplicar_soft_delete_ponto(
        id_projeto=id_projeto,
        id_ponto=id_ponto,
        id_usuario_autor=payload.id_usuario_autor,
        novo_status_ponto=StatusPontoProjeto(payload.novo_status_ponto.value),
        forcar_recalculo_mst=payload.forcar_recalculo_mst,
    )
    return PontoRedeSchema(**asdict(ponto_atualizado))
