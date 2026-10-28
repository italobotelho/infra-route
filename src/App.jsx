import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Cadastro from "./pages/Cadastro";
import { CanvasBackground } from "./pages/Login/loginIndex";
import Projetos from "./pages/Projetos";
import Workspace from "./pages/Workspace";
import { getSession } from "./lib/api";

function RequireAuth({ children }) {
  return getSession() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cadastro" replace />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/login" element={<CanvasBackground />} />
        <Route path="/projetos" element={<RequireAuth><Projetos /></RequireAuth>} />
        <Route path="/workspace" element={<RequireAuth><Workspace /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/cadastro" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
