"""
Suíte de Testes de Robustez, Casos de Borda e Auditoria de Brechas
para o Algoritmo de Prim e Lista de Adjacência (`prim_service.py`).
"""

import math
import random
import time
import unittest

from backend.services.prim_service import (
    ArestaCandidata,
    CategoriaEquipamento,
    CoordenadaLatLng,
    FabricanteEquipamento,
    GrafoTopologicoOptico,
    PontoRede,
    StatusFisicoPonto,
    StatusPontoProjeto,
    TipoCabo,
    TipoEquipamento,
    calcular_distancia_haversine,
)


class TestPrimServiceRobustez(unittest.TestCase):
    def setUp(self) -> None:
        self.catalogo_padrao = [
            TipoCabo(
                id_cabo=1,
                descricao_modelo="Fibra AS-80 12FO",
                custo_por_metro=4.50,
                limite_distancia_metros=2000.0,
            ),
            TipoCabo(
                id_cabo=2,
                descricao_modelo="Fibra AS-120 24FO",
                custo_por_metro=6.80,
                limite_distancia_metros=5000.0,
            ),
        ]

    def test_01_extracao_mst_classica_eliminacao_de_ciclos(self) -> None:
        """
        Garante que em um grafo com ciclos fechados o Algoritmo de Prim descarta
        arestas redundantes mais caras e extrai exatamente |V| - 1 arestas.
        """
        pontos = [
            PontoRede(1, "POP Central", -22.7000, -46.9800, id_tipo_equipamento=3, custo_equipamento=2450.0),
            PontoRede(2, "Poste #2", -22.7010, -46.9810, id_tipo_equipamento=1, custo_equipamento=380.0),
            PontoRede(3, "Poste #3", -22.7020, -46.9820, id_tipo_equipamento=None, custo_equipamento=0.0),
            PontoRede(4, "Poste #4", -22.7030, -46.9830, id_tipo_equipamento=2, custo_equipamento=520.0),
        ]
        # Ciclo quadrado com diagonais mais pesadas:
        # Caminho ótimo esperado: (1-2: 100m), (2-3: 150m), (3-4: 120m) => Total = 370m
        arestas = [
            ArestaCandidata(1, 2, distancia_metros=100.0),
            ArestaCandidata(2, 3, distancia_metros=150.0),
            ArestaCandidata(3, 4, distancia_metros=120.0),
            ArestaCandidata(4, 1, distancia_metros=400.0),  # Fecha ciclo externo (deve ser ignorada)
            ArestaCandidata(1, 3, distancia_metros=350.0),  # Diagonal (deve ser ignorada)
            ArestaCandidata(2, 4, distancia_metros=290.0),  # Diagonal (deve ser ignorada)
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas)
        resultado = grafo.extrair_mst_prim(no_inicial_id=1)

        self.assertTrue(resultado.grafo_conexo)
        self.assertEqual(resultado.nos_ativos_processados, 4)
        self.assertEqual(len(resultado.trechos_mst), 3)  # |V| - 1 = 3
        self.assertAlmostEqual(resultado.metragem_total, 370.00, places=2)
        self.assertAlmostEqual(resultado.custo_total_cabos, 370.00 * 4.50, places=2)
        self.assertAlmostEqual(resultado.custo_total_equipamentos, 2450.0 + 380.0 + 520.0, places=2)
        self.assertAlmostEqual(
            resultado.custo_estimado,
            resultado.custo_total_cabos + resultado.custo_total_equipamentos,
            places=2,
        )

    def test_02_invariancia_em_relacao_ao_no_inicial(self) -> None:
        """
        Iniciar o Algoritmo de Prim a partir de qualquer nó do grafo conexo
        deve resultar exatamente na mesma Metragem_Total e Custo_Estimado.
        """
        pontos = [
            PontoRede(10, "Nó 10", -22.700, -46.980, id_tipo_equipamento=1, custo_equipamento=380.0),
            PontoRede(20, "Nó 20", -22.702, -46.981, id_tipo_equipamento=2, custo_equipamento=520.0),
            PontoRede(30, "Nó 30", -22.704, -46.979, id_tipo_equipamento=None),
            PontoRede(40, "Nó 40", -22.701, -46.984, id_tipo_equipamento=3, custo_equipamento=2450.0),
            PontoRede(50, "Nó 50", -22.705, -46.985, id_tipo_equipamento=1, custo_equipamento=380.0),
        ]

        metragens = set()
        custos = set()

        for no_raiz in (10, 20, 30, 40, 50):
            grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
            grafo.construir_lista_adjacencia()
            res = grafo.extrair_mst_prim(no_inicial_id=no_raiz)
            self.assertTrue(res.grafo_conexo)
            self.assertEqual(len(res.trechos_mst), 4)
            metragens.add(res.metragem_total)
            custos.add(res.custo_estimado)

        self.assertEqual(len(metragens), 1, "Metragem da MST variou conforme o nó inicial!")
        self.assertEqual(len(custos), 1, "Custo estimado da MST variou conforme o nó inicial!")

    def test_03_paradoxo_direcionalidade_adjacencia_bidirecional(self) -> None:
        """
        Seção 3.2 da Documentação:
        Mesmo que as arestas de entrada estejam orientadas apenas de Destino -> Origem,
        a Lista de Adjacência deve ser simétrica (bidirecional).
        """
        pontos = [
            PontoRede(1, "A", -22.700, -46.980),
            PontoRede(2, "B", -22.701, -46.981),
            PontoRede(3, "C", -22.702, -46.982),
        ]
        # Arestas declaradas "ao contrário" em relação ao nó inicial 1
        arestas = [
            ArestaCandidata(origem_id=3, destino_id=2, distancia_metros=80.0),
            ArestaCandidata(origem_id=2, destino_id=1, distancia_metros=90.0),
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas)
        res = grafo.extrair_mst_prim(no_inicial_id=1)

        self.assertTrue(res.grafo_conexo)
        self.assertEqual(len(res.trechos_mst), 2)
        self.assertAlmostEqual(res.metragem_total, 170.00, places=2)

    def test_04_brecha_arestas_paralelas_e_duplicadas(self) -> None:
        """
        Força a inserção de arestas duplicadas (1->2 e 2->1) e paralelas com pesos
        diferentes entre os mesmos dois postes. A Lista de Adjacência não deve duplicar
        vizinhos e deve preservar apenas a aresta de menor distância/custo.
        """
        pontos = [
            PontoRede(1, "Poste 1", -22.700, -46.980),
            PontoRede(2, "Poste 2", -22.701, -46.981),
        ]
        arestas_poluidas = [
            ArestaCandidata(1, 2, distancia_metros=500.0),
            ArestaCandidata(2, 1, distancia_metros=500.0),
            ArestaCandidata(1, 2, distancia_metros=120.0),  # Menor vão (deve prevalecer)
            ArestaCandidata(2, 1, distancia_metros=350.0),
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas_poluidas)

        # Cada nó deve ter apenas 1 adjacência para o outro nó (sem duplicatas)
        self.assertEqual(len(grafo.lista_adjacencia[1]), 1)
        self.assertEqual(len(grafo.lista_adjacencia[2]), 1)
        self.assertAlmostEqual(grafo.lista_adjacencia[1][0].distancia_metros, 120.0)

        res = grafo.extrair_mst_prim()
        self.assertAlmostEqual(res.metragem_total, 120.0)

    def test_05_trava_anti_loop_e_dependencia_triangular(self) -> None:
        """
        Seção 3.1 e Constraint chk_nos_diferentes:
        Auto-laços (u == v) e arestas apontando para nós de outros projetos (não pertencentes
        ao escopo de `nos_ativos`) devem ser sumariamente bloqueados.
        """
        pontos = [
            PontoRede(1, "Poste 1", -22.700, -46.980),
            PontoRede(2, "Poste 2", -22.701, -46.981),
        ]
        arestas_maliciosas = [
            ArestaCandidata(1, 1, distancia_metros=10.0),    # Auto-loop ilegal
            ArestaCandidata(2, 2, distancia_metros=5.0),     # Auto-loop ilegal
            ArestaCandidata(1, 999, distancia_metros=20.0),  # Nó 999 externo ao projeto
            ArestaCandidata(888, 2, distancia_metros=15.0),  # Nó 888 externo ao projeto
            ArestaCandidata(1, 2, distancia_metros=100.0),   # Única aresta legítima
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas_maliciosas)
        res = grafo.extrair_mst_prim()

        self.assertTrue(res.grafo_conexo)
        self.assertEqual(len(res.trechos_mst), 1)
        self.assertEqual(res.metragem_total, 100.0)

    def test_06_soft_delete_status_ponto_e_status_fisico(self) -> None:
        """
        Seção 3.3 da Documentação (Soft Delete):
        Nós com Status_Ponto != 'Ativo' (em Contem) ou Status_Fisico == 'Desativado'
        (em Ponto_Rede) devem ser ignorados pelo motor, mesmo que ofereçam atalhos mais curtos.
        """
        pontos = [
            PontoRede(1, "Ativo 1", -22.700, -46.980, id_tipo_equipamento=1, custo_equipamento=380.0),
            PontoRede(
                2,
                "Poste Removido no Projeto",
                -22.7005,
                -46.9805,
                status_ponto=StatusPontoProjeto.REMOVIDO.value,
                id_tipo_equipamento=3,
                custo_equipamento=2450.0,
            ),
            PontoRede(
                3,
                "Poste Fisicamente Desativado",
                -22.7008,
                -46.9808,
                status_fisico=StatusFisicoPonto.DESATIVADO.value,
                id_tipo_equipamento=2,
                custo_equipamento=520.0,
            ),
            PontoRede(4, "Ativo 4", -22.701, -46.981, id_tipo_equipamento=1, custo_equipamento=380.0),
        ]
        arestas = [
            ArestaCandidata(1, 2, distancia_metros=10.0),
            ArestaCandidata(2, 4, distancia_metros=10.0),
            ArestaCandidata(1, 3, distancia_metros=15.0),
            ArestaCandidata(3, 4, distancia_metros=15.0),
            ArestaCandidata(1, 4, distancia_metros=200.0),
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas)
        res = grafo.extrair_mst_prim()

        self.assertEqual(res.nos_ativos_processados, 2)
        self.assertEqual(len(res.trechos_mst), 1)
        self.assertEqual(res.trechos_mst[0].origem_id, 1)
        self.assertEqual(res.trechos_mst[0].destino_id, 4)
        self.assertAlmostEqual(res.metragem_total, 200.0)
        # Equipamentos dos nós 2 e 3 (inativos/desativados) NÃO podem entrar no Custo_Estimado
        self.assertAlmostEqual(res.custo_total_equipamentos, 760.0)

    def test_07_mst_constrita_limite_distancia_metros_cabo(self) -> None:
        """
        Seção 2.10 da Documentação (Árvore Geradora Mínima Constrita):
        - Vão de 1500m deve usar Fibra AS-80 (limite 2000m, R$ 4,50/m).
        - Vão de 3000m excede a AS-80 e deve migrar automaticamente para Fibra AS-120 (limite 5000m, R$ 6,80/m).
        - Vão de 5500m excede todos os cabos e deve ser bloqueado fisicamente.
        """
        pontos = [
            PontoRede(1, "Nó 1", -22.700, -46.980),
            PontoRede(2, "Nó 2", -22.710, -46.980),
            PontoRede(3, "Nó 3", -22.730, -46.980),
        ]
        arestas = [
            ArestaCandidata(1, 2, distancia_metros=1500.0),  # Compatível com cabo 1 (AS-80)
            ArestaCandidata(2, 3, distancia_metros=3000.0),  # Exige cabo 2 (AS-120)
            ArestaCandidata(1, 3, distancia_metros=5500.0),  # Excede limite máximo (5000m) -> Bloqueado!
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas)

        # Verifica que a aresta (1, 3) de 5500m foi bloqueada
        vizinhos_de_1 = [a.destino_id for a in grafo.lista_adjacencia[1]]
        self.assertNotIn(3, vizinhos_de_1)

        res = grafo.extrair_mst_prim(no_inicial_id=1)
        self.assertTrue(res.grafo_conexo)
        self.assertEqual(res.trechos_mst[0].id_tipo_cabo, 1)
        self.assertEqual(res.trechos_mst[1].id_tipo_cabo, 2)
        self.assertAlmostEqual(res.custo_total_cabos, (1500.0 * 4.50) + (3000.0 * 6.80), places=2)

    def test_08_grafo_desconexo_ilhas_topologicas(self) -> None:
        """
        Quando os pontos estão separados por uma distância maior que o Limite_Distancia_Metros
        de todos os cabos do catálogo, o grafo forma ilhas desconexas (`grafo_conexo = False`).
        """
        pontos = [
            PontoRede(1, "Cluster A - Poste 1", -22.7000, -46.9800, id_tipo_equipamento=1, custo_equipamento=380.0),
            PontoRede(2, "Cluster A - Poste 2", -22.7010, -46.9810, id_tipo_equipamento=1, custo_equipamento=380.0),
            # Cluster B a ~35 km de distância (inviável para cabos com limite de 5000m)
            PontoRede(3, "Cluster B - Isolado", -23.0000, -47.1000, id_tipo_equipamento=3, custo_equipamento=2450.0),
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia()
        res = grafo.extrair_mst_prim(no_inicial_id=1)

        self.assertFalse(res.grafo_conexo)
        self.assertEqual(res.nos_ativos_processados, 3)
        self.assertEqual(len(res.trechos_mst), 1)
        # Apenas os equipamentos alcançados na árvore (Cluster A) devem compor o custo da árvore extraída
        self.assertAlmostEqual(res.custo_total_equipamentos, 760.0)

    def test_09_brecha_no_passagem_mecanica_com_custo_fantasma(self) -> None:
        """
        Seção 2.6 da Documentação:
        Se `id_tipo_equipamento` é None (passagem mecânica), qualquer valor residual passado
        em `custo_equipamento` deve ser ignorado no cálculo de Custo_Estimado.
        """
        pontos = [
            PontoRede(
                1,
                "Passagem Mecânica Pura",
                -22.7000,
                -46.9800,
                id_tipo_equipamento=None,
                custo_equipamento=9999.99,  # Tentativa de inflar custo sem hardware acoplado
            ),
            PontoRede(
                2,
                "Poste com CTO",
                -22.7010,
                -46.9800,
                id_tipo_equipamento=1,
                custo_equipamento=380.00,
            ),
        ]
        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia()
        res = grafo.extrair_mst_prim()

        self.assertAlmostEqual(res.custo_total_equipamentos, 380.00)

    def test_10_brecha_valores_nan_inf_e_coordenadas_invalidas(self) -> None:
        """
        Garante que NaN, Inf, -Inf, coordenadas fora da Terra (SRID 4326) e custos/distâncias
        negativas sejam bloqueados imediatamente.
        """
        with self.assertRaises(ValueError):
            PontoRede(1, "Lat Inválida", 95.0, -46.98)

        with self.assertRaises(ValueError):
            PontoRede(1, "Lon Inválida", -22.70, -190.0)

        with self.assertRaises(ValueError):
            PontoRede(1, "Lat NaN", float("nan"), -46.98)

        with self.assertRaises(ValueError):
            PontoRede(1, "Custo Inf", -22.70, -46.98, id_tipo_equipamento=1, custo_equipamento=float("inf"))

        with self.assertRaises(ValueError):
            TipoCabo(1, "Cabo Inválido", custo_por_metro=-1.0, limite_distancia_metros=1000.0)

        with self.assertRaises(ValueError):
            TipoCabo(1, "Limite Infinito", custo_por_metro=4.5, limite_distancia_metros=float("inf"))

        # Tentativa de injetar NaN ou distância negativa em ArestaCandidata
        pontos = [
            PontoRede(1, "P1", -22.700, -46.980),
            PontoRede(2, "P2", -22.701, -46.981),
        ]
        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        self.assertFalse(grafo.adicionar_aresta_bidirecional(1, 2, distancia_metros=float("nan")))
        self.assertFalse(grafo.adicionar_aresta_bidirecional(1, 2, distancia_metros=float("inf")))
        self.assertFalse(grafo.adicionar_aresta_bidirecional(1, 2, distancia_metros=-50.0))
        self.assertFalse(grafo.adicionar_aresta_bidirecional(1, 2, distancia_metros=0.0))

    def test_11_brecha_colisao_de_pk_e_no_inicial_invalido(self) -> None:
        """
        Verifica bloqueio contra IDs duplicados na entrada e contra `no_inicial_id`
        inexistente ou desativado.
        """
        pontos_duplicados = [
            PontoRede(1, "Poste A", -22.700, -46.980),
            PontoRede(1, "Poste A Clonado", -22.705, -46.985),
        ]
        with self.assertRaises(ValueError):
            GrafoTopologicoOptico(1, pontos_duplicados, self.catalogo_padrao)

        pontos = [
            PontoRede(1, "Ativo", -22.700, -46.980),
            PontoRede(2, "Inativo", -22.701, -46.981, status_ponto=StatusPontoProjeto.INATIVO.value),
        ]
        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia()

        # Nó 2 está inativo e Nó 999 não existe: ambos devem lançar ValueError se exigidos como raiz
        with self.assertRaises(ValueError):
            grafo.extrair_mst_prim(no_inicial_id=2)

        with self.assertRaises(ValueError):
            grafo.extrair_mst_prim(no_inicial_id=999)

    def test_12_coordenadas_identicas_vs_subcentimetricas(self) -> None:
        """
        - Dois pontos com coordenadas idênticas têm distância 0.0 (bloqueada pela constraint CHECK > 0).
        - Dois pontos distintos a milímetros de distância preservam o piso de 0.01m.
        """
        self.assertEqual(calcular_distancia_haversine(-22.70, -46.98, -22.70, -46.98), 0.0)
        dist_micro = calcular_distancia_haversine(-22.7000000, -46.9800000, -22.70000001, -46.98000001)
        self.assertEqual(dist_micro, 0.01)

    def test_13_determinismo_sob_permutacao_e_teste_de_estresse_100_nos(self) -> None:
        """
        1. Verifica que embaralhar a ordem dos pontos/arestas com pesos empatados produz
           exatamente a mesma árvore (desempate canônico).
        2. Executa o Algoritmo de Prim em um grafo completo de 100 nós (9.900 adjacências)
           garantindo tempo de resposta sub-segundo.
        """
        # Parte 1: Empate perfeito (triângulo equilátero de 100m)
        pontos_empate = [
            PontoRede(1, "N1", -22.700, -46.980),
            PontoRede(2, "N2", -22.701, -46.981),
            PontoRede(3, "N3", -22.702, -46.982),
        ]
        arestas_empate = [
            ArestaCandidata(1, 2, distancia_metros=100.0),
            ArestaCandidata(2, 3, distancia_metros=100.0),
            ArestaCandidata(1, 3, distancia_metros=100.0),
        ]

        g1 = GrafoTopologicoOptico(1, pontos_empate, self.catalogo_padrao)
        g1.construir_lista_adjacencia(arestas_empate)
        r1 = g1.extrair_mst_prim(no_inicial_id=1)

        g2 = GrafoTopologicoOptico(1, list(reversed(pontos_empate)), self.catalogo_padrao)
        g2.construir_lista_adjacencia(list(reversed(arestas_empate)))
        r2 = g2.extrair_mst_prim(no_inicial_id=1)

        self.assertEqual(
            [(t.origem_id, t.destino_id) for t in r1.trechos_mst],
            [(t.origem_id, t.destino_id) for t in r2.trechos_mst],
        )

        # Parte 2: Estresse com 100 nós em grade geográfica
        rng = random.Random(42)
        pontos_estresse = [
            PontoRede(
                id_ponto=i,
                descricao=f"Poste #{i}",
                latitude=-22.7000 + rng.uniform(-0.01, 0.01),
                longitude=-46.9800 + rng.uniform(-0.01, 0.01),
                id_tipo_equipamento=1 if i % 3 == 0 else None,
                custo_equipamento=380.0 if i % 3 == 0 else 0.0,
            )
            for i in range(1, 101)
        ]

        inicio = time.perf_counter()
        grafo_estresse = GrafoTopologicoOptico(1, pontos_estresse, self.catalogo_padrao)
        grafo_estresse.construir_lista_adjacencia()
        res_estresse = grafo_estresse.extrair_mst_prim()
        duracao_ms = (time.perf_counter() - inicio) * 1000.0

        self.assertTrue(res_estresse.grafo_conexo)
        self.assertEqual(res_estresse.nos_ativos_processados, 100)
        self.assertEqual(len(res_estresse.trechos_mst), 99)
        self.assertLess(duracao_ms, 500.0, f"Execução lenta para 100 nós: {duracao_ms:.2f} ms")

    def test_14_google_maps_coordenadas_reais_alta_precisao_e_equador(self) -> None:
        """
        Testa coordenadas reais extraídas de cliques no Google Maps (15 casas decimais)
        e coordenadas próximas à Linha do Equador (`1e-7`), garantindo que o WKT gerado
        para o PostGIS nunca emita notação científica (`1e-07`) e retorne `caminho_coordenadas`
        no formato `{lat, lng}` do Google Maps.
        """
        pontos = [
            PontoRede(1, "Marco Zero Equador", 0.0000001, -46.985234567891234),
            PontoRede(2, "Poste Adjacente", -0.0000002, -46.985123456789123),
        ]
        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia()
        res = grafo.extrair_mst_prim()

        self.assertTrue(res.grafo_conexo)
        wkt = res.trechos_mst[0].geometria_wkt
        self.assertNotIn("e-", wkt.lower(), f"Notação científica vazou no WKT: {wkt}")
        self.assertTrue(wkt.startswith("SRID=4326;LINESTRING("))
        self.assertEqual(len(res.trechos_mst[0].caminho_coordenadas), 2)
        self.assertIn("lat", res.trechos_mst[0].caminho_coordenadas[0])
        self.assertIn("lng", res.trechos_mst[0].caminho_coordenadas[0])

    def test_15_google_maps_clique_duplo_mesma_coordenada_nao_quebra_grafo(self) -> None:
        """
        Se o usuário clicar duas vezes exatamente no mesmo pixel no Google Maps (ou cadastrar
        uma CEO e uma CTO no mesmo poste físico com mesma lat/lng), o grafo não pode ficar
        desconexo nem violar `CHECK (Distancia_Metros > 0)`.
        """
        pontos = [
            PontoRede(1, "CEO Poste #100", -22.905560, -47.060830, id_tipo_equipamento=2, custo_equipamento=520.0),
            PontoRede(2, "CTO Poste #100 (Mesmo Poste)", -22.905560, -47.060830, id_tipo_equipamento=1, custo_equipamento=380.0),
            PontoRede(3, "Poste #101", -22.906100, -47.061200, id_tipo_equipamento=1, custo_equipamento=380.0),
        ]
        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia()
        res = grafo.extrair_mst_prim()

        self.assertTrue(res.grafo_conexo)
        self.assertEqual(len(res.trechos_mst), 2)
        self.assertEqual(res.trechos_mst[0].distancia_metros, 0.01)

    def test_16_google_maps_polilinha_viaria_sinuosa_reversao_orientacao(self) -> None:
        """
        Seções 2.8 e 3.2 da Documentação:
        Quando a aresta candidata traz uma polilinha viária do Google Maps (múltiplos vértices
        acompanhando curvas de rua de 2 -> 1), se o Prim percorrer no sentido inverso (1 -> 2),
        a orientação dos vértices da polilinha deve ser invertida automaticamente para `1 -> 2`.
        """
        pontos = [
            PontoRede(1, "POP Origem", -22.9000, -47.0600),
            PontoRede(2, "CTO Destino", -22.9020, -47.0620),
        ]
        # Polilinha informada no sentido 2 -> 1 com esquina intermediária
        curva_rua = (
            CoordenadaLatLng(lat=-22.9020, lng=-47.0620),  # Nó 2
            CoordenadaLatLng(lat=-22.9015, lng=-47.0605),  # Esquina intermediária
            CoordenadaLatLng(lat=-22.9000, lng=-47.0600),  # Nó 1
        )
        arestas = [
            ArestaCandidata(
                origem_id=2,
                destino_id=1,
                distancia_metros=310.0,
                caminho_coordenadas=curva_rua,
            )
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao)
        grafo.construir_lista_adjacencia(arestas)
        # Inicia o Prim pelo Nó 1 (forçando travessia 1 -> 2, oposta ao cadastro 2 -> 1)
        res = grafo.extrair_mst_prim(no_inicial_id=1)

        trecho = res.trechos_mst[0]
        self.assertEqual(trecho.origem_id, 1)
        self.assertEqual(trecho.destino_id, 2)
        # O primeiro vértice da polilinha agora deve ser o Nó 1 e o último deve ser o Nó 2!
        self.assertAlmostEqual(trecho.caminho_coordenadas[0]["lat"], -22.9000)
        self.assertAlmostEqual(trecho.caminho_coordenadas[1]["lat"], -22.9015)
        self.assertAlmostEqual(trecho.caminho_coordenadas[2]["lat"], -22.9020)

    def test_17_isolamento_catalogo_3fn_tipo_equipamento_e_enums_fechados(self) -> None:
        """
        Seção 0.2.3 (3FN - Isolamento de Catálogos) e Seção 1 do Modelo Físico (ENUMs):
        - Valida que o custo unitário vem estritamente da tabela catálogo `Tipo_Equipamento`.
        - Rejeita FK `idTipo_Equipamento` inexistente no catálogo.
        - Rejeita valores fora dos ENUMs fechados do PostgreSQL.
        """
        catalogo_eq = [
            TipoEquipamento(
                id_tipo_equipamento=1,
                categoria=CategoriaEquipamento.CTO.value,
                fabricante=FabricanteEquipamento.FURUKAWA.value,
                custo_unitario=380.00,
            ),
            TipoEquipamento(
                id_tipo_equipamento=3,
                categoria=CategoriaEquipamento.SWITCH.value,
                fabricante=FabricanteEquipamento.HUAWEI.value,
                custo_unitario=2450.00,
            ),
        ]
        pontos = [
            PontoRede(1, "POP", -22.700, -46.980, id_tipo_equipamento=3),
            PontoRede(2, "Poste CTO", -22.701, -46.980, id_tipo_equipamento=1),
        ]

        grafo = GrafoTopologicoOptico(1, pontos, self.catalogo_padrao, catalogo_equipamentos=catalogo_eq)
        grafo.construir_lista_adjacencia()
        res = grafo.extrair_mst_prim()
        self.assertAlmostEqual(res.custo_total_equipamentos, 2450.00 + 380.00, places=2)

        # FK id_tipo_equipamento=99 não existe no catálogo -> deve lançar erro de integridade
        with self.assertRaises(ValueError):
            GrafoTopologicoOptico(
                1,
                [PontoRede(1, "Poste FK Inválida", -22.700, -46.980, id_tipo_equipamento=99)],
                self.catalogo_padrao,
                catalogo_equipamentos=catalogo_eq,
            )

        # Valores fora do domínio fechado dos ENUMs -> devem ser bloqueados
        with self.assertRaises(ValueError):
            PontoRede(1, "Status Inválido", -22.700, -46.980, status_fisico="Quebrado")

        with self.assertRaises(ValueError):
            PontoRede(1, "Status Ponto Inválido", -22.700, -46.980, status_ponto="Deletado")

        with self.assertRaises(ValueError):
            TipoEquipamento(1, categoria="Roteador Caseiro", fabricante="Furukawa", custo_unitario=100.0)

    def test_18_calculo_automatico_distancia_acumulada_polilinha_google_maps(self) -> None:
        """
        Garante que quando uma aresta traz uma polilinha viária (`caminho_coordenadas`)
        do Google Maps sem informar `distancia_metros`, o motor calcula automaticamente
        a soma geodésica dos segmentos da rua (que é maior que a linha reta euclidiana).
        """
        p1 = PontoRede(1, "Poste A", -22.7000, -46.9800)
        p2 = PontoRede(2, "Poste B", -22.7020, -46.9820)
        dist_reta = calcular_distancia_haversine(p1.latitude, p1.longitude, p2.latitude, p2.longitude)

        # Caminho contornando quarteirão em "L" (A -> esquina -> B)
        rota_quarteirao = (
            CoordenadaLatLng(lat=-22.7000, lng=-46.9800),
            CoordenadaLatLng(lat=-22.7000, lng=-46.9820),
            CoordenadaLatLng(lat=-22.7020, lng=-46.9820),
        )
        grafo = GrafoTopologicoOptico(1, [p1, p2], self.catalogo_padrao)
        grafo.construir_lista_adjacencia(
            [ArestaCandidata(origem_id=1, destino_id=2, distancia_metros=None, caminho_coordenadas=rota_quarteirao)]
        )
        res = grafo.extrair_mst_prim()

        self.assertTrue(res.grafo_conexo)
        self.assertGreater(res.metragem_total, dist_reta)


if __name__ == "__main__":
    unittest.main()

