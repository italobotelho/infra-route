"""
Schemas Pydantic alinhados à modelagem lógica e física do sistema InfraRoute.
"""

from enum import Enum
import math
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


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


class EnumNivelAcesso(str, Enum):
    ADMINISTRADOR = "Administrador"
    PROJETISTA = "Projetista"
    VISUALIZADOR = "Visualizador"


class EnumCategoriaEquip(str, Enum):
    CAIXA_DE_EMENDA = "Caixa de Emenda"
    CTO = "CTO"
    SWITCH = "Switch"
    PASSIVO_DE_PASSAGEM = "Passivo de Passagem"
    OUTRO = "Outro"


class EnumFabricante(str, Enum):
    FURUKAWA = "Furukawa"
    INTELBRAS = "Intelbras"
    HUAWEI = "Huawei"
    CISCO = "Cisco"
    OUTRO = "Outro"


class TipoEquipamentoSchema(BaseModel):
    id_tipo_equipamento: int = Field(..., gt=0, description="PK de Tipo_Equipamento")
    categoria: EnumCategoriaEquip = Field(..., description="ENUM enum_categoria_equip do SGBD")
    fabricante: EnumFabricante = Field(..., description="ENUM enum_fabricante do SGBD")
    custo_unitario: float = Field(..., ge=0, description="Custo unitário do hardware (>= 0)")


class TipoCaboSchema(BaseModel):
    id_cabo: int = Field(..., gt=0, description="PK de Tipo_Cabo")
    descricao_modelo: str = Field(..., min_length=1, description="Nomenclatura comercial do cabo óptico")
    custo_por_metro: float = Field(..., ge=0, description="Custo por metro linear (>= 0)")
    limite_distancia_metros: float = Field(
        ...,
        gt=0,
        description="Vão livre máximo suportado pela resistência mecânica/tração do cabo (> 0)",
    )

    @field_validator("descricao_modelo")
    @classmethod
    def validar_descricao_nao_vazia(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Descricao_Modelo não pode estar em branco.")
        return v.strip()


class PontoRedeSchema(BaseModel):
    id_ponto: int = Field(..., gt=0, description="PK de Ponto_Rede (Nó do grafo)")
    descricao: str = Field(..., min_length=1, description="Identificação do ativo (ex: Poste Concreto #104)")
    latitude: float = Field(..., ge=-90, le=90, description="Latitude WGS 84 (SRID 4326)")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude WGS 84 (SRID 4326)")
    status_fisico: EnumStatusFisico = Field(default=EnumStatusFisico.PROJETADO)
    status_ponto: EnumStatusPonto = Field(
        default=EnumStatusPonto.ATIVO,
        description="Atributo da tabela associativa Contem (Soft Delete no escopo do projeto)",
    )
    id_tipo_equipamento: Optional[int] = Field(
        default=None,
        gt=0,
        description="FK opcional (0,1) para Tipo_Equipamento; None indica nó de passagem mecânica",
    )
    custo_equipamento: float = Field(
        default=0.0,
        ge=0,
        description="Custo unitário do equipamento acoplado ao ponto (quando aplicável)",
    )

    @field_validator("descricao")
    @classmethod
    def validar_descricao_ponto(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("A descrição do Ponto_Rede não pode estar em branco.")
        return v.strip()

    @field_validator("latitude", "longitude", "custo_equipamento")
    @classmethod
    def validar_float_finito(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("O valor numérico deve ser finito.")
        return v


class CoordenadaLatLngSchema(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude WGS 84 (compatível com Google Maps)")
    lng: float = Field(..., ge=-180, le=180, description="Longitude WGS 84 (compatível com Google Maps)")


class ArestaCandidataSchema(BaseModel):
    origem_id: int = Field(..., gt=0, description="FK Origem_ID referenciando Ponto_Rede")
    destino_id: int = Field(..., gt=0, description="FK Destino_ID referenciando Ponto_Rede")
    distancia_metros: Optional[float] = Field(
        default=None,
        gt=0,
        description="Distância física em metros; se omitida, é calculada via Haversine (SRID 4326)",
    )
    id_tipo_cabo: Optional[int] = Field(
        default=None,
        gt=0,
        description="FK opcional para Tipo_Cabo; se omitida, seleciona o cabo compatível de menor custo",
    )
    caminho_coordenadas: Optional[List[CoordenadaLatLngSchema]] = Field(
        default=None,
        description="Vértices intermediários da polilinha viária do Google Maps ({lat, lng})",
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
    caminho_coordenadas: List[CoordenadaLatLngSchema] = Field(
        default_factory=list,
        description="Array de {lat, lng} pronto para `new google.maps.Polyline({ path })`",
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
    catalogo_equipamentos: Optional[List[TipoEquipamentoSchema]] = Field(
        default=None,
        description="Catálogo opcional 3FN Tipo_Equipamento para tarifação e validação de FK",
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
        gt=0,
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
