import { BrandLogo } from "../BrandLogo";

/**
 * Tela de carregamento moderna com logotipo InfraRoute, anel orbital e barra de progresso.
 */
export function PageLoader({
  label = "Carregando módulo...",
  fullscreen = false,
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`flex w-full flex-col items-center justify-center gap-5 bg-slate-50 px-6 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100 ${
        fullscreen ? "min-h-screen" : "min-h-[60vh] flex-1"
      }`}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span
          aria-hidden="true"
          className="loader-orbit absolute inset-0 rounded-full border-2 border-slate-200 border-t-blue-600 border-r-cyan-400 dark:border-slate-800 dark:border-t-blue-400 dark:border-r-cyan-400"
        />
        <BrandLogo size="lg" decorative className="ring-slate-200 dark:ring-slate-800" />
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
          InfraRoute
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="h-1 w-44 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div className="loader-indeterminate h-full w-20 rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500" />
      </div>
    </div>
  );
}
