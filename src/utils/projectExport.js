/**
 * Utilitários puros para cálculo de Lista de Materiais (BOM / CAPEX)
 * e exportação técnica multi-formato (.geojson, .csv, .json) do InfraRoute.
 */

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

/**
 * Agrupa equipamentos (3FN) e cabos ópticos aplicando percentual de reserva técnica (ex.: 10%).
 */
export function calcularBomProjeto(projectDetail, reservaTecnicaPct = 10) {
  const reservaFactor = 1 + Math.max(0, Number(reservaTecnicaPct) || 0) / 100;
  const pontosAtivos = (projectDetail?.pontos || []).filter(
    (p) => !p.status_ponto || p.status_ponto === "Ativo",
  );
  const trechos = projectDetail?.trechos || [];

  const gruposEquip = new Map();
  for (const pt of pontosAtivos) {
    const tipoId = pt.id_tipo_equipamento ?? 0;
    const meta = EQUIPAMENTO_CATALOGO_FALLBACK[tipoId] || {
      categoria: "Poste de Passagem (Apoio)",
      fabricante: "Infraestrutura Parceira",
      custoUnitario: 0,
    };
    const custoUnit = Number(pt.custo_equipamento ?? meta.custoUnitario) || 0;
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
    atual.subtotal = Number((atual.quantidade * atual.custoUnitario).toFixed(2));
    atual.subtotalComReserva = atual.subtotal;
    gruposEquip.set(chave, atual);
  }

  const gruposCabos = new Map();
  for (const tr of trechos) {
    const caboId = tr.id_tipo_cabo ?? 1;
    const modelo = tr.modelo_cabo || `Cabo Óptico #${caboId}`;
    const dist = Number(tr.distancia_metros) || 0;
    const custoTr = Number(tr.custo_trecho) || 0;
    const precoMetro = dist > 0 ? custoTr / dist : (CABO_PRECO_FALLBACK[caboId] ?? 4.5);
    const chave = `${caboId}:${modelo}`;
    const atual = gruposCabos.get(chave) || {
      codigo: `CB-${caboId}`,
      item: modelo,
      fabricante: "Rede Óptica OSP",
      unidade: "m",
      quantidade: 0,
      quantidadeComReserva: 0,
      custoUnitario: Number(precoMetro.toFixed(2)),
      subtotal: 0,
      subtotalComReserva: 0,
    };
    atual.quantidade = Number((atual.quantidade + dist).toFixed(2));
    atual.quantidadeComReserva = Number((atual.quantidade * reservaFactor).toFixed(2));
    atual.subtotal = Number((atual.subtotal + custoTr).toFixed(2));
    atual.subtotalComReserva = Number((atual.subtotal * reservaFactor).toFixed(2));
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

  return {
    itens: [...equipamentos, ...cabos],
    equipamentos,
    cabos,
    pontosAtivosCount: pontosAtivos.length,
    trechosCount: trechos.length,
    metragemLiquida,
    metragemComReserva,
    totalEquipamentos,
    totalCabos,
    totalCabosComReserva,
    capexTotal: Number((totalEquipamentos + totalCabos).toFixed(2)),
    capexTotalComReserva: Number((totalEquipamentos + totalCabosComReserva).toFixed(2)),
  };
}

/**
 * Gera FeatureCollection GeoJSON (RFC 7946 / WGS 84 SRID 4326) compatível com QGIS e PostGIS.
 */
export function gerarGeoJsonProjeto(projectDetail) {
  const pontos = projectDetail?.pontos || [];
  const pontosById = new Map(pontos.map((p) => [p.id_ponto, p]));
  const trechos = projectDetail?.trechos || [];

  const featuresPontos = pontos
    .filter((pt) => !pt.status_ponto || pt.status_ponto === "Ativo")
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
        status_ponto: pt.status_ponto,
        id_tipo_equipamento: pt.id_tipo_equipamento,
        custo_equipamento: pt.custo_equipamento,
        tipo_camada: "Ponto_Rede",
      },
    }));

  const featuresTrechos = trechos
    .map((tr) => {
      const coords =
        Array.isArray(tr.caminho_coordenadas) && tr.caminho_coordenadas.length >= 2
          ? tr.caminho_coordenadas.map((c) => [Number(c.lng), Number(c.lat)])
          : (() => {
              const orig = pontosById.get(tr.origem_id);
              const dest = pontosById.get(tr.destino_id);
              if (!orig || !dest) return null;
              return [
                [Number(orig.longitude), Number(orig.latitude)],
                [Number(dest.longitude), Number(dest.latitude)],
              ];
            })();

      if (!coords) return null;
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: coords,
        },
        properties: {
          id_trecho: tr.id_trecho,
          origem_id: tr.origem_id,
          origem_descricao: tr.origem_descricao,
          destino_id: tr.destino_id,
          destino_descricao: tr.destino_descricao,
          id_tipo_cabo: tr.id_tipo_cabo,
          modelo_cabo: tr.modelo_cabo,
          distancia_metros: tr.distancia_metros,
          custo_trecho: tr.custo_trecho,
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
      metragem_total_m: projectDetail?.metragem_total,
      custo_estimado_brl: projectDetail?.custo_estimado,
      gerado_em_utc: new Date().toISOString(),
    },
    features: [...featuresPontos, ...featuresTrechos],
  };
}

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gera planilha CSV UTF-8 com BOM (\uFEFF) separada por `;` pronta para Excel PT-BR.
 */
export function gerarCsvBomETrechos(projectDetail, reservaTecnicaPct = 10) {
  const bom = calcularBomProjeto(projectDetail, reservaTecnicaPct);
  const linhas = [
    ["InfraRoute — Memorial Descritivo & Orçamento CAPEX"],
    ["Projeto", projectDetail?.nome || ""],
    ["Código", `IR-${String(projectDetail?.id_projeto || 0).padStart(4, "0")}`],
    ["Status", projectDetail?.status || ""],
    ["Responsável Técnico", projectDetail?.engenheiro_nome || "Engenheiro Responsável"],
    ["CREA", projectDetail?.engenheiro_crea || "N/A"],
    ["Reserva Técnica Aplicada (%)", String(reservaTecnicaPct)],
    [],
    ["LISTA DE MATERIAIS (BOM)"],
    ["Código", "Item / Descrição", "Fabricante / Classe", "Unidade", "Qtd Líquida", "Qtd c/ Reserva", "Custo Unitário (R$)", "Subtotal c/ Reserva (R$)"],
    ...bom.itens.map((item) => [
      item.codigo,
      item.item,
      item.fabricante,
      item.unidade,
      item.quantidade.toFixed(2).replace(".", ","),
      item.quantidadeComReserva.toFixed(2).replace(".", ","),
      item.custoUnitario.toFixed(2).replace(".", ","),
      item.subtotalComReserva.toFixed(2).replace(".", ","),
    ]),
    ["", "TOTAL CAPEX ESTIMADO (C/ RESERVA)", "", "", "", "", "", bom.capexTotalComReserva.toFixed(2).replace(".", ",")],
    [],
    ["ENLACES OTIMIZADOS (ÁRVORE GERADORA MÍNIMA — PRIM)"],
    ["ID Trecho", "Origem", "Destino", "Modelo de Cabo", "Distância (m)", "Custo Trecho (R$)"],
    ...(projectDetail?.trechos || []).map((tr) => [
      tr.id_trecho,
      tr.origem_descricao,
      tr.destino_descricao,
      tr.modelo_cabo,
      Number(tr.distancia_metros).toFixed(2).replace(".", ","),
      Number(tr.custo_trecho).toFixed(2).replace(".", ","),
    ]),
  ];

  const corpo = linhas.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");
  return `\uFEFF${corpo}`;
}

export function baixarArquivo(conteudo, nomeArquivo, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([conteudo], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nomeArquivo;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
