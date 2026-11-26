import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, getSession, logoutSession } from "../../lib/api";
import { useToast } from "../../components/ToastProvider";
import { KpiGridSkeleton } from "../../components/ui/Skeleton";
import { AuditStreamClient } from "../../utils/auditStreamClient";
import {
  converterDatetimeLocalBrParaUtcIso,
  formatarDataHoraBr,
  formatarInputDatetimeLocalBr,
  formatarTempoRelativo,
  parseApiUtcDate,
} from "../../utils/dateTime";
import { baixarArquivo, formatarNumeroCsv, montarCsv } from "../../utils/projectExport";
import { podeAcessarLogsAuditoria, sessionManager } from "../../utils/sessionVault";

const PRESETS_PERIODO = [
  { id: "15m", label: "Últimos 15 min", minutos: 15 },
  { id: "1h", label: "Última 1h", minutos: 60 },
  { id: "hoje", label: "Hoje (BRT)", minutos: null },
  { id: "7d", label: "Últimos 7 dias", minutos: 60 * 24 * 7 },
  { id: "tudo", label: "Todo o período", minutos: 0 },
];

export default function Governanca() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const session = getSession();
  const isAdmin = session?.nivel_acesso === "Administrador";
  const isSuperAdmin = session?.nivel_acesso === "SuperAdmin";
  const canViewAudit = podeAcessarLogsAuditoria(session?.nivel_acesso);

  const tabInicial = searchParams.get("tab") || (canViewAudit ? "auditoria" : "catalogos");
  const [activeTab, setActiveTab] = useState(tabInicial);

  const [catalogos, setCatalogos] = useState({ catalogo_equipamentos: [], catalogo_cabos: [] });
  const [opcoesFiltro, setOpcoesFiltro] = useState({
    escopo_global: false,
    id_empresa_travada: null,
    empresas: [],
    funcionarios: [],
    acoes: [],
    metodos_http: [],
  });
  const [auditoria, setAuditoria] = useState([]);
  const [newEventIds, setNewEventIds] = useState(() => new Set());
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [liveAuditEnabled, setLiveAuditEnabled] = useState(true);
  const [streamMode, setStreamMode] = useState("paused");
  const [dbHealth, setDbHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Filtros do Painel de Requisições & Logs
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [empresaFiltro, setEmpresaFiltro] = useState("TODAS");
  const [funcionarioFiltro, setFuncionarioFiltro] = useState("TODOS");
  const [periodoPreset, setPeriodoPreset] = useState("tudo");
  const [dataInicioBr, setDataInicioBr] = useState("");
  const [dataFimBr, setDataFimBr] = useState("");
  const [metodoFiltro, setMetodoFiltro] = useState("TODOS");
  const [statusFiltro, setStatusFiltro] = useState("TODOS");
  const [auditFilter, setAuditFilter] = useState("");

  // Paginação cliente da trilha de auditoria
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);

  // Cadastro de Cabo (Catálogo 3FN)
  const [modeloCabo, setModeloCabo] = useState("");
  const [custoMetro, setCustoMetro] = useState("8.20");
  const [vaoMaximo, setVaoMaximo] = useState("3500");
  const [isSavingCable, setIsSavingCable] = useState(false);

  // Contador ao vivo para aba JWT
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["auditoria", "catalogos", "saude", "jwt"].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "jwt") return undefined;
    setNowSeconds(Math.floor(Date.now() / 1000));
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  const jwtDetails = useMemo(
    () => sessionManager.inspectTokenParts(session?.access_token),
    [session?.access_token, nowSeconds],
  );

  useEffect(() => {
    document.title = "Governança, Segurança & Painel de Requisições | InfraRoute";
  }, []);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const buildAuditQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");

    if (isSuperAdmin && empresaFiltro !== "TODAS") {
      params.set("id_empresa", empresaFiltro);
    }
    if (funcionarioFiltro !== "TODOS") {
      params.set("id_usuario_filtro", funcionarioFiltro);
    }
    const inicioUtc = converterDatetimeLocalBrParaUtcIso(dataInicioBr);
    const fimUtc = converterDatetimeLocalBrParaUtcIso(dataFimBr);
    if (inicioUtc) params.set("data_inicio", inicioUtc);
    if (fimUtc) params.set("data_fim", fimUtc);

    if (metodoFiltro !== "TODOS") {
      params.set("metodo_http", metodoFiltro);
    }
    if (statusFiltro === "2XX") {
      params.set("status_familia", "2xx");
    } else if (statusFiltro === "ALERTA") {
      params.set("severidade", "ALERTA");
    } else if (statusFiltro === "INFO") {
      params.set("severidade", "INFO");
    }
    if (auditFilter.trim()) {
      params.set("busca", auditFilter.trim());
    }
    return params.toString();
  }, [
    isSuperAdmin,
    empresaFiltro,
    funcionarioFiltro,
    dataInicioBr,
    dataFimBr,
    metodoFiltro,
    statusFiltro,
    auditFilter,
  ]);

  const fetchFilteredAudit = useCallback(async () => {
    if (!canViewAudit) {
      setAuditoria([]);
      return;
    }
    if (dataInicioBr && dataFimBr && dataInicioBr > dataFimBr) {
      showToast("Data/Hora inicial não pode ser maior que Data/Hora final.", { type: "warning" });
      return;
    }
    setLoadingAudit(true);
    try {
      const qs = buildAuditQueryString();
      const audRes = await apiRequest(`/auth/auditoria?${qs}`);
      setAuditoria(Array.isArray(audRes) ? audRes : []);
      setAuditPage(1);
    } catch (err) {
      showToast(err.message, { type: "error" });
    } finally {
      setLoadingAudit(false);
    }
  }, [canViewAudit, buildAuditQueryString, dataInicioBr, dataFimBr, showToast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!canViewAudit) {
        const catRes = await apiRequest("/catalogos");
        setCatalogos(catRes || { catalogo_equipamentos: [], catalogo_cabos: [] });
        setAuditoria([]);
        setDbHealth(null);
      } else {
        const qs = buildAuditQueryString();
        const [catRes, opRes, audRes, dbRes] = await Promise.all([
          apiRequest("/catalogos"),
          apiRequest("/auth/opcoes-filtro-auditoria").catch(() => null),
          apiRequest(`/auth/auditoria?${qs}`).catch(() => []),
          apiRequest("/health/db").catch(() => null),
        ]);
        setCatalogos(catRes || { catalogo_equipamentos: [], catalogo_cabos: [] });
        if (opRes) setOpcoesFiltro(opRes);
        setAuditoria(Array.isArray(audRes) ? audRes : []);
        setDbHealth(dbRes);
      }
    } catch (err) {
      showToast(err.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [canViewAudit, buildAuditQueryString, showToast]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && canViewAudit) {
      fetchFilteredAudit();
    }
  }, [
    empresaFiltro,
    funcionarioFiltro,
    dataInicioBr,
    dataFimBr,
    metodoFiltro,
    statusFiltro,
    canViewAudit,
  ]);

  const eventoCorrespondeAosFiltros = useCallback(
    (ev) => {
      if (isSuperAdmin && empresaFiltro !== "TODAS") {
        if (Number(ev.id_empresa) !== Number(empresaFiltro)) return false;
      }
      if (funcionarioFiltro !== "TODOS") {
        const idFiltro = Number(funcionarioFiltro);
        if (idFiltro === 0) {
          if (ev.id_usuario !== null && ev.id_usuario !== undefined) return false;
        } else if (Number(ev.id_usuario) !== idFiltro) {
          return false;
        }
      }
      if (metodoFiltro !== "TODOS" && String(ev.metodo_http || "").toUpperCase() !== metodoFiltro) {
        return false;
      }
      if (statusFiltro === "ALERTA" && ev.severidade !== "ALERTA") return false;
      if (statusFiltro === "INFO" && ev.severidade === "ALERTA") return false;
      if (statusFiltro === "2XX" && !(ev.status_http >= 200 && ev.status_http < 300)) return false;

      const evDate = parseApiUtcDate(ev.timestamp_utc);
      const inicioIso = converterDatetimeLocalBrParaUtcIso(dataInicioBr);
      const fimIso = converterDatetimeLocalBrParaUtcIso(dataFimBr);
      if (inicioIso && evDate && evDate < new Date(inicioIso)) return false;
      if (fimIso && evDate && evDate > new Date(fimIso)) return false;

      const q = auditFilter.trim().toLowerCase();
      if (q) {
        const hay = `${ev.acao} ${ev.email_usuario || ""} ${ev.nome_usuario || ""} ${
          ev.caminho_http || ""
        } ${ev.razao_social_empresa || ""} ${ev.detalhes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [
      isSuperAdmin,
      empresaFiltro,
      funcionarioFiltro,
      metodoFiltro,
      statusFiltro,
      dataInicioBr,
      dataFimBr,
      auditFilter,
    ],
  );

  useEffect(() => {
    if (!session?.access_token || !canViewAudit || !liveAuditEnabled || loading) {
      setStreamMode(canViewAudit ? "paused" : "forbidden");
      return undefined;
    }

    let cancelled = false;
    const maxId = auditoria.reduce((acc, ev) => Math.max(acc, Number(ev.id_evento) || 0), 0);
    const client = new AuditStreamClient({
      token: session.access_token,
      initialLastId: maxId,
    });

    client.start({
      initialLastId: maxId,
      onStatusChange: (mode) => !cancelled && setStreamMode(mode),
      onEvents: (incoming) => {
        if (cancelled || !incoming.length) return;
        const compativeis = incoming.filter(eventoCorrespondeAosFiltros);
        if (!compativeis.length) return;
        setAuditoria((prev) => {
          const seen = new Set(prev.map((ev) => ev.id_evento));
          const novos = compativeis.filter((ev) => !seen.has(ev.id_evento));
          if (!novos.length) return prev;
          setNewEventIds((oldIds) => {
            const next = new Set(oldIds);
            novos.forEach((ev) => next.add(ev.id_evento));
            return next;
          });
          return [...novos.reverse(), ...prev];
        });
      },
    });

    return () => {
      cancelled = true;
      client.stop();
    };
  }, [
    session?.access_token,
    canViewAudit,
    liveAuditEnabled,
    loading,
    eventoCorrespondeAosFiltros,
  ]);

  const funcionariosDisponiveis = useMemo(() => {
    const lista = opcoesFiltro?.funcionarios || [];
    if (!isSuperAdmin || empresaFiltro === "TODAS") {
      return lista;
    }
    return lista.filter((f) => Number(f.id_empresa) === Number(empresaFiltro));
  }, [opcoesFiltro?.funcionarios, isSuperAdmin, empresaFiltro]);

  const filteredAuditoria = useMemo(() => {
    const q = auditFilter.trim().toLowerCase();
    if (!q) return auditoria;
    return auditoria.filter((ev) =>
      `${ev.acao} ${ev.email_usuario || ""} ${ev.nome_usuario || ""} ${ev.caminho_http || ""} ${
        ev.razao_social_empresa || ""
      } ${ev.detalhes}`
        .toLowerCase()
        .includes(q),
    );
  }, [auditoria, auditFilter]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditoria.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const paginatedAuditoria = useMemo(() => {
    const start = (safeAuditPage - 1) * auditPageSize;
    return filteredAuditoria.slice(start, start + auditPageSize);
  }, [filteredAuditoria, safeAuditPage, auditPageSize]);

  const auditKpis = useMemo(() => {
    const total = filteredAuditoria.length;
    const alertas = filteredAuditoria.filter((ev) => ev.severidade === "ALERTA").length;
    const sucessos2xx = filteredAuditoria.filter(
      (ev) => ev.status_http >= 200 && ev.status_http < 300,
    ).length;
    const latencias = filteredAuditoria
      .map((ev) => Number(ev.duracao_ms))
      .filter((v) => Number.isFinite(v) && v >= 0);
    const latenciaMedia =
      latencias.length > 0
        ? latencias.reduce((acc, v) => acc + v, 0) / latencias.length
        : 0;
    return { total, alertas, sucessos2xx, latenciaMedia };
  }, [filteredAuditoria]);

  const aplicarPresetPeriodo = (preset) => {
    setPeriodoPreset(preset.id);
    if (preset.id === "tudo") {
      setDataInicioBr("");
      setDataFimBr("");
      return;
    }
    const agora = new Date();
    if (preset.id === "hoje") {
      const fimStr = formatarInputDatetimeLocalBr(agora);
      const inicioDia = `${fimStr.slice(0, 10)}T00:00`;
      setDataInicioBr(inicioDia);
      setDataFimBr(fimStr);
      return;
    }
    const inicio = new Date(agora.getTime() - preset.minutos * 60 * 1000);
    setDataInicioBr(formatarInputDatetimeLocalBr(inicio));
    setDataFimBr(formatarInputDatetimeLocalBr(agora));
  };

  const limparFiltros = () => {
    setEmpresaFiltro("TODAS");
    setFuncionarioFiltro("TODOS");
    setPeriodoPreset("tudo");
    setDataInicioBr("");
    setDataFimBr("");
    setMetodoFiltro("TODOS");
    setStatusFiltro("TODOS");
    setAuditFilter("");
    setAuditPage(1);
  };

  const activeChips = useMemo(() => {
    const chips = [];
    if (isSuperAdmin && empresaFiltro !== "TODAS") {
      const emp = (opcoesFiltro?.empresas || []).find(
        (e) => String(e.id_empresa) === empresaFiltro,
      );
      chips.push({
        id: "empresa",
        label: `Empresa: ${emp?.razao_social || empresaFiltro}`,
        clear: () => {
          setEmpresaFiltro("TODAS");
          setFuncionarioFiltro("TODOS");
        },
      });
    }
    if (funcionarioFiltro !== "TODOS") {
      const func = funcionariosDisponiveis.find(
        (f) => String(f.id_usuario) === funcionarioFiltro,
      );
      chips.push({
        id: "funcionario",
        label: `Colaborador: ${func?.nome || (funcionarioFiltro === "0" ? "Sistema" : funcionarioFiltro)}`,
        clear: () => setFuncionarioFiltro("TODOS"),
      });
    }
    if (metodoFiltro !== "TODOS") {
      chips.push({
        id: "metodo",
        label: `HTTP: ${metodoFiltro}`,
        clear: () => setMetodoFiltro("TODOS"),
      });
    }
    if (statusFiltro !== "TODOS") {
      chips.push({
        id: "status",
        label: `Status: ${statusFiltro}`,
        clear: () => setStatusFiltro("TODOS"),
      });
    }
    if (dataInicioBr || dataFimBr) {
      chips.push({
        id: "periodo",
        label: "Intervalo personalizado",
        clear: () => {
          setPeriodoPreset("tudo");
          setDataInicioBr("");
          setDataFimBr("");
        },
      });
    }
    if (auditFilter.trim()) {
      chips.push({
        id: "busca",
        label: `Busca: "${auditFilter.trim()}"`,
        clear: () => setAuditFilter(""),
      });
    }
    return chips;
  }, [
    isSuperAdmin,
    empresaFiltro,
    opcoesFiltro?.empresas,
    funcionarioFiltro,
    funcionariosDisponiveis,
    metodoFiltro,
    statusFiltro,
    dataInicioBr,
    dataFimBr,
    auditFilter,
  ]);

  const advancedCount = activeChips.filter((c) => c.id !== "busca").length;

  const handleCreateCable = async (event) => {
    event.preventDefault();
    if (!modeloCabo.trim()) return;
    setIsSavingCable(true);
    try {
      await apiRequest("/catalogos/cabos", {
        method: "POST",
        body: JSON.stringify({
          descricao_modelo: modeloCabo.trim(),
          custo_por_metro: Number(custoMetro),
          limite_distancia_metros: Number(vaoMaximo),
          id_usuario_autor: session.id_usuario,
        }),
      });
      setModeloCabo("");
      await loadData();
      showToast("Modelo de cabo cadastrado na tabela normalizada Tipo_Cabo.", {
        type: "success",
      });
    } catch (err) {
      showToast(err.message, { type: "error" });
    } finally {
      setIsSavingCable(false);
    }
  };

  const handleSimulateRbacBlock = async (alvo = "cabo") => {
    try {
      if (alvo === "logs") {
        await apiRequest("/auth/auditoria?limit=5");
        showToast("Perfil atual possui acesso autorizado ao painel de logs.", { type: "info" });
      } else {
        await apiRequest("/catalogos/cabos", {
          method: "POST",
          body: JSON.stringify({
            descricao_modelo: "Teste Bloqueio RBAC",
            custo_por_metro: 5.0,
            limite_distancia_metros: 1000,
            id_usuario_autor: session.id_usuario,
          }),
        });
        showToast("Perfil atual possui permissão Administrador — cadastro permitido.", {
          type: "info",
        });
      }
    } catch (err) {
      showToast(`Bloqueio RBAC confirmado e gravado no Log: ${err.message}`, {
        type: "warning",
      });
    }
  };

  const handleExportAuditCsv = () => {
    if (filteredAuditoria.length === 0) {
      showToast("Nenhum registro de auditoria no filtro atual para exportar.", {
        type: "warning",
      });
      return;
    }
    const header = [
      "ID_Evento",
      "Data_Hora_BRT",
      "Timestamp_UTC",
      "Empresa",
      "Funcionario",
      "Email",
      "Papel_RBAC",
      "Metodo_HTTP",
      "Caminho_HTTP",
      "Status_HTTP",
      "Duracao_Ms",
      "Severidade",
      "Acao",
      "Detalhes",
    ];
    const rows = filteredAuditoria.map((ev) => [
      ev.id_evento,
      formatarDataHoraBr(ev.timestamp_utc),
      ev.timestamp_utc,
      ev.razao_social_empresa || "Plataforma",
      ev.nome_usuario || "Sistema",
      ev.email_usuario || "sistema",
      ev.papel_rbac || "N/A",
      ev.metodo_http || "-",
      ev.caminho_http || "-",
      ev.status_http ?? "-",
      ev.duracao_ms !== null && ev.duracao_ms !== undefined
        ? formatarNumeroCsv(ev.duracao_ms, 2)
        : "-",
      ev.severidade || "INFO",
      ev.acao,
      ev.detalhes || "",
    ]);
    const csv = montarCsv([header, ...rows]);
    baixarArquivo(csv, "painel-requisicoes-infraroute.csv", "text/csv;charset=utf-8");
    showToast("Painel de requisições exportado em .csv (Horário de Brasília BRT).", {
      type: "success",
    });
  };

  const handleRevokeJwtTest = async () => {
    await logoutSession();
    window.location.assign("/login");
  };

  const jwtLifetimeTotal =
    jwtDetails?.payload?.exp && jwtDetails?.payload?.iat
      ? Math.max(1, Number(jwtDetails.payload.exp) - Number(jwtDetails.payload.iat))
      : 28800;

  return (
    <main className="flex flex-1 flex-col gap-6 self-stretch p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5">
        <nav aria-label="Breadcrumb">
          <ol className="m-0 inline-flex list-none items-center gap-2 p-0 text-xs text-slate-600">
            <li>
              <Link to="/dashboard" className="font-medium text-slate-600 hover:text-blue-700 hover:underline">
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-slate-900">
              Governança & Segurança
            </li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Segurança <abbr title="Lei Geral de Proteção de Dados">LGPD</abbr>,{" "}
              <abbr title="Role-Based Access Control">RBAC</abbr>, Catálogos 3FN & Auditoria Ao Vivo
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Governança & Segurança
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewAudit && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                <span
                  className={`h-2 w-2 rounded-full ${
                    streamMode === "paused" || streamMode === "forbidden"
                      ? "bg-slate-400"
                      : "animate-pulse bg-emerald-500"
                  }`}
                  aria-hidden="true"
                />
                {streamMode === "sse"
                  ? "Stream SSE Ativo (Ticket Efêmero)"
                  : streamMode === "polling"
                    ? "Sync Incremental Ativo"
                    : "Stream Pausado"}
              </span>
            )}
            <button
              type="button"
              onClick={loadData}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-slate-50"
            >
              Atualizar Dados ↻
            </button>
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Seções de governança e segurança"
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
      >
        {[
          {
            id: "auditoria",
            label: canViewAudit
              ? `Painel de Requisições & Logs (${filteredAuditoria.length})`
              : "Painel de Requisições & Logs (Restrito)",
          },
          { id: "catalogos", label: "Catálogos Técnicos (3FN)" },
          { id: "saude", label: canViewAudit ? "Saúde SQL & Views" : "Saúde SQL (Restrito)" },
          { id: "jwt", label: "Sessão JWT" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => handleSelectTab(tab.id)}
              className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <KpiGridSkeleton count={4} />
      ) : activeTab === "catalogos" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section
              aria-labelledby="cat-equip-heading"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 id="cat-equip-heading" className="text-base font-bold text-slate-900">
                Catálogo de Equipamentos (3ª Forma Normal)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Registros normalizados na tabela <code>Tipo_Equipamento</code>
              </p>
              <div className="tabela-wrap mt-3 rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Equipamentos normalizados na tabela Tipo_Equipamento
                  </caption>
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">ID</th>
                      <th scope="col" className="px-3 py-2">Categoria</th>
                      <th scope="col" className="px-3 py-2">Fabricante</th>
                      <th scope="col" className="px-3 py-2 text-right">Custo Unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogos.catalogo_equipamentos.map((eq) => (
                      <tr key={eq.id_tipo_equipamento} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono tabular-nums">{eq.id_tipo_equipamento}</td>
                        <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                          {eq.categoria}
                        </th>
                        <td className="px-3 py-2 text-slate-600">{eq.fabricante}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                          {Number(eq.custo_unitario).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              aria-labelledby="cat-cabos-heading"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 id="cat-cabos-heading" className="text-base font-bold text-slate-900">
                Catálogo de Cabos Ópticos (Restrição de Vão Livre)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Modelos normalizados na tabela <code>Tipo_Cabo</code>
              </p>
              <div className="tabela-wrap mt-3 rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">Modelos de cabo óptico na tabela Tipo_Cabo</caption>
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">ID</th>
                      <th scope="col" className="px-3 py-2">Modelo</th>
                      <th scope="col" className="px-3 py-2 text-right">Custo / m</th>
                      <th scope="col" className="px-3 py-2 text-right">Vão Máx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogos.catalogo_cabos.map((cb) => (
                      <tr key={cb.id_cabo} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono tabular-nums">{cb.id_cabo}</td>
                        <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                          {cb.descricao_modelo}
                        </th>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-700">
                          {Number(cb.custo_por_metro).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(cb.limite_distancia_metros).toFixed(0)} m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section
            aria-labelledby="novo-cabo-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="novo-cabo-heading" className="text-sm font-bold text-slate-900">
                  Cadastrar Novo Modelo de Cabo
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Operação restrita ao papel RBAC <strong>Administrador</strong> via{" "}
                  <code>POST /api/catalogos/cabos</code>.
                </p>
              </div>
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => handleSimulateRbacBlock("cabo")}
                  className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Simular Tentativa Proibida (Gerar Log 403)
                </button>
              )}
            </div>
            <form onSubmit={handleCreateCable} className="mt-4">
              <fieldset className="m-0 grid grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-4">
                <legend className="sr-only">Dados do novo modelo de cabo óptico</legend>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label htmlFor="cabo-modelo" className="text-xs font-semibold text-slate-700">
                    Descrição do Modelo
                  </label>
                  <input
                    id="cabo-modelo"
                    type="text"
                    required
                    disabled={!isAdmin || isSavingCable}
                    placeholder="Ex.: Fibra AS-160 36FO"
                    value={modeloCabo}
                    onChange={(e) => setModeloCabo(e.target.value)}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-xs disabled:bg-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="cabo-custo" className="text-xs font-semibold text-slate-700">
                    Custo por Metro (R$)
                  </label>
                  <input
                    id="cabo-custo"
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    disabled={!isAdmin || isSavingCable}
                    value={custoMetro}
                    onChange={(e) => setCustoMetro(e.target.value)}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-xs disabled:bg-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="cabo-vao" className="text-xs font-semibold text-slate-700">
                    Vão Máximo (m)
                  </label>
                  <input
                    id="cabo-vao"
                    type="number"
                    min="1"
                    required
                    disabled={!isAdmin || isSavingCable}
                    value={vaoMaximo}
                    onChange={(e) => setVaoMaximo(e.target.value)}
                    className="h-10 rounded-lg border border-slate-300 px-3 text-xs disabled:bg-slate-100"
                  />
                </div>
                <div className="sm:col-span-4">
                  <button
                    type="submit"
                    disabled={!isAdmin || isSavingCable || !modeloCabo.trim()}
                    className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAdmin
                      ? isSavingCable
                        ? "Salvando no catálogo..."
                        : "Adicionar ao Catálogo SQL"
                      : "Requer papel Administrador (RBAC)"}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      ) : activeTab === "auditoria" ? (
        !canViewAudit ? (
          <section
            aria-labelledby="rbac-restricted-logs"
            className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                  Proteção LGPD · Princípio do Menor Privilégio (RBAC)
                </span>
                <h2 id="rbac-restricted-logs" className="text-lg font-bold text-slate-900">
                  Acesso ao Painel de Requisições & Logs Restrito para o Perfil{" "}
                  {session?.nivel_acesso}
                </h2>
                <p className="max-w-2xl text-xs leading-5 text-slate-700">
                  Por segurança dos dados e conformidade LGPD, o perfil operacional{" "}
                  <strong>Projetista</strong> acessa apenas projetos, topologia GIS e catálogos
                  técnicos — sem permissão para consultar logs de requisições, endereços IP ou
                  atividades de outros colaboradores.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSimulateRbacBlock("logs")}
                className="shrink-0 cursor-pointer rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
              >
                Testar Bloqueio 403 na API de Logs
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <strong className="block text-xs text-rose-800">SuperAdmin (Global)</strong>
                <p className="mt-1 text-[11px] text-slate-600">
                  Inspeciona requisições de todas as empresas, filtra por Empresa, Funcionário e
                  Data/Hora.
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4">
                <strong className="block text-xs text-blue-800">
                  Administrador / Visualizador
                </strong>
                <p className="mt-1 text-[11px] text-slate-600">
                  Acessam exclusivamente os logs dos colaboradores da própria empresa (Multi-Tenant
                  estrito).
                </p>
              </article>
              <article className="rounded-xl border border-amber-200 bg-white p-4">
                <strong className="block text-xs text-amber-800">Projetista (Seu Perfil)</strong>
                <p className="mt-1 text-[11px] text-slate-600">
                  Bloqueado com HTTP 403 no endpoint <code>/api/auth/auditoria</code>. Tentativas
                  ficam registradas para o Admin/SecOps.
                </p>
              </article>
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            <section
              aria-label="Resumo operacional do painel de requisições"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Requisições Filtradas
                </span>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{auditKpis.total}</p>
                <span className="text-[11px] text-slate-500">
                  {isSuperAdmin ? "Visão Global Multi-Empresa" : `Tenant: ${session?.razao_social_empresa}`}
                </span>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Respostas 2xx (Sucesso)
                </span>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                  {auditKpis.sucessos2xx}
                </p>
                <span className="text-[11px] text-slate-500">Operações autenticadas</span>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Bloqueios / Alertas
                </span>
                <p className="mt-1 text-2xl font-bold tabular-nums text-red-700">{auditKpis.alertas}</p>
                <span className="text-[11px] text-slate-500">401, 403 RBAC, 409 e Login Falho</span>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Latência Média
                </span>
                <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">
                  {auditKpis.latenciaMedia.toFixed(1)} ms
                </p>
                <span className="text-[11px] text-slate-500">Horário oficial America/Sao_Paulo</span>
              </article>
            </section>

            <section
              aria-labelledby="audit-heading"
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="audit-heading" className="text-base font-bold text-slate-900">
                    Painel de Requisições & Auditoria (
                    {isSuperAdmin
                      ? "Global · Todas as Empresas"
                      : session?.razao_social_empresa}
                    )
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Horários em Brasília (BRT · GMT-3) com telemetria HTTP e inspeção detalhada por evento.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLiveAuditEnabled((prev) => !prev)}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      liveAuditEnabled
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {liveAuditEnabled ? "● Tempo Real Ligado" : "Tempo Real Pausado"}
                  </button>
                  {!isAdmin && !isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleSimulateRbacBlock("cabo")}
                      className="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Simular Bloqueio RBAC
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleExportAuditCsv}
                    className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Exportar CSV (BRT) ⬇
                  </button>
                </div>
              </div>

              {/* Barra de Busca Rápida + Presets + Filtros Avançados Expansíveis */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  fetchFilteredAudit();
                }}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Atalhos de período">
                    {PRESETS_PERIODO.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => aplicarPresetPeriodo(preset)}
                        className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          periodoPreset === preset.id
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <label htmlFor="audit-search" className="sr-only">
                      Buscar no painel de requisições
                    </label>
                    <input
                      id="audit-search"
                      type="search"
                      placeholder="Rota, ação, e-mail ou detalhe..."
                      value={auditFilter}
                      onChange={(e) => {
                        setAuditFilter(e.target.value);
                        setAuditPage(1);
                      }}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs sm:w-60"
                    />
                    <button
                      type="button"
                      aria-expanded={showAdvancedFilters}
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <span>Filtros avançados</span>
                      {advancedCount > 0 && (
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {advancedCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="submit"
                      disabled={loadingAudit}
                      className="h-9 cursor-pointer rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {loadingAudit ? "Filtrando..." : "Aplicar"}
                    </button>
                  </div>
                </div>

                {showAdvancedFilters && (
                  <fieldset className="m-0 grid grid-cols-1 gap-3 border-0 border-t border-slate-200 p-0 pt-3 sm:grid-cols-2 lg:grid-cols-3">
                    <legend className="sr-only">Filtros avançados de auditoria</legend>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="filtro-empresa"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Empresa (Tenant)
                      </label>
                      {isSuperAdmin ? (
                        <select
                          id="filtro-empresa"
                          value={empresaFiltro}
                          onChange={(e) => {
                            setEmpresaFiltro(e.target.value);
                            setFuncionarioFiltro("TODOS");
                          }}
                          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                        >
                          <option value="TODAS">Todas as Empresas</option>
                          {(opcoesFiltro?.empresas || []).map((emp) => (
                            <option key={emp.id_empresa} value={String(emp.id_empresa)}>
                              {emp.razao_social}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div
                          id="filtro-empresa"
                          className="flex h-9 items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-700"
                        >
                          <span className="truncate">{session?.razao_social_empresa}</span>
                          <span className="ml-2 shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                            Travado
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="filtro-funcionario"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Funcionário / Colaborador
                      </label>
                      <select
                        id="filtro-funcionario"
                        value={funcionarioFiltro}
                        onChange={(e) => setFuncionarioFiltro(e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                      >
                        <option value="TODOS">Todos os funcionários</option>
                        {isSuperAdmin && (
                          <option value="0">Sistema / Sem Sessão Autenticada</option>
                        )}
                        {funcionariosDisponiveis.map((func) => (
                          <option key={`${func.id_empresa}-${func.id_usuario}`} value={String(func.id_usuario)}>
                            {func.nome} ({func.nivel_acesso})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="filtro-metodo"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Método HTTP
                      </label>
                      <select
                        id="filtro-metodo"
                        value={metodoFiltro}
                        onChange={(e) => setMetodoFiltro(e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                      >
                        <option value="TODOS">Todos Métodos</option>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="filtro-status"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Status / Severidade
                      </label>
                      <select
                        id="filtro-status"
                        value={statusFiltro}
                        onChange={(e) => setStatusFiltro(e.target.value)}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                      >
                        <option value="TODOS">Todos Status</option>
                        <option value="2XX">Sucesso (2xx)</option>
                        <option value="ALERTA">Bloqueios / Alertas</option>
                        <option value="INFO">Operações Normais</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="filtro-data-inicio"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Data / Hora Inicial (BRT)
                      </label>
                      <input
                        id="filtro-data-inicio"
                        type="datetime-local"
                        value={dataInicioBr}
                        onChange={(e) => {
                          setPeriodoPreset("custom");
                          setDataInicioBr(e.target.value);
                        }}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="filtro-data-fim"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Data / Hora Final (BRT)
                      </label>
                      <input
                        id="filtro-data-fim"
                        type="datetime-local"
                        value={dataFimBr}
                        onChange={(e) => {
                          setPeriodoPreset("custom");
                          setDataFimBr(e.target.value);
                        }}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900"
                      />
                    </div>
                  </fieldset>
                )}

                {activeChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2.5">
                    <span className="text-[11px] font-medium text-slate-500">Filtros ativos:</span>
                    {activeChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={chip.clear}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-800 hover:bg-blue-100"
                      >
                        <span>{chip.label}</span>
                        <span aria-hidden="true">✕</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={limparFiltros}
                      className="cursor-pointer px-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      Limpar todos
                    </button>
                  </div>
                )}
              </form>

              <div className="tabela-wrap rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Registros de requisições HTTP e eventos de segurança na tabela Log_Auditoria
                  </caption>
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">#</th>
                      <th scope="col" className="px-3 py-2">Data / Hora (BRT)</th>
                      {isSuperAdmin && <th scope="col" className="px-3 py-2">Empresa</th>}
                      <th scope="col" className="px-3 py-2">Funcionário & Papel</th>
                      <th scope="col" className="px-3 py-2">Requisição HTTP</th>
                      <th scope="col" className="px-3 py-2">Status · Latência</th>
                      <th scope="col" className="px-3 py-2">Evento & Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAuditoria.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isSuperAdmin ? 7 : 6}
                          className="px-3 py-6 text-center text-slate-500"
                        >
                          Nenhuma requisição ou evento encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      paginatedAuditoria.map((ev) => {
                        const isAlert = ev.severidade === "ALERTA";
                        const isFresh = newEventIds.has(ev.id_evento);
                        const isExpanded = expandedEventId === ev.id_evento;
                        const tempoRel = formatarTempoRelativo(ev.timestamp_utc);
                        const toggleExpand = () =>
                          setExpandedEventId((curr) =>
                            curr === ev.id_evento ? null : ev.id_evento,
                          );
                        return (
                          <Fragment key={ev.id_evento}>
                            <tr
                              className={`border-t border-slate-200 transition-colors hover:bg-slate-50 ${
                                isAlert
                                  ? "bg-red-50/60"
                                  : isFresh
                                    ? "bg-emerald-50/70"
                                    : "bg-white"
                              }`}
                            >
                              <td className="px-3 py-2 font-mono tabular-nums text-slate-500">
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  aria-label={`Expandir detalhes do evento ${ev.id_evento}`}
                                  onClick={toggleExpand}
                                  className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-slate-700 hover:text-blue-700"
                                >
                                  <span aria-hidden="true" className="text-[10px]">
                                    {isExpanded ? "▾" : "▸"}
                                  </span>
                                  <span>{ev.id_evento}</span>
                                </button>
                                {isFresh && (
                                  <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white">
                                    NOVO
                                  </span>
                                )}
                              </td>
                              <td
                                className="whitespace-nowrap px-3 py-2 font-mono text-[11px] tabular-nums text-slate-700"
                                title={`UTC original: ${ev.timestamp_utc}`}
                              >
                                <time dateTime={ev.timestamp_utc} className="block font-semibold">
                                  {formatarDataHoraBr(ev.timestamp_utc)}
                                </time>
                                {tempoRel && (
                                  <span className="text-[10px] text-slate-500">{tempoRel}</span>
                                )}
                              </td>
                              {isSuperAdmin && (
                                <td className="px-3 py-2 text-[11px] text-slate-700">
                                  {ev.razao_social_empresa || "Plataforma / N/A"}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                <span className="block font-medium text-slate-900">
                                  {ev.nome_usuario || ev.email_usuario || "Sistema"}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {ev.email_usuario || "sem e-mail"}
                                  {ev.papel_rbac ? ` · ${ev.papel_rbac}` : ""}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-700">
                                {ev.metodo_http ? (
                                  <span>
                                    <strong className="text-slate-900">{ev.metodo_http}</strong>{" "}
                                    {ev.caminho_http || ""}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">evento interno</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] tabular-nums">
                                {ev.status_http ? (
                                  <span
                                    className={`rounded px-1.5 py-0.5 font-semibold ${
                                      ev.status_http >= 400
                                        ? "bg-red-100 text-red-900"
                                        : "bg-emerald-100 text-emerald-900"
                                    }`}
                                  >
                                    {ev.status_http}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                                {ev.duracao_ms !== null && ev.duracao_ms !== undefined && (
                                  <span className="ml-1.5 text-[10px] text-slate-500">
                                    {Number(ev.duracao_ms).toFixed(1)}ms
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={toggleExpand}
                                  className="cursor-pointer text-left hover:underline"
                                >
                                  <span
                                    className={`mr-2 inline-block rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                      isAlert
                                        ? "border border-red-200 bg-red-100 text-red-900"
                                        : "bg-slate-100 text-slate-800"
                                    }`}
                                  >
                                    {ev.acao}
                                  </span>
                                  <span className="text-slate-600">{ev.detalhes}</span>
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="border-t border-slate-200 bg-slate-900 text-slate-100">
                                <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-3 text-[11px]">
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                                    <div>
                                      <span className="block text-[10px] uppercase text-slate-400">
                                        Horário Brasília (BRT) / UTC
                                      </span>
                                      <time dateTime={ev.timestamp_utc} className="block font-mono font-bold text-emerald-300">
                                        {formatarDataHoraBr(ev.timestamp_utc)}
                                      </time>
                                      <span className="block font-mono text-[10px] text-slate-400">
                                        {ev.timestamp_utc}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-slate-400">
                                        Empresa & Origem (IP LGPD)
                                      </span>
                                      <strong className="text-slate-100">
                                        {ev.razao_social_empresa || "Sem vínculo / Plataforma"}
                                      </strong>
                                      <span className="block font-mono text-[10px] text-slate-400">
                                        IP: {ev.ip_origem || "local / interno"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-slate-400">
                                        Colaborador & Papel
                                      </span>
                                      <strong>
                                        {ev.nome_usuario || "Não autenticado"} (
                                        {ev.papel_rbac || "N/A"})
                                      </strong>
                                      <span className="block text-[10px] text-slate-400">
                                        {ev.email_usuario || "—"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-slate-400">
                                        Telemetria HTTP
                                      </span>
                                      <strong className="font-mono text-cyan-300">
                                        {ev.metodo_http || "EVENT"} {ev.caminho_http || "-"} ·{" "}
                                        {ev.status_http ?? "-"}
                                      </strong>
                                      <span className="block font-mono text-[10px] text-slate-400">
                                        Duração:{" "}
                                        {ev.duracao_ms !== null && ev.duracao_ms !== undefined
                                          ? `${Number(ev.duracao_ms).toFixed(2)} ms`
                                          : "—"}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="mt-2 border-t border-slate-800 pt-2 text-slate-200">
                                    <strong>Detalhes:</strong> {ev.detalhes}
                                  </p>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>
                    Exibindo {paginatedAuditoria.length} de {filteredAuditoria.length} evento(s)
                  </span>
                  <label htmlFor="audit-page-size" className="sr-only">
                    Eventos por página
                  </label>
                  <select
                    id="audit-page-size"
                    value={auditPageSize}
                    onChange={(e) => {
                      setAuditPageSize(Number(e.target.value));
                      setAuditPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                  >
                    <option value={25}>25 / pág.</option>
                    <option value={50}>50 / pág.</option>
                    <option value={100}>100 / pág.</option>
                  </select>
                </div>
                <nav aria-label="Paginação de logs">
                  <ul className="m-0 inline-flex list-none items-center gap-1 p-0">
                    <li>
                      <button
                        type="button"
                        disabled={safeAuditPage <= 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        className="h-8 cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Anterior
                      </button>
                    </li>
                    <li className="px-2 text-[11px] font-semibold tabular-nums text-slate-700">
                      Página {safeAuditPage} de {totalAuditPages}
                    </li>
                    <li>
                      <button
                        type="button"
                        disabled={safeAuditPage >= totalAuditPages}
                        onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                        className="h-8 cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Próximo
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </section>
          </div>
        )
      ) : activeTab === "saude" ? (
        !canViewAudit ? (
          <section
            aria-labelledby="rbac-restricted-db"
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm"
          >
            <h2 id="rbac-restricted-db" className="text-base font-bold text-slate-900">
              Visão Administrativa de Saúde SQL Restrita (RBAC)
            </h2>
            <p className="mt-1 text-xs text-slate-700">
              Consultas globais de métricas e views administrativas ficam disponíveis apenas para{" "}
              <strong>SuperAdmin</strong>, <strong>Administrador</strong> e{" "}
              <strong>Visualizador</strong>.
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            <section
              aria-labelledby="db-status-heading"
              className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4"
            >
              <div>
                <h2 id="db-status-heading" className="text-[11px] font-semibold uppercase text-slate-500">
                  Status da Persistência SQL
                </h2>
                <strong className="mt-1 block text-base font-bold text-emerald-700">
                  {dbHealth?.status || "indisponível"}
                </strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Motor Ativo
                </span>
                <strong className="mt-1 block text-base font-bold text-slate-900">
                  {dbHealth?.motor || "—"}
                </strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Escopo Multi-Tenant
                </span>
                <strong className="mt-1 block text-sm font-bold text-blue-700">
                  {dbHealth?.escopo_tenant === "global"
                    ? "Global (Todas Empresas)"
                    : `Empresa #${dbHealth?.escopo_tenant ?? "—"}`}
                </strong>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Destino Conectado
                </span>
                <strong className="mt-1 block truncate font-mono text-xs text-slate-800">
                  {dbHealth?.destino || "—"}
                </strong>
              </div>
            </section>

            <section
              aria-labelledby="view-resumo-heading"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 id="view-resumo-heading" className="mb-1 text-base font-bold text-slate-900">
                Resumo Corporativo de Projetos (View SQL)
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Consulta ao vivo da view <code>vw_resumo_projetos_corporativos</code>
              </p>
              <div className="tabela-wrap rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">
                    Resultados diretos da VIEW SQL de resumo de projetos
                  </caption>
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">ID</th>
                      <th scope="col" className="px-3 py-2">Empresa</th>
                      <th scope="col" className="px-3 py-2">Nome do Projeto</th>
                      <th scope="col" className="px-3 py-2">Status</th>
                      <th scope="col" className="px-3 py-2 text-right">Pontos Ativos</th>
                      <th scope="col" className="px-3 py-2 text-right">Trechos</th>
                      <th scope="col" className="px-3 py-2 text-right">Metragem</th>
                      <th scope="col" className="px-3 py-2 text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dbHealth?.vw_resumo_projetos || []).map((row) => (
                      <tr key={row.ID_Projeto} className="border-t border-slate-200">
                        <td className="px-3 py-2 font-mono tabular-nums">{row.ID_Projeto}</td>
                        <td className="px-3 py-2 text-slate-600">{row.Empresa || `Empresa #${row.ID_Empresa}`}</td>
                        <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                          {row.Nome_Projeto}
                        </th>
                        <td className="px-3 py-2 text-slate-700">{row.Status}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.Pontos_Ativos}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.Trechos_Otimizados}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(row.Metragem_Total).toFixed(2)} m
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                          {Number(row.Custo_Estimado).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )
      ) : (
        <section
          aria-labelledby="jwt-inspector-heading"
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="jwt-inspector-heading" className="text-base font-bold text-slate-900">
                Inspetor de Token <abbr title="JSON Web Token">JWT</abbr>
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Estrutura <code>Header.Payload.Signature</code> assinada com HMAC-SHA256 no servidor e isolada nesta aba via <code>TabSessionManager</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRevokeJwtTest}
              className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
            >
              Revogar JWT (Logout Denylist)
            </button>
          </div>

          {jwtDetails ? (
            <>
              {jwtDetails.secondsRemaining !== null && (
                <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-950">Validade restante da sessão</span>
                    <strong className="font-mono tabular-nums text-indigo-800">
                      {Math.floor(jwtDetails.secondsRemaining / 60)} min {jwtDetails.secondsRemaining % 60} s
                    </strong>
                  </div>
                  <progress
                    className="barra-progresso barra-progresso--indigo"
                    value={jwtDetails.secondsRemaining}
                    max={jwtLifetimeTotal}
                    aria-label="Tempo restante de validade do token JWT"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <article className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <strong className="text-xs font-bold uppercase tracking-wider text-rose-800">
                    1. Header (Algoritmo)
                  </strong>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-rose-200">
                    {JSON.stringify(jwtDetails.header, null, 2)}
                  </pre>
                </article>
                <article className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                  <strong className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                    2. Payload (Claims Base64URL)
                  </strong>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] text-indigo-200">
                    {JSON.stringify(jwtDetails.payload, null, 2)}
                  </pre>
                  {jwtDetails.payload?.iat && (
                    <p className="mt-2 text-[11px] text-slate-700">
                      Emitido (BRT): <strong>{formatarDataHoraBr(jwtDetails.payload.iat)}</strong>
                    </p>
                  )}
                  {jwtDetails.payload?.exp && (
                    <p className="mt-0.5 text-[11px] text-slate-700">
                      Expira (BRT): <strong>{formatarDataHoraBr(jwtDetails.payload.exp)}</strong>
                    </p>
                  )}
                </article>
                <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <strong className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    3. Signature (HS256)
                  </strong>
                  <p className="mt-2 break-all rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
                    {jwtDetails.signature}
                  </p>
                  <p className="mt-2 text-[11px] leading-4 text-slate-600">
                    O payload é apenas codificado em Base64URL, nunca criptografado. Dados sensíveis como senha e CPF nunca entram no token nem no Web Storage.
                  </p>
                </article>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Token JWT não disponível na sessão atual.</p>
          )}
        </section>
      )}
    </main>
  );
}
