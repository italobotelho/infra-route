import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, getSession, saveSession } from "../../../lib/api";
import { Icon, Icon1, Icon2, Icon3, Icon4, Icon5, Icon6, Icon7, Icon8, IconComponentNode } from "./icons/ActionIcons";
import collaborators from "../assets/collaborators.svg";
import collaborators2 from "../assets/collaborators-2.svg";
import collaborators3 from "../assets/collaborators-3.svg";
import collaborators4 from "../assets/collaborators-4.svg";
import collaborators5 from "../assets/collaborators-5.svg";
import collaborators6 from "../assets/collaborators-6.svg";
import collaborators7 from "../assets/collaborators-7.svg";
import collaborators8 from "../assets/collaborators-8.svg";
import collaborators9 from "../assets/collaborators-9.svg";
import collaborators10 from "../assets/collaborators-10.svg";
import xdefault from "../assets/default.svg";
import default2 from "../assets/default-2.svg";
import default3 from "../assets/default-3.svg";
import default4 from "../assets/default-4.svg";
import default5 from "../assets/default-5.svg";
import default6 from "../assets/default-6.svg";
import default7 from "../assets/default-7.svg";
import default8 from "../assets/default-8.svg";
import default9 from "../assets/default-9.svg";
import default10 from "../assets/default-10.svg";
import default11 from "../assets/default-11.svg";
import default12 from "../assets/default-12.svg";
import default13 from "../assets/default-13.svg";
import default14 from "../assets/default-14.svg";
import default15 from "../assets/default-15.svg";
import default16 from "../assets/default-16.svg";
import default17 from "../assets/default-17.svg";
import default18 from "../assets/default-18.svg";
import default19 from "../assets/default-19.svg";
import default20 from "../assets/default-20.svg";
import default21 from "../assets/default-21.svg";
import default22 from "../assets/default-22.svg";
import default23 from "../assets/default-23.svg";
import default28 from "../assets/default-28.svg";
import image from "../assets/image.svg";
import objective from "../assets/objective.svg";
import objective2 from "../assets/objective-2.svg";
import objective3 from "../assets/objective-3.svg";
import objective4 from "../assets/objective-4.svg";
import objective5 from "../assets/objective-5.svg";
import objective6 from "../assets/objective-6.svg";
import objective7 from "../assets/objective-7.svg";
import objective8 from "../assets/objective-8.svg";
import objective9 from "../assets/objective-9.svg";
import objective10 from "../assets/objective-10.svg";
import owner from "../assets/owner.svg";
import owner2 from "../assets/owner-2.svg";
import owner3 from "../assets/owner-3.svg";
import owner4 from "../assets/owner-4.svg";
import owner5 from "../assets/owner-5.svg";
import owner6 from "../assets/owner-6.svg";
import owner7 from "../assets/owner-7.svg";
import owner8 from "../assets/owner-8.svg";
import owner9 from "../assets/owner-9.svg";
import owner10 from "../assets/owner-10.svg";
import status from "../assets/status.svg";
import status2 from "../assets/status-2.svg";
import status3 from "../assets/status-3.svg";
import status4 from "../assets/status-4.svg";
import status5 from "../assets/status-5.svg";
import status6 from "../assets/status-6.svg";
import status7 from "../assets/status-7.svg";
import status8 from "../assets/status-8.svg";
import status9 from "../assets/status-9.svg";
import status10 from "../assets/status-10.svg";

const projectArtwork = [
  {
    name: "Projeto Campinas",
    code: "OSP-0268 · Campinas / SP",
    status: status,
    owner: owner,
    collaborators: collaborators,
    objective: objective,
    folder: default4,
    start: "26/10/26",
    end: "12/11/26",
    action: Icon,
  },
  {
    name: "Projeto Valinhos",
    code: "OSP-0267 · Valinhos / SP",
    status: status2,
    owner: owner2,
    collaborators: collaborators2,
    objective: objective2,
    folder: default6,
    start: "20/10/26",
    end: "18/11/26",
    action: IconComponentNode,
  },
  {
    name: "Bairro da Capela",
    code: "OSP-0266 · Vinhedo / SP",
    status: status3,
    owner: owner3,
    collaborators: collaborators3,
    objective: objective3,
    folder: default8,
    start: "05/10/26",
    end: "30/11/26",
    action: Icon1,
  },
  {
    name: "Parque Portugal",
    code: "OSP-0265 · Valinhos / SP",
    status: status4,
    owner: owner4,
    collaborators: collaborators4,
    objective: objective4,
    folder: default10,
    start: "01/10/26",
    end: "28/10/26",
    action: Icon2,
  },
  {
    name: "Anel Sorocaba",
    code: "OSP-0264 · Sorocaba / SP",
    status: status5,
    owner: owner5,
    collaborators: collaborators5,
    objective: objective5,
    folder: default12,
    start: "22/10/26",
    end: "25/11/26",
    action: Icon3,
  },
  {
    name: "Rede Vinhedo",
    code: "OSP-0263 · Vinhedo / SP",
    status: status6,
    owner: owner6,
    collaborators: collaborators6,
    objective: objective6,
    folder: default14,
    start: "19/10/26",
    end: "09/11/26",
    action: Icon4,
  },
  {
    name: "Parque Logístico Sul",
    code: "OSP-0262 · Curitiba / PR",
    status: status7,
    owner: owner7,
    collaborators: collaborators7,
    objective: objective7,
    folder: default16,
    start: "08/10/26",
    end: "06/11/26",
    action: Icon5,
  },
  {
    name: "Residencial Aurora",
    code: "OSP-0261 · Londrina / PR",
    status: status8,
    owner: owner8,
    collaborators: collaborators8,
    objective: objective8,
    folder: default18,
    start: "23/10/26",
    end: "16/12/26",
    action: Icon6,
  },
  {
    name: "Campus Pinheiros",
    code: "OSP-0260 · São Paulo / SP",
    status: status9,
    owner: owner9,
    collaborators: collaborators9,
    objective: objective9,
    folder: default20,
    start: "15/10/26",
    end: "27/11/26",
    action: Icon7,
  },
  {
    name: "Expansão Jundiaí",
    code: "OSP-0259 · Jundiaí / SP",
    status: status10,
    owner: owner10,
    collaborators: collaborators10,
    objective: objective10,
    folder: default22,
    start: "12/10/26",
    end: "20/11/26",
    action: Icon8,
  },
];

const calendarIcons = [
  default5,
  default7,
  default9,
  default11,
  default13,
  default15,
  default17,
  default19,
  default21,
  default23,
];

const headerColumns = [
  { label: "Nome", className: "min-w-[172px]" },
  { label: "Status", className: "min-w-[120px]" },
  { label: "Empresa", className: "min-w-36" },
  { label: "Equipe", className: "min-w-[104px]" },
  { label: "Tipo de Projeto", className: "min-w-36" },
  { label: "Custo / Metragem", className: "min-w-[156px]" },
  { label: "Ações", className: "min-w-9" },
];

export const CurrentProjectsSection = () => {
  const navigate = useNavigate();
  const [session, setSessionState] = useState(() => getSession());
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [actionProject, setActionProject] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(
        `/projetos?id_empresa=${session.id_empresa_padrao}&id_usuario_autor=${session.id_usuario}`,
      );
      setProjects(
        response.map((project, index) => ({
          ...project,
          name: project.nome,
          code: `IR-${String(project.id_projeto).padStart(4, "0")}`,
          artwork: projectArtwork[index % projectArtwork.length],
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

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const base = !normalizedQuery
      ? projects
      : projects.filter((project) =>
          `${project.name} ${project.code} ${project.status}`.toLowerCase().includes(normalizedQuery),
        );

    return [...base].sort((a, b) =>
      sortAsc ? a.name.localeCompare(b.name, "pt-BR") : b.name.localeCompare(a.name, "pt-BR"),
    );
  }, [projects, query, sortAsc]);

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedProjects = useMemo(() => {
    const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredProjects.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredProjects, safePage]);

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
      setActionProject((curr) => (curr && curr.id_projeto === idProjeto ? { ...curr, status: novoStatus } : curr));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const exportProjectReport = async (project) => {
    setError("");
    try {
      const detail = await apiRequest(
        `/projetos/${project.id_projeto}?id_usuario_autor=${session.id_usuario}`,
      );
      const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-projeto-${project.id_projeto}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
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
        current.filter(
          (code) => !filteredProjects.some((project) => project.code === code),
        ),
      );
      return;
    }

    setSelected((current) => [
      ...new Set([
        ...current,
        ...filteredProjects.map((project) => project.code),
      ]),
    ]);
  };

  const refreshProjects = () => {
    setQuery("");
    setSelected([]);
    setPage(1);
    loadProjects();
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
      setOtpMessage("E-mail verificado com sucesso!");
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

  return (
    <main className="flex flex-col items-start gap-6 p-8 relative flex-1 self-stretch grow">
      {session && session.email_verificado === false && (
        <section
          role="region"
          aria-label="Verificação de e-mail"
          className="flex flex-wrap items-center justify-between gap-4 w-full rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-slate-900 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-amber-900">
              Confirme seu e-mail corporativo ({session.email})
            </span>
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
          <form onSubmit={verifyEmailOtp} className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
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
      <header className="flex flex-col min-h-20 items-start gap-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="flex items-center justify-between relative self-stretch w-full flex-[0_0_auto]">
          <nav
            aria-label="Breadcrumb"
            className="inline-flex items-center gap-2 relative flex-[0_0_auto]"
          >
            <span className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
              Workspace
            </span>
            <span className="relative w-3 h-3" aria-hidden="true">
              <img
                className="absolute w-[69.58%] h-[82.08%] top-[17.92%] left-[30.42%]"
                alt=""
                src={xdefault}
              />
            </span>
            <span className="relative w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-slate-900 text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
              Projetos
            </span>
          </nav>
          <p className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
            Gestão de expansão OSP / FTTH
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-[12px_24px] relative self-stretch w-full flex-[0_0_auto]">
          <h1 className="relative flex-1 [font-family:'Inter-Bold',Helvetica] font-bold text-slate-900 text-[32px] tracking-[-0.26px] leading-10">
            Projetos atuais
          </h1>
          <div className="inline-flex items-center gap-3 relative flex-[0_0_auto]">
            <label className="flex w-[210px] h-11 items-center gap-3 px-4 py-0 relative bg-white rounded-lg border border-solid border-slate-300">
              <img
                className="relative w-[19.7px] h-[19.7px]"
                alt=""
                src={default28}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar projetos..."
                aria-label="Buscar projetos"
                className="relative min-w-0 flex-1 bg-transparent outline-none [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-xs tracking-[0] leading-5 placeholder:text-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={refreshProjects}
              className="inline-flex h-12 items-center justify-center gap-2.5 px-6 py-3 relative flex-[0_0_auto] bg-white rounded-lg border border-solid border-slate-300"
            >
              <span className="text-blue-700 relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm text-center tracking-[0] leading-6 whitespace-nowrap">
                Refresh ↻
              </span>
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2.5 px-6 py-3 relative flex-[0_0_auto] bg-white rounded-lg border border-solid border-slate-300"
            >
              <span className="text-blue-700 relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm text-center tracking-[0] leading-6 whitespace-nowrap">
                Customize ⚙
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex h-12 items-center justify-center gap-2.5 px-6 py-3 relative flex-[0_0_auto] bg-blue-600 rounded-lg"
            >
              <span className="text-white relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm text-center tracking-[0] leading-6 whitespace-nowrap">
                New project +
              </span>
            </button>
          </div>
        </div>
      </header>
      <section className="flex flex-col items-start gap-4 relative self-stretch w-full flex-[0_0_auto]">
        <div className="flex flex-col items-start relative self-stretch w-full flex-[0_0_auto] overflow-x-auto">
          <div className="flex flex-col min-w-[1016px] items-start relative self-stretch w-full flex-[0_0_auto] bg-white rounded-lg overflow-hidden border border-solid border-slate-200">
            <div
              role="row"
              className="flex h-[52px] items-center gap-3 px-4 py-0 relative self-stretch w-full bg-slate-50 border-b [border-bottom-style:solid] border-slate-200"
            >
              <div className="flex min-w-6 items-center gap-2 relative flex-1 grow">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos os projetos"
                  className="relative w-4 h-4 rounded border border-solid border-slate-300 accent-blue-600"
                />
              </div>
              {headerColumns.map((column) => (
                <div
                  key={column.label}
                  className={`flex items-center gap-2 relative flex-1 grow ${column.className}`}
                >
                  {column.label === "Nome" ? (
                    <button
                      type="button"
                      onClick={() => setSortAsc((prev) => !prev)}
                      className="flex items-center gap-2 bg-transparent border-0 p-0 cursor-pointer text-left"
                      title="Ordenar por nome"
                    >
                      <span className="leading-[15px] whitespace-pre-line relative flex-1 mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-600 text-[10px] tracking-[0]">
                        {column.label}
                      </span>
                      <span className="relative w-3 h-3" aria-hidden="true">
                        <img
                          className={`absolute w-[86.25%] h-[86.25%] top-[13.75%] left-[13.75%] transition-transform ${sortAsc ? "" : "rotate-180"}`}
                          alt=""
                          src={image}
                        />
                      </span>
                    </button>
                  ) : (
                    <span className="leading-[15px] whitespace-pre-line relative flex-1 mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-600 text-[10px] tracking-[0]">
                      {column.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {loading ? (
              <p className="p-6 text-sm text-slate-600">Carregando projetos...</p>
            ) : error && projects.length === 0 ? (
              <p className="p-6 text-sm text-red-600" role="alert">{error}</p>
            ) : filteredProjects.length === 0 ? (
              <p className="p-6 text-sm text-slate-600">Nenhum projeto encontrado.</p>
            ) : paginatedProjects.map((project, index) => {
              const ActionIcon = project.artwork.action;
              const calendarIcon = calendarIcons[index % calendarIcons.length];

              return (
                <div
                  role="row"
                  key={project.id_projeto}
                  className="flex h-14 items-center gap-3 px-4 py-0 relative self-stretch w-full bg-white border-b [border-bottom-style:solid] border-slate-200"
                >
                  <div className="flex min-w-6 items-center gap-2 relative flex-1 grow">
                    <input
                      type="checkbox"
                      checked={selected.includes(project.code)}
                      onChange={() => toggleProject(project.code)}
                      aria-label={`Selecionar ${project.name}`}
                      className="relative w-4 h-4 rounded border border-solid border-slate-300 accent-blue-600"
                    />
                  </div>
                  <div className="flex min-w-[172px] items-center gap-2 relative flex-1 grow">
                    <div className="relative w-[18px] h-[18px]">
                      <img
                        className="absolute w-[96.39%] h-[92.22%] top-[7.78%] left-[3.61%]"
                        alt=""
                        src={project.artwork.folder}
                      />
                    </div>
                    <div className="flex flex-col items-start gap-1 relative flex-1 grow min-w-0">
                      <button
                        type="button"
                        className="relative self-stretch mt-[-1.00px] text-left [font-family:'Inter-SemiBold',Helvetica] font-semibold text-slate-900 text-xs tracking-[0] leading-4 truncate"
                        onClick={() => navigate(`/workspace?id_projeto=${project.id_projeto}`)}
                      >
                        {project.name}
                      </button>
                      <span className="relative self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-[10px] tracking-[0] leading-[14px] truncate">
                        {project.code} · {project.metragem_total.toFixed(0)} m
                      </span>
                    </div>
                  </div>
                  <span className="min-w-[120px] flex-1 text-xs text-slate-700">{project.status}</span>
                  <span className="min-w-36 flex-1 truncate text-xs text-slate-700">{session.razao_social_empresa}</span>
                  <span className="min-w-[104px] flex-1 text-xs text-slate-500">—</span>
                  <span className="min-w-36 flex-1 text-xs text-slate-700">Expansão OSP</span>
                  <div className="flex min-w-[156px] items-center gap-2 relative flex-1 grow">
                    <div className="relative w-[15px] h-[15px]">
                      <img
                        className="absolute w-[93.17%] h-[97.34%] top-[2.66%] left-[6.83%]"
                        alt=""
                        src={calendarIcon}
                      />
                    </div>
                    <div className="inline-flex flex-col items-start gap-1 relative flex-[0_0_auto]">
                      <span className="relative w-fit mt-[-1.00px] [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-[11px] tracking-[0] leading-[14px] whitespace-nowrap">
                        {project.custo_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                      <span className="relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-slate-900 text-[11px] tracking-[0] leading-[14px] whitespace-nowrap">
                        {project.metragem_total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-9 items-center gap-2 relative flex-1 grow">
                    <button
                      type="button"
                      aria-label={`Ações de ${project.name}`}
                      onClick={() => setActionProject(project)}
                      className="p-0 bg-transparent border-0 cursor-pointer"
                    >
                      <ActionIcon className="!relative !w-8 !h-8" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex h-14 items-center justify-between px-4 py-0 relative self-stretch w-full bg-white rounded-lg overflow-hidden border border-solid border-slate-200 shadow-[0px_4px_16px_#0f172a0d]">
          <p className="relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-xs tracking-[0] leading-[normal]">
            Exibindo {paginatedProjects.length} de {filteredProjects.length} projetos
          </p>
          <nav
            aria-label="Paginação"
            className="inline-flex items-center gap-1 relative flex-[0_0_auto]"
          >
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Página anterior"
              className="relative w-3.5 h-3.5 bg-transparent border-0 p-0"
            >
              <img
                className="absolute w-[71.09%] h-[81.07%] top-[18.93%] left-[28.91%]"
                alt=""
                src={default2}
              />
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex min-w-8 h-8 items-center justify-center px-2.5 py-0 relative flex-[0_0_auto] bg-white rounded-md overflow-hidden"
            >
              <span className="[font-family:'Inter-Medium',Helvetica] font-medium text-slate-600 relative w-fit text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
                Anterior
              </span>
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setPage(item)}
                aria-current={safePage === item ? "page" : undefined}
                className={`inline-flex min-w-8 h-8 items-center justify-center px-2.5 py-0 relative flex-[0_0_auto] rounded-md overflow-hidden ${
                  safePage === item ? "bg-blue-600" : "bg-white"
                }`}
              >
                <span
                  className={`[font-family:'Inter-SemiBold',Helvetica] font-semibold relative w-fit text-[11px] tracking-[0] leading-[normal] whitespace-nowrap ${
                    safePage === item ? "text-white" : "text-slate-600"
                  }`}
                >
                  {item}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="inline-flex min-w-8 h-8 items-center justify-center px-2.5 py-0 relative flex-[0_0_auto] bg-white rounded-md overflow-hidden"
            >
              <span className="[font-family:'Inter-Medium',Helvetica] font-medium text-slate-600 relative w-fit text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
                Próximo
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              aria-label="Próxima página"
              className="relative w-3.5 h-3.5 bg-transparent border-0 p-0"
            >
              <img
                className="absolute w-[68.57%] h-[81.07%] top-[18.93%] left-[31.43%]"
                alt=""
                src={default3}
              />
            </button>
          </nav>
        </div>
      </section>
      <footer className="flex items-center justify-between relative self-stretch w-full flex-[0_0_auto]">
        <p className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
          Dados demonstrativos · Não representam dados reais
        </p>
        <p className="mt-[-1.00px] text-slate-600 relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-[11px] tracking-[0] leading-[normal] whitespace-nowrap">
          InfraRoute / Engenharia de redes
        </p>
      </footer>
      {error && projects.length > 0 && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
            onSubmit={createProject}
          >
            <h2 className="text-xl font-semibold text-slate-900">Criar projeto</h2>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Nome do projeto
              <input
                autoFocus
                required
                minLength={1}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </label>
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
                {isCreating ? "Criando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}
      {actionProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
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
                className="text-slate-400 hover:text-slate-700"
                aria-label="Fechar ações do projeto"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Alterar Status (Governança Seção 3.3)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {["Em Planejamento", "Em Execução", "Concluído", "Cancelado"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={isUpdatingStatus || actionProject.status === st}
                    onClick={() => updateProjectStatus(actionProject.id_projeto, st)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
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
                onClick={() => exportProjectReport(actionProject)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Exportar Memorial Descritivo (JSON) ⬇
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
