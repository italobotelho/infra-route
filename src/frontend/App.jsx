import { useState } from "react";
import "./style.css";


const estadoInicial = {
  nome: "",
  email: "",
  senha: "",
  telefone:"",
  cpf: "",
  crea: "",
  termo: false,
};

function validarNome(nome) {
  return nome.trim().length >= 3 ? "" : "Digite pelo menos 3 caracteres.";
}

function validarEmail(email) {
  const formato = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return formato.test(email.trim()) ? "" : "Digite um e-mail válido.";
}

function validarTelefone(telefone){
  const formato = /^(?:\d{10,11}|\(\d{2}\)\s?\d{4,5}-\d{4})$/;
  const numero = telefone.trim();
  const digitos = numero.replace(/\D/g, "");
  const quantidadeValida = digitos.length === 10 || digitos.length === 11;
  const numeroValido = /^[1-9]\d{1}[2-5]\d{7}$/.test(digitos)
    || /^[1-9]\d{1}9\d{8}$/.test(digitos);

  return formato.test(numero) && quantidadeValida && numeroValido
    ? ""
    : "Digite um telefone válido.";
}

function formatarCpf(cpf) {
  const digitos = cpf.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function validarCpf(cpf) {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) {
    return "Digite um CPF válido.";
  }

  const calcularDigito = (base, pesoInicial) => {
    const soma = base
      .split("")
      .reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiroDigito = calcularDigito(digitos.slice(0, 9), 10);
  const segundoDigito = calcularDigito(digitos.slice(0, 10), 11);
  return primeiroDigito === Number(digitos[9]) && segundoDigito === Number(digitos[10])
    ? ""
    : "Digite um CPF válido.";
}

function formatarCrea(crea) {
  return crea.replace(/\D/g, "").slice(0, 10);
}

function validarCrea(crea) {
  return /^\d{1,10}$/.test(crea)
    ? ""
    : "Digite um número de CREA válido, com até 10 dígitos.";
}

function avaliarSenha(senha) {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (/[A-Z]/.test(senha)) pontos++;
  if (/[a-z]/.test(senha)) pontos++;
  if (/[0-9]/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  let forca = "Fraca";
  if (senha.length >= 8 && pontos >= 3) forca = "Média";
  if (senha.length >= 10 && pontos >= 4) forca = "Forte";
  return forca;
}

function CampoErro({ children }) {
  return children ? <p className="mensagem">{children}</p> : null;
}

export default function App() {
  const [form, setForm] = useState(estadoInicial);
  const [enviado, setEnviado] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [tocados, setTocados] = useState({});
  const [emailEmFoco, setEmailEmFoco] = useState(false);

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

  function classeCampo(campo, valor) {
    if (!tocados[campo] && !enviado) return "";
    return erros[campo] ? "invalido" : "valido";
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
    <>
      <h1>Cadastro de Usuário</h1>
      <form onSubmit={enviarFormulario} noValidate>
        <label htmlFor="fname">Nome</label>
        <input
          type="text" id="fname" name="fname" maxLength={50}
          value={form.nome}
          className={classeCampo("nome", form.nome)}
          aria-invalid={Boolean((tocados.nome || enviado) && erros.nome)}
          onChange={(e) => atualizar("nome", e.target.value)}
        />
        <p id="contador" className={form.nome.length >= 45 ? "limite" : ""}>
          {form.nome.length}/50 caracteres
        </p>
        <CampoErro>{(tocados.nome || enviado) && erros.nome}</CampoErro>

        <label htmlFor="telefone">Telefone</label>
        <input
          type="tel" id="telefone" name="telefone" maxLength={15}
          value={form.telefone}
          className={classeCampo("telefone", form.telefone)}
          aria-invalid={Boolean((tocados.telefone || enviado) && erros.telefone)}
          onChange={(e) => atualizar("telefone", e.target.value)}
        />
        <p id="contador" className={form.telefone.replace(/\D/g, "").length >= 11 ? "limite" : ""}>
          {form.telefone.replace(/\D/g, "").length}/11 dígitos
        </p>
        <CampoErro>{(tocados.telefone || enviado) && erros.telefone}</CampoErro>

        <label htmlFor="cpf">CPF</label>
        <input
          type="text"
          id="cpf"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={14}
          value={form.cpf}
          className={classeCampo("cpf", form.cpf)}
          aria-invalid={Boolean((tocados.cpf || enviado) && erros.cpf)}
          onChange={(e) => atualizar("cpf", formatarCpf(e.target.value))}
        />
        <CampoErro>{(tocados.cpf || enviado) && erros.cpf}</CampoErro>

        <label htmlFor="crea">CREA</label>
        <input
          type="text"
          id="crea"
          name="crea"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={form.crea}
          className={classeCampo("crea", form.crea)}
          aria-invalid={Boolean((tocados.crea || enviado) && erros.crea)}
          onChange={(e) => atualizar("crea", formatarCrea(e.target.value))}
        />
        <CampoErro>{(tocados.crea || enviado) && erros.crea}</CampoErro>

        <label htmlFor="femail">Email</label>
        <input type="email" id="femail" name="femail" value={form.email}
          className={`${classeCampo("email", form.email)} ${emailEmFoco ? "emFoco" : ""}`}
          aria-invalid={Boolean((tocados.email || enviado) && erros.email)}
          onFocus={() => setEmailEmFoco(true)}
          onBlur={() => { setEmailEmFoco(false); setTocados((atual) => ({ ...atual, email: true })); }}
          onChange={(e) => atualizar("email", e.target.value)}
        />
        <CampoErro>{(tocados.email || enviado) && erros.email}</CampoErro>

        <label htmlFor="fsenha">Senha</label>
        <input type="password" id="fsenha" name="fsenha" value={form.senha}
          className={classeCampo("senha", form.senha)}
          aria-invalid={Boolean((tocados.senha || enviado) && erros.senha)}
          onChange={(e) => atualizar("senha", e.target.value)}
        />
        <p id="forcaSenha">Força da senha: {form.senha ? forcaSenha : "não informada"}</p>
        <CampoErro>{(tocados.senha || enviado) && erros.senha}</CampoErro>

        <div className="termos">
          <input type="checkbox" id="termo" name="termo" checked={form.termo}
            className={classeCampo("termo", form.termo)}
            onChange={(e) => atualizar("termo", e.target.checked)}
          />
          <label htmlFor="termo">Eu aceito os termos e condições</label>
        </div>
        <CampoErro>{(tocados.termo || enviado) && erros.termo}</CampoErro>

        <p className="mensagem">
          {resumo.length > 0 ? `Verifique: ${resumo.join(", ")}.` : ""}
        </p>
        {sucesso && (
          <p className="sucesso" role="status">Cadastro enviado com sucesso!</p>
        )}
        <input type="submit" value="Enviar" disabled={!formularioValido} />
      </form>
    </>
  );
}
