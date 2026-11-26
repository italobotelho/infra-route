import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularBomProjeto,
  escapeCsvCell,
  gerarCsvBomETrechos,
  gerarCsvCarteiraProjetos,
  gerarGeoJsonProjeto,
  montarCsv,
} from "../src/utils/projectExport.js";
import { gerarDocumentoPdfMemorial } from "../src/utils/pdfMemorial.js";

const SAMPLE_PROJECT = {
  id_projeto: 12,
  nome: 'Backbone "Centro"; Sul',
  status: "Em Execução",
  engenheiro_nome: "Ana Souza",
  engenheiro_crea: "SP-123456/D",
  metragem_total: 450,
  custo_estimado: 5835,
  pontos: [
    {
      id_ponto: 1,
      descricao: "OLT Matriz",
      latitude: -23.55052,
      longitude: -46.633308,
      status_fisico: "Existente",
      status_ponto: "Ativo",
      id_tipo_equipamento: 3,
      custo_equipamento: 2450,
    },
    {
      id_ponto: 2,
      descricao: "CTO Praça",
      latitude: -23.55152,
      longitude: -46.634308,
      status_fisico: "Projetado",
      status_ponto: "Ativo",
      id_tipo_equipamento: 1,
      custo_equipamento: 380,
    },
    {
      id_ponto: 3,
      descricao: "Poste Antigo",
      latitude: -23.552,
      longitude: -46.635,
      status_fisico: "Projetado",
      status_ponto: "Removido",
      id_tipo_equipamento: 0,
      custo_equipamento: 0,
    },
    {
      id_ponto: 4,
      descricao: "Poste Inválido",
      latitude: Number.NaN,
      longitude: -46.636,
      status_fisico: "Projetado",
      status_ponto: "Ativo",
      id_tipo_equipamento: 0,
      custo_equipamento: 0,
    },
  ],
  trechos: [
    {
      id_trecho: 101,
      origem_id: 1,
      origem_descricao: "OLT Matriz",
      destino_id: 2,
      destino_descricao: "CTO Praça",
      id_tipo_cabo: 2,
      modelo_cabo: "AS-120 24 FO",
      distancia_metros: 200,
      custo_trecho: 1400, // R$ 7,00/m personalizado
    },
    {
      id_trecho: 102,
      origem_id: 2,
      origem_descricao: "CTO Praça",
      destino_id: 1,
      destino_descricao: "OLT Matriz",
      id_tipo_cabo: 2,
      modelo_cabo: "AS-120 24 FO",
      distancia_metros: 100,
      custo_trecho: 800, // R$ 8,00/m personalizado -> média ponderada R$ 7,33/m
    },
    {
      id_trecho: 103,
      origem_id: 1,
      origem_descricao: "OLT Matriz",
      destino_id: 2,
      destino_descricao: "CTO Praça",
      id_tipo_cabo: 1,
      modelo_cabo: "AS-80 12 FO",
      distancia_metros: 150,
      custo_trecho: 805,
    },
  ],
};

test("calcularBomProjeto calcula múltiplos cabos, média ponderada e reserva técnica com segurança", () => {
  const bom10 = calcularBomProjeto(SAMPLE_PROJECT, 10);
  assert.equal(bom10.pontosAtivosCount, 3); // exclui status_ponto === "Removido"
  assert.equal(bom10.trechosCount, 3);
  assert.equal(bom10.cabos.length, 2); // AS-120 e AS-80 agrupados separadamente
  assert.equal(bom10.metragemLiquida, 450);
  assert.equal(bom10.metragemComReserva, 495);
  assert.equal(bom10.totalEquipamentos, 2830); // 2450 + 380 + 0
  assert.equal(bom10.totalCabos, 3005); // 1400 + 800 + 805
  assert.equal(bom10.totalCabosComReserva, 3305.5);
  assert.equal(bom10.capexTotal, 5835);
  assert.equal(bom10.capexTotalComReserva, 6135.5);

  const caboAs120 = bom10.cabos.find((c) => c.codigo === "CB-2");
  assert.equal(caboAs120.quantidade, 300);
  assert.equal(caboAs120.custoUnitario, 7.33); // (1400 + 800) / 300

  const bomZero = calcularBomProjeto({ pontos: null, trechos: [{ distancia_metros: "abc", custo_trecho: -50 }] }, "invalid");
  assert.equal(bomZero.metragemLiquida, 0);
  assert.equal(bomZero.capexTotal, 0);
});

test("escapeCsvCell e montarCsv protegem contra Formula Injection preservando coordenadas negativas", () => {
  assert.equal(escapeCsvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(escapeCsvCell("+cmd|'/C calc'!A0"), "'+cmd|'/C calc'!A0");
  assert.equal(escapeCsvCell("@evil"), "'@evil");
  assert.equal(escapeCsvCell("-CMD|calc"), "'-CMD|calc");
  assert.equal(escapeCsvCell("-23,550520"), "-23,550520");
  assert.equal(escapeCsvCell('Texto; com "aspas"\ne quebra'), '"Texto; com ""aspas""\ne quebra"');

  const csv = montarCsv([
    ["Col A", "Col B"],
    ["=1+1", "Valor; 2"],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("\r\n"));
  assert.ok(csv.includes("'=1+1;\"Valor; 2\""));
});

test("gerarCsvBomETrechos gera todas as seções (BOM, Enlaces, Inventário) com vírgula PT-BR", () => {
  const csv = gerarCsvBomETrechos(SAMPLE_PROJECT, 15, { empresaNome: "InfraTelecom S.A." });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("Empresa / Tenant;InfraTelecom S.A."));
  assert.ok(csv.includes('"Backbone ""Centro""; Sul"'));
  assert.ok(csv.includes("1. LISTA DE MATERIAIS (BOM)"));
  assert.ok(csv.includes("2. ENLACES OTIMIZADOS (ÁRVORE GERADORA MÍNIMA — PRIM)"));
  assert.ok(csv.includes("3. INVENTÁRIO DE ATIVOS GEORREFERENCIADOS (WGS 84)"));
  assert.ok(csv.includes("-23,550520;-46,633308"));
  assert.ok(csv.includes("TOTAL CAPEX ESTIMADO (C/ RESERVA)"));
});

test("gerarCsvCarteiraProjetos exclui cancelados do total válido e formata PT-BR", () => {
  const carteira = [
    {
      id_projeto: 1,
      nome: "Projeto Ativo",
      status: "Em Execução",
      metragem_total: 1500,
      custo_estimado: 7500,
      engenheiro_nome: "Ana",
      engenheiro_crea: "SP-1",
      data_criacao: "2026-11-25T15:00:00Z",
    },
    {
      id_projeto: 2,
      nome: "Projeto Cancelado",
      status: "Cancelado",
      metragem_total: 9000,
      custo_estimado: 99999,
      engenheiro_nome: "Carlos",
      engenheiro_crea: "SP-2",
      data_criacao: "2026-11-25T15:00:00Z",
    },
  ];
  const csvValido = gerarCsvCarteiraProjetos(carteira, { includeCanceled: false });
  assert.ok(!csvValido.includes("Projeto Cancelado"));
  assert.ok(csvValido.includes("IR-0001;Projeto Ativo;Em Execução;1500,0;1,500;7500,00;5000,00"));

  const csvCompleto = gerarCsvCarteiraProjetos(carteira, { includeCanceled: true });
  assert.ok(csvCompleto.includes("Projeto Cancelado"));
  assert.ok(csvCompleto.includes("TOTAL VÁLIDO;1 projeto(s) ativo(s)/concluído(s)"));
  assert.ok(csvCompleto.includes("1500,0;1,500;7500,00;5000,00"));
});

test("gerarGeoJsonProjeto filtra coordenadas inválidas e nós removidos", () => {
  const geo = gerarGeoJsonProjeto(SAMPLE_PROJECT);
  assert.equal(geo.type, "FeatureCollection");
  const pontos = geo.features.filter((f) => f.geometry.type === "Point");
  const linhas = geo.features.filter((f) => f.geometry.type === "LineString");
  assert.equal(pontos.length, 2); // exclui id 3 (Removido) e id 4 (NaN)
  assert.equal(linhas.length, 3);
  assert.deepEqual(pontos[0].geometry.coordinates, [-46.633308, -23.55052]);
});

test("gerarDocumentoPdfMemorial gera PDF A4 multipágina válido sem cortes", async () => {
  const manyPontos = Array.from({ length: 48 }, (_, idx) => ({
    id_ponto: idx + 1,
    descricao: `Poste Tronco #${idx + 1}`,
    latitude: -23.55 - idx * 0.0002,
    longitude: -46.63 - idx * 0.0002,
    status_fisico: idx === 0 ? "Existente" : "Projetado",
    status_ponto: "Ativo",
    id_tipo_equipamento: idx === 0 ? 3 : idx % 5 === 0 ? 1 : 0,
    custo_equipamento: idx === 0 ? 2450 : idx % 5 === 0 ? 380 : 0,
  }));
  const manyTrechos = Array.from({ length: 47 }, (_, idx) => ({
    id_trecho: idx + 1,
    origem_id: idx + 1,
    origem_descricao: `Poste Tronco #${idx + 1}`,
    destino_id: idx + 2,
    destino_descricao: `Poste Tronco #${idx + 2}`,
    id_tipo_cabo: (idx % 3) + 1,
    modelo_cabo: idx % 3 === 2 ? "AS-200 48 FO" : idx % 3 === 1 ? "AS-120 24 FO" : "AS-80 12 FO",
    distancia_metros: 85.5,
    custo_trecho: 520.25,
  }));

  const doc = await gerarDocumentoPdfMemorial(
    {
      ...SAMPLE_PROJECT,
      nome: "Projeto Troncal Metropolitano Extenso de Alta Densidade Óptica",
      pontos: manyPontos,
      trechos: manyTrechos,
    },
    10,
    { empresaNome: "InfraTelecom S.A." },
  );

  const pageCount = doc.getNumberOfPages();
  assert.ok(pageCount >= 2, `Esperado >= 2 páginas para 48 pontos e 47 trechos, veio ${pageCount}`);

  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  assert.equal(header, "%PDF-");
  assert.ok(pdfBytes.byteLength > 2000);
});
