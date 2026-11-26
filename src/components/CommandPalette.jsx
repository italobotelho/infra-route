import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, getSession } from "../lib/api";
import { podeAcessarLogsAuditoria } from "../utils/sessionVault";
import { useTheme } from "./ThemeProvider";

function buildBaseCommands(canViewAudit, isDark) {
  const items = [
    {
      id: "action-toggle-theme",
      group: "Preferências de Interface",
      label: isDark ? "Alternar para Modo Claro" : "Alternar para Modo Escuro",
      hint: isDark
        ? "Usar superfície clara de alto contraste nos painéis"
        : "Reduzir fadiga visual com superfície noturna",
      action: "toggle-theme",
      keywords: "tema escuro claro dark light modo noturno aparencia",
    },
    {
      id: "nav-dashboard",
      group: "Navegação",
      label: "Dashboard Executivo",
      hint: "Indicadores de portfólio e status",
      to: "/dashboard",
      keywords: "dashboard inicio home kpis resumo",
    },
    {
      id: "nav-projetos",
      group: "Navegação",
      label: "Projetos",
      hint: "Portfólio, busca, filtros e exportações",
      to: "/projetos",
      keywords: "projetos lista portfolio criar bom",
    },
    {
      id: "nav-governanca-cat",
      group: "Governança & Segurança",
      label: "Catálogos Técnicos (Equipamentos e Cabos)",
      hint: "Modelos normalizados 3FN e vãos livres",
      to: "/governanca?tab=catalogos",
      keywords: "catalogos cabos equipamentos 3fn",
    },
    {
      id: "nav-governanca-jwt",
      group: "Governança & Segurança",
      label: "Inspetor de Sessão JWT",
      hint: "Claims, expiração e revogação de token",
      to: "/governanca?tab=jwt",
      keywords: "jwt token sessao seguranca",
    },
    {
      id: "nav-ajuda",
      group: "Suporte",
      label: "Central de Ajuda & Atalhos GIS",
      hint: "Manual operacional, RBAC e FAQ",
      to: "/ajuda",
      keywords: "ajuda manual atalhos faq rbac",
    },
  ];

  if (canViewAudit) {
    items.splice(2, 0,
      {
        id: "nav-governanca-auditoria",
        group: "Governança & Segurança",
        label: "Painel de Requisições & Logs Ao Vivo",
        hint: "Telemetria HTTP, filtros e trilha LGPD",
        to: "/governanca?tab=auditoria",
        keywords: "governanca auditoria logs sse requisicoes",
      },
      {
        id: "nav-governanca-saude",
        group: "Governança & Segurança",
        label: "Saúde SQL & Views Corporativas",
        hint: "Diagnóstico ACID e resumo consolidado",
        to: "/governanca?tab=saude",
        keywords: "sql banco saude view postgres sqlite",
      },
    );
  }

  return items;
}

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const session = getSession();
  const canViewAudit = podeAcessarLogsAuditoria(session?.nivel_acesso);
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActiveIndex(0);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    if (session?.id_usuario) {
      let cancelled = false;
      const empresaQuery =
        session?.nivel_acesso === "SuperAdmin" ? 0 : session.id_empresa_padrao;
      setLoadingProjects(true);
      apiRequest(
        `/projetos?id_empresa=${empresaQuery}&id_usuario_autor=${session.id_usuario}`,
      )
        .then((res) => {
          if (!cancelled && Array.isArray(res)) {
            setProjects(res.slice(0, 15));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingProjects(false);
        });
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(frame);
      };
    }

    return () => window.cancelAnimationFrame(frame);
  }, [open, session?.id_usuario, session?.id_empresa_padrao, session?.nivel_acesso]);

  const commands = useMemo(() => {
    const base = buildBaseCommands(canViewAudit, isDark);
    const projectItems = projects.map((proj) => ({
      id: `proj-${proj.id_projeto}`,
      group: "Abrir no Workspace GIS",
      label: proj.nome,
      hint: `IR-${String(proj.id_projeto).padStart(4, "0")} · ${proj.status}`,
      to: `/workspace?id_projeto=${proj.id_projeto}`,
      keywords: `${proj.nome} ir-${String(proj.id_projeto).padStart(4, "0")} ${proj.status} mapa workspace`,
    }));
    const all = [...base, ...projectItems];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) =>
      `${item.label} ${item.hint} ${item.group} ${item.keywords}`
        .toLowerCase()
        .includes(q),
    );
  }, [canViewAudit, isDark, projects, query]);

  const executeCommand = useCallback(
    (cmd) => {
      if (!cmd) return;
      if (cmd.action === "toggle-theme") {
        toggleTheme();
      } else if (cmd.to) {
        navigate(cmd.to);
      }
      onClose();
    },
    [navigate, onClose, toggleTheme],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((idx) => (commands.length ? (idx + 1) % commands.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((idx) =>
          commands.length ? (idx - 1 + commands.length) % commands.length : 0,
        );
      } else if (event.key === "Enter" && commands[activeIndex]) {
        event.preventDefault();
        executeCommand(commands[activeIndex]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, commands, activeIndex, executeCommand, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-[1100] flex items-start justify-center bg-slate-950/60 px-4 pt-16 backdrop-blur-sm sm:pt-24"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navegação rápida"
        data-theme-surface="adaptive"
        className="modal-panel-enter w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4 shrink-0 text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.8-3.8" />
          </svg>
          <label htmlFor="command-palette-input" className="sr-only">
            Ir para tela ou projeto
          </label>
          <input
            ref={inputRef}
            id="command-palette-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ir para tela, aba ou projeto (ex.: Projetos, Logs, IR-0001)..."
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
          >
            <kbd>Esc</kbd>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {commands.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              {loadingProjects
                ? "Carregando projetos..."
                : "Nenhum destino encontrado para esta busca."}
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0" role="listbox" aria-label="Destinos disponíveis">
              {commands.map((cmd, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={cmd.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => executeCommand(cmd)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        isActive
                          ? "bg-blue-50 text-blue-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold">
                          {cmd.label}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {cmd.hint}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isActive
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {cmd.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span>
            Use <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px]">↑</kbd>{" "}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px]">↓</kbd> para navegar e{" "}
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[10px]">Enter</kbd> para abrir
          </span>
          <span>{loadingProjects ? "Sincronizando projetos..." : `${commands.length} opções`}</span>
        </footer>
      </div>
    </div>
  );
}
