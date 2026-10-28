"""
Controlador HTTP (FastAPI Router) para processamento topológico e extração da
Árvore Geradora Mínima (MST / AGM) via Algoritmo de Prim.
"""

from dataclasses import asdict
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from backend.controllers.auth_controller import obter_sessao_opcional
from backend.models.schemas import (
    RequisicaoCalculoMSTSchema,
    ResultadoMSTProjetoSchema,
    VizinhoAdjacenciaSchema,
)
from backend.services.exceptions import ValidacaoDominioError
from backend.services.workspace_store import SessaoAutenticada, workspace_store
from backend.services.prim_service import (
    ArestaCandidata,
    CoordenadaLatLng,
    GrafoTopologicoOptico,
    PontoRede,
    TipoCabo,
    TipoEquipamento,
)

router = APIRouter(
    prefix="/api/projetos",
    tags=["Topologia e Otimização (Prim / MST)"],
)


@router.post(
    "/{id_projeto}/mst",
    response_model=ResultadoMSTProjetoSchema,
    status_code=status.HTTP_200_OK,
    summary="Calcula a Árvore Geradora Mínima (Algoritmo de Prim) via Lista de Adjacência",
)
def calcular_mst_projeto(
    id_projeto: int,
    payload: RequisicaoCalculoMSTSchema | None = None,
    id_usuario_autor: int = Query(default=1, gt=0),
    sessao: Optional[SessaoAutenticada] = Depends(obter_sessao_opcional),
) -> ResultadoMSTProjetoSchema:
    if id_projeto <= 0:
        raise ValidacaoDominioError(
            "O identificador do projeto (id_projeto) deve ser um inteiro positivo."
        )

    autor_id = sessao.id_usuario if sessao is not None else id_usuario_autor

    if payload is None:
        resultado = workspace_store.recalcular_mst_projeto(
            id_projeto=id_projeto,
            id_usuario_autor=autor_id,
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

    pontos = [
        PontoRede(
            id_ponto=p.id_ponto,
            descricao=p.descricao,
            latitude=p.latitude,
            longitude=p.longitude,
            status_fisico=p.status_fisico.value,
            status_ponto=p.status_ponto.value,
            id_tipo_equipamento=p.id_tipo_equipamento,
            custo_equipamento=p.custo_equipamento,
        )
        for p in payload.pontos
    ]
    cabos = [
        TipoCabo(
            id_cabo=c.id_cabo,
            descricao_modelo=c.descricao_modelo,
            custo_por_metro=c.custo_por_metro,
            limite_distancia_metros=c.limite_distancia_metros,
        )
        for c in payload.catalogo_cabos
    ]
    equipamentos = (
        [
            TipoEquipamento(
                id_tipo_equipamento=eq.id_tipo_equipamento,
                categoria=eq.categoria.value,
                fabricante=eq.fabricante.value,
                custo_unitario=eq.custo_unitario,
            )
            for eq in payload.catalogo_equipamentos
        ]
        if payload.catalogo_equipamentos is not None
        else None
    )
    arestas = (
        [
            ArestaCandidata(
                origem_id=a.origem_id,
                destino_id=a.destino_id,
                distancia_metros=a.distancia_metros,
                id_tipo_cabo=a.id_tipo_cabo,
                caminho_coordenadas=(
                    tuple(CoordenadaLatLng(lat=c.lat, lng=c.lng) for c in a.caminho_coordenadas)
                    if a.caminho_coordenadas
                    else None
                ),
            )
            for a in payload.arestas_candidatas
        ]
        if payload.arestas_candidatas is not None
        else None
    )

    grafo = GrafoTopologicoOptico(
        id_projeto=id_projeto,
        pontos=pontos,
        catalogo_cabos=cabos,
        catalogo_equipamentos=equipamentos,
    )
    grafo.construir_lista_adjacencia(arestas_candidatas=arestas)
    resultado = grafo.extrair_mst_prim(no_inicial_id=payload.no_inicial_id)

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
