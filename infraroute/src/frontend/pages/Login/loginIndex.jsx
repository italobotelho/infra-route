import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, saveSession } from "../../lib/api";

const fields = [
  {
    id: "email",
    label: "E-mail Corporativo",
    type: "email",
    placeholder: "nome@empresa.com",
  },
  {
    id: "senha",
    label: "Senha de Acesso",
    type: "password",
    placeholder: "Digite sua senha",
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
      className="flex min-h-screen items-center relative bg-slate-50 overflow-y-scroll"
      data-infraroute-02-sem-nticos-mode="modo-claro"
    >
      <section
        className="flex flex-col items-start justify-center gap-10 p-16 relative flex-1 self-stretch grow bg-slate-900"
        aria-labelledby="brand-heading"
      >
        <div className="items-start gap-4 flex flex-col relative self-stretch w-full flex-[0_0_auto]">
          <div className="relative self-stretch mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-slate-300 text-xs tracking-[0] leading-5">
            INFRAROUTE&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA DE REDES
          </div>
          <h1
            id="brand-heading"
            className="self-stretch text-slate-50 text-[40px] leading-[64px] relative [font-family:'Inter-Bold',Helvetica] font-bold tracking-[0]"
          >
            Conecte projetos.
            <br />
            Expanda possibilidades.
          </h1>
          <p className="relative self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-slate-300 text-base tracking-[0] leading-6">
            Plataforma de expansão de fibra óptica
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 relative self-stretch w-full flex-[0_0_auto]">
          <div className="relative w-fit mt-[-1.00px] [font-family:'Inter-Medium',Helvetica] font-medium text-slate-300 text-xs tracking-[0] leading-5 whitespace-nowrap">
            PROJETOS
            OSP&nbsp;&nbsp;/&nbsp;&nbsp;TOPOLOGIA&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA
          </div>
          <p className="relative self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-slate-300 text-base tracking-[0] leading-6">
            Gestão de projetos OSP, topologia de rede e assinaturas de
            engenharia em um único ambiente.
          </p>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center p-16 relative flex-1 self-stretch grow bg-slate-50">
        <div className="flex flex-col min-w-[360px] max-w-[480px] items-center relative w-full flex-[0_0_auto] max-sm:min-w-0">
          <form
            className="flex flex-col min-w-[360px] max-w-[480px] items-center gap-8 p-10 relative w-full flex-[0_0_auto] bg-white rounded-2xl border border-solid border-slate-200 shadow-[0px_8px_32px_#050a191a] max-sm:min-w-0 max-sm:p-6"
            onSubmit={handleSubmit}
            noValidate={false}
          >
            <div className="items-center gap-2 flex flex-col relative self-stretch w-full flex-[0_0_auto]">
              <h2 className="w-fit mt-[-1.00px] text-slate-900 text-[32px] text-center leading-10 whitespace-nowrap relative [font-family:'Inter-Bold',Helvetica] font-bold tracking-[0]">
                InfraRoute
              </h2>
              <p className="relative self-stretch [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-base tracking-[0] leading-6">
                Acesso à Plataforma de Engenharia
              </p>
            </div>
            <div className="flex flex-col items-center gap-6 relative self-stretch w-full flex-[0_0_auto]">
              {fields.map((field) => (
                <div
                  className="flex flex-col items-start gap-2 relative self-stretch w-full flex-[0_0_auto]"
                  key={field.id}
                >
                  <label
                    className="text-slate-900 leading-5 relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm tracking-[0] whitespace-nowrap"
                    htmlFor={field.id}
                  >
                    {field.label}
                  </label>
                  <div className="flex h-12 items-center gap-3 px-4 py-0 relative self-stretch w-full bg-white rounded-lg border border-solid border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
                    <input
                      className="relative min-w-0 flex-1 h-full [font-family:'Inter-Regular',Helvetica] font-normal text-slate-900 text-sm tracking-[0] leading-5 placeholder:text-slate-600"
                      id={field.id}
                      name={field.id}
                      type={field.type}
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
                      className="relative w-fit [font-family:'Inter-Regular',Helvetica] font-normal text-slate-600 text-xs tracking-[0] leading-5 whitespace-nowrap"
                      id={`${field.id}-help`}
                    >
                      {field.helperText}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-start gap-2 relative self-stretch w-full flex-[0_0_auto]">
              <button
                className="all-unset box-border flex min-h-12 items-center justify-center gap-2.5 px-6 py-3 relative self-stretch w-full flex-[0_0_auto] bg-blue-600 rounded-lg text-white text-center leading-6 [font-family:'Inter-SemiBold',Helvetica] font-semibold text-sm tracking-[0] whitespace-nowrap cursor-pointer hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Login"}
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
            <p className="text-xs text-slate-500">
              Demonstração: engenheiro@empresa.com.br / 123456
            </p>
          </form>
        </div>
      </section>
    </main>
  );
};
