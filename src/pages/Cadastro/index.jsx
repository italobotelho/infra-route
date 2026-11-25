import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CampoErro from "../../components/CampoErro";
import { useToast } from "../../components/ToastProvider";
import { apiRequest, saveSession } from "../../lib/api";
import {
  STORAGE_KEYS,
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from "../../utils/storage";
import {
  estadoInicial,
  validarNome,
  validarEmail,
  validarTelefone,
  formatarTelefone,
  formatarCpf,
  validarCpf,
  formatarCrea,
  validarCrea,
  avaliarSenha,
  validarSenha,
} from "./validators";

export default function Cadastro() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => {
    const rascunho = getStorageItem(STORAGE_KEYS.CADASTRO_DRAFT, null);
    if (!rascunho || typeof rascunho !== "object") {
      return estadoInicial;
    }
    return {
      ...estadoInicial,
      nome: rascunho.nome || "",
      email: rascunho.email || "",
      telefone: rascunho.telefone || "",
      crea: rascunho.crea || "",
      termo: Boolean(rascunho.termo),
    };
  });
  const [showPassword, setShowPassword] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [tocados, setTocados] = useState({});
  const [erroApi, setErroApi] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Criar Conta | InfraRoute — Engenharia de Redes Ópticas";
  }, []);

  // Persiste apenas campos não sensíveis no rascunho (Aula 14: nunca salvar senha ou CPF)
  useEffect(() => {
    setStorageItem(STORAGE_KEYS.CADASTRO_DRAFT, {
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      crea: form.crea,
      termo: form.termo,
    });
  }, [form.nome, form.email, form.telefone, form.crea, form.termo]);

  const forcaSenha = avaliarSenha(form.senha);
  const erros = {
    nome: validarNome(form.nome),
    email: validarEmail(form.email),
    telefone: validarTelefone(form.telefone),
    cpf: validarCpf(form.cpf),
    crea: validarCrea(form.crea),
    senha: validarSenha(form.senha),
    termo: form.termo ? "" : "Você precisa aceitar os termos.",
  };

  const resumo = Object.entries(erros)
    .filter(([campo, mensagem]) => mensagem && (tocados[campo] || enviado))
    .map(([campo]) => ({
      nome: "Nome",
      email: "E-mail",
      telefone: "Telefone",
      cpf: "CPF",
      crea: "CREA",
      senha: "Senha",
      termo: "Aceite dos termos",
    }[campo]));

  const formularioValido =
    !erros.nome && !erros.email && !erros.senha && !erros.termo
    && !erros.telefone && !erros.cpf && !erros.crea;

  function atualizar(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setTocados((atual) => ({ ...atual, [campo]: true }));
    setEnviado(false);
    setSucesso(false);
  }

  function limparFormulario() {
    setForm(estadoInicial);
    setTocados({});
    setEnviado(false);
    setSucesso(false);
    setErroApi("");
    removeStorageItem(STORAGE_KEYS.CADASTRO_DRAFT);
  }

  function classeCampo(campo) {
    if (!tocados[campo] && !enviado) return "border-slate-300";
    return erros[campo] ? "border-red-500" : "border-green-600";
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    setEnviado(true);
    setSucesso(false);
    setTocados({
      nome: true, email: true, telefone: true, cpf: true, crea: true,
      senha: true, termo: true,
    });

    if (!formularioValido) return;

    setIsSubmitting(true);
    setErroApi("");
    try {
      const session = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha,
          telefone: form.telefone,
          cpf: form.cpf,
          crea: form.crea,
        }),
      });
      removeStorageItem(STORAGE_KEYS.CADASTRO_DRAFT);
      saveSession(session);
      setSucesso(true);
      showToast("Conta criada! Confirme o código OTP exibido no painel.", { type: "success" });
      navigate("/projetos", { replace: true });
    } catch (error) {
      setErroApi(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-y-auto bg-slate-50 lg:flex-row">
      <section
        className="relative flex flex-1 flex-col items-start justify-center gap-10 bg-slate-900 p-8 sm:p-12 lg:min-h-screen lg:p-16"
        aria-labelledby="brand-heading"
      >
        <div className="flex w-full flex-col items-start gap-4">
          <p className="text-xs font-medium leading-5 text-slate-300">
            INFRAROUTE&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA DE REDES
          </p>
          <h1
            id="brand-heading"
            className="text-3xl font-bold leading-tight text-slate-50 sm:text-[40px] sm:leading-[56px]"
          >
            <span className="block">Conecte projetos.</span>
            <span className="block">Expanda possibilidades.</span>
          </h1>
          <p className="text-base leading-6 text-slate-300">
            Plataforma de expansão de fibra óptica (<abbr title="Fiber to the Home">FTTH</abbr>)
          </p>
        </div>
        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium leading-5 text-slate-300">
            PROJETOS <abbr title="Outside Plant (Planta Externa)">OSP</abbr>&nbsp;&nbsp;/&nbsp;&nbsp;TOPOLOGIA&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA
          </p>
          <p className="text-base leading-6 text-slate-300">
            Gestão de projetos <abbr title="Outside Plant (Planta Externa)">OSP</abbr>, topologia de rede e assinaturas de
            engenharia em um único ambiente.
          </p>
        </div>
      </section>

      <section
        className="relative flex flex-1 flex-col items-center justify-center bg-slate-50 px-5 py-10 sm:px-8 lg:min-h-screen lg:p-12"
        aria-labelledby="register-heading"
      >
        <div className="w-full max-w-2xl">
          <form
            className="flex w-full flex-col gap-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0px_8px_32px_#050a191a] sm:gap-8 sm:p-10"
            onSubmit={enviarFormulario}
            onReset={limparFormulario}
            noValidate
          >
            <header className="flex flex-col items-center gap-2 text-center">
              <h2 id="register-heading" className="text-[32px] font-bold leading-10 text-slate-900">
                Crie sua conta
              </h2>
              <p className="text-base leading-6 text-slate-600">
                Acesso à Plataforma de Engenharia
              </p>
            </header>

            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dados profissionais e de contato
              </legend>
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="fname" className="text-sm font-semibold leading-5 text-slate-900">
                    Nome completo
                  </label>
                  <input
                    className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("nome")}`}
                    type="text"
                    id="fname"
                    name="fname"
                    required
                    minLength={2}
                    maxLength={50}
                    autoComplete="name"
                    placeholder="Ex.: Ana Beatriz Souza"
                    value={form.nome}
                    aria-invalid={Boolean((tocados.nome || enviado) && erros.nome)}
                    onChange={(e) => atualizar("nome", e.target.value)}
                  />
                  <p className={`text-xs leading-5 ${form.nome.length >= 45 ? "text-red-600" : "text-slate-600"}`}>
                    {form.nome.length}/50 caracteres
                  </p>
                  <CampoErro>{(tocados.nome || enviado) && erros.nome}</CampoErro>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="telefone" className="text-sm font-semibold leading-5 text-slate-900">
                    Telefone
                  </label>
                  <input
                    className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("telefone")}`}
                    type="tel"
                    id="telefone"
                    name="telefone"
                    required
                    maxLength={19}
                    autoComplete="tel"
                    placeholder="(11) 91234-5678"
                    value={form.telefone}
                    aria-invalid={Boolean((tocados.telefone || enviado) && erros.telefone)}
                    onChange={(e) => atualizar("telefone", formatarTelefone(e.target.value))}
                  />
                  <CampoErro>{(tocados.telefone || enviado) && erros.telefone}</CampoErro>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="cpf" className="text-sm font-semibold leading-5 text-slate-900">
                    <abbr title="Cadastro de Pessoas Físicas">CPF</abbr>
                  </label>
                  <input
                    className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("cpf")}`}
                    type="text"
                    id="cpf"
                    name="cpf"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
                    maxLength={14}
                    value={form.cpf}
                    aria-invalid={Boolean((tocados.cpf || enviado) && erros.cpf)}
                    onChange={(e) => atualizar("cpf", formatarCpf(e.target.value))}
                  />
                  <CampoErro>{(tocados.cpf || enviado) && erros.cpf}</CampoErro>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="crea" className="text-sm font-semibold leading-5 text-slate-900">
                    <abbr title="Conselho Regional de Engenharia e Agronomia">CREA</abbr>
                  </label>
                  <input
                    className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("crea")}`}
                    type="text"
                    id="crea"
                    name="crea"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="123456/D"
                    maxLength={10}
                    value={form.crea}
                    aria-invalid={Boolean((tocados.crea || enviado) && erros.crea)}
                    onChange={(e) => atualizar("crea", formatarCrea(e.target.value))}
                  />
                  <CampoErro>{(tocados.crea || enviado) && erros.crea}</CampoErro>
                </div>
              </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Credenciais e termos de uso
              </legend>
              <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="femail" className="text-sm font-semibold leading-5 text-slate-900">
                    E-mail corporativo
                  </label>
                  <input
                    className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("email")}`}
                    type="email"
                    id="femail"
                    name="femail"
                    required
                    autoComplete="email"
                    placeholder="nome@empresa.com.br"
                    value={form.email}
                    aria-invalid={Boolean((tocados.email || enviado) && erros.email)}
                    onBlur={() => {
                      setTocados((atual) => ({ ...atual, email: true }));
                    }}
                    onChange={(e) => atualizar("email", e.target.value)}
                  />
                  <CampoErro>{(tocados.email || enviado) && erros.email}</CampoErro>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="fsenha" className="text-sm font-semibold leading-5 text-slate-900">
                    Senha de acesso
                  </label>
                  <div className={`flex h-12 w-full items-center gap-2 rounded-lg border bg-white px-4 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 ${classeCampo("senha")}`}>
                    <input
                      className="h-full min-w-0 flex-1 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
                      type={showPassword ? "text" : "password"}
                      id="fsenha"
                      name="fsenha"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Mínimo de 8 caracteres"
                      value={form.senha}
                      aria-invalid={Boolean((tocados.senha || enviado) && erros.senha)}
                      onChange={(e) => atualizar("senha", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="shrink-0 cursor-pointer rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  {(() => {
                    const regras = [
                      { label: "8+ caracteres", ok: form.senha.length >= 8 },
                      { label: "Maiúscula", ok: /[A-Z]/.test(form.senha) },
                      { label: "Número", ok: /\d/.test(form.senha) },
                      { label: "Símbolo", ok: /[^A-Za-z0-9]/.test(form.senha) },
                    ];
                    const pontos = regras.filter((r) => r.ok).length;
                    const corAtiva =
                      pontos <= 1
                        ? "bg-red-500"
                        : pontos === 2
                          ? "bg-amber-500"
                          : pontos === 3
                            ? "bg-blue-500"
                            : "bg-emerald-500";
                    return (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                          {[0, 1, 2, 3].map((idx) => (
                            <span
                              key={idx}
                              className={`h-1.5 rounded-full transition-colors ${
                                idx < pontos ? corAtiva : "bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs leading-5 text-slate-600">
                          Força da senha: <strong>{form.senha ? forcaSenha : "não informada"}</strong>
                        </p>
                        <ul className="m-0 flex flex-wrap list-none gap-x-3 gap-y-1 p-0 text-[11px]">
                          {regras.map((r) => (
                            <li key={r.label} className={r.ok ? "font-medium text-emerald-700" : "text-slate-500"}>
                              {r.ok ? "✓" : "○"} {r.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  <CampoErro>{(tocados.senha || enviado) && erros.senha}</CampoErro>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <label className="flex items-center gap-3 text-sm leading-5 text-slate-700" htmlFor="termo">
                  <input
                    className={`h-4 w-4 appearance-auto accent-blue-600 ${classeCampo("termo")}`}
                    type="checkbox"
                    id="termo"
                    name="termo"
                    required
                    checked={form.termo}
                    onChange={(e) => atualizar("termo", e.target.checked)}
                  />
                  Eu aceito os termos e condições de governança de projetos
                </label>
                <CampoErro>{(tocados.termo || enviado) && erros.termo}</CampoErro>
              </div>
            </fieldset>

            <p className="text-sm leading-5 text-red-600" aria-live="polite">
              {resumo.length > 0 ? `Verifique: ${resumo.join(", ")}.` : ""}
            </p>
            {sucesso && (
              <p className="text-sm font-semibold text-green-700" role="status">
                Cadastro enviado com sucesso!
              </p>
            )}
            {erroApi && (
              <p className="text-sm text-red-600" role="alert">
                {erroApi}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold leading-6 text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                type="submit"
                disabled={!formularioValido || isSubmitting}
              >
                {isSubmitting ? "Enviando cadastro..." : "Enviar Cadastro"}
              </button>
              <button
                className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium leading-6 text-slate-700 transition-colors hover:bg-slate-100"
                type="reset"
              >
                Limpar
              </button>
            </div>
            <p className="text-center text-sm text-slate-600">
              Já tem uma conta?{" "}
              <Link className="font-semibold text-blue-700 hover:underline" to="/login">
                Entrar
              </Link>
            </p>
          </form>
          <footer className="mt-6 text-center text-xs text-slate-500">
            <address className="not-italic">
              Suporte Técnico InfraRoute ·{" "}
              <a className="text-blue-700 hover:underline" href="mailto:suporte@infraroute.com.br">
                suporte@infraroute.com.br
              </a>
            </address>
            <small className="mt-1 block text-[11px] text-slate-400">
              Seus dados sensíveis (CPF e senha) jamais são armazenados em cache local.
            </small>
          </footer>
        </div>
      </section>
    </main>
  );
}
