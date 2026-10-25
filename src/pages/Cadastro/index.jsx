import { useState } from "react";
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
} from "./validators";

function CampoErro({ children }) {
  return children ? (
    <p className="text-xs leading-5 text-red-600" role="alert">{children}</p>
  ) : null;
}

export default function Cadastro() {
  const [form, setForm] = useState(estadoInicial);
  const [enviado, setEnviado] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [tocados, setTocados] = useState({});

  const forcaSenha = avaliarSenha(form.senha);
  const erros = {
    nome: validarNome(form.nome),
    email: validarEmail(form.email),
    telefone: validarTelefone(form.telefone),
    cpf: validarCpf(form.cpf),
    crea: validarCrea(form.crea),
    senha: forcaSenha === "Fraca" ? "A senha precisa ser pelo menos média." : "",
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

  function classeCampo(campo) {
    if (!tocados[campo] && !enviado) return "border-slate-300";
    return erros[campo] ? "border-red-500" : "border-green-600";
  }

  function enviarFormulario(evento) {
    evento.preventDefault();
    setEnviado(true);
    setSucesso(false);
    setTocados({
      nome: true, email: true, telefone: true, cpf: true, crea: true,
      senha: true, termo: true,
    });

    if (!formularioValido) return;

    setForm(estadoInicial);
    setTocados({});
    setEnviado(false);
    setSucesso(true);
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-y-auto bg-slate-50 lg:flex-row">
      <section
        className="relative flex flex-1 flex-col items-start justify-center gap-10 bg-slate-900 p-8 sm:p-12 lg:min-h-screen lg:p-16"
        aria-labelledby="brand-heading"
      >
        <div className="flex w-full flex-col items-start gap-4">
          <div className="text-xs font-medium leading-5 text-slate-300">
            INFRAROUTE&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA DE REDES
          </div>
          <h1
            id="brand-heading"
            className="text-4xl font-bold leading-tight text-slate-50 sm:text-[40px] sm:leading-[64px]"
          >
            Conecte projetos.
            <br />
            Expanda possibilidades.
          </h1>
          <p className="text-base leading-6 text-slate-300">
            Plataforma de expansão de fibra óptica
          </p>
        </div>
        <div className="flex w-full flex-col items-start gap-2">
          <div className="text-xs font-medium leading-5 text-slate-300">
            PROJETOS OSP&nbsp;&nbsp;/&nbsp;&nbsp;TOPOLOGIA&nbsp;&nbsp;/&nbsp;&nbsp;ENGENHARIA
          </div>
          <p className="text-base leading-6 text-slate-300">
            Gestão de projetos OSP, topologia de rede e assinaturas de
            engenharia em um único ambiente.
          </p>
        </div>
      </section>

      <section className="relative flex flex-1 flex-col items-center justify-center bg-slate-50 px-5 py-10 sm:px-8 lg:min-h-screen lg:p-12">
        <div className="w-full max-w-2xl">
          <form
            className="flex w-full flex-col gap-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0px_8px_32px_#050a191a] sm:gap-8 sm:p-10"
            onSubmit={enviarFormulario}
            noValidate
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-[32px] font-bold leading-10 text-slate-900">
                Crie sua conta
              </h2>
              <p className="text-base leading-6 text-slate-600">
                Acesso à Plataforma de Engenharia
              </p>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="fname" className="text-sm font-semibold leading-5 text-slate-900">
                  Nome
                </label>
                <input
                  className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("nome")}`}
                  type="text"
                  id="fname"
                  name="fname"
                  maxLength={50}
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
                  maxLength={19}
                  autoComplete="tel"
                  placeholder="(11) 91234-5678"
                  value={form.telefone}
                  aria-invalid={Boolean((tocados.telefone || enviado) && erros.telefone)}
                  onChange={(e) => atualizar("telefone", formatarTelefone(e.target.value))}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="cpf" className="text-sm font-semibold leading-5 text-slate-900">
                  CPF
                </label>
                <input
                  className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("cpf")}`}
                  type="text"
                  id="cpf"
                  name="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  maxLength={32}
                  value={form.cpf}
                  aria-invalid={Boolean((tocados.cpf || enviado) && erros.cpf)}
                  onChange={(e) => atualizar("cpf", formatarCpf(e.target.value))}
                />
                <CampoErro>{(tocados.cpf || enviado) && erros.cpf}</CampoErro>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="crea" className="text-sm font-semibold leading-5 text-slate-900">
                  CREA
                </label>
                <input
                  className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("crea")}`}
                  type="text"
                  id="crea"
                  name="crea"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  value={form.crea}
                  aria-invalid={Boolean((tocados.crea || enviado) && erros.crea)}
                  onChange={(e) => atualizar("crea", formatarCrea(e.target.value))}
                />
                <CampoErro>{(tocados.crea || enviado) && erros.crea}</CampoErro>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="femail" className="text-sm font-semibold leading-5 text-slate-900">
                  E-mail
                </label>
                <input
                  className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("email")}`}
                  type="email"
                  id="femail"
                  name="femail"
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
                  Senha
                </label>
                <input
                  className={`h-12 w-full rounded-lg border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 ${classeCampo("senha")}`}
                  type="password"
                  id="fsenha"
                  name="fsenha"
                  value={form.senha}
                  aria-invalid={Boolean((tocados.senha || enviado) && erros.senha)}
                  onChange={(e) => atualizar("senha", e.target.value)}
                />
                <p className="text-xs leading-5 text-slate-600">
                  Força da senha: {form.senha ? forcaSenha : "não informada"}
                </p>
                <CampoErro>{(tocados.senha || enviado) && erros.senha}</CampoErro>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 text-sm leading-5 text-slate-700" htmlFor="termo">
                <input
                  className={`h-4 w-4 appearance-auto accent-blue-600 ${classeCampo("termo")}`}
                  type="checkbox"
                  id="termo"
                  name="termo"
                  checked={form.termo}
                  onChange={(e) => atualizar("termo", e.target.checked)}
                />
                Eu aceito os termos e condições
              </label>
              <CampoErro>{(tocados.termo || enviado) && erros.termo}</CampoErro>
            </div>

            <p className="text-sm leading-5 text-red-600" aria-live="polite">
              {resumo.length > 0 ? `Verifique: ${resumo.join(", ")}.` : ""}
            </p>
            {sucesso && (
              <p className="text-sm font-semibold text-green-700" role="status">
                Cadastro enviado com sucesso!
              </p>
            )}
            <button
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold leading-6 text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="submit"
              disabled={!formularioValido}
            >
              Criar conta
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
