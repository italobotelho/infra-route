/**
 * Funções puras de validação e formatação de formulários (Aulas 09 e 12 — Programação Web).
 * Utiliza const/let, igualdade estrita (===), conversão explícita Number() e Number.isFinite().
 */

export const estadoInicial = {
  nome: "",
  email: "",
  senha: "",
  telefone: "",
  cpf: "",
  crea: "",
  termo: false,
};

export const validarNome = (nome) =>
  nome.trim().length >= 3 ? "" : "Digite pelo menos 3 caracteres.";

export const validarEmail = (email) => {
  const formato = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return formato.test(email.trim()) ? "" : "Digite um e-mail corporativo válido.";
};

export const formatarTelefone = (telefone) => {
  let digitos = telefone.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.slice(0, 11);

  if (digitos.length <= 2) return digitos;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const tamanhoPrefixo = digitos[2] === "9" ? 5 : 4;
  const prefixo = numero.slice(0, tamanhoPrefixo);
  const sufixo = numero.slice(tamanhoPrefixo);

  return `(${ddd}) ${prefixo}${sufixo ? `-${sufixo}` : ""}`;
};

export const validarTelefone = (telefone) => {
  let digitos = telefone.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }

  const numeroValido = /^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(digitos);
  return numeroValido ? "" : "Digite um telefone válido com DDD.";
};

export const formatarCpf = (cpf) => {
  const digitos = cpf.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const validarCpf = (cpf) => {
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
};

export const UFS_BRASIL = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO",
  "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export const formatarCrea = (crea) => {
  const bruto = String(crea || "")
    .toUpperCase()
    .replace(/^CREA[\s-]+/, "")
    .replace(/[^A-Z0-9/-]/g, "");

  const letrasIniciais = bruto.match(/^[A-Z]{0,2}/)?.[0] || "";
  const restante = bruto.slice(letrasIniciais.length).replace(/[^0-9/DP]/g, "");
  const [parteNum = "", ...restoBarra] = restante.split("/");
  const digitos = parteNum.replace(/\D/g, "").slice(0, 10);

  let sufixo = "";
  if (restoBarra.length > 0) {
    const letraSufixo = restoBarra.join("").replace(/[^DP]/g, "").slice(0, 1);
    sufixo = `/${letraSufixo}`;
  }

  if (!letrasIniciais) {
    return `${digitos}${sufixo}`.slice(0, 15);
  }
  if (letrasIniciais.length === 2 && (digitos.length > 0 || bruto.includes("-"))) {
    return `${letrasIniciais}-${digitos}${sufixo}`.slice(0, 15);
  }
  return letrasIniciais;
};

export const validarCrea = (crea) => {
  const limpo = String(crea || "").trim().toUpperCase().replace(/^CREA[\s-]+/, "");
  if (!limpo) {
    return "Informe o registro CREA no formato UF-NUMERO (ex.: SP-5060708090).";
  }

  const match = limpo.match(/^([A-Z]{2})-(\d+)(?:\/([A-Z]+))?$/);
  if (!match) {
    return "Use o formato UF-NUMERO (ex.: SP-5060708090 ou MG-123456/D).";
  }

  const [, uf, numero, sufixo] = match;
  if (!UFS_BRASIL.includes(uf)) {
    return `UF do CREA inválida (${uf}). Utilize uma sigla estadual brasileira válida.`;
  }
  if (numero.length < 6 || numero.length > 10) {
    return "O número do CREA deve conter entre 6 e 10 dígitos.";
  }
  if (/^(\d)\1+$/.test(numero)) {
    return "Número do CREA inválido: sequência de dígitos repetidos.";
  }
  if (sufixo && sufixo !== "D" && sufixo !== "P") {
    return "Sufixo do CREA inválido. Utilize apenas /D ou /P.";
  }
  return "";
};

export const avaliarSenha = (senha) => {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (/[A-Z]/.test(senha)) pontos++;
  if (/[a-z]/.test(senha)) pontos++;
  if (/[0-9]/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;

  let forca = "Fraca";
  if (senha.length >= 8 && pontos >= 4) forca = "Média";
  if (senha.length >= 8 && pontos === 5) forca = "Forte";
  return forca;
};

export const validarSenha = (senha) => {
  if (senha.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (!/[A-Z]/.test(senha)) {
    return "A senha deve incluir pelo menos 1 letra maiúscula.";
  }
  if (!/[a-z]/.test(senha)) {
    return "A senha deve incluir pelo menos 1 letra minúscula.";
  }
  if (!/[0-9]/.test(senha)) {
    return "A senha deve incluir pelo menos 1 número.";
  }
  if (!/[^A-Za-z0-9]/.test(senha)) {
    return "A senha deve incluir pelo menos 1 caractere especial (ex: @, #, !, $).";
  }
  return "";
};

