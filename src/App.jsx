import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider, useToast } from "./components/ToastProvider";
import { PageLoader } from "./components/ui/PageLoader";
import { RouteProgressBar } from "./components/ui/RouteProgressBar";
import { AppLayout } from "./layouts/AppLayout";
import { getSession } from "./lib/api";

const Cadastro = lazy(() => import("./pages/Cadastro"));
const LoginPage = lazy(() =>
  import("./pages/Login/loginIndex").then((mod) => ({ default: mod.CanvasBackground })),
);
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projetos = lazy(() => import("./pages/Projetos"));
const Governanca = lazy(() => import("./pages/Governanca"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const Workspace = lazy(() => import("./pages/Workspace"));

function RequireAuth({ children }) {
  return getSession() ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuth({ children }) {
  return getSession() ? <Navigate to="/projetos" replace /> : children;
}

function HomeRedirect() {
  return <Navigate to={getSession() ? "/projetos" : "/login"} replace />;
}

function SessionExpiryListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const handleExpired = () => {
      showToast("Sua sessão expirou. Faça login novamente para continuar.", {
        type: "warning",
      });
      if (location.pathname !== "/login") {
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("infraroute:session-expired", handleExpired);
    return () => window.removeEventListener("infraroute:session-expired", handleExpired);
  }, [location.pathname, navigate, showToast]);

  return null;
}

function AnimatedFullPage({ children, loaderLabel = "Carregando ambiente..." }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageLoader fullscreen label={loaderLabel} />}>
        <div key={location.pathname} className="page-transition-enter min-h-screen w-full">
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <RouteProgressBar />
            <NetworkStatusBanner />
            <SessionExpiryListener />
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route
                path="/cadastro"
                element={
                  <RedirectIfAuth>
                    <AnimatedFullPage loaderLabel="Carregando formulário de cadastro...">
                      <Cadastro />
                    </AnimatedFullPage>
                  </RedirectIfAuth>
                }
              />
              <Route
                path="/login"
                element={
                  <RedirectIfAuth>
                    <AnimatedFullPage loaderLabel="Carregando acesso seguro...">
                      <LoginPage />
                    </AnimatedFullPage>
                  </RedirectIfAuth>
                }
              />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projetos" element={<Projetos />} />
                <Route path="/governanca" element={<Governanca />} />
                <Route path="/ajuda" element={<Ajuda />} />
              </Route>
              <Route
                path="/workspace"
                element={
                  <RequireAuth>
                    <AnimatedFullPage loaderLabel="Inicializando Workspace GIS...">
                      <Workspace />
                    </AnimatedFullPage>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
