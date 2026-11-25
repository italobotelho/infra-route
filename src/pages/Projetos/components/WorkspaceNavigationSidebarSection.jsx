import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSession, logoutSession } from "../../../lib/api";
import { LiveAuditDrawer } from "../../../components/LiveAuditDrawer";
import { QuickPersonaSwitcher } from "../../../components/QuickPersonaSwitcher";
import { useToast } from "../../../components/ToastProvider";
import default27 from "../assets/default-27.svg";
import symbol from "../assets/symbol.svg";

const navigationItems = [
  { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
  { label: "Projetos", path: "/projetos", icon: "projects" },
  { label: "Governança & SQL", path: "/governanca", icon: "governance" },
  { label: "Central de Ajuda", path: "/ajuda", icon: "help" },
];

function SidebarNavIcon({ icon, active }) {
  const colorClass = active ? "text-blue-700" : "text-slate-300";
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

export const WorkspaceNavigationSidebarSection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const session = getSession();

  const userInitials = (session?.nome || "IR")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "IR";

  const handleNavigation = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    await logoutSession();
    showToast("Sessão encerrada com segurança.", { type: "info" });
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className="no-print relative flex w-full shrink-0 flex-col items-start justify-between self-stretch bg-slate-900 px-4 pt-5 pb-5 lg:min-h-screen lg:w-[260px] lg:pt-8 lg:pb-6"
      aria-label="Navegação do workspace"
    >
      <div className="relative flex w-full flex-col items-start gap-6 lg:gap-10">
        <header className="relative flex w-full items-center justify-between px-2 lg:flex-col lg:items-start lg:gap-3 lg:px-3">
          <div className="flex flex-col items-start gap-2">
            <div className="inline-flex items-center gap-2.5">
              <div className="flex h-[26px] w-[26px] items-center justify-center">
                <img
                  className="h-[22px] w-[22px]"
                  alt="Logotipo da plataforma InfraRoute"
                  src={symbol}
                />
              </div>
              <span className="whitespace-nowrap text-[22px] font-bold tracking-[-0.20px] text-slate-50 lg:text-[25px]">
                InfraRoute
              </span>
            </div>
            <div className="hidden items-start overflow-hidden rounded border border-solid border-slate-600 px-2 py-[4px] lg:inline-flex">
              <span className="whitespace-nowrap text-[10px] font-semibold text-slate-300">
                <abbr title="Business-to-Business">B2B</abbr> Enterprise ·{" "}
                {session?.razao_social_empresa ? "Multi-Tenant" : "OSP"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="sidebar-menu-content"
            aria-label={mobileMenuOpen ? "Recolher menu de navegação" : "Abrir menu de navegação"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700 lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              {mobileMenuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </header>

        <div
          id="sidebar-menu-content"
          className={`${mobileMenuOpen ? "flex" : "hidden"} w-full flex-col gap-6 lg:flex`}
        >
          <nav
            className="relative flex w-full flex-col items-start gap-2"
            aria-label="Menu principal do workspace"
          >
            <p className="px-3 text-[10px] font-semibold tracking-[0.14px] text-slate-400">
              NAVEGAÇÃO
            </p>
            <ul className="m-0 flex w-full list-none flex-col items-start gap-1.5 p-0">
              {navigationItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <li key={item.path} className="w-full">
                    <button
                      type="button"
                      onClick={() => handleNavigation(item.path)}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "relative flex h-11 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg border-0 bg-blue-100 px-3 text-left transition"
                          : "relative flex h-11 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg border-0 bg-slate-900 px-3 text-left transition hover:bg-slate-800"
                      }
                    >
                      {active && (
                        <span
                          className="absolute top-2.5 left-0 h-6 w-[3px] rounded-sm bg-blue-600"
                          aria-hidden="true"
                        />
                      )}
                      <SidebarNavIcon icon={item.icon} active={active} />
                      <span
                        className={
                          active
                            ? "text-[13px] font-semibold text-blue-700"
                            : "text-[13px] font-medium text-slate-300"
                        }
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex w-full flex-col gap-5 border-t border-slate-800 pt-5 lg:hidden">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
                  {userInitials}
                </div>
                <div className="flex flex-col">
                  <strong className="text-xs font-semibold text-slate-100">{session?.nome}</strong>
                  <span className="text-[11px] text-slate-400">{session?.nivel_acesso}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 hidden w-full flex-col items-start gap-4 lg:flex">
        <QuickPersonaSwitcher variant="sidebar" />

        <section
          className="flex w-full flex-col items-start gap-1.5 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
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

        <section
          className="flex w-full flex-col items-start gap-3 border-t border-solid border-slate-700 px-2 pt-5"
          aria-label="Perfil do usuário"
        >
          <div className="flex w-full items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700"
              aria-hidden="true"
            >
              <span className="text-xs font-semibold text-slate-50">{userInitials}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <strong className="max-w-full truncate text-[13px] font-semibold text-slate-50">
                {session?.nome}
              </strong>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                {session?.nivel_acesso}
              </span>
            </div>
          </div>

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

          <button
            type="button"
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-left text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
            onClick={handleLogout}
          >
            Sair da plataforma
          </button>
        </section>
      </div>
      <LiveAuditDrawer placement="bottom-left" />
    </aside>
  );
};
