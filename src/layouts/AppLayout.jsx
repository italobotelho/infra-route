import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CommandPalette } from "../components/CommandPalette";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { useTheme } from "../components/ThemeProvider";
import { PageLoader } from "../components/ui/PageLoader";
import { WorkspaceNavigationSidebarSection } from "../pages/Projetos/components/WorkspaceNavigationSidebarSection";

/**
 * Shell persistente para telas administrativas e de portfólio,
 * preservando a sidebar, o tema ativo e animando suavemente as trocas de rota.
 */
export function AppLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const { isDark } = useTheme();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col items-start bg-gray-50 text-gray-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 lg:flex-row"
      data-infraroute-02-sem-nticos-mode={isDark ? "modo-escuro" : "modo-claro"}
      data-theme-surface="adaptive"
    >
      <WorkspaceNavigationSidebarSection
        onOpenCommandPalette={() => setCommandOpen(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col self-stretch">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoader label="Carregando módulo..." />}>
            <div
              key={location.pathname}
              className="page-transition-enter flex min-w-0 flex-1 flex-col self-stretch"
            >
              <Outlet />
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}
