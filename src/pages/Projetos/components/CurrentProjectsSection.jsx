import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, getSession, saveSession } from "../../../lib/api";
import { useToast } from "../../../components/ToastProvider";
import { ProjectReportModal } from "../../../components/ProjectReportModal";
import { baixarArquivo } from "../../../utils/projectExport";
import { ehPerfilSomenteLeituraProjetos } from "../../../utils/sessionVault";
import default28 from "../assets/default-28.svg";

const STATUS_BADGE_MAP = {
  "Em Planejamento": "border-blue-200 bg-blue-50 text-blue-800",
  "Em Execução": "border-amber-200 bg-amber-50 text-amber-800",
  "Concluído": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Cancelado": "border-slate-300 bg-slate-100 text-slate-700",
};

const STATUS_FILTER_OPTIONS = [
  "Todos",
  "Em Planejamento",
  "Em Execução",
  "Concluído",
  "Cancelado",
];

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0 text-blue-600" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function MoreActionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-slate-600" aria-hidden="true">
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

export const CurrentProjectsSection = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [session, setSessionState] = useState(() => getSession());
  const isViewer = ehPerfilSomenteLeituraProjetos(session?.nivel_acesso);
  const empresaQuery = session?.nivel_acesso === "SuperAdmin" ? 0 : session.id_empresa_padrao;

  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [sortBy, setSortBy] = useState({ field: "nome", asc: true });
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    empresa: true,
    responsavel: true,
    tipo: true,
  });

  const [actionProject, setActionProject] = useState(null);
  const [reportProjectId, setReportProjectId] = useState(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [projects, setProjects] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    document.title = "Projetos | InfraRoute — Gestão de Expansão OSP/FTTH";
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(
        `/projetos?id_empresa=${empresaQuery}&id_usuario_autor=${session.id_usuario}`,
      );
      setProjects(
        response.map((project) => ({
          ...project,
          name: project.nome,
          code: `IR-${String(project.id_projeto).padStart(4, "0")}`,
        })),
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const kpis = useMemo(() => {
    const total = projects.length;
    const ativos = projects.filter(
      (p) => p.status === "Em Planejamento" || p.status === "Em Execução",
    ).length;
    const totalMeters = projects.reduce((acc, p) => acc + Number(p.metragem_total || 0), 0);
    const totalCapex = projects.reduce((acc, p) => acc + Number(p.custo_estimado || 0), 0);
    return { total, ativos, totalMeters, totalCapex };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const byStatus =
      statusFilter === "Todos"
        ? projects
        : projects.filter((project) => project.status === statusFilter);

    const base = !normalizedQuery
      ? byStatus
      : byStatus.filter((project) =>
          `${project.name} ${project.code} ${project.status} ${project.engenheiro_nome || ""}`
            .toLowerCase()
            .includes(normalizedQuery),
        );

    return [...base].sort((a, b) => {
      let diff = 0;
      if (sortBy.field === "metragem") {
        diff = Number(a.metragem_total || 0) - Number(b.metragem_total || 0);
      } else if (sortBy.field === "custo") {
        diff = Number(a.custo_estimado || 0) - Number(b.custo_estimado || 0);
      } else {
        diff = a.name.localeCompare(b.name, "pt-BR");
      }
      return sortBy.asc ? diff : -diff;
    });
  }, [projects, query, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(() => {
    const startIdx = (safePage - 1) * itemsPerPage;
    return filteredProjects.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredProjects, safePage, itemsPerPage]);

  const pageTotalCost = useMemo(
    () => paginatedProjects.reduce((acc, item) => acc + Number(item.custo_estimado || 0), 0),
    [paginatedProjects],
  );
  const pageTotalMeters = useMemo(
    () => paginatedProjects.reduce((acc, item) => acc + Number(item.metragem_total || 0), 0),
    [paginatedProjects],
  );

  const toggleSort = (field) => {
    setSortBy((prev) =>
      prev.field === field ? { field, asc: !prev.asc } : { field, asc: true },
    );
  };

  const updateProjectStatus = async (idProjeto, novoStatus) => {
    setIsUpdatingStatus(true);
    setError("");
    try {
      await apiRequest(`/projetos/${idProjeto}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          novo_status: novoStatus,
          id_usuario_autor: session.id_usuario,
        }),
      });
      await loadProjects();
      setActionProject((curr) =>
        curr && curr.id_projeto === idProjeto ? { ...curr, status: novoStatus } : curr,
      );
      showToast(`Status alterado para "${novoStatus}".`, { type: "success" });
    } catch (err) {
      setError(err.message);
      showToast(err.message, { type: "error" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const renameProject = async (event) => {
    event.preventDefault();
    if (!actionProject) return;
    const nomeLimpo = editProjectName.trim();
    if (!nomeLimpo) return;

    setIsRenamingProject(true);
    setError("");
    try {
      const updated = await apiRequest(`/projetos/${actionProject.id_projeto}`, {
        method: "PATCH",
        body: JSON.stringify({
          nome: nomeLimpo,
          id_usuario_autor: session.id_usuario,
        }),
      });
      await loadProjects();
      setActionProject((curr) =>
        curr && curr.id_projeto === actionProject.id_projeto
          ? { ...curr, nome: updated.nome, name: updated.nome }
          : curr,
      );
      showToast(`Projeto renomeado para "${updated.nome}".`, { type: "success" });
    } catch (err) {
      setError(err.message);
      showToast(err.message, { type: "error" });
    } finally {
      setIsRenamingProject(false);
    }
  };

  const exportSelectedBatch = async () => {
    if (selected.length === 0) return;
    const targetProjects = projects.filter((p) => selected.includes(p.code));
    try {
      const details = await Promise.all(
        targetProjects.map((proj) =>
          apiRequest(`/projetos/${proj.id_projeto}?id_usuario_autor=${session.id_usuario}`),
        ),
      );
      baixarArquivo(
        JSON.stringify({ exportado_em_utc: new Date().toISOString(), projetos: details }, null, 2),
        `lote-projetos-infraroute-${details.length}.json`,
        "application/json;charset=utf-8",
      );
      showToast(`${details.length} projeto(s) exportado(s) em lote.`, { type: "success" });
    } catch (err) {
      showToast(err.message, { type: "error" });
    }
  };

  const allSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every((project) => selected.includes(project.code));

  const toggleProject = (code) => {
    setSelected((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((current) =>
        current.filter((code) => !filteredProjects.some((project) => project.code === code)),
      );
      return;
    }

    setSelected((current) => [
      ...new Set([...current, ...filteredProjects.map((project) => project.code)]),
    ]);
  };

  const refreshProjects = () => {
    setQuery("");
    setStatusFilter("Todos");
    setSelected([]);
    setPage(1);
    loadProjects();
    showToast("Lista de projetos atualizada.", { type: "info" });
  };

  const createProject = async (event) => {
    event.preventDefault();
    const nome = projectName.trim();
    if (!nome) return;

    setIsCreating(true);
    setError("");
    try {
      await apiRequest("/projetos", {
        method: "POST",
        body: JSON.stringify({
          nome,
          id_empresa: session.id_empresa_padrao,
          id_engenheiro: session.id_usuario,
          id_usuario_autor: session.id_usuario,
        }),
      });
      setProjectName("");
      setShowCreateForm(false);
      await loadProjects();
      showToast(`Projeto "${nome}" criado com sucesso!`, { type: "success" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsCreating(false);
    }
  };

  const verifyEmailOtp = async (event) => {
    event.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) return;
    setIsVerifyingOtp(true);
    setOtpMessage("");
    try {
      const updated = await apiRequest("/auth/verificar-email", {
        method: "POST",
        body: JSON.stringify({
          email: session.email,
          codigo: otpCode.trim(),
        }),
      });
      saveSession(updated);
      setSessionState(updated);
      setOtpCode("");
      showToast("E-mail corporativo verificado com sucesso!", { type: "success" });
    } catch (err) {
      setOtpMessage(err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const resendEmailOtp = async () => {
    setOtpMessage("");
    try {
      const res = await apiRequest("/auth/reenviar-codigo", {
        method: "POST",
        body: JSON.stringify({ email: session.email }),
      });
      const updated = {
        ...session,
        codigo_verificacao_dev: res.codigo_verificacao_dev || session.codigo_verificacao_dev,
      };
      saveSession(updated);
      setSessionState(updated);
      setOtpMessage(res.mensagem);
    } catch (err) {
      setOtpMessage(err.message);
    }
  };

  const visibleColCount =
    5 +
    (visibleCols.empresa ? 1 : 0) +
    (visibleCols.responsavel ? 1 : 0) +
    (visibleCols.tipo ? 1 : 0);

  return (
    <main className="relative flex flex-1 grow flex-col items-start gap-6 self-stretch p-4 sm:p-6 lg:p-8">
      {session && session.email_verificado === false && (
        <section
          role="region"
          aria-label="Verificação de e-mail"
          className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-slate-900 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <strong className="text-sm font-semibold text-amber-900">
              Confirme seu e-mail corporativo ({session.email})
            </strong>
            <span className="text-xs text-amber-800">
              Digite o código de 6 dígitos enviado para sua conta.
              {session.codigo_verificacao_dev && (
                <strong className="ml-2 rounded bg-amber-200 px-2 py-0.5 font-mono text-amber-950">
                  Código Dev: {session.codigo_verificacao_dev}
                </strong>
              )}
            </span>
            {otpMessage && (
              <span className="text-xs font-medium text-red-700" role="alert">
                {otpMessage}
              </span>
            )}
          </div>
          <form onSubmit={verifyEmailOtp} className="flex flex-wrap items-center gap-2">
            <label htmlFor="otp-code" className="sr-only">
              Código de verificação de 6 dígitos
            </label>
            <input
              id="otp-code"
              name="otpCode"
              type="text"
              inputMode="numeric"
              required
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-10 w-28 rounded-lg border border-amber-400 bg-white px-3 text-center font-mono text-sm tracking-widest text-slate-900"
            />
            <button
              type="submit"
              disabled={isVerifyingOtp || otpCode.length !== 6}
              className="h-10 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isVerifyingOtp ? "Validando..." : "Verificar e-mail"}
            </button>
            <button
              type="button"
              onClick={resendEmailOtp}
              className="h-10 rounded-lg border border-amber-400 bg-white px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              Reenviar código
            </button>
          </form>
        </section>
      )}

      <header className="flex w-full flex-col items-start gap-4">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <nav aria-label="Breadcrumb">
            <ol className="m-0 inline-flex list-none items-center gap-2 p-0 text-[11px] text-slate-600">
              <li>Workspace</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-slate-900">
                Projetos
              </li>
            </ol>
          </nav>
          <div className="flex items-center gap-2">
            {isViewer && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                Perfil {session?.nivel_acesso} (Somente Leitura em Projetos)
              </span>
            )}
            <p className="m-0 text-[11px] text-slate-600">
              Gestão de expansão <abbr title="Outside Plant (Planta Externa)">OSP</abbr> /{" "}
              <abbr title="Fiber to the Home">FTTH</abbr>
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] font-bold leading-9 tracking-[-0.26px] text-slate-900 sm:text-[32px]">
            Projetos atuais
          </h1>
          <div className="relative flex flex-wrap items-center gap-2.5">
            <label
              htmlFor="search-projects"
              className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-solid border-slate-300 bg-white px-3.5 sm:w-[220px]"
            >
              <img className="h-[18px] w-[18px]" alt="" src={default28} />
              <span className="sr-only">Buscar projetos</span>
              <input
                id="search-projects"
                name="query"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar projeto ou responsável..."
                aria-label="Buscar projetos"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-500"
              />
            </label>

            <button
              type="button"
              onClick={refreshProjects}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-solid border-slate-300 bg-white px-4 text-xs font-semibold text-blue-700 transition hover:bg-slate-50"
            >
              Atualizar ↻
            </button>

            <div className="relative">
              <button
                type="button"
                aria-expanded={showColumnsMenu}
                onClick={() => setShowColumnsMenu((prev) => !prev)}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-solid border-slate-300 bg-white px-4 text-xs font-semibold text-blue-700 transition hover:bg-slate-50"
              >
                Colunas ⚙
              </button>
              {showColumnsMenu && (
                <div
                  role="region"
                  aria-label="Personalizar colunas e paginação"
                  className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Colunas Visíveis
                  </p>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    {[
                      { key: "empresa", label: "Empresa (Tenant)" },
                      { key: "responsavel", label: "Responsável Técnico (CREA)" },
                      { key: "tipo", label: "Tipo de Rede" },
                    ].map((col) => (
                      <label key={col.key} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={visibleCols[col.key]}
                          onChange={() =>
                            setVisibleCols((curr) => ({ ...curr, [col.key]: !curr[col.key] }))
                          }
                          className="h-4 w-4 accent-blue-600"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <label htmlFor="items-per-page" className="block text-[11px] font-semibold text-slate-500">
                      Itens por página
                    </label>
                    <select
                      id="items-per-page"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setPage(1);
                      }}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900"
                    >
                      <option value={5}>5 projetos por página</option>
                      <option value={10}>10 projetos por página</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isViewer}
              title={
                isViewer
                  ? "Perfil Visualizador não tem permissão para criar projetos (RBAC)."
                  : "Criar um novo projeto de expansão óptica"
              }
              onClick={() => setShowCreateForm(true)}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Novo Projeto +
            </button>
          </div>
        </div>
      </header>

      <section aria-label="Resumo executivo do portfólio" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Projetos na Carteira
          </span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.total}</p>
          <span className="text-xs text-slate-500">Isolamento multi-tenant ativo</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Em Planejamento / Execução
          </span>
          <p className="mt-1 text-2xl font-bold text-blue-700">{kpis.ativos}</p>
          <span className="text-xs text-slate-500">Abertos para edição no GIS</span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Malha Óptica Total
          </span>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {(kpis.totalMeters / 1000).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            km
          </p>
          <span className="text-xs text-slate-500">
            {kpis.totalMeters.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} metros otimizados
          </span>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            CAPEX Total Estimado
          </span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {kpis.totalCapex.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <span className="text-xs text-slate-500">Cabos AGM + equipamentos</span>
        </article>
      </section>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por status">
          {STATUS_FILTER_OPTIONS.map((statusOpt) => {
            const active = statusFilter === statusOpt;
            return (
              <button
                key={statusOpt}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setStatusFilter(statusOpt);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {statusOpt}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <div
            role="region"
            aria-label="Ações em lote"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-900"
          >
            <strong>{selected.length} selecionado(s)</strong>
            <button
              type="button"
              onClick={exportSelectedBatch}
              className="rounded bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700"
            >
              Exportar Lote (JSON)
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded border border-blue-300 bg-white px-2.5 py-1 font-medium text-blue-800 hover:bg-blue-100"
            >
              Limpar
            </button>
          </div>
        )}
      </div>

      <section
        className="flex w-full flex-col items-start gap-4"
        aria-label="Lista de projetos da empresa"
      >
        <div className="tabela-wrap w-full rounded-xl border border-solid border-slate-200 bg-white shadow-sm">
          <table className="tabela-projetos w-full text-left">
            <caption className="sr-only">
              Relação de projetos de expansão óptica da empresa {session?.razao_social_empresa}
            </caption>
            <thead className="border-b border-solid border-slate-200 bg-slate-50">
              <tr className="h-[50px]">
                <th scope="col" className="w-12 px-4 py-2">
                  <label htmlFor="select-all-projects" className="sr-only">
                    Selecionar todos os projetos
                  </label>
                  <input
                    id="select-all-projects"
                    name="selectAllProjects"
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todos os projetos"
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                </th>
                <th scope="col" className="min-w-[180px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("nome")}
                    className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-semibold text-slate-700 hover:text-blue-700"
                  >
                    <span>Nome</span>
                    <span aria-hidden="true">{sortBy.field === "nome" ? (sortBy.asc ? "↑" : "↓") : "↕"}</span>
                  </button>
                </th>
                <th scope="col" className="min-w-[130px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Status
                </th>
                {visibleCols.empresa && (
                  <th scope="col" className="min-w-[150px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Empresa
                  </th>
                )}
                {visibleCols.responsavel && (
                  <th scope="col" className="min-w-[160px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Responsável (CREA)
                  </th>
                )}
                {visibleCols.tipo && (
                  <th scope="col" className="min-w-[120px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    Tipo de Rede
                  </th>
                )}
                <th scope="col" className="min-w-[170px] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSort("custo")}
                      className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-semibold text-slate-700 hover:text-blue-700"
                    >
                      <span>Custo</span>
                      <span aria-hidden="true">{sortBy.field === "custo" ? (sortBy.asc ? "↑" : "↓") : ""}</span>
                    </button>
                    <span>/</span>
                    <button
                      type="button"
                      onClick={() => toggleSort("metragem")}
                      className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-semibold text-slate-700 hover:text-blue-700"
                    >
                      <span>Metragem</span>
                      <span aria-hidden="true">{sortBy.field === "metragem" ? (sortBy.asc ? "↑" : "↓") : ""}</span>
                    </button>
                  </div>
                </th>
                <th scope="col" className="w-16 px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColCount} className="p-6 text-sm text-slate-600">
                    Carregando projetos...
                  </td>
                </tr>
              ) : error && projects.length === 0 ? (
                <tr>
                  <td colSpan={visibleColCount} className="p-6 text-sm text-red-600" role="alert">
                    {error}
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={visibleColCount} className="p-6 text-sm text-slate-600">
                    Nenhum projeto encontrado para o filtro aplicado.
                  </td>
                </tr>
              ) : (
                paginatedProjects.map((project) => {
                  const checkboxId = `select-project-${project.id_projeto}`;
                  const isFrozen = project.status === "Concluído" || project.status === "Cancelado";
                  const badgeClass =
                    STATUS_BADGE_MAP[project.status] || "border-slate-200 bg-slate-50 text-slate-700";

                  return (
                    <tr
                      key={project.id_projeto}
                      className="h-14 border-b border-solid border-slate-200 bg-white transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-2">
                        <label htmlFor={checkboxId} className="sr-only">
                          Selecionar {project.name}
                        </label>
                        <input
                          id={checkboxId}
                          name={checkboxId}
                          type="checkbox"
                          checked={selected.includes(project.code)}
                          onChange={() => toggleProject(project.code)}
                          aria-label={`Selecionar ${project.name}`}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                        />
                      </td>
                      <th scope="row" className="px-4 py-2 font-normal">
                        <div className="flex items-center gap-2.5">
                          <FolderIcon />
                          <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                            <button
                              type="button"
                              className="max-w-full cursor-pointer truncate text-left text-xs font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                              onClick={() => navigate(`/workspace?id_projeto=${project.id_projeto}`)}
                            >
                              {project.name}
                            </button>
                            <span className="max-w-full truncate text-[10px] text-slate-500">
                              {project.code} · Abrir no mapa GIS
                            </span>
                          </div>
                        </div>
                      </th>
                      <td className="px-4 py-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                        >
                          {isFrozen && <span aria-hidden="true">🔒</span>}
                          <span>{project.status}</span>
                        </span>
                      </td>
                      {visibleCols.empresa && (
                        <td className="max-w-[180px] truncate px-4 py-2 text-xs text-slate-700">
                          {session?.razao_social_empresa}
                        </td>
                      )}
                      {visibleCols.responsavel && (
                        <td className="px-4 py-2 text-xs text-slate-700">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">
                              {project.engenheiro_nome || `Eng. #${project.id_engenheiro}`}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {project.engenheiro_crea ? `CREA ${project.engenheiro_crea}` : "CREA vinculado"}
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleCols.tipo && (
                        <td className="px-4 py-2 text-xs text-slate-700">
                          Expansão <abbr title="Outside Plant (Planta Externa)">OSP</abbr>
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="whitespace-nowrap text-xs font-semibold text-slate-900">
                            {Number(project.custo_estimado || 0).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span className="whitespace-nowrap text-[11px] text-slate-600">
                            {Number(project.metragem_total || 0).toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}{" "}
                            m
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          aria-label={`Ações de ${project.name}`}
                          onClick={() => {
                            setActionProject(project);
                            setEditProjectName(project.name);
                          }}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-100"
                        >
                          <MoreActionsIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="border-t border-solid border-slate-200 bg-slate-50">
              <tr className="h-11">
                <th
                  scope="row"
                  colSpan={visibleColCount - 2}
                  className="px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Total acumulado (página atual)
                </th>
                <td className="px-4 py-2 text-xs font-semibold text-slate-900">
                  {pageTotalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ·{" "}
                  {pageTotalMeters.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m
                </td>
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-solid border-slate-200 bg-white px-4 py-2 shadow-sm">
          <p className="text-xs text-slate-600">
            Exibindo {paginatedProjects.length} de {filteredProjects.length} projeto(s)
          </p>
          <nav aria-label="Paginação">
            <ul className="m-0 inline-flex list-none items-center gap-1 p-0">
              <li>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => setPage(item)}
                    aria-current={safePage === item ? "page" : undefined}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2.5 text-[11px] font-semibold ${
                      safePage === item
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Próximo
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </section>

      <footer className="flex w-full flex-wrap items-center justify-between gap-2 pt-2">
        <small className="text-[11px] text-slate-600">
          InfraRoute B2B · Persistência SQL Relacional & Algoritmo de Prim
        </small>
        <address className="text-[11px] not-italic text-slate-600">
          Engenharia de redes ·{" "}
          <a className="text-blue-700 hover:underline" href="mailto:engenharia@infraroute.com.br">
            engenharia@infraroute.com.br
          </a>
        </address>
      </footer>

      {error && projects.length > 0 && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
            onSubmit={createProject}
          >
            <h2 className="text-xl font-semibold text-slate-900">Criar novo projeto</h2>
            <fieldset className="m-0 space-y-2 border-0 p-0">
              <legend className="sr-only">Identificação do novo projeto</legend>
              <label htmlFor="new-project-name" className="block text-sm font-medium text-slate-700">
                Nome do projeto
              </label>
              <input
                id="new-project-name"
                name="projectName"
                type="text"
                autoFocus
                required
                minLength={1}
                maxLength={100}
                placeholder="Ex.: Expansão FTTH Setor Norte"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
            </fieldset>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isCreating ? "Criando projeto..." : "Criar Projeto"}
              </button>
            </div>
          </form>
        </div>
      )}

      {actionProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Gerenciar ${actionProject.name}`}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{actionProject.name}</h2>
                <p className="text-xs text-slate-500">
                  {actionProject.code} · Status atual: <strong>{actionProject.status}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionProject(null)}
                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar ações do projeto"
              >
                ✕
              </button>
            </div>

            <form onSubmit={renameProject} className="space-y-2 border-t border-slate-100 pt-3">
              <label
                htmlFor="edit-project-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Renomear Projeto
              </label>
              <div className="flex gap-2">
                <input
                  id="edit-project-name"
                  name="editProjectName"
                  type="text"
                  required
                  minLength={1}
                  maxLength={255}
                  disabled={
                    isViewer ||
                    isRenamingProject ||
                    actionProject.status === "Concluído" ||
                    actionProject.status === "Cancelado"
                  }
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs text-slate-900 disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={
                    isViewer ||
                    isRenamingProject ||
                    !editProjectName.trim() ||
                    editProjectName.trim() === actionProject.name ||
                    actionProject.status === "Concluído" ||
                    actionProject.status === "Cancelado"
                  }
                  className="h-9 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRenamingProject ? "Salvando..." : "Salvar Nome"}
                </button>
              </div>
              {(actionProject.status === "Concluído" || actionProject.status === "Cancelado") && (
                <p className="text-[11px] text-amber-700">
                  Projeto congelado para auditoria histórica (Seção 3.3).
                </p>
              )}
            </form>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Alterar Status (Ciclo de Vida)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {["Em Planejamento", "Em Execução", "Concluído", "Cancelado"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={isViewer || isUpdatingStatus || actionProject.status === st}
                    onClick={() => updateProjectStatus(actionProject.id_projeto, st)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      actionProject.status === st
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => navigate(`/workspace?id_projeto=${actionProject.id_projeto}`)}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Abrir no Mapa GIS →
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = actionProject.id_projeto;
                  setActionProject(null);
                  setReportProjectId(targetId);
                }}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
              >
                Memorial & Orçamento (BOM / GeoJSON / PDF)
              </button>
            </div>
          </div>
        </div>
      )}

      {reportProjectId && (
        <ProjectReportModal
          projectId={reportProjectId}
          onClose={() => setReportProjectId(null)}
        />
      )}
    </main>
  );
};
