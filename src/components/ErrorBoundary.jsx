import { Component } from "react";
import { BrandLogo } from "./BrandLogo";

/**
 * ErrorBoundary de proteção contra falhas inesperadas de renderização.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Erro inesperado ao renderizar a interface.",
    };
  }

  componentDidCatch(error) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[InfraRoute ErrorBoundary]", error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        role="alert"
        className="flex min-h-[70vh] w-full flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      >
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="md" decorative />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Algo interrompeu esta visualização
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Detectamos uma falha pontual ao carregar os componentes desta tela. Seus dados salvos
            no servidor permanecem protegidos.
          </p>

          {this.state.errorMessage && (
            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                Detalhes técnicos
              </summary>
              <p className="mt-2 break-words font-mono">{this.state.errorMessage}</p>
            </details>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Recarregar plataforma
            </button>
          </div>
        </section>
      </main>
    );
  }
}
