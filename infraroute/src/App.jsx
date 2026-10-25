import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Cadastro from "./pages/Cadastro";
import { CanvasBackground } from "./pages/Login/loginIndex";
import Projetos from "./pages/Projetos";
import Workspace from "./pages/Workspace";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cadastro" replace />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/login" element={<CanvasBackground />} />
        <Route path="/projetos" element={<Projetos />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="*" element={<Navigate to="/cadastro" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
