import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest, getSession } from "../lib/api";
import { AuditStreamClient } from "../utils/auditStreamClient";
import { formatarHoraCurtaBr, formatarTempoRelativo } from "../utils/dateTime";
import { podeAcessarLogsAuditoria } from "../utils/sessionVault";

const MODE_LABELS = {
  sse: "Ao Vivo (SSE)",
  polling: "Ao Vivo (Sync)",
  paused: "Pausado",
  forbidden: "Restrito (RBAC)",
};

export function LiveAuditDrawer({
  placement = "bottom-left",
  sidebarCollapsed = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const podeVerLogs = podeAcessarLogsAuditoria(session?.nivel_acesso);
  const isSuperAdmin = session?.nivel_acesso === "SuperAdmin";

  const searchTab = new URLSearchParams(location.search).get("tab");
  const isOnGovernancaAudit =
    location.pathname === "/governanca" &&
    (!searchTab || searchTab === "auditoria");

  const [open, setOpen] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [streamMode, setStreamMode] = useState("paused");
  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;
  const clientRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!session?.access_token || !podeVerLogs || isOnGovernancaAudit) {
      if (isOnGovernancaAudit) setStreamMode("paused");
      return undefined;
    }
    let cancelled = false;

    const client = new AuditStreamClient({ token: session.access_token });
    clientRef.current = client;

    apiRequest("/auth/auditoria?limit=25")
      .then((initial) => {
        if (cancelled || !Array.isArray(initial)) return;
        setEvents(initial);
        const maxId = initial.reduce(
          (acc, ev) => Math.max(acc, Number(ev.id_evento) || 0),
          0,
        );
        if (liveEnabled) {
          client.start({
            initialLastId: maxId,
            onStatusChange: (mode) => !cancelled && setStreamMode(mode),
            onEvents: (incoming) => {
              if (cancelled) return;
              setEvents((prev) => {
                const seen = new Set(prev.map((p) => p.id_evento));
                const novos = incoming.filter((item) => !seen.has(item.id_evento));
                if (!novos.length) return prev;
                if (!openRef.current) {
                  setUnreadCount((c) => c + novos.length);
                }
                const merged = [...novos.reverse(), ...prev];
                return merged.slice(0, 30);
              });
            },
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      client.stop();
    };
  }, [session?.access_token, podeVerLogs, liveEnabled, isOnGovernancaAudit]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEsc = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleOutsideClick = (event) => {
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  // Princípio do Menor Privilégio / LGPD: Projetista não possui acesso ao monitor de requisições
  if (!podeVerLogs) {
    return null;
  }

  const handleToggleOpen = () => {
    if (isOnGovernancaAudit) return;
    setOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

  if (placement === "sidebar-inline") {
    const panelLeftClass = sidebarCollapsed ? "lg:left-[88px]" : "lg:left-[276px]";
    const sidebarPanel =
      open && !isOnGovernancaAudit ? (
        <aside
          ref={panelRef}
          aria-label="Monitor de requisições e auditoria em tempo real"
          className={`modal-panel-enter no-print fixed right-4 bottom-4 left-4 z-[1080] flex max-h-96 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 text-xs text-slate-100 shadow-2xl backdrop-blur-md sm:right-auto sm:w-[400px] ${panelLeftClass}`}
        >
            <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    streamMode === "paused" || streamMode === "forbidden"
                      ? "bg-slate-500"
                      : "animate-pulse bg-emerald-400"
                  }`}
                  aria-hidden="true"
                />
                <strong className="text-xs font-semibold text-white">
                  Logs Ao Vivo ({MODE_LABELS[streamMode] || streamMode})
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLiveEnabled((prev) => !prev)}
                  className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                >
                  {liveEnabled ? "Pausar" : "Retomar"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar monitor de logs"
                  className="cursor-pointer rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </header>

            <ul className="m-0 flex-1 list-none divide-y divide-slate-800/80 overflow-y-auto p-0">
              {events.length === 0 ? (
                <li className="p-4 text-center text-[11px] text-slate-400">
                  Nenhuma requisição registrada ainda neste escopo.
                </li>
              ) : (
                events.map((ev) => {
                  const isAlert = ev.severidade === "ALERTA";
                  const tempoRel = formatarTempoRelativo(ev.timestamp_utc);
                  return (
                    <li key={ev.id_evento} className="space-y-1 px-4 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                              isAlert
                                ? "border border-red-500/40 bg-red-950 text-red-200"
                                : "bg-slate-800 text-cyan-300"
                            }`}
                          >
                            {ev.acao}
                          </span>
                          {ev.metodo_http && (
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                              {ev.metodo_http} {ev.status_http ?? ""}
                            </span>
                          )}
                        </div>
                        <time
                          dateTime={ev.timestamp_utc}
                          className="font-mono text-[10px] text-slate-400"
                        >
                          {formatarHoraCurtaBr(ev.timestamp_utc)} BRT
                          {tempoRel ? ` · ${tempoRel}` : ""}
                        </time>
                      </div>
                      <p className="m-0 text-[11px] leading-4 text-slate-200">{ev.detalhes}</p>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
                        <span>
                          {ev.nome_usuario || ev.email_usuario || "sistema"}
                          {ev.papel_rbac ? ` (${ev.papel_rbac})` : ""}
                        </span>
                        {isSuperAdmin && (
                          <span className="text-indigo-300">
                            {ev.razao_social_empresa || "Plataforma / Sem Tenant"}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-2">
              <span className="truncate text-[10px] text-slate-400">
                {isSuperAdmin ? "Escopo Global (Multi-Empresa)" : `Tenant: ${session?.razao_social_empresa}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/governanca?tab=auditoria");
                }}
                className="shrink-0 cursor-pointer text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                Painel Completo →
              </button>
            </footer>
          </aside>
      ) : null;

    return (
      <div className="no-print relative w-full">
        {sidebarPanel && typeof document !== "undefined"
          ? createPortal(sidebarPanel, document.body)
          : null}

        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggleOpen}
          disabled={isOnGovernancaAudit}
          aria-expanded={open}
          title={
            isOnGovernancaAudit
              ? "Logs ao vivo já exibidos no painel principal de Governança"
              : "Abrir monitor de logs ao vivo"
          }
          className={`flex w-full cursor-pointer items-center rounded-lg border border-slate-700/80 bg-slate-800/70 px-3 py-2 text-[11px] font-medium text-slate-200 transition hover:border-blue-500/60 hover:bg-slate-800 hover:text-white disabled:cursor-default disabled:opacity-60 ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between gap-2"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                isOnGovernancaAudit
                  ? "bg-emerald-400"
                  : streamMode === "paused" || streamMode === "forbidden"
                    ? "bg-slate-400"
                    : "animate-pulse bg-emerald-400"
              }`}
              aria-hidden="true"
            />
            {!sidebarCollapsed && (
              <span>
                {isOnGovernancaAudit ? "Logs no Painel" : "Logs Ao Vivo"}
              </span>
            )}
          </span>
          {!sidebarCollapsed && unreadCount > 0 && !isOnGovernancaAudit && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  const isTopRight = placement === "workspace-top-right";
  const posClass = isTopRight
    ? "pointer-events-auto relative z-40 flex items-center"
    : "no-print fixed bottom-4 left-4 z-[900] flex flex-col items-start gap-2";

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleToggleOpen}
      aria-expanded={open}
      className={
        isTopRight
          ? "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-medium text-slate-200 transition hover:border-indigo-500 hover:bg-slate-800 hover:text-white"
          : "inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3.5 py-1.5 text-[11px] font-semibold text-slate-100 shadow-lg backdrop-blur-md transition hover:border-indigo-500 hover:text-white"
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${
          streamMode === "paused" || streamMode === "forbidden"
            ? "bg-slate-400"
            : "animate-pulse bg-emerald-400"
        }`}
        aria-hidden="true"
      />
      <span>Logs Ao Vivo</span>
      {unreadCount > 0 && (
        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <div className={posClass}>
      {isTopRight && triggerButton}
      {open && (
        <aside
          ref={panelRef}
          aria-label="Monitor de requisições e auditoria em tempo real"
          className={`modal-panel-enter flex max-h-96 w-80 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 text-xs text-slate-100 shadow-2xl backdrop-blur-md sm:w-96 ${
            isTopRight ? "absolute top-full right-0 z-[1080] mt-2" : "z-[1080]"
          }`}
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  streamMode === "paused" || streamMode === "forbidden"
                    ? "bg-slate-500"
                    : "animate-pulse bg-emerald-400"
                }`}
                aria-hidden="true"
              />
              <strong className="text-xs font-semibold text-white">
                Logs Ao Vivo ({MODE_LABELS[streamMode] || streamMode})
              </strong>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLiveEnabled((prev) => !prev)}
                className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                {liveEnabled ? "Pausar" : "Retomar"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar monitor de logs"
                className="cursor-pointer rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>
          </header>

          <ul className="m-0 flex-1 list-none divide-y divide-slate-800/80 overflow-y-auto p-0">
            {events.length === 0 ? (
              <li className="p-4 text-center text-[11px] text-slate-400">
                Nenhuma requisição registrada ainda neste escopo.
              </li>
            ) : (
              events.map((ev) => {
                const isAlert = ev.severidade === "ALERTA";
                const tempoRel = formatarTempoRelativo(ev.timestamp_utc);
                return (
                  <li key={ev.id_evento} className="space-y-1 px-4 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                            isAlert
                              ? "border border-red-500/40 bg-red-950 text-red-200"
                              : "bg-slate-800 text-cyan-300"
                          }`}
                        >
                          {ev.acao}
                        </span>
                        {ev.metodo_http && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                            {ev.metodo_http} {ev.status_http ?? ""}
                          </span>
                        )}
                      </div>
                      <time
                        dateTime={ev.timestamp_utc}
                        className="font-mono text-[10px] text-slate-400"
                      >
                        {formatarHoraCurtaBr(ev.timestamp_utc)} BRT
                        {tempoRel ? ` · ${tempoRel}` : ""}
                      </time>
                    </div>
                    <p className="m-0 text-[11px] leading-4 text-slate-200">{ev.detalhes}</p>
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
                      <span>
                        {ev.nome_usuario || ev.email_usuario || "sistema"}
                        {ev.papel_rbac ? ` (${ev.papel_rbac})` : ""}
                      </span>
                      {isSuperAdmin && (
                        <span className="text-indigo-300">
                          {ev.razao_social_empresa || "Plataforma / Sem Tenant"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-2">
            <span className="truncate text-[10px] text-slate-400">
              {isSuperAdmin ? "Escopo Global (Multi-Empresa)" : `Tenant: ${session?.razao_social_empresa}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/governanca?tab=auditoria");
              }}
              className="shrink-0 cursor-pointer text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Painel Completo →
            </button>
          </footer>
        </aside>
      )}

      {!isTopRight && triggerButton}
    </div>
  );
}
