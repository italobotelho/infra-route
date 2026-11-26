import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getSession, logoutSession } from "../../../lib/api";
import { BrandLogo } from "../../../components/BrandLogo";
import { LiveAuditDrawer } from "../../../components/LiveAuditDrawer";
import { QuickPersonaSwitcher } from "../../../components/QuickPersonaSwitcher";
import { ThemeToggle } from "../../../components/ThemeProvider";
import { useToast } from "../../../components/ToastProvider";
import { STORAGE_KEYS, getStorageItem, setStorageItem } from "../../../utils/storage";
import default27 from "../assets/default-27.svg";

const navigationItems = [
  { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { label: "Projetos", path: "/projetos", icon: "projects" },
  { label: "Governança & SQL", path: "/governanca", icon: "governance" },
  { label: "Central de Ajuda", path: "/ajuda", icon: "help" },
];

function SidebarNavIcon({ icon, active }) {
  const colorClass = active ? "text-blue-300" : "text-slate-300";
  switch (icon) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${colorClass}`} aria-hidden="true">
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "projects":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${colorClass}`} aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "governance":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${colorClass}`} aria-hidden="true">
          <path d="M12 3l7 4v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V7l7-4z" />
          <path d="M9.5 12l1.8 1.8 3.5-3.8" />
        </svg>
      );
    case "help":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 shrink-0 ${colorClass}`} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    default:
      return null;
  }
}

export const WorkspaceNavigationSidebarSection = ({ onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    Boolean(getStorageItem(STORAGE_KEYS.UI_SIDEBAR_COLLAPSED, false)),
  );
  const session = getSession();

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.UI_SIDEBAR_COLLAPSED, collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const handleEsc = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mobileMenuOpen]);

  const userInitials =
    (session?.nome || "IR")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "IR";

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logoutSession();
    showToast("Sessão encerrada com segurança.", { type: "info" });
    navigate("/login", { replace: true });
  };

  return (
    <>
      <aside
        className={`no-print relative flex w-full shrink-0 flex-col items-start justify-between bg-slate-900 px-4 py-3.5 transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r lg:border-slate-800 lg:py-6 ${
          collapsed ? "lg:w-[76px] lg:px-3" : "lg:w-[264px] lg:px-4"
        }`}
        aria-label="Navegação do workspace"
      >
        <div className="relative flex w-full flex-col items-start gap-5 lg:gap-7">
          <header className="relative flex w-full items-center justify-between gap-2">
            <div className={`flex flex-col items-start gap-2 ${collapsed ? "lg:items-center lg:w-full" : ""}`}>
              <div className="flex w-full items-center justify-between gap-2">
                <NavLink
                  to="/dashboard"
                  title="InfraRoute — Ir para Dashboard"
                  className="inline-flex items-center gap-2.5 rounded-lg text-decoration-none"
                >
                  <BrandLogo size="xs" />
                  {!collapsed && (
                    <span className="whitespace-nowrap text-[21px] font-bold tracking-[-0.20px] text-slate-50 lg:text-[23px]">
                      InfraRoute
                    </span>
                  )}
                </NavLink>

                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => !prev)}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
                  title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
                  className="hidden h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-700/80 bg-slate-800/70 text-slate-300 transition hover:bg-slate-800 hover:text-white lg:inline-flex"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                    {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
                  </svg>
                </button>
              </div>

              {!collapsed && (
                <div className="hidden items-start overflow-hidden rounded border border-solid border-slate-700 bg-slate-950/40 px-2 py-[3px] lg:inline-flex">
                  <span className="whitespace-nowrap text-[10px] font-semibold text-slate-300">
                    <abbr title="Business-to-Business">B2B</abbr> Enterprise ·{" "}
                    {session?.razao_social_empresa ? "Multi-Tenant" : "OSP"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  aria-label="Abrir busca rápida"
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.8-3.8" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-drawer"
                aria-label="Abrir menu de navegação"
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </header>

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              title="Navegação rápida (Ctrl+K)"
              className={`hidden w-full cursor-pointer items-center rounded-lg border border-slate-700/80 bg-slate-950/60 py-2 text-xs text-slate-300 transition hover:border-blue-500/60 hover:bg-slate-800 hover:text-white lg:flex ${
                collapsed ? "justify-center px-2" : "justify-between px-3"
              }`}
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.8-3.8" />
                </svg>
                {!collapsed && <span>Busca rápida...</span>}
              </span>
              {!collapsed && (
                <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  Ctrl K
                </kbd>
              )}
            </button>
          )}

          <nav
            className="relative hidden w-full flex-col items-start gap-2 lg:flex"
            aria-label="Menu principal do workspace"
          >
            {!collapsed && (
              <p className="px-2 text-[10px] font-semibold tracking-[0.14px] text-slate-400">
                NAVEGAÇÃO
              </p>
            )}
            <ul className="m-0 flex w-full list-none flex-col items-start gap-1.5 p-0">
              {navigationItems.map((item) => (
                <li key={item.path} className="w-full">
                  <NavLink
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    aria-current={undefined}
                    className={({ isActive }) =>
                      `relative flex h-11 w-full items-center rounded-lg transition ${
                        collapsed ? "justify-center px-2" : "gap-3 px-3"
                      } ${
                        isActive
                          ? "bg-blue-600/20 text-blue-100 ring-1 ring-inset ring-blue-500/40"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            className="absolute top-2.5 left-0 h-6 w-[3px] rounded-r-sm bg-blue-400"
                            aria-hidden="true"
                          />
                        )}
                        <SidebarNavIcon icon={item.icon} active={isActive} />
                        {!collapsed && (
                          <span
                            className={`truncate text-[13px] ${
                              isActive ? "font-semibold text-white" : "font-medium text-slate-300"
                            }`}
                          >
                            {item.label}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="relative mt-6 hidden w-full flex-col items-start gap-3.5 lg:flex">
          {!collapsed && <QuickPersonaSwitcher variant="sidebar" />}

          <LiveAuditDrawer placement="sidebar-inline" sidebarCollapsed={collapsed} />

          {!collapsed && (
            <section
              className="flex w-full flex-col items-start gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              aria-labelledby="tenant-card-title"
            >
              <h2
                id="tenant-card-title"
                className="text-[10px] font-semibold tracking-[0.11px] text-slate-400"
              >
                EMPRESA ATIVA
              </h2>
              <p className="m-0 text-xs font-medium leading-5 text-slate-200">
                {session?.razao_social_empresa || "InfraTelecom Engenharia Óptica S.A."}
              </p>
            </section>
          )}

          <section
            className={`flex w-full flex-col items-start gap-3 border-t border-solid border-slate-800 pt-4 ${
              collapsed ? "items-center px-0" : "px-1"
            }`}
            aria-label="Perfil do usuário"
          >
            <div className={`flex w-full items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
              <div
                title={`${session?.nome || "Usuário"} (${session?.nivel_acesso || ""})`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700"
                aria-hidden="true"
              >
                <span className="text-xs font-semibold text-slate-50">{userInitials}</span>
              </div>
              {!collapsed && (
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <strong className="max-w-full truncate text-[13px] font-semibold text-slate-50">
                    {session?.nome}
                  </strong>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                    {session?.nivel_acesso}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="inline-flex items-center gap-1.5">
                <span className="relative h-[15px] w-[15px]" aria-hidden="true">
                  <img className="h-full w-full" alt="" src={default27} />
                </span>
                <span className="text-[11px] text-slate-300">
                  {session?.crea ? (
                    <>
                      <abbr title="Conselho Regional de Engenharia e Agronomia">CREA</abbr> {session.crea}
                    </>
                  ) : (
                    "Acesso Somente Leitura"
                  )}
                </span>
              </div>
            )}

            <ThemeToggle variant="sidebar" collapsed={collapsed} />

            <button
              type="button"
              title="Sair da plataforma"
              aria-label="Sair da plataforma"
              className={`flex cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-800/70 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white ${
                collapsed ? "w-full justify-center px-2" : "w-full justify-between px-3 text-left"
              }`}
              onClick={handleLogout}
            >
              {collapsed ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
              ) : (
                <>
                  <span>Sair da plataforma</span>
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </section>
        </div>
      </aside>

      {/* Drawer Mobile Deslizante com Backdrop */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-[1050] flex bg-slate-950/70 backdrop-blur-sm lg:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside
            id="mobile-navigation-drawer"
            aria-label="Menu de navegação móvel"
            className="flex h-full w-80 max-w-[85vw] flex-col justify-between overflow-y-auto bg-slate-900 p-5 text-slate-100 shadow-2xl"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="inline-flex items-center gap-2.5">
                  <BrandLogo size="xs" decorative />
                  <span className="text-lg font-bold text-white">InfraRoute</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu de navegação"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <nav aria-label="Links principais móveis">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {navigationItems.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `relative flex h-11 w-full items-center gap-3 rounded-lg px-3 transition ${
                            isActive
                              ? "bg-blue-600/20 font-semibold text-white ring-1 ring-inset ring-blue-500/40"
                              : "font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <SidebarNavIcon icon={item.icon} active={isActive} />
                            <span className="text-[13px]">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              <QuickPersonaSwitcher variant="sidebar" />

              <LiveAuditDrawer placement="sidebar-inline" sidebarCollapsed={false} />
            </div>

            <div className="mt-6 space-y-3 border-t border-slate-800 pt-4">
              <ThemeToggle variant="sidebar" collapsed={false} />

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="block text-[10px] font-semibold uppercase text-slate-400">
                  Empresa Ativa
                </span>
                <p className="m-0 mt-0.5 text-xs font-medium text-slate-200">
                  {session?.razao_social_empresa || "InfraTelecom Engenharia Óptica S.A."}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <strong className="block truncate text-xs font-semibold text-white">
                    {session?.nome}
                  </strong>
                  <span className="text-[11px] text-slate-400">
                    {session?.nivel_acesso}
                    {session?.crea ? ` · CREA ${session.crea}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="shrink-0 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  Sair
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
