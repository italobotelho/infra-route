import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, saveSession } from "../../lib/api";

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
  const [formValues, setFormValues] = useState({
    email: "",
    senha: "",
  });
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
      navigate("/projetos", { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-y-auto bg-slate-50 lg:flex-row"
      data-infraroute-02-sem-nticos-mode="modo-claro"
    >
      <section
        className="relative flex flex-1 flex-col items-start justify-center gap-10 self-stretch bg-slate-900 p-8 sm:p-12 lg:p-16"
        aria-labelledby="brand-heading"
      >
        <div className="relative flex w-full flex-col items-start gap-4 self-stretch">
          <p className="relative self-stretch text-xs font-medium leading-5 tracking-[0] text-slate-300">
            INFRAROUTE&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA DE REDES
          </p>
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
            Gestão de projetos <abbr title="Outside Plant (Planta Externa)">OSP</abbr>, topologia de rede e assinaturas de
            engenharia em um único ambiente.
          </p>
        </div>
      </section>
      <section
        className="relative flex flex-1 flex-col items-center justify-center self-stretch bg-slate-50 p-6 sm:p-10 lg:p-16"
        aria-labelledby="login-heading"
      >
        <div className="relative flex w-full max-w-[480px] flex-col items-center">
          <form
            className="relative flex w-full max-w-[480px] flex-col items-center gap-8 rounded-2xl border border-solid border-slate-200 bg-white p-6 shadow-[0px_8px_32px_#050a191a] sm:p-10"
            onSubmit={handleSubmit}
            noValidate={false}
          >
            <header className="relative flex w-full flex-col items-center gap-2 self-stretch text-center">
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
            <fieldset className="m-0 flex w-full flex-col items-center gap-6 self-stretch border-0 p-0">
              <legend className="sr-only">Credenciais de acesso</legend>
              {fields.map((field) => (
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
                  <div className="relative flex h-12 w-full items-center gap-3 self-stretch rounded-lg border border-solid border-slate-300 bg-white px-4 py-0 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                    <input
                      className="relative h-full min-w-0 flex-1 text-sm font-normal leading-5 tracking-[0] text-slate-900 placeholder:text-slate-600 focus:outline-none"
                      id={field.id}
                      name={field.id}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      minLength={field.minLength}
                      placeholder={field.placeholder}
                      value={formValues[field.id]}
                      onChange={handleChange}
                      required
                      aria-describedby={
                        field.helperText ? `${field.id}-help` : undefined
                      }
                    />
                  </div>
                  {field.helperText ? (
                    <p
                      className="relative w-fit whitespace-nowrap text-xs font-normal leading-5 tracking-[0] text-slate-600"
                      id={`${field.id}-help`}
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </div>
              ))}
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
            <p className="text-sm text-red-600" role="alert" aria-live="polite">
              {message}
            </p>
            <p className="text-sm text-slate-600">
              Ainda não tem uma conta?{" "}
              <Link className="font-semibold text-blue-700 hover:underline" to="/cadastro">
                Criar conta
              </Link>
            </p>
            <button
              type="button"
              onClick={() => {
                setFormValues({
                  email: "engenheiro@empresa.com.br",
                  senha: "123456",
                });
                setMessage("");
              }}
              className="cursor-pointer text-xs text-slate-500 hover:text-blue-700 hover:underline"
            >
              Demonstração (clique para preencher): engenheiro@empresa.com.br / 123456
            </button>
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
