"""
Schemas Pydantic alinhados à modelagem lógica e física do sistema InfraRoute.
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class EnumStatusProjeto(str, Enum):
    EM_PLANEJAMENTO = "Em Planejamento"
    EM_EXECUCAO = "Em Execução"
    CONCLUIDO = "Concluído"
    CANCELADO = "Cancelado"


class EnumStatusFisico(str, Enum):
    PROJETADO = "Projetado"
    INSTALADO = "Instalado"
    EM_MANUTENCAO = "Em Manutenção"
    DESATIVADO = "Desativado"


class EnumStatusPonto(str, Enum):
    ATIVO = "Ativo"
    INATIVO = "Inativo"
    REMOVIDO = "Removido"


class TipoEquipamentoSchema(BaseModel):
    id_tipo_equipamento: int = Field(..., description="PK de Tipo_Equipamento")
    categoria: str = Field(..., description="Ex: CTO, Caixa de Emenda, Switch")
    fabricante: str = Field(..., description="Ex: Furukawa, Huawei, Intelbras, Cisco")
    custo_unitario: float = Field(..., ge=0, description="Custo unitário do hardware (>= 0)")


class TipoCaboSchema(BaseModel):
    id_cabo: int = Field(..., description="PK de Tipo_Cabo")
    descricao_modelo: str = Field(..., description="Nomenclatura comercial do cabo óptico")
    custo_por_metro: float = Field(..., ge=0, description="Custo por metro linear (>= 0)")
    limite_distancia_metros: float = Field(
        ...,
        gt=0,
        description="Vão livre máximo suportado pela resistência mecânica/tração do cabo (> 0)",
    )


class PontoRedeSchema(BaseModel):
    id_ponto: int = Field(..., description="PK de Ponto_Rede (Nó do grafo)")
    descricao: str = Field(..., description="Identificação do ativo (ex: Poste Concreto #104)")
    latitude: float = Field(..., ge=-90, le=90, description="Latitude WGS 84 (SRID 4326)")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude WGS 84 (SRID 4326)")
    status_fisico: EnumStatusFisico = Field(default=EnumStatusFisico.PROJETADO)
    status_ponto: EnumStatusPonto = Field(
        default=EnumStatusPonto.ATIVO,
        description="Atributo da tabela associativa Contem (Soft Delete no escopo do projeto)",
    )
    id_tipo_equipamento: Optional[int] = Field(
        default=None,
        description="FK opcional (0,1) para Tipo_Equipamento; None indica nó de passagem mecânica",
    )
    custo_equipamento: float = Field(
        default=0.0,
        ge=0,
        description="Custo unitário do equipamento acoplado ao ponto (quando aplicável)",
    )


class ArestaCandidataSchema(BaseModel):
    origem_id: int = Field(..., description="FK Origem_ID referenciando Ponto_Rede")
    destino_id: int = Field(..., description="FK Destino_ID referenciando Ponto_Rede")
    distancia_metros: Optional[float] = Field(
        default=None,
        gt=0,
        description="Distância física em metros; se omitida, é calculada via Haversine (SRID 4326)",
    )
    id_tipo_cabo: Optional[int] = Field(
        default=None,
        description="FK opcional para Tipo_Cabo; se omitida, seleciona o cabo compatível de menor custo",
    )


class VizinhoAdjacenciaSchema(BaseModel):
    destino_id: int
    distancia_metros: float
    id_tipo_cabo: int
    descricao_cabo: str
    custo_trecho: float


class TrechoRedeMSTSchema(BaseModel):
    id_trecho: int
    origem_id: int
    origem_descricao: str
    destino_id: int
    destino_descricao: str
    id_projeto: int
    id_tipo_cabo: int
    modelo_cabo: str
    distancia_metros: float
    custo_trecho: float
    geometria_wkt: str = Field(
        ...,
        description="Representação WKT LineString (SRID 4326) para persistência no PostGIS",
    )


class RequisicaoCalculoMSTSchema(BaseModel):
    pontos: List[PontoRedeSchema] = Field(
        ...,
        min_length=1,
        description="Lista de nós (Ponto_Rede) vinculados ao projeto",
    )
    catalogo_cabos: List[TipoCaboSchema] = Field(
        default_factory=lambda: [
            TipoCaboSchema(
                id_cabo=1,
                descricao_modelo="Fibra AS-80 12FO",
                custo_por_metro=4.50,
                limite_distancia_metros=2000.0,
            ),
            TipoCaboSchema(
                id_cabo=2,
                descricao_modelo="Fibra AS-120 24FO",
                custo_por_metro=6.80,
                limite_distancia_metros=5000.0,
            ),
        ],
        description="Catálogo Tipo_Cabo para validação de Limite_Distancia_Metros e tarifação",
    )
    arestas_candidatas: Optional[List[ArestaCandidataSchema]] = Field(
        default=None,
        description=(
            "Arestas candidatas explícitas. Se None, o motor gera as adjacências "
            "entre todos os nós ativos respeitando o Limite_Distancia_Metros."
        ),
    )
    no_inicial_id: Optional[int] = Field(
        default=None,
        description="ID_Ponto raiz para iniciar o Algoritmo de Prim (opcional)",
    )


class ResultadoMSTProjetoSchema(BaseModel):
    id_projeto: int
    nos_ativos_processados: int
    grafo_conexo: bool
    metragem_total: float = Field(
        ...,
        description="Atributo memoizado Metragem_Total para atualização na tabela Projeto (O(1))",
    )
    custo_estimado: float = Field(
        ...,
        description="Atributo memoizado Custo_Estimado (cabos da AGM + hardwares acoplados) para a tabela Projeto",
    )
    custo_total_cabos: float
    custo_total_equipamentos: float
    trechos_mst: List[TrechoRedeMSTSchema]
    lista_adjacencia: Dict[int, List[VizinhoAdjacenciaSchema]]
