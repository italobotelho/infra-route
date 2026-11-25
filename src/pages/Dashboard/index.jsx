import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, getSession } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";
import { podeAcessarLogsAuditoria } from "../../utils/sessionVault";
import { WorkspaceNavigationSidebarSection } from "../Projetos/components/WorkspaceNavigationSidebarSection";

function discreteBarWidthClass(count, total) {
  if (!total || !count) return "w-0";
  const ratio = count / total;
  if (ratio >= 0.88) return "w-full";
  if (ratio >= 0.68) return "w-3/4";
  if (ratio >= 0.45) return "w-1/2";
  if (ratio >= 0.2) return "w-1/4";
  return "w-1/6";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = getSession();
  const canViewAudit = podeAcessarLogsAuditoria(session?.nivel_acesso);
  const empresaParam = session?.nivel_acesso === "SuperAdmin" ? 0 : session.id_empresa_padrao;
  const [projects, setProjects] = useState([]);
  const [dbHealth, setDbHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard Executivo | InfraRoute — Engenharia de Redes Ópticas";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiRequest(`/projetos?id_empresa=${empresaParam}&id_usuario_autor=${session.id_usuario}`),
      canViewAudit ? apiRequest("/health/db").catch(() => null) : Promise.resolve(null),
    ])
      .then(([projRes, healthRes]) => {
        if (cancelled) return;
        setProjects(Array.isArray(projRes) ? projRes : []);
        setDbHealth(healthRes);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message, { type: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [empresaParam, session.id_usuario, canViewAudit, showToast]);

  const metrics = useMemo(() => {
    const total = projects.length;
    const byStatus = {
      "Em Planejamento": projects.filter((p) => p.status === "Em Planejamento").length,
      "Em Execução": projects.filter((p) => p.status === "Em Execução").length,
      "Concluído": projects.filter((p) => p.status === "Concluído").length,
      "Cancelado": projects.filter((p) => p.status === "Cancelado").length,
    };
    const totalMeters = projects.reduce((acc, p) => acc + Number(p.metragem_total || 0), 0);
    const totalCapex = projects.reduce((acc, p) => acc + Number(p.custo_estimado || 0), 0);
    const topProjects = [...projects]
      .sort((a, b) => Number(b.custo_estimado || 0) - Number(a.custo_estimado || 0))
      .slice(0, 5);
    return { total, byStatus, totalMeters, totalCapex, topProjects };
  }, [projects]);

  return (
    <div className="flex min-h-screen flex-col items-start bg-gray-50 text-gray-900 lg:flex-row">
      <WorkspaceNavigationSidebarSection />
      <main className="flex flex-1 flex-col gap-6 self-stretch p-4 sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Visão Executiva · {session?.razao_social_empresa}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Olá, {session?.nome}
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Perfil <strong>{session?.nivel_acesso}</strong>
              {session?.crea ? ` · CREA ${session.crea}` : " · Acesso de Auditoria"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/governanca"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Catálogos & Auditoria
            </Link>
            <Link
              to="/projetos"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Gerenciar Projetos →
            </Link>
          </div>
        </header>

        <section aria-label="Indicadores estratégicos" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total de Projetos
            </span>
            <p className="mt-2 text-3xl font-bold text-slate-900">{metrics.total}</p>
            <span className="text-xs text-slate-500">
              {metrics.byStatus["Em Planejamento"] + metrics.byStatus["Em Execução"]} em operação ativa
            </span>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Extensão Óptica Planejada
            </span>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {(metrics.totalMeters / 1000).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              km
            </p>
            <span className="text-xs text-slate-500">
              {metrics.totalMeters.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} metros na AGM Prim
            </span>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              CAPEX Consolidado
            </span>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {metrics.totalCapex.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <span className="text-xs text-slate-500">Memoização O(1) sincronizada com SQL</span>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Persistência SQL
            </span>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {dbHealth?.status === "connected" ? "Conectado (ACID)" : "Verificando..."}
            </p>
            <span className="text-xs text-slate-500">
              Motor: {dbHealth?.motor || "—"} · {dbHealth?.tabelas?.pontos_rede ?? 0} pontos ativos/hist.
            </span>
          </article>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section
            aria-labelledby="status-dist-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="status-dist-heading" className="text-base font-bold text-slate-900">
              Distribuição do Ciclo de Vida
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Controle de governança e imutabilidade histórica por status
            </p>
            <div className="mt-5 space-y-4">
              {[
                { label: "Em Planejamento", color: "bg-blue-600" },
                { label: "Em Execução", color: "bg-amber-500" },
                { label: "Concluído", color: "bg-emerald-600" },
                { label: "Cancelado", color: "bg-slate-500" },
              ].map((row) => {
                const count = metrics.byStatus[row.label] || 0;
                const widthClass = discreteBarWidthClass(count, metrics.total);
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <strong className="text-slate-900">{count} projeto(s)</strong>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all ${row.color} ${widthClass}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            aria-labelledby="top-projects-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="top-projects-heading" className="text-base font-bold text-slate-900">
              Principais Projetos por CAPEX
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Clique em um projeto para abrir diretamente no Workspace GIS
            </p>
            <div className="mt-4 space-y-2.5">
              {loading ? (
                <p className="text-xs text-slate-500">Carregando carteira de obras...</p>
              ) : metrics.topProjects.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum projeto cadastrado ainda.</p>
              ) : (
                metrics.topProjects.map((proj) => (
                  <button
                    key={proj.id_projeto}
                    type="button"
                    onClick={() => navigate(`/workspace?id_projeto=${proj.id_projeto}`)}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-xs font-semibold text-slate-900">
                        {proj.nome}
                      </strong>
                      <span className="text-[11px] text-slate-500">
                        IR-{String(proj.id_projeto).padStart(4, "0")} · {proj.status} ·{" "}
                        {Number(proj.metragem_total || 0).toFixed(0)} m
                      </span>
                    </div>
                    <strong className="shrink-0 text-xs font-bold text-emerald-700">
                      {Number(proj.custo_estimado || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
