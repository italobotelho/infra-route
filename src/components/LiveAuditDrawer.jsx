import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export function LiveAuditDrawer({ placement = "bottom-left" }) {
  const navigate = useNavigate();
  const session = getSession();
  const podeVerLogs = podeAcessarLogsAuditoria(session?.nivel_acesso);
  const isSuperAdmin = session?.nivel_acesso === "SuperAdmin";

  const [open, setOpen] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [streamMode, setStreamMode] = useState("paused");
  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const openRef = useRef(open);
  openRef.current = open;
  const clientRef = useRef(null);

  useEffect(() => {
    if (!session?.access_token || !podeVerLogs) return undefined;
    let cancelled = false;

    const client = new AuditStreamClient({ token: session.access_token });
    clientRef.current = client;

    apiRequest("/auth/auditoria?limit=25")
      .then((initial) => {
        if (cancelled || !Array.isArray(initial)) return;
        setEvents(initial);
        const maxId = initial.reduce((acc, ev) => Math.max(acc, Number(ev.id_evento) || 0), 0);
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
  }, [session?.access_token, podeVerLogs, liveEnabled]);

  // Princípio do Menor Privilégio / LGPD: Projetista não possui acesso ao monitor de requisições
  if (!podeVerLogs) {
    return null;
  }

  const handleToggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

  const posClass =
    placement === "workspace-top-right"
      ? "pointer-events-auto absolute top-14 right-6 z-30 flex flex-col items-end gap-2"
      : "no-print fixed bottom-4 left-4 z-[900] flex flex-col items-start gap-2";

  return (
    <div className={posClass}>
      {open && (
        <aside
          aria-label="Monitor de requisições e auditoria em tempo real"
          className="flex max-h-96 w-80 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 text-xs text-slate-100 shadow-2xl backdrop-blur-md sm:w-96"
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
                className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                {liveEnabled ? "Pausar" : "Retomar"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar monitor de logs"
                className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
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
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatarHoraCurtaBr(ev.timestamp_utc)} BRT
                        {tempoRel ? ` · ${tempoRel}` : ""}
                      </span>
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
              className="shrink-0 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Painel Completo →
            </button>
          </footer>
        </aside>
      )}

      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3.5 py-1.5 text-[11px] font-semibold text-slate-100 shadow-lg backdrop-blur-md transition hover:border-indigo-500 hover:text-white"
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
    </div>
  );
}
