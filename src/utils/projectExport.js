/**
 * Utilitários puros para cálculo de Lista de Materiais (BOM / CAPEX)
 * e exportação técnica multi-formato (.geojson, .csv, .json) do InfraRoute.
 */

import { formatarDataBr, formatarDataHoraBr } from "./dateTime.js";

const EQUIPAMENTO_CATALOGO_FALLBACK = {
  1: { categoria: "CTO (Caixa de Terminação Óptica)", fabricante: "Furukawa", custoUnitario: 380.0 },
  2: { categoria: "CEO (Caixa de Emenda Óptica)", fabricante: "Furukawa", custoUnitario: 520.0 },
  3: { categoria: "Switch / OLT Central", fabricante: "Huawei", custoUnitario: 2450.0 },
};

const CABO_PRECO_FALLBACK = {
  1: 4.5,
  2: 6.8,
  3: 9.5,
};

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeNonNegative(value, fallback = 0) {
  const parsed = toSafeNumber(value, fallback);
  return parsed >= 0 ? parsed : fallback;
}

function isValidWgs84Coord(lng, lat) {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
}

/**
 * Escapa célula CSV para padrão Excel PT-BR (;), neutralizando CSV Formula Injection.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  let str = String(value);
  const trimmedStart = str.trimStart();
  const isNegativeNumeric = /^-[\d.,]+$/.test(trimmedStart);
  if (
    trimmedStart.startsWith("=") ||
    trimmedStart.startsWith("+") ||
    trimmedStart.startsWith("@") ||
    str.startsWith("\t") ||
    str.startsWith("\r") ||
    (trimmedStart.startsWith("-") && !isNegativeNumeric)
  ) {
    str = `'${str}`;
  }
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formata número para planilha PT-BR (vírgula decimal) com proteção contra NaN/Infinity.
 */
export function formatarNumeroCsv(valor, casas = 2) {
  return toSafeNumber(valor, 0).toFixed(casas).replace(".", ",");
}

/**
 * Monta string CSV UTF-8 com BOM (\uFEFF), separador `;` e quebra CRLF (\r\n).
 */
export function montarCsv(linhas) {
  const corpo = (Array.isArray(linhas) ? linhas : [])
    .map((row) => (Array.isArray(row) ? row : [row]).map(escapeCsvCell).join(";"))
    .join("\r\n");
  return `\uFEFF${corpo}`;
}

/**
 * Agrupa equipamentos (3FN) e cabos ópticos aplicando percentual de reserva técnica (ex.: 10%).
 */
export function calcularBomProjeto(projectDetail, reservaTecnicaPct = 10) {
  const safeReservaPct = toSafeNonNegative(reservaTecnicaPct, 10);
  const reservaFactor = 1 + safeReservaPct / 100;
  const pontosAtivos = (projectDetail?.pontos || []).filter(
    (p) => p && (!p.status_ponto || p.status_ponto === "Ativo"),
  );
  const trechos = Array.isArray(projectDetail?.trechos) ? projectDetail.trechos : [];

  const gruposEquip = new Map();
  for (const pt of pontosAtivos) {
    const tipoId = pt.id_tipo_equipamento ?? 0;
    const meta = EQUIPAMENTO_CATALOGO_FALLBACK[tipoId] || {
      categoria: "Poste de Passagem (Apoio)",
      fabricante: "Infraestrutura Parceira",
      custoUnitario: 0,
    };
    const custoUnit = toSafeNonNegative(pt.custo_equipamento ?? meta.custoUnitario, 0);
    const chave = `${tipoId}:${meta.categoria}`;
    const atual = gruposEquip.get(chave) || {
      codigo: tipoId === 0 ? "POSTE" : `EQ-${tipoId}`,
      item: meta.categoria,
      fabricante: meta.fabricante,
      unidade: "un",
      quantidade: 0,
      quantidadeComReserva: 0,
      custoUnitario: custoUnit,
      subtotal: 0,
      subtotalComReserva: 0,
    };
    atual.quantidade += 1;
    atual.quantidadeComReserva += 1;
    atual.subtotal = Number((atual.subtotal + custoUnit).toFixed(2));
    atual.subtotalComReserva = atual.subtotal;
    atual.custoUnitario =
      atual.quantidade > 0 ? Number((atual.subtotal / atual.quantidade).toFixed(2)) : 0;
    gruposEquip.set(chave, atual);
  }

  const gruposCabos = new Map();
  for (const tr of trechos) {
    if (!tr) continue;
    const caboId = tr.id_tipo_cabo ?? 1;
    const modelo = tr.modelo_cabo || `Cabo Óptico #${caboId}`;
    const dist = toSafeNonNegative(tr.distancia_metros, 0);
    const custoTr = toSafeNonNegative(tr.custo_trecho, 0);
    const fallbackPreco = CABO_PRECO_FALLBACK[caboId] ?? 4.5;
    const chave = `${caboId}:${modelo}`;
    const atual = gruposCabos.get(chave) || {
      codigo: `CB-${caboId}`,
      item: modelo,
      fabricante: "Rede Óptica OSP",
      unidade: "m",
      quantidade: 0,
      quantidadeComReserva: 0,
      custoUnitario: Number(fallbackPreco.toFixed(2)),
      subtotal: 0,
      subtotalComReserva: 0,
    };
    atual.quantidade = Number((atual.quantidade + dist).toFixed(2));
    atual.quantidadeComReserva = Number((atual.quantidade * reservaFactor).toFixed(2));
    atual.subtotal = Number((atual.subtotal + custoTr).toFixed(2));
    atual.subtotalComReserva = Number((atual.subtotal * reservaFactor).toFixed(2));
    atual.custoUnitario =
      atual.quantidade > 0
        ? Number((atual.subtotal / atual.quantidade).toFixed(2))
        : Number(fallbackPreco.toFixed(2));
    gruposCabos.set(chave, atual);
  }

  const equipamentos = Array.from(gruposEquip.values());
  const cabos = Array.from(gruposCabos.values());

  const totalEquipamentos = Number(
    equipamentos.reduce((acc, row) => acc + row.subtotal, 0).toFixed(2),
  );
  const totalCabos = Number(
    cabos.reduce((acc, row) => acc + row.subtotal, 0).toFixed(2),
  );
  const totalCabosComReserva = Number(
    cabos.reduce((acc, row) => acc + row.subtotalComReserva, 0).toFixed(2),
  );
  const metragemLiquida = Number(
    cabos.reduce((acc, row) => acc + row.quantidade, 0).toFixed(2),
  );
  const metragemComReserva = Number(
    cabos.reduce((acc, row) => acc + row.quantidadeComReserva, 0).toFixed(2),
  );
  const capexTotal = Number((totalEquipamentos + totalCabos).toFixed(2));
  const capexTotalComReserva = Number((totalEquipamentos + totalCabosComReserva).toFixed(2));
  const custoPorKm =
    metragemLiquida > 0 ? Number((capexTotal / (metragemLiquida / 1000)).toFixed(2)) : 0;
  const custoPorKmComReserva =
    metragemLiquida > 0
      ? Number((capexTotalComReserva / (metragemLiquida / 1000)).toFixed(2))
      : 0;

  return {
    itens: [...equipamentos, ...cabos],
    equipamentos,
    cabos,
    pontosAtivos,
    pontosAtivosCount: pontosAtivos.length,
    trechosCount: trechos.length,
    metragemLiquida,
    metragemComReserva,
    totalEquipamentos,
    totalCabos,
    totalCabosComReserva,
    capexTotal,
    capexTotalComReserva,
    custoPorKm,
    custoPorKmComReserva,
  };
}

/**
 * Gera FeatureCollection GeoJSON (RFC 7946 / WGS 84 SRID 4326) compatível com QGIS e PostGIS.
 */
export function gerarGeoJsonProjeto(projectDetail) {
  const pontos = Array.isArray(projectDetail?.pontos) ? projectDetail.pontos : [];
  const pontosById = new Map(pontos.map((p) => [p.id_ponto, p]));
  const trechos = Array.isArray(projectDetail?.trechos) ? projectDetail.trechos : [];

  const featuresPontos = pontos
    .filter((pt) => {
      if (!pt || (pt.status_ponto && pt.status_ponto !== "Ativo")) return false;
      return isValidWgs84Coord(Number(pt.longitude), Number(pt.latitude));
    })
    .map((pt) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(pt.longitude), Number(pt.latitude)],
      },
      properties: {
        id_ponto: pt.id_ponto,
        descricao: pt.descricao,
        status_fisico: pt.status_fisico,
        status_ponto: pt.status_ponto || "Ativo",
        id_tipo_equipamento: pt.id_tipo_equipamento ?? 0,
        custo_equipamento: toSafeNonNegative(pt.custo_equipamento, 0),
        tipo_camada: "Ponto_Rede",
      },
    }));

  const featuresTrechos = trechos
    .map((tr) => {
      if (!tr) return null;
      const rawPath = Array.isArray(tr.caminho_coordenadas)
        ? tr.caminho_coordenadas
            .map((c) => [Number(c?.lng), Number(c?.lat)])
            .filter(([lng, lat]) => isValidWgs84Coord(lng, lat))
        : [];

      const coords =
        rawPath.length >= 2
          ? rawPath
          : (() => {
              const orig = pontosById.get(tr.origem_id ?? tr.id_ponto_origem);
              const dest = pontosById.get(tr.destino_id ?? tr.id_ponto_destino);
              if (!orig || !dest) return null;
              const origLng = Number(orig.longitude);
              const origLat = Number(orig.latitude);
              const destLng = Number(dest.longitude);
              const destLat = Number(dest.latitude);
              if (!isValidWgs84Coord(origLng, origLat) || !isValidWgs84Coord(destLng, destLat)) {
                return null;
              }
              return [
                [origLng, origLat],
                [destLng, destLat],
              ];
            })();

      if (!coords || coords.length < 2) return null;
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        properties: {
          id_trecho: tr.id_trecho,
          origem_id: tr.origem_id ?? tr.id_ponto_origem,
          origem_descricao: tr.origem_descricao,
          destino_id: tr.destino_id ?? tr.id_ponto_destino,
          destino_descricao: tr.destino_descricao,
          id_tipo_cabo: tr.id_tipo_cabo,
          modelo_cabo: tr.modelo_cabo,
          distancia_metros: toSafeNonNegative(tr.distancia_metros, 0),
          custo_trecho: toSafeNonNegative(tr.custo_trecho, 0),
          tipo_camada: "Trecho_Rede_AGM",
        },
      };
    })
    .filter(Boolean);

  return {
    type: "FeatureCollection",
    name: `InfraRoute_${projectDetail?.id_projeto || "projeto"}`,
    properties: {
      id_projeto: projectDetail?.id_projeto,
      nome: projectDetail?.nome,
      status: projectDetail?.status,
      engenheiro_nome: projectDetail?.engenheiro_nome,
      engenheiro_crea: projectDetail?.engenheiro_crea,
      metragem_total_m: toSafeNonNegative(projectDetail?.metragem_total, 0),
      custo_estimado_brl: toSafeNonNegative(projectDetail?.custo_estimado, 0),
      gerado_em_utc: new Date().toISOString(),
    },
    features: [...featuresPontos, ...featuresTrechos],
  };
}

/**
 * Gera planilha CSV UTF-8 com BOM (\uFEFF) separada por `;` pronta para Excel PT-BR.
 */
export function gerarCsvBomETrechos(projectDetail, reservaTecnicaPct = 10, options = {}) {
  const safePct = toSafeNonNegative(reservaTecnicaPct, 10);
  const bom = calcularBomProjeto(projectDetail, safePct);
  const trechos = Array.isArray(projectDetail?.trechos) ? projectDetail.trechos : [];
  const totalTrechosDist = trechos.reduce((acc, tr) => acc + toSafeNonNegative(tr?.distancia_metros, 0), 0);
  const totalTrechosCusto = trechos.reduce((acc, tr) => acc + toSafeNonNegative(tr?.custo_trecho, 0), 0);

  const linhas = [
    ["InfraRoute — Memorial Descritivo & Orçamento CAPEX"],
    ["Projeto", projectDetail?.nome || ""],
    ["Código", `IR-${String(projectDetail?.id_projeto || 0).padStart(4, "0")}`],
    ["Status", projectDetail?.status || ""],
    ...(options?.empresaNome ? [["Empresa / Tenant", options.empresaNome]] : []),
    ["Responsável Técnico", projectDetail?.engenheiro_nome || "Engenheiro Responsável"],
    ["CREA", projectDetail?.engenheiro_crea || "N/A"],
    ["Data de Emissão (BRT)", `${formatarDataHoraBr(new Date())} BRT`],
    ["Reserva Técnica Aplicada (%)", formatarNumeroCsv(safePct, 0)],
    ["Metragem Líquida AGM (m)", formatarNumeroCsv(bom.metragemLiquida, 2)],
    ["Metragem c/ Reserva (m)", formatarNumeroCsv(bom.metragemComReserva, 2)],
    ["Custo Médio / km c/ Reserva (R$)", formatarNumeroCsv(bom.custoPorKmComReserva, 2)],
    [],
    ["1. LISTA DE MATERIAIS (BOM)"],
    [
      "Código",
      "Item / Descrição",
      "Fabricante / Classe",
      "Unidade",
      "Qtd Líquida",
      "Qtd c/ Reserva",
      "Custo Unitário (R$)",
      "Subtotal Líquido (R$)",
      "Subtotal c/ Reserva (R$)",
    ],
    ...bom.itens.map((item) => [
      item.codigo,
      item.item,
      item.fabricante,
      item.unidade,
      formatarNumeroCsv(item.quantidade, item.unidade === "m" ? 2 : 0),
      formatarNumeroCsv(item.quantidadeComReserva, item.unidade === "m" ? 2 : 0),
      formatarNumeroCsv(item.custoUnitario, 2),
      formatarNumeroCsv(item.subtotal, 2),
      formatarNumeroCsv(item.subtotalComReserva, 2),
    ]),
    [
      "",
      "SUBTOTAL EQUIPAMENTOS",
      "",
      "",
      "",
      "",
      "",
      formatarNumeroCsv(bom.totalEquipamentos, 2),
      formatarNumeroCsv(bom.totalEquipamentos, 2),
    ],
    [
      "",
      `SUBTOTAL CABOS (+${safePct}% RESERVA)`,
      "",
      "",
      "",
      "",
      "",
      formatarNumeroCsv(bom.totalCabos, 2),
      formatarNumeroCsv(bom.totalCabosComReserva, 2),
    ],
    [
      "",
      "TOTAL CAPEX ESTIMADO (C/ RESERVA)",
      "",
      "",
      "",
      "",
      "",
      formatarNumeroCsv(bom.capexTotal, 2),
      formatarNumeroCsv(bom.capexTotalComReserva, 2),
    ],
    [],
    ["2. ENLACES OTIMIZADOS (ÁRVORE GERADORA MÍNIMA — PRIM)"],
    ["ID Trecho", "Origem", "Destino", "Modelo de Cabo", "Distância (m)", "Custo Trecho (R$)"],
    ...trechos.map((tr) => [
      tr.id_trecho ?? "",
      tr.origem_descricao || "",
      tr.destino_descricao || "",
      tr.modelo_cabo || "",
      formatarNumeroCsv(tr.distancia_metros, 2),
      formatarNumeroCsv(tr.custo_trecho, 2),
    ]),
    [
      "",
      "TOTAL DOS ENLACES",
      `${trechos.length} trecho(s)`,
      "",
      formatarNumeroCsv(totalTrechosDist, 2),
      formatarNumeroCsv(totalTrechosCusto, 2),
    ],
    [],
    ["3. INVENTÁRIO DE ATIVOS GEORREFERENCIADOS (WGS 84)"],
    ["ID Ponto", "Descrição", "Equipamento / Classe", "Status Físico", "Latitude", "Longitude", "Custo Unitário (R$)"],
    ...bom.pontosAtivos.map((pt) => {
      const tipoId = pt.id_tipo_equipamento ?? 0;
      const meta = EQUIPAMENTO_CATALOGO_FALLBACK[tipoId] || {
        categoria: "Poste de Passagem (Apoio)",
        custoUnitario: 0,
      };
      return [
        pt.id_ponto ?? "",
        pt.descricao || "",
        meta.categoria,
        pt.status_fisico || "Projetado",
        formatarNumeroCsv(pt.latitude, 6),
        formatarNumeroCsv(pt.longitude, 6),
        formatarNumeroCsv(pt.custo_equipamento ?? meta.custoUnitario, 2),
      ];
    }),
  ];

  return montarCsv(linhas);
}

/**
 * Gera planilha CSV da carteira executiva de projetos (Excel PT-BR).
 */
export function gerarCsvCarteiraProjetos(projetos, { includeCanceled = false } = {}) {
  const list = Array.isArray(projetos) ? projetos : [];
  const scoped = includeCanceled ? list : list.filter((p) => p?.status !== "Cancelado");

  let totalMeters = 0;
  let totalCapex = 0;

  const rows = scoped.map((p) => {
    const meters = toSafeNonNegative(p?.metragem_total, 0);
    const capex = toSafeNonNegative(p?.custo_estimado, 0);
    const costKm = meters > 0 ? capex / (meters / 1000) : 0;
    if (p?.status !== "Cancelado") {
      totalMeters += meters;
      totalCapex += capex;
    }
    const code = `IR-${String(p?.id_projeto ?? 0).padStart(4, "0")}`;
    return [
      code,
      p?.nome || "",
      p?.status || "",
      formatarNumeroCsv(meters, 1),
      formatarNumeroCsv(meters / 1000, 3),
      formatarNumeroCsv(capex, 2),
      formatarNumeroCsv(costKm, 2),
      p?.engenheiro_nome || `Eng. #${p?.id_engenheiro ?? "-"}`,
      p?.engenheiro_crea || "",
      p?.data_criacao ? formatarDataBr(p.data_criacao) : "",
    ];
  });

  const avgCostKm = totalMeters > 0 ? totalCapex / (totalMeters / 1000) : 0;

  return montarCsv([
    [
      "Código",
      "Nome",
      "Status",
      "Extensão (m)",
      "Extensão (km)",
      "CAPEX (R$)",
      "Custo / km (R$)",
      "Responsável Técnico",
      "CREA",
      "Data de Criação",
    ],
    ...rows,
    [
      "TOTAL VÁLIDO",
      `${scoped.filter((p) => p?.status !== "Cancelado").length} projeto(s) ativo(s)/concluído(s)`,
      includeCanceled ? "Escopo completo (soma exclui cancelados)" : "Cancelados excluídos",
      formatarNumeroCsv(totalMeters, 1),
      formatarNumeroCsv(totalMeters / 1000, 3),
      formatarNumeroCsv(totalCapex, 2),
      formatarNumeroCsv(avgCostKm, 2),
      "",
      "",
      "",
    ],
  ]);
}

function sanitizeFilename(nomeArquivo) {
  const cleaned = String(nomeArquivo || "exportacao-infraroute.txt")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .trim();
  return cleaned || "exportacao-infraroute.txt";
}

export function baixarArquivo(conteudo, nomeArquivo, mimeType = "text/plain;charset=utf-8") {
  const safeName = sanitizeFilename(nomeArquivo);
  const blob = new Blob([conteudo], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    URL.revokeObjectURL(url);
  }
}
