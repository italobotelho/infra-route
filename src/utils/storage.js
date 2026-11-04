/**
 * Utilitário centralizado de Web Storage e inspeção de JWT no Front-End.
 *
 * Boas práticas aplicadas (Aulas 14 e 15 — Programação Web):
 * 1. Verificação explícita de suporte ao Web Storage (`typeof Storage !== "undefined"`).
 * 2. Padronização de chaves com namespace (`infraroute:<modulo>:<chave>`) para evitar colisões.
 * 3. Serialização estruturada com `JSON.stringify` e leitura segura com `JSON.parse` + fallback.
 * 4. Proibição estrita de armazenamento de dados sensíveis em texto puro (`senha`, `cpf`).
 * 5. Remoção seletiva com `localStorage.removeItem` em vez de `localStorage.clear()`.
 * 6. Decodificação Base64URL do Payload JWT (`Header.Payload.Signature`) para validar expiração (`exp`).
 *    Nota de segurança (Aula 15): O payload do JWT é apenas codificado em Base64, NÃO criptografado.
 */

export const STORAGE_KEYS = {
  AUTH_SESSION: "infraroute:auth:session",
  LEGACY_AUTH_SESSION: "infraroute-session",
  CADASTRO_DRAFT: "infraroute:form:cadastro",
  WORKSPACE_CONFIG: "infraroute:config:workspace",
};

const CAMPOS_SENSIVEIS_PROIBIDOS = ["senha", "senha_hash", "password", "cpf"];

export function isStorageSupported() {
  try {
    return typeof Storage !== "undefined" && typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function sanitizeForStorage(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const copiaSegura = { ...data };
  CAMPOS_SENSIVEIS_PROIBIDOS.forEach((campo) => {
    if (campo in copiaSegura) {
      delete copiaSegura[campo];
    }
  });
  return copiaSegura;
}

export function getStorageItem(key, fallback = null) {
  if (!isStorageSupported()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

export function setStorageItem(key, value) {
  if (!isStorageSupported()) return false;
  try {
    const safeValue = sanitizeForStorage(value);
    window.localStorage.setItem(key, JSON.stringify(safeValue));
    return true;
  } catch {
    return false;
  }
}

export function removeStorageItem(key) {
  if (!isStorageSupported()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignora falha de acesso ao storage
  }
}

/**
 * Decodifica o Payload (2ª parte) de um JSON Web Token (Header.Payload.Signature).
 * Observação (Aula 15): Base64 ≠ Criptografia. Qualquer cliente pode ler as claims públicas,
 * mas apenas o Back-End possui a chave secreta para assinar e validar a Signature (HS256).
 */
export function decodeJwtPayload(token) {
  if (typeof token !== "string" || !token.trim()) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonPayload = decodeURIComponent(
      window
        .atob(padded)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function isJwtExpired(token) {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || !Number.isFinite(Number(payload.exp))) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Number(payload.exp) <= nowSeconds;
}

