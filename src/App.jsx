import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Cadastro from "./pages/Cadastro";
import { CanvasBackground } from "./pages/Login/loginIndex";
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import Governanca from "./pages/Governanca";
import Ajuda from "./pages/Ajuda";
import Workspace from "./pages/Workspace";
import { ToastProvider } from "./components/ToastProvider";
import { getSession } from "./lib/api";

function RequireAuth({ children }) {
  return getSession() ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuth({ children }) {
  return getSession() ? <Navigate to="/projetos" replace /> : children;
}

function HomeRedirect() {
  return <Navigate to={getSession() ? "/projetos" : "/login"} replace />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/cadastro" element={<RedirectIfAuth><Cadastro /></RedirectIfAuth>} />
          <Route path="/login" element={<RedirectIfAuth><CanvasBackground /></RedirectIfAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/projetos" element={<RequireAuth><Projetos /></RequireAuth>} />
          <Route path="/governanca" element={<RequireAuth><Governanca /></RequireAuth>} />
          <Route path="/ajuda" element={<RequireAuth><Ajuda /></RequireAuth>} />
          <Route path="/workspace" element={<RequireAuth><Workspace /></RequireAuth>} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
