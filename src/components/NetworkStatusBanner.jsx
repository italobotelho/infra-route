import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider";

/**
 * Monitora conectividade do navegador (online/offline) e alerta o usuário quando sem rede.
 */
export function NetworkStatusBanner() {
  const { showToast } = useToast();
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine === false : false,
  );

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
    };
    const handleOnline = () => {
      setIsOffline(false);
      showToast("Conexão com a rede restabelecida.", { type: "success" });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [showToast]);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="no-print fixed inset-x-0 top-0 z-[1190] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-md"
    >
      <span aria-hidden="true">⚠</span>
      <span>Sem conexão com a internet. Algumas operações com o servidor podem falhar.</span>
    </div>
  );
}
