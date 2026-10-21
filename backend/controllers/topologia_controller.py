"""
Controlador HTTP (FastAPI Router) para processamento topológico e extração da
Árvore Geradora Mínima (MST / AGM) via Algoritmo de Prim.
"""

from dataclasses import asdict
from fastapi import APIRouter, HTTPException, status

from backend.models.schemas import (
    RequisicaoCalculoMSTSchema,
    ResultadoMSTProjetoSchema,
    VizinhoAdjacenciaSchema,
)
from backend.services.prim_service import (
    ArestaCandidata,
    CoordenadaLatLng,
    GrafoTopologicoOptico,
    PontoRede,
    TipoCabo,
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
    id_projeto: int, payload: RequisicaoCalculoMSTSchema
) -> ResultadoMSTProjetoSchema:
    if id_projeto <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O identificador do projeto (id_projeto) deve ser um inteiro positivo.",
        )

    try:
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
        )
        grafo.construir_lista_adjacencia(arestas_candidatas=arestas)
        resultado = grafo.extrair_mst_prim(no_inicial_id=payload.no_inicial_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

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
