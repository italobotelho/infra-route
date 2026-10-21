"""
Motor de Processamento Topológico e Algoritmo de Prim (Árvore Geradora Mínima - MST).

Implementa as diretrizes arquiteturais documentadas em `docs/`:
1. Modelagem em memória por Lista de Adjacência (`Dict[int, List[Adjacencia]]`).
2. Abstração da direcionalidade (Origem/Destino -> Grafo Não Direcionado Bidirecional)
   com preservação da orientação paramétrica do vetor viário (`Geometria_Linha`).
3. Resolução da Dependência Triangular e filtro de Soft Delete (`Status_Ponto == 'Ativo'`).
4. Trava Topológica Anti-Loop (`Origem_ID <> Destino_ID`).
5. Árvore Geradora Mínima Constrita (`Limite_Distancia_Metros` de `Tipo_Cabo`).
6. Pré-filtro espacial por Bounding Box (inspirado no índice GIST) e suporte direto
   a coordenadas e polilinhas reais vindas da API do Google Maps (`{lat, lng}`).
7. Memoização de `Metragem_Total` e `Custo_Estimado` para a entidade `Projeto`.
"""

from dataclasses import dataclass, field
from enum import Enum
import heapq
import math
from typing import Dict, List, Optional, Sequence, Set, Tuple

from backend.services.exceptions import ValidacaoDominioError


class StatusFisicoPonto(str, Enum):
    PROJETADO = "Projetado"
    INSTALADO = "Instalado"
    EM_MANUTENCAO = "Em Manutenção"
    DESATIVADO = "Desativado"


class StatusPontoProjeto(str, Enum):
    ATIVO = "Ativo"
    INATIVO = "Inativo"
    REMOVIDO = "Removido"


@dataclass(frozen=True)
class CoordenadaLatLng:
    """Coordenada geográfica compatível com `google.maps.LatLngLiteral` ({lat, lng})."""

    lat: float
    lng: float

    def __post_init__(self) -> None:
        if not (math.isfinite(self.lat) and math.isfinite(self.lng)):
            raise ValidacaoDominioError("Coordenadas lat/lng devem ser números finitos.")
        if not (-90.0 <= self.lat <= 90.0):
            raise ValidacaoDominioError(f"Latitude fora do intervalo [-90, 90]: {self.lat}")
        if not (-180.0 <= self.lng <= 180.0):
            raise ValidacaoDominioError(f"Longitude fora do intervalo [-180, 180]: {self.lng}")


@dataclass(frozen=True)
class TipoCabo:
    id_cabo: int
    descricao_modelo: str
    custo_por_metro: float
    limite_distancia_metros: float

    def __post_init__(self) -> None:
        if self.id_cabo <= 0:
            raise ValidacaoDominioError("ID_Cabo deve ser um inteiro positivo.")
        if not (self.descricao_modelo and self.descricao_modelo.strip()):
            raise ValidacaoDominioError("Descricao_Modelo do cabo não pode ser vazia.")
        if not math.isfinite(self.custo_por_metro) or self.custo_por_metro < 0:
            raise ValidacaoDominioError("Custo_Por_Metro deve ser um número finito >= 0.")
        if not math.isfinite(self.limite_distancia_metros) or self.limite_distancia_metros <= 0:
            raise ValidacaoDominioError("Limite_Distancia_Metros deve ser um número finito > 0.")


@dataclass(frozen=True)
class PontoRede:
    id_ponto: int
    descricao: str
    latitude: float
    longitude: float
    status_fisico: str = StatusFisicoPonto.PROJETADO.value
    status_ponto: str = StatusPontoProjeto.ATIVO.value
    id_tipo_equipamento: Optional[int] = None
    custo_equipamento: float = 0.0

    def __post_init__(self) -> None:
        if self.id_ponto <= 0:
            raise ValidacaoDominioError("ID_Ponto deve ser um inteiro positivo.")
        if not (self.descricao and self.descricao.strip()):
            raise ValidacaoDominioError("Descrição do Ponto_Rede não pode ser vazia.")
        if not math.isfinite(self.latitude) or not (-90.0 <= self.latitude <= 90.0):
            raise ValidacaoDominioError(f"Latitude inválida para SRID 4326: {self.latitude}")
        if not math.isfinite(self.longitude) or not (-180.0 <= self.longitude <= 180.0):
            raise ValidacaoDominioError(f"Longitude inválida para SRID 4326: {self.longitude}")
        if not math.isfinite(self.custo_equipamento) or self.custo_equipamento < 0:
            raise ValidacaoDominioError("Custo de equipamento não pode ser negativo ou não-finito.")


@dataclass(frozen=True)
class ArestaCandidata:
    origem_id: int
    destino_id: int
    distancia_metros: Optional[float] = None
    id_tipo_cabo: Optional[int] = None
    caminho_coordenadas: Optional[Tuple[CoordenadaLatLng, ...]] = None


@dataclass(frozen=True)
class Adjacencia:
    """Representa uma aresta incidente na Lista de Adjacência em memória."""

    origem_id: int
    destino_id: int
    distancia_metros: float
    id_tipo_cabo: int
    modelo_cabo: str
    custo_trecho: float
    caminho_coordenadas: Tuple[CoordenadaLatLng, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class TrechoRedeMST:
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
    geometria_wkt: str
    caminho_coordenadas: List[Dict[str, float]] = field(default_factory=list)


@dataclass(frozen=True)
class ResultadoMSTProjeto:
    id_projeto: int
    nos_ativos_processados: int
    grafo_conexo: bool
    metragem_total: float
    custo_estimado: float
    custo_total_cabos: float
    custo_total_equipamentos: float
    trechos_mst: List[TrechoRedeMST] = field(default_factory=list)
    lista_adjacencia: Dict[int, List[Adjacencia]] = field(default_factory=dict)


def calcular_distancia_haversine(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calcula a distância geodésica em metros entre dois pontos WGS 84 (SRID 4326).
    """
    if not all(math.isfinite(v) for v in (lat1, lon1, lat2, lon2)):
        raise ValidacaoDominioError("Coordenadas devem ser números finitos.")
    if not (-90.0 <= lat1 <= 90.0 and -90.0 <= lat2 <= 90.0):
        raise ValidacaoDominioError("Latitude fora do intervalo [-90, 90].")
    if not (-180.0 <= lon1 <= 180.0 and -180.0 <= lon2 <= 180.0):
        raise ValidacaoDominioError("Longitude fora do intervalo [-180, 180].")

    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    raio_terra_metros = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distancia_bruta = raio_terra_metros * c

    # Garante piso de 0.01m para coordenadas distintas (compatível com NUMERIC(15,2) CHECK > 0)
    if 0.0 < distancia_bruta < 0.01:
        return 0.01

    return round(distancia_bruta, 2)


def gerar_linestring_wkt(
    ponto_origem: PontoRede,
    ponto_destino: PontoRede,
    caminho_coordenadas: Optional[Sequence[CoordenadaLatLng]] = None,
) -> str:
    """
    Gera a representação geométrica WKT (LineString, SRID 4326) no padrão PostGIS (Longitude Latitude).
    - Formata com 8 casas decimais fixas (`:.8f`) para evitar notação científica (`1e-07`)
      próxima ao Equador/Meridiano de Greenwich, que quebraria o parser WKT do PostGIS.
    - Suporta polilinhas com múltiplos vértices intermediários vindos do Google Maps Directions API.
    """
    if caminho_coordenadas and len(caminho_coordenadas) >= 2:
        vertices_str = ", ".join(f"{c.lng:.8f} {c.lat:.8f}" for c in caminho_coordenadas)
    else:
        vertices_str = (
            f"{ponto_origem.longitude:.8f} {ponto_origem.latitude:.8f}, "
            f"{ponto_destino.longitude:.8f} {ponto_destino.latitude:.8f}"
        )
    return f"SRID=4326;LINESTRING({vertices_str})"


class GrafoTopologicoOptico:
    """
    Modela a topologia de um Projeto em memória por meio de Listas de Adjacência.
    """

    DISTANCIA_MINIMA_JUMPER_METROS: float = 0.01

    def __init__(
        self,
        id_projeto: int,
        pontos: Sequence[PontoRede],
        catalogo_cabos: Sequence[TipoCabo],
    ) -> None:
        if id_projeto <= 0:
            raise ValidacaoDominioError("ID_Projeto deve ser um inteiro positivo.")
        if not catalogo_cabos:
            raise ValidacaoDominioError("O catálogo de cabos (Tipo_Cabo) não pode estar vazio.")

        self.id_projeto = id_projeto

        # Valida unicidade de ID_Cabo no catálogo
        self.catalogo_cabos: Dict[int, TipoCabo] = {}
        for cabo in catalogo_cabos:
            if cabo.id_cabo in self.catalogo_cabos:
                raise ValidacaoDominioError(f"ID_Cabo duplicado no catálogo: {cabo.id_cabo}")
            self.catalogo_cabos[cabo.id_cabo] = cabo

        self.maior_limite_cabo_metros: float = max(
            c.limite_distancia_metros for c in self.catalogo_cabos.values()
        )

        # Valida unicidade de ID_Ponto na entrada e filtra apenas nós ativos (Seções 3.1 e 3.3)
        ids_vistos: Set[int] = set()
        self.nos_ativos: Dict[int, PontoRede] = {}

        for p in pontos:
            if p.id_ponto in ids_vistos:
                raise ValidacaoDominioError(f"ID_Ponto duplicado na lista de entrada: {p.id_ponto}")
            ids_vistos.add(p.id_ponto)

            status_ponto_val = (
                p.status_ponto.value if isinstance(p.status_ponto, Enum) else str(p.status_ponto)
            )
            status_fisico_val = (
                p.status_fisico.value
                if isinstance(p.status_fisico, Enum)
                else str(p.status_fisico)
            )

            if (
                status_ponto_val == StatusPontoProjeto.ATIVO.value
                and status_fisico_val != StatusFisicoPonto.DESATIVADO.value
            ):
                self.nos_ativos[p.id_ponto] = p

        # Inicializa a Lista de Adjacência em memória para cada nó ativo do projeto
        self.lista_adjacencia: Dict[int, List[Adjacencia]] = {
            id_ponto: [] for id_ponto in self.nos_ativos
        }

    def _selecionar_cabo_compativel(
        self, distancia_metros: float, id_tipo_cabo_preferencial: Optional[int] = None
    ) -> Optional[TipoCabo]:
        """
        Seção 2.10 da Documentação (Árvore Geradora Mínima Constrita):
        Verifica se a distância do vão respeita `Limite_Distancia_Metros` do Tipo_Cabo.
        Bloqueia conexões cujo vão livre exceda a resistência mecânica/tração do cabo.
        """
        if id_tipo_cabo_preferencial is not None:
            cabo = self.catalogo_cabos.get(id_tipo_cabo_preferencial)
            if cabo and distancia_metros <= cabo.limite_distancia_metros:
                return cabo
            return None

        cabos_validos = [
            cabo
            for cabo in self.catalogo_cabos.values()
            if distancia_metros <= cabo.limite_distancia_metros
        ]
        if not cabos_validos:
            return None

        return min(
            cabos_validos,
            key=lambda c: (c.custo_por_metro, c.limite_distancia_metros, c.id_cabo),
        )

    def _inserir_ou_atualizar_vizinho(self, adj_nova: Adjacencia) -> None:
        """
        Insere a adjacência na lista do nó `origem_id`. Caso já exista uma aresta paralela
        para o mesmo `destino_id`, mantém apenas a de menor distância/custo.
        """
        adjacencias = self.lista_adjacencia[adj_nova.origem_id]
        for idx, adj_existente in enumerate(adjacencias):
            if adj_existente.destino_id == adj_nova.destino_id:
                chave_nova = (
                    adj_nova.distancia_metros,
                    adj_nova.custo_trecho,
                    adj_nova.id_tipo_cabo,
                )
                chave_existente = (
                    adj_existente.distancia_metros,
                    adj_existente.custo_trecho,
                    adj_existente.id_tipo_cabo,
                )
                if chave_nova < chave_existente:
                    adjacencias[idx] = adj_nova
                return
        adjacencias.append(adj_nova)

    def adicionar_aresta_bidirecional(
        self,
        origem_id: int,
        destino_id: int,
        distancia_metros: Optional[float] = None,
        id_tipo_cabo: Optional[int] = None,
        caminho_coordenadas: Optional[Sequence[CoordenadaLatLng]] = None,
    ) -> bool:
        """
        Adiciona uma aresta não direcionada (bidirecional) na Lista de Adjacência,
        aplicando todas as travas de integridade topológica e física.
        """
        # 1. Trava Topológica Anti-Loop (chk_nos_diferentes: Origem_ID <> Destino_ID)
        if origem_id == destino_id:
            return False

        # 2. Resolução da Dependência Triangular (Seção 3.1):
        if origem_id not in self.nos_ativos or destino_id not in self.nos_ativos:
            return False

        ponto_u = self.nos_ativos[origem_id]
        ponto_v = self.nos_ativos[destino_id]

        # 3. Cálculo ou validação da distância física (> 0 e finita)
        if distancia_metros is not None:
            if not math.isfinite(distancia_metros) or distancia_metros <= 0:
                return False
            dist = max(self.DISTANCIA_MINIMA_JUMPER_METROS, round(float(distancia_metros), 2))
        else:
            dist_haversine = calcular_distancia_haversine(
                ponto_u.latitude, ponto_u.longitude, ponto_v.latitude, ponto_v.longitude
            )
            # Se dois ativos distintos (ex: CEO e CTO no mesmo poste/caixa ou clique duplo no mapa)
            # compartilham a mesma coordenada GPS, adota o vão mínimo de manobra (0.01m)
            # para respeitar CHECK (Distancia_Metros > 0) sem desconectar a topologia.
            dist = (
                dist_haversine
                if dist_haversine > 0.0
                else self.DISTANCIA_MINIMA_JUMPER_METROS
            )

        # 4. Restrição Física de Engenharia de Enlaces (Limite_Distancia_Metros)
        cabo = self._selecionar_cabo_compativel(dist, id_tipo_cabo)
        if cabo is None:
            return False

        custo_trecho = round(dist * cabo.custo_por_metro, 2)

        # 5. Construção do vetor viário orientado (Origem -> Destino e Destino -> Origem)
        if caminho_coordenadas and len(caminho_coordenadas) >= 2:
            rota_direta = tuple(caminho_coordenadas)
            rota_inversa = tuple(reversed(caminho_coordenadas))
        else:
            coord_u = CoordenadaLatLng(lat=ponto_u.latitude, lng=ponto_u.longitude)
            coord_v = CoordenadaLatLng(lat=ponto_v.latitude, lng=ponto_v.longitude)
            rota_direta = (coord_u, coord_v)
            rota_inversa = (coord_v, coord_u)

        # 6. Resolução do Paradoxo da Direcionalidade (Seção 3.2):
        self._inserir_ou_atualizar_vizinho(
            Adjacencia(
                origem_id=origem_id,
                destino_id=destino_id,
                distancia_metros=dist,
                id_tipo_cabo=cabo.id_cabo,
                modelo_cabo=cabo.descricao_modelo,
                custo_trecho=custo_trecho,
                caminho_coordenadas=rota_direta,
            )
        )
        self._inserir_ou_atualizar_vizinho(
            Adjacencia(
                origem_id=destino_id,
                destino_id=origem_id,
                distancia_metros=dist,
                id_tipo_cabo=cabo.id_cabo,
                modelo_cabo=cabo.descricao_modelo,
                custo_trecho=custo_trecho,
                caminho_coordenadas=rota_inversa,
            )
        )
        return True

    def construir_lista_adjacencia(
        self, arestas_candidatas: Optional[Sequence[ArestaCandidata]] = None
    ) -> None:
        """
        Popula a Lista de Adjacência a partir de arestas candidatas explícitas ou,
        quando não informadas, calcula os vãos viáveis entre os pontos ativos do projeto
        utilizando pré-filtro de Bounding Box espacial.
        """
        if arestas_candidatas is not None:
            for aresta in arestas_candidatas:
                self.adicionar_aresta_bidirecional(
                    origem_id=aresta.origem_id,
                    destino_id=aresta.destino_id,
                    distancia_metros=aresta.distancia_metros,
                    id_tipo_cabo=aresta.id_tipo_cabo,
                    caminho_coordenadas=aresta.caminho_coordenadas,
                )
            return

        ids_nos = sorted(self.nos_ativos.keys())
        total_nos = len(ids_nos)
        # 1 grau de latitude equivale a ~110.574 km (margem segura de 110.000m)
        delta_lat_max_graus = (self.maior_limite_cabo_metros / 110000.0) * 1.05

        for i in range(total_nos):
            u = self.nos_ativos[ids_nos[i]]
            for j in range(i + 1, total_nos):
                v = self.nos_ativos[ids_nos[j]]
                # Pré-filtro rápido por Bounding Box Latitudinal (evita trigonometria desnecessária)
                if abs(u.latitude - v.latitude) > delta_lat_max_graus:
                    continue
                self.adicionar_aresta_bidirecional(ids_nos[i], ids_nos[j])

    def extrair_mst_prim(
        self, no_inicial_id: Optional[int] = None
    ) -> ResultadoMSTProjeto:
        """
        Executa o Algoritmo de Prim utilizando Fila de Prioridade (Min-Heap) sobre a
        Lista de Adjacência em memória para extrair a Árvore Geradora Mínima (MST / AGM).

        Complexidade: O(E log V), onde V = |Ponto_Rede ativos| e E = |Adjacências válidas|.
        """
        if not self.nos_ativos:
            if no_inicial_id is not None:
                raise ValidacaoDominioError(
                    f"O nó inicial {no_inicial_id} não existe ou não está ativo no projeto."
                )
            return ResultadoMSTProjeto(
                id_projeto=self.id_projeto,
                nos_ativos_processados=0,
                grafo_conexo=False,
                metragem_total=0.0,
                custo_estimado=0.0,
                custo_total_cabos=0.0,
                custo_total_equipamentos=0.0,
                trechos_mst=[],
                lista_adjacencia={},
            )

        if no_inicial_id is not None and no_inicial_id not in self.nos_ativos:
            raise ValidacaoDominioError(
                f"O nó inicial {no_inicial_id} não pertence ao conjunto de nós ativos do projeto."
            )

        raiz_id = (
            no_inicial_id
            if no_inicial_id is not None
            else min(self.nos_ativos.keys())
        )

        visitados: Set[int] = {raiz_id}
        fila_prioridade: List[Tuple[float, float, int, int, int, Adjacencia]] = []

        for adj in self.lista_adjacencia[raiz_id]:
            u_min = min(adj.origem_id, adj.destino_id)
            v_max = max(adj.origem_id, adj.destino_id)
            heapq.heappush(
                fila_prioridade,
                (
                    adj.distancia_metros,
                    adj.custo_trecho,
                    u_min,
                    v_max,
                    adj.destino_id,
                    adj,
                ),
            )

        trechos_mst: List[TrechoRedeMST] = []
        sequencial_trecho = 1

        while fila_prioridade and len(visitados) < len(self.nos_ativos):
            _, _, _, _, id_atual, aresta_escolhida = heapq.heappop(fila_prioridade)

            if id_atual in visitados:
                continue

            visitados.add(id_atual)

            ponto_origem = self.nos_ativos[aresta_escolhida.origem_id]
            ponto_destino = self.nos_ativos[aresta_escolhida.destino_id]

            caminho_google_maps = [
                {"lat": c.lat, "lng": c.lng} for c in aresta_escolhida.caminho_coordenadas
            ]

            trechos_mst.append(
                TrechoRedeMST(
                    id_trecho=sequencial_trecho,
                    origem_id=ponto_origem.id_ponto,
                    origem_descricao=ponto_origem.descricao,
                    destino_id=ponto_destino.id_ponto,
                    destino_descricao=ponto_destino.descricao,
                    id_projeto=self.id_projeto,
                    id_tipo_cabo=aresta_escolhida.id_tipo_cabo,
                    modelo_cabo=aresta_escolhida.modelo_cabo,
                    distancia_metros=aresta_escolhida.distancia_metros,
                    custo_trecho=aresta_escolhida.custo_trecho,
                    geometria_wkt=gerar_linestring_wkt(
                        ponto_origem,
                        ponto_destino,
                        aresta_escolhida.caminho_coordenadas,
                    ),
                    caminho_coordenadas=caminho_google_maps,
                )
            )
            sequencial_trecho += 1

            for adj_vizinho in self.lista_adjacencia[id_atual]:
                if adj_vizinho.destino_id not in visitados:
                    u_min = min(adj_vizinho.origem_id, adj_vizinho.destino_id)
                    v_max = max(adj_vizinho.origem_id, adj_vizinho.destino_id)
                    heapq.heappush(
                        fila_prioridade,
                        (
                            adj_vizinho.distancia_metros,
                            adj_vizinho.custo_trecho,
                            u_min,
                            v_max,
                            adj_vizinho.destino_id,
                            adj_vizinho,
                        ),
                    )

        metragem_total = round(sum(t.distancia_metros for t in trechos_mst), 2)
        custo_total_cabos = round(sum(t.custo_trecho for t in trechos_mst), 2)
        custo_total_equipamentos = round(
            sum(
                p.custo_equipamento
                for id_no, p in self.nos_ativos.items()
                if id_no in visitados and p.id_tipo_equipamento is not None
            ),
            2,
        )
        custo_estimado = round(custo_total_cabos + custo_total_equipamentos, 2)
        grafo_conexo = len(visitados) == len(self.nos_ativos)

        return ResultadoMSTProjeto(
            id_projeto=self.id_projeto,
            nos_ativos_processados=len(self.nos_ativos),
            grafo_conexo=grafo_conexo,
            metragem_total=metragem_total,
            custo_estimado=custo_estimado,
            custo_total_cabos=custo_total_cabos,
            custo_total_equipamentos=custo_total_equipamentos,
            trechos_mst=trechos_mst,
            lista_adjacencia={
                id_no: list(adjacencias)
                for id_no, adjacencias in self.lista_adjacencia.items()
            },
        )
