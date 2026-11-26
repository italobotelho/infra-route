import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import { ThemeToggle } from "../../components/ThemeProvider";
import { apiRequest, saveSession } from "../../lib/api";
import { DEMO_PERSONAS } from "../../utils/sessionVault";
import { useToast } from "../../components/ToastProvider";

const fields = [
  {
    id: "email",
    label: "E-mail Corporativo",
    type: "email",
    placeholder: "nome@empresa.com",
    autoComplete: "email",
  },
  {
    id: "senha",
    label: "Senha de Acesso",
    type: "password",
    placeholder: "Digite sua senha",
    autoComplete: "current-password",
    minLength: 6,
  },
];

export const CanvasBackground = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formValues, setFormValues] = useState({
    email: "",
    senha: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Login | InfraRoute — Engenharia de Redes Ópticas";
  }, []);

  const handleChange = (event) => {
    const { id, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [id]: value,
    }));

    if (message) {
      setMessage("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(formValues),
      });
      saveSession(session);
      showToast(`Bem-vindo(a), ${session.nome}!`, { type: "success" });
      navigate("/projetos", { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoUser = (email) => {
    setFormValues({ email, senha: "123456" });
    setMessage("");
  };

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-y-auto bg-slate-50 lg:flex-row"
      data-infraroute-02-sem-nticos-mode="modo-claro"
    >
      <section
        className="relative flex flex-1 flex-col items-start justify-center gap-10 self-stretch bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 sm:p-12 lg:p-16"
        aria-labelledby="brand-heading"
      >
        <div className="relative flex w-full flex-col items-start gap-4 self-stretch">
          <div className="inline-flex items-center gap-3">
            <BrandLogo size="md" decorative />
            <p className="relative text-xs font-semibold leading-5 tracking-wider text-blue-400">
              INFRAROUTE&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA DE REDES
            </p>
          </div>
          <h1
            id="brand-heading"
            className="relative self-stretch text-3xl font-bold leading-tight tracking-[0] text-slate-50 sm:text-[40px] sm:leading-[56px]"
          >
            <span className="block">Conecte projetos.</span>
            <span className="block">Expanda possibilidades.</span>
          </h1>
          <p className="relative self-stretch text-base font-normal leading-6 tracking-[0] text-slate-300">
            Plataforma de expansão de fibra óptica (<abbr title="Fiber to the Home">FTTH</abbr>)
          </p>
        </div>
        <div className="relative flex w-full flex-col items-start gap-2 self-stretch">
          <p className="relative w-fit whitespace-nowrap text-xs font-medium leading-5 tracking-[0] text-slate-300">
            PROJETOS <abbr title="Outside Plant (Planta Externa)">OSP</abbr>&nbsp;&nbsp;/&nbsp;&nbsp;TOPOLOGIA&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA
          </p>
          <p className="relative self-stretch text-base font-normal leading-6 tracking-[0] text-slate-300">
            Gestão de projetos <abbr title="Outside Plant (Planta Externa)">OSP</abbr>, topologia de rede via Algoritmo de Prim e governança multi-tenant em um único ambiente.
          </p>
        </div>
      </section>
      <section
        className="relative flex flex-1 flex-col items-center justify-center self-stretch bg-slate-50 p-6 transition-colors sm:p-10 lg:p-16"
        aria-labelledby="login-heading"
        data-theme-surface="adaptive"
      >
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle variant="floating" />
        </div>
        <div className="relative flex w-full max-w-[480px] flex-col items-center">
          <form
            className="relative flex w-full max-w-[480px] flex-col items-center gap-6 rounded-2xl border border-solid border-slate-200 bg-white p-6 shadow-[0px_8px_32px_#050a191a] sm:p-10"
            onSubmit={handleSubmit}
            noValidate={false}
          >
            <header className="relative flex w-full flex-col items-center gap-2 self-stretch text-center">
              <BrandLogo size="lg" />
              <h2
                id="login-heading"
                className="relative w-fit whitespace-nowrap text-center text-[32px] font-bold leading-10 tracking-[0] text-slate-900"
              >
                InfraRoute
              </h2>
              <p className="relative self-stretch text-base font-normal leading-6 tracking-[0] text-slate-600">
                Acesso à Plataforma de Engenharia
              </p>
            </header>
            <fieldset className="m-0 flex w-full flex-col items-center gap-5 self-stretch border-0 p-0">
              <legend className="sr-only">Credenciais de acesso</legend>
              {fields.map((field) => {
                const isPassword = field.id === "senha";
                const resolvedType = isPassword && showPassword ? "text" : field.type;
                return (
                  <div
                    className="relative flex w-full flex-col items-start gap-2 self-stretch"
                    key={field.id}
                  >
                    <label
                      className="relative w-fit whitespace-nowrap text-sm font-semibold leading-5 tracking-[0] text-slate-900"
                      htmlFor={field.id}
                    >
                      {field.label}
                    </label>
                    <div className="relative flex h-12 w-full items-center gap-2 self-stretch rounded-lg border border-solid border-slate-300 bg-slate-50/60 px-4 py-0 transition hover:border-slate-400 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                      <input
                        className="relative h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-normal leading-5 tracking-[0] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        id={field.id}
                        name={field.id}
                        type={resolvedType}
                        autoComplete={field.autoComplete}
                        minLength={field.minLength}
                        placeholder={field.placeholder}
                        value={formValues[field.id]}
                        onChange={handleChange}
                        required
                      />
                      {isPassword && (
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-pressed={showPassword}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          className="shrink-0 cursor-pointer rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          {showPassword ? "Ocultar" : "Mostrar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </fieldset>

            <div className="relative flex w-full flex-col items-start gap-2 self-stretch">
              <button
                className="box-border flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 self-stretch rounded-lg bg-blue-600 px-6 py-3 text-center text-sm font-semibold leading-6 tracking-[0] text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando na plataforma..." : "Entrar na Plataforma"}
              </button>
            </div>

            {message && (
              <p className="text-sm text-red-600" role="alert" aria-live="polite">
                {message}
              </p>
            )}

            <p className="text-sm text-slate-600">
              Ainda não tem uma conta?{" "}
              <Link className="font-semibold text-blue-700 hover:underline" to="/cadastro">
                Criar conta
              </Link>
            </p>

            <details className="group flex w-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-600 marker:hidden">
                <span>Contas de demonstração ({DEMO_PERSONAS.length} perfis)</span>
                <span aria-hidden="true" className="text-slate-400 transition group-open:rotate-90">
                  ▸
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DEMO_PERSONAS.map((persona) => (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => fillDemoUser(persona.email)}
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-800 transition hover:border-blue-400 hover:bg-blue-50"
                    >
                      <strong className="block text-blue-700">{persona.nomeCurto}</strong>
                      <span className="text-[10px] text-slate-500">{persona.descricao}</span>
                    </button>
                  ))}
                </div>
                <p className="m-0 text-[10px] text-slate-500">
                  Senha padrão: <code>123456</code>. Cada aba mantém sessão própria ao trocar de perfil.
                </p>
              </div>
            </details>
          </form>
          <footer className="mt-6 text-center text-xs text-slate-500">
            <address className="not-italic">
              Suporte Técnico InfraRoute ·{" "}
              <a className="text-blue-700 hover:underline" href="mailto:suporte@infraroute.com.br">
                suporte@infraroute.com.br
              </a>
            </address>
            <small className="mt-1 block text-[11px] text-slate-400">
              © 2026 InfraRoute Engenharia de Redes. Todos os direitos reservados.
            </small>
          </footer>
        </div>
      </section>
    </main>
  );
};
