export const estadoInicial = {
  nome: "",
  email: "",
  senha: "",
  telefone: "",
  cpf: "",
  crea: "",
  termo: false,
};

export function validarNome(nome) {
  return nome.trim().length >= 3 ? "" : "Digite pelo menos 3 caracteres.";
}

export function validarEmail(email) {
  const formato = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return formato.test(email.trim()) ? "" : "Digite um e-mail válido.";
}

export function formatarTelefone(telefone) {
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
}

export function validarTelefone(telefone) {
  let digitos = telefone.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }

  const numeroValido = /^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(digitos);
  return numeroValido ? "" : "Digite um telefone válido.";
}

export function formatarCpf(cpf) {
  const digitos = cpf.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function validarCpf(cpf) {
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

export function formatarCrea(crea) {
  return crea.replace(/\D/g, "").slice(0, 10);
}

export function validarCrea(crea) {
  return /^\d{1,10}$/.test(crea)
    ? ""
    : "Digite um número de CREA válido, com até 10 dígitos.";
}

export function avaliarSenha(senha) {
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
