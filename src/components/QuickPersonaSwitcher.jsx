import { useState } from "react";
import { apiRequest, getSession, saveSession } from "../lib/api";
import { DEMO_PERSONAS } from "../utils/sessionVault";
import { useToast } from "./ToastProvider";

export function QuickPersonaSwitcher({ variant = "sidebar" }) {
  const session = getSession();
  const { showToast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState(session?.email || DEMO_PERSONAS[0].email);
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (nextEmail) => {
    setSelectedEmail(nextEmail);
    if (!nextEmail || nextEmail === session?.email) return;

    setSwitching(true);
    try {
      const novaSessao = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: nextEmail, senha: "123456" }),
      });
      // Isola a sessão nesta aba para permitir comparação lado a lado em múltiplas abas
      saveSession(novaSessao, { isolateTab: true });
      showToast(
        `Aba alterada para ${novaSessao.nome} (${novaSessao.nivel_acesso} · ${novaSessao.razao_social_empresa}).`,
        { type: "success" },
      );

      if (window.location.pathname.startsWith("/workspace")) {
        window.location.assign("/projetos");
      } else {
        window.location.reload();
      }
    } catch (err) {
      showToast(err.message, { type: "error" });
      setSelectedEmail(session?.email || DEMO_PERSONAS[0].email);
    } finally {
      setSwitching(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="flex w-full flex-col gap-1">
        <label
          htmlFor="persona-switch-compact"
          className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"
        >
          Perfil ativo nesta aba (isolado)
        </label>
        <select
          id="persona-switch-compact"
          disabled={switching}
          value={selectedEmail}
          onChange={(e) => handleSwitch(e.target.value)}
          className="h-8 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-[11px] font-medium text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        >
          {DEMO_PERSONAS.map((persona) => (
            <option key={persona.id} value={persona.email}>
              {persona.nomeCurto} ({persona.nivel})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <section
      aria-label="Troca rápida de perfil para testes"
      className="flex w-full flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="persona-switch-sidebar"
          className="text-[10px] font-semibold uppercase tracking-[0.11px] text-slate-400"
        >
          PERFIL DESTA ABA (ISOLADO)
        </label>
        <span className="rounded bg-indigo-950/70 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
          Multi-Aba
        </span>
      </div>
      <select
        id="persona-switch-sidebar"
        disabled={switching}
        value={selectedEmail}
        onChange={(e) => handleSwitch(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      >
        {!DEMO_PERSONAS.some((p) => p.email === selectedEmail) && session?.email && (
          <option value={session.email}>
            {session.nome} ({session.nivel_acesso})
          </option>
        )}
        {DEMO_PERSONAS.map((persona) => (
          <option key={persona.id} value={persona.email}>
            {persona.nomeCurto} · {persona.nivel}
          </option>
        ))}
      </select>
      <p className="m-0 text-[10px] leading-4 text-slate-400">
        Abra 2 abas lado a lado para editar em uma e ver logs ao vivo na outra.
      </p>
    </section>
  );
}
