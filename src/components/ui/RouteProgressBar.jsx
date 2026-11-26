import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Barra discreta no topo que sinaliza transições de rota em andamento.
 */
export function RouteProgressBar() {
  const location = useLocation();
  const [animKey, setAnimKey] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setAnimKey((prev) => prev + 1);
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div
      key={animKey}
      aria-hidden="true"
      className="no-print pointer-events-none fixed inset-x-0 top-0 z-[1200] h-0.5 overflow-hidden"
    >
      <div className="route-progress-bar h-full w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 shadow-[0_0_8px_rgba(56,189,248,0.65)]" />
    </div>
  );
}
