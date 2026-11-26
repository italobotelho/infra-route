import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: "border-emerald-500/40 bg-emerald-950/95 text-emerald-100",
  error: "border-red-500/40 bg-red-950/95 text-red-100",
  warning: "border-amber-500/40 bg-amber-950/95 text-amber-100",
  info: "border-blue-500/40 bg-slate-900/95 text-slate-100",
};

const VARIANT_LABELS = {
  success: "Sucesso",
  error: "Erro",
  warning: "Atenção",
  info: "Informação",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message, options = {}) => {
      if (!message) return null;
      const { type = "info", durationMs = 4500 } = options;
      const id = nextIdRef.current++;
      setToasts((current) => [...current.slice(-3), { id, message, type }]);
      if (durationMs > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, durationMs);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        className="no-print pointer-events-none fixed right-4 bottom-4 z-[9999] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`toast-enter pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs shadow-2xl backdrop-blur-md transition ${
              VARIANT_STYLES[toast.type] || VARIANT_STYLES.info
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <strong className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
                {VARIANT_LABELS[toast.type] || VARIANT_LABELS.info}
              </strong>
              <p className="m-0 leading-4">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fechar notificação"
              className="shrink-0 rounded px-1.5 py-0.5 text-xs opacity-70 hover:bg-white/10 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => null,
      dismissToast: () => {},
    };
  }
  return ctx;
}
