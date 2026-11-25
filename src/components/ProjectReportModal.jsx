import { useEffect, useState } from "react";
import { apiRequest, getSession } from "../lib/api";
import { useToast } from "./ToastProvider";
import {
  baixarArquivo,
  calcularBomProjeto,
  gerarCsvBomETrechos,
  gerarGeoJsonProjeto,
} from "../utils/projectExport";
import { formatarDataBr, formatarDataHoraBr } from "../utils/dateTime";

const RESERVA_OPCOES = [0, 10, 15, 20];

export function ProjectReportModal({ projectId, initialDetail = null, onClose }) {
  const session = getSession();
  const { showToast } = useToast();
  const [detail, setDetail] = useState(initialDetail);
  const [loading, setLoading] = useState(!initialDetail);
  const [error, setError] = useState("");
  const [reservaPct, setReservaPct] = useState(10);

  useEffect(() => {
    if (initialDetail && initialDetail.id_projeto === projectId) {
      setDetail(initialDetail);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    apiRequest(`/projetos/${projectId}?id_usuario_autor=${session?.id_usuario || 1}`)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, initialDetail, session?.id_usuario]);

  const bom = detail ? calcularBomProjeto(detail, reservaPct) : null;
  const projectCode = `IR-${String(projectId || detail?.id_projeto || 0).padStart(4, "0")}`;

  const handlePrint = () => {
    window.print();
  };

  const handleExportGeoJson = () => {
    if (!detail) return;
    const geojson = gerarGeoJsonProjeto(detail);
    baixarArquivo(
      JSON.stringify(geojson, null, 2),
      `malha-${projectCode.toLowerCase()}.geojson`,
      "application/geo+json;charset=utf-8",
    );
    showToast(`GeoJSON ${projectCode} exportado (SRID 4326).`, { type: "success" });
  };

  const handleExportCsv = () => {
    if (!detail) return;
    const csv = gerarCsvBomETrechos(detail, reservaPct);
    baixarArquivo(
      csv,
      `orcamento-bom-${projectCode.toLowerCase()}.csv`,
      "text/csv;charset=utf-8",
    );
    showToast(`Planilha BOM ${projectCode} (.csv) gerada.`, { type: "success" });
  };

  const handleExportJson = () => {
    if (!detail) return;
    baixarArquivo(
      JSON.stringify(detail, null, 2),
      `relatorio-projeto-${detail.id_projeto}.json`,
      "application/json;charset=utf-8",
    );
    showToast(`Relatório técnico ${projectCode} (.json) baixado.`, { type: "success" });
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Memorial Descritivo e Orçamento de ${detail?.nome || projectCode}`}
        className="print-sheet flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Memorial Descritivo & Orçamento CAPEX
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              {detail?.nome || "Carregando projeto..."} ({projectCode})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar memorial descritivo"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Fechar ✕
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {loading && (
            <p className="text-sm text-slate-600" role="status">
              Carregando topologia e quantitativo de materiais...
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {detail && bom && (
            <>
              <section
                aria-label="Identificação técnica do projeto"
                className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-4"
              >
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Empresa / Tenant</span>
                  <strong className="text-xs font-semibold text-slate-900">
                    {session?.razao_social_empresa || `Empresa #${detail.id_empresa}`}
                  </strong>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Responsável Técnico</span>
                  <strong className="text-xs font-semibold text-slate-900">
                    {detail.engenheiro_nome || `Engenheiro #${detail.id_engenheiro}`}
                    {detail.engenheiro_crea ? ` · CREA ${detail.engenheiro_crea}` : ""}
                  </strong>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Status do Projeto</span>
                  <strong className="text-xs font-semibold text-slate-900">{detail.status}</strong>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Emissão do Relatório</span>
                  <strong className="text-xs font-semibold text-slate-900">
                    {formatarDataHoraBr(new Date())} (BRT)
                  </strong>
                  {detail.data_criacao && (
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      Criado em {formatarDataBr(detail.data_criacao)}
                    </span>
                  )}
                </div>
              </section>

              <section
                aria-label="Resumo executivo e reserva técnica"
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4"
              >
                <div className="flex flex-wrap gap-6">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-600">Metragem Líquida AGM</span>
                    <strong className="text-base font-bold text-slate-900">
                      {bom.metragemLiquida.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-600">
                      Cabo c/ Reserva (+{reservaPct}%)
                    </span>
                    <strong className="text-base font-bold text-blue-800">
                      {bom.metragemComReserva.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-600">CAPEX Total Estimado</span>
                    <strong className="text-base font-bold text-emerald-700">
                      {bom.capexTotalComReserva.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                </div>

                <div className="no-print flex items-center gap-2">
                  <label htmlFor="reserva-tecnica-select" className="text-xs font-semibold text-slate-700">
                    Reserva técnica (sobra):
                  </label>
                  <select
                    id="reserva-tecnica-select"
                    value={reservaPct}
                    onChange={(e) => setReservaPct(Number(e.target.value))}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900"
                  >
                    {RESERVA_OPCOES.map((pct) => (
                      <option key={pct} value={pct}>
                        +{pct}%
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section aria-labelledby="bom-heading">
                <h3 id="bom-heading" className="mb-2 text-sm font-bold text-slate-900">
                  1. Lista de Materiais (Bill of Materials — 3FN)
                </h3>
                <div className="tabela-wrap rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <caption className="sr-only">Lista consolidada de equipamentos e cabos ópticos</caption>
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                      <tr>
                        <th scope="col" className="px-3 py-2.5">Código</th>
                        <th scope="col" className="px-3 py-2.5">Item / Modelo</th>
                        <th scope="col" className="px-3 py-2.5">Fabricante / Classe</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Qtd. Líquida</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Qtd. c/ Reserva</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Unitário</th>
                        <th scope="col" className="px-3 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bom.itens.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                            Nenhum ativo ou trecho calculado ainda neste projeto.
                          </td>
                        </tr>
                      ) : (
                        bom.itens.map((item) => (
                          <tr key={`${item.codigo}-${item.item}`} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{item.codigo}</td>
                            <th scope="row" className="px-3 py-2 font-semibold text-slate-900">{item.item}</th>
                            <td className="px-3 py-2 text-slate-600">{item.fabricante}</td>
                            <td className="px-3 py-2 text-right">
                              {item.unidade === "m" ? item.quantidade.toFixed(2) : item.quantidade} {item.unidade}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-blue-800">
                              {item.unidade === "m"
                                ? item.quantidadeComReserva.toFixed(2)
                                : item.quantidadeComReserva}{" "}
                              {item.unidade}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {item.subtotalComReserva.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold">
                      <tr>
                        <th scope="row" colSpan={6} className="px-3 py-2.5 text-right text-slate-700">
                          Total Geral Estimado (Equipamentos + Cabos c/ {reservaPct}% de Reserva)
                        </th>
                        <td className="px-3 py-2.5 text-right text-emerald-700">
                          {bom.capexTotalComReserva.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <section aria-labelledby="trechos-heading">
                <h3 id="trechos-heading" className="mb-2 text-sm font-bold text-slate-900">
                  2. Enlaces Ópticos da Árvore Geradora Mínima ({bom.trechosCount})
                </h3>
                <div className="tabela-wrap rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs">
                    <caption className="sr-only">Relação dos enlaces otimizados via Algoritmo de Prim</caption>
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                      <tr>
                        <th scope="col" className="px-3 py-2">#</th>
                        <th scope="col" className="px-3 py-2">Origem</th>
                        <th scope="col" className="px-3 py-2">Destino</th>
                        <th scope="col" className="px-3 py-2">Modelo de Cabo</th>
                        <th scope="col" className="px-3 py-2 text-right">Distância</th>
                        <th scope="col" className="px-3 py-2 text-right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.trechos || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                            Execute &ldquo;Calcular Malha Otimizada&rdquo; no Workspace para gerar os enlaces.
                          </td>
                        </tr>
                      ) : (
                        detail.trechos.map((tr) => (
                          <tr key={tr.id_trecho} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-600">#{tr.id_trecho}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{tr.origem_descricao}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{tr.destino_descricao}</td>
                            <td className="px-3 py-2 text-slate-700">{tr.modelo_cabo}</td>
                            <td className="px-3 py-2 text-right">{Number(tr.distancia_metros).toFixed(2)} m</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">
                              {Number(tr.custo_trecho).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <span className="text-[11px] text-slate-500">
            Coordenadas padrão WGS 84 (SRID 4326) compatível com PostgreSQL + PostGIS e QGIS.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!detail}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              JSON Técnico
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!detail}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Planilha Excel (.csv)
            </button>
            <button
              type="button"
              onClick={handleExportGeoJson}
              disabled={!detail}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
              GeoJSON (.geojson)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!detail}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Imprimir / Salvar PDF
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
