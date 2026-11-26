/**
 * Gerador programático de Memorial Descritivo & Orçamento CAPEX em PDF (A4 multipágina).
 * Substitui `window.print()` para evitar cortes de página, quebras de tabela e diferenças entre navegadores.
 */

import { formatarDataBr, formatarDataHoraBr } from "./dateTime.js";
import { calcularBomProjeto } from "./projectExport.js";

const EQUIPAMENTO_CLASSE = {
  1: "CTO (Terminação Óptica)",
  2: "CEO (Emenda Óptica)",
  3: "Switch / OLT Central",
};

function formatBrl(valor, casas = 2) {
  const num = Number(valor);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function formatNumBr(valor, casas = 2) {
  const num = Number(valor);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

async function carregarLogoDataUrl(url = "/infraroute-logo.png") {
  if (typeof fetch !== "function" || typeof FileReader === "undefined") {
    return null;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ensureSpace(doc, currentY, neededHeight, margin = 14) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - 16;
  if (currentY + neededHeight > bottomLimit) {
    doc.addPage();
    return margin + 4;
  }
  return currentY;
}

function drawSectionHeading(doc, y, title, margin = 14) {
  const nextY = ensureSpace(doc, y, 16, margin);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(title, margin, nextY);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, nextY + 1.8, doc.internal.pageSize.getWidth() - margin, nextY + 1.8);
  return nextY + 5;
}

/**
 * Constrói e retorna a instância `jsPDF` A4 completa do Memorial Descritivo & BOM.
 */
export async function gerarDocumentoPdfMemorial(
  projectDetail,
  reservaTecnicaPct = 10,
  options = {},
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.autoTable || autoTableMod.default;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const safeReservaPct = Number.isFinite(Number(reservaTecnicaPct))
    ? Math.max(0, Number(reservaTecnicaPct))
    : 10;
  const bom = calcularBomProjeto(projectDetail, safeReservaPct);
  const projectCode = `IR-${String(projectDetail?.id_projeto || 0).padStart(4, "0")}`;
  const projectName = String(projectDetail?.nome || "Projeto Sem Título");
  const trechos = Array.isArray(projectDetail?.trechos) ? projectDetail.trechos : [];
  const emittedAt = new Date();
  const logoDataUrl = options.logoDataUrl ?? (await carregarLogoDataUrl());

  // 1. Banner Institucional Superior
  const titleLines = doc.splitTextToSize(`${projectName} (${projectCode})`, contentWidth - 46);
  const headerHeight = Math.max(26, 16 + titleLines.length * 5.2);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, headerHeight - 1.2, pageWidth, 1.2, "F");

  let textStartX = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, 5, 13, 13);
      textStartX = margin + 17;
    } catch {
      textStartX = margin;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(96, 165, 250);
  doc.text("INFRAROUTE  |  MEMORIAL DESCRITIVO & ORÇAMENTO CAPEX", textStartX, 8.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(248, 250, 252);
  doc.text(titleLines, textStartX, 14.8);

  // Selo de status no canto direito
  const statusLabel = String(projectDetail?.status || "Em Planejamento");
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(71, 85, 105);
  doc.roundedRect(pageWidth - margin - 34, 6.5, 34, 7.5, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text(statusLabel, pageWidth - margin - 17, 11.4, { align: "center" });

  let y = headerHeight + 7;

  // 2. Cartão de Identificação Técnica
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 21, 2, 2, "FD");

  const colW = contentWidth / 4;
  const metaItems = [
    {
      label: "EMPRESA / TENANT",
      value: options?.empresaNome || `Empresa #${projectDetail?.id_empresa ?? "-"}`,
    },
    {
      label: "RESPONSÁVEL TÉCNICO",
      value: `${projectDetail?.engenheiro_nome || `Engenheiro #${projectDetail?.id_engenheiro ?? "-"}`}${
        projectDetail?.engenheiro_crea ? ` · CREA ${projectDetail.engenheiro_crea}` : ""
      }`,
    },
    {
      label: "EMISSÃO (BRT)",
      value: `${formatarDataHoraBr(emittedAt)} BRT`,
    },
    {
      label: "CRIAÇÃO / RESERVA",
      value: `${projectDetail?.data_criacao ? formatarDataBr(projectDetail.data_criacao) : "—"} · +${safeReservaPct}%`,
    },
  ];

  metaItems.forEach((item, idx) => {
    const x = margin + 3 + idx * colW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(String(item.value), colW - 5).slice(0, 2);
    doc.text(wrapped, x, y + 10.5);
  });

  y += 26;

  // 3. Faixa de 4 KPIs Executivos
  const gap = 3;
  const kpiW = (contentWidth - gap * 3) / 4;
  const kpis = [
    {
      label: "METRAGEM LÍQUIDA AGM",
      value: `${formatNumBr(bom.metragemLiquida, 2)} m`,
      accent: [37, 99, 235],
    },
    {
      label: `CABO C/ RESERVA (+${safeReservaPct}%)`,
      value: `${formatNumBr(bom.metragemComReserva, 2)} m`,
      accent: [2, 132, 199],
    },
    {
      label: "CAPEX TOTAL ESTIMADO",
      value: formatBrl(bom.capexTotalComReserva, 2),
      accent: [5, 150, 105],
    },
    {
      label: "CUSTO MÉDIO / KM (OSP)",
      value: formatBrl(bom.custoPorKmComReserva, 0),
      accent: [79, 70, 229],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiW + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, y, kpiW, 17, 2, 2, "FD");
    doc.setFillColor(...kpi.accent);
    doc.rect(x, y, kpiW, 1.3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 3, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...kpi.accent);
    doc.text(kpi.value, x + 3, y + 12.8);
  });

  y += 23;

  // 4. Seção 1: Lista de Materiais (BOM)
  y = drawSectionHeading(doc, y, "1. Lista de Materiais (Bill of Materials — 3FN)", margin);

  const bomBody = bom.itens.length
    ? bom.itens.map((item) => [
        item.codigo,
        item.item,
        item.fabricante,
        `${item.unidade === "m" ? formatNumBr(item.quantidade, 2) : item.quantidade} ${item.unidade}`,
        `${item.unidade === "m" ? formatNumBr(item.quantidadeComReserva, 2) : item.quantidadeComReserva} ${item.unidade}`,
        formatBrl(item.custoUnitario, 2),
        formatBrl(item.subtotalComReserva, 2),
      ])
    : [["—", "Nenhum ativo ou trecho calculado neste projeto.", "—", "0", "0", "R$ 0,00", "R$ 0,00"]];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 18 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
      fontSize: 7.3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 16, fontStyle: "bold" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
    },
    head: [["Cód.", "Item / Modelo", "Classe / Fab.", "Qtd. Líq.", "Qtd. c/ Res.", "Unitário", "Subtotal"]],
    body: bomBody,
    foot: [
      [
        { content: "Subtotal Equipamentos", colSpan: 6, styles: { halign: "right", fontStyle: "normal" } },
        { content: formatBrl(bom.totalEquipamentos, 2), styles: { halign: "right", fontStyle: "normal" } },
      ],
      [
        { content: `Subtotal Cabos (+${safeReservaPct}% reserva)`, colSpan: 6, styles: { halign: "right", fontStyle: "normal" } },
        { content: formatBrl(bom.totalCabosComReserva, 2), styles: { halign: "right", fontStyle: "normal" } },
      ],
      [
        { content: `TOTAL GERAL CAPEX (C/ ${safeReservaPct}% RESERVA)`, colSpan: 6, styles: { halign: "right", fontStyle: "bold" } },
        { content: formatBrl(bom.capexTotalComReserva, 2), styles: { halign: "right", textColor: [5, 150, 105], fontStyle: "bold" } },
      ],
    ],
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // 5. Seção 2: Enlaces Otimizados (AGM Prim)
  y = drawSectionHeading(
    doc,
    y,
    `2. Enlaces Ópticos da Árvore Geradora Mínima (${bom.trechosCount})`,
    margin,
  );

  const trechosBody = trechos.length
    ? trechos.map((tr) => [
        `#${tr.id_trecho ?? "-"}`,
        tr.origem_descricao || "—",
        tr.destino_descricao || "—",
        tr.modelo_cabo || "—",
        `${formatNumBr(tr.distancia_metros, 2)} m`,
        formatBrl(tr.custo_trecho, 2),
      ])
    : [["—", "Execute 'Calcular Malha Otimizada' no Workspace GIS.", "—", "—", "0,00 m", "R$ 0,00"]];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 18 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.1,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252],
      fontStyle: "bold",
      fontSize: 7.3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 14 },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    head: [["#", "Origem", "Destino", "Modelo de Cabo", "Distância", "Custo"]],
    body: trechosBody,
    foot: [
      [
        { content: `Total dos Enlaces (${trechos.length})`, colSpan: 4, styles: { halign: "right" } },
        { content: `${formatNumBr(bom.metragemLiquida, 2)} m`, styles: { halign: "right" } },
        { content: formatBrl(bom.totalCabos, 2), styles: { halign: "right" } },
      ],
    ],
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // 6. Seção 3: Inventário de Ativos Georreferenciados (WGS 84)
  y = drawSectionHeading(
    doc,
    y,
    `3. Inventário de Ativos Georreferenciados (${bom.pontosAtivosCount} — WGS 84)`,
    margin,
  );

  const ativosBody = bom.pontosAtivos.length
    ? bom.pontosAtivos.map((pt) => {
        const tipoId = pt.id_tipo_equipamento ?? 0;
        const classe = EQUIPAMENTO_CLASSE[tipoId] || "Poste de Passagem";
        return [
          `#${pt.id_ponto ?? "-"}`,
          pt.descricao || "—",
          classe,
          pt.status_fisico || "Projetado",
          formatNumBr(pt.latitude, 6),
          formatNumBr(pt.longitude, 6),
          formatBrl(pt.custo_equipamento || 0, 2),
        ];
      })
    : [["—", "Nenhum ativo posicionado neste projeto.", "—", "—", "—", "—", "R$ 0,00"]];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 18 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252],
      fontStyle: "bold",
      fontSize: 7.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 13 },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    head: [["#", "Descrição", "Equipamento / Classe", "Status Físico", "Latitude", "Longitude", "Custo"]],
    body: ativosBody,
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  // 7. Bloco de Responsabilidade Técnica (sempre inteiro na mesma página)
  y = ensureSpace(doc, y, 26, margin);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${projectDetail?.engenheiro_nome || `Engenheiro #${projectDetail?.id_engenheiro ?? "-"}`}${
      projectDetail?.engenheiro_crea ? `  ·  CREA ${projectDetail.engenheiro_crea}` : ""
    }`,
    margin + 4,
    y + 8,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Responsável Técnico pelo Traçado Óptico (AGM Prim) e Quantitativo de Materiais (BOM).",
    margin + 4,
    y + 13.5,
  );
  doc.text(
    `Emitido eletronicamente via plataforma InfraRoute em ${formatarDataHoraBr(emittedAt)} (BRT).`,
    margin + 4,
    y + 18.2,
  );

  // 8. Rodapé Paginado em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `InfraRoute B2B · ${projectCode} · Coordenadas WGS 84 (SRID 4326)`,
      margin,
      pageHeight - 6.8,
    );
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 6.8, {
      align: "right",
    });
  }

  return doc;
}

/**
 * Gera e realiza o download direto do Memorial Descritivo em arquivo `.pdf` A4.
 */
export async function baixarPdfMemorial(
  projectDetail,
  reservaTecnicaPct = 10,
  options = {},
) {
  const doc = await gerarDocumentoPdfMemorial(projectDetail, reservaTecnicaPct, options);
  const projectCode = `ir-${String(projectDetail?.id_projeto || 0).padStart(4, "0")}`;
  doc.save(`memorial-descritivo-${projectCode}.pdf`);
  return doc;
}
