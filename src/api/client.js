/**
 * Camada de Comunicação HTTP e Gestão de Sessão JWT (Aulas 04, 05, 14 e 15).
 *
 * Responsabilidades:
 * - Anexar o cabeçalho `Authorization: Bearer <token>` em requisições autenticadas (Aula 15).
 * - Validar a integridade estrutural e a expiração (`exp`) do token JWT no cliente (Aula 15).
 * - Persistir os metadados não-sensíveis da sessão em chave padronizada no Web Storage (Aula 14).
 * - Limpar explicitamente o token no Logout com `removeStorageItem` (Aulas 14 e 15).
 */

import {
  STORAGE_KEYS,
  decodeJwtPayload,
  getStorageItem,
  isJwtExpired,
  removeStorageItem,
  setStorageItem,
} from "../utils/storage";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const session = getSession();
  const authHeader = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...authHeader,
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor da API (porta 8000). Verifique se o backend está em execução.",
    );
  }

  let data = null;
  if (response.status !== 204) {
    const rawText = await response.text();
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    const detail = data?.detalhe || data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join(" ")
      : detail;
    if (message) {
      throw new Error(message);
    }
    if (response.status >= 500) {
      throw new Error(
        "Servidor da API indisponível (porta 8000). Verifique se o backend FastAPI está rodando.",
      );
    }
    throw new Error(`Falha na requisição (${response.status}).`);
  }
  return data;
}

export function getSession() {
  const session =
    getStorageItem(STORAGE_KEYS.AUTH_SESSION) ||
    getStorageItem(STORAGE_KEYS.LEGACY_AUTH_SESSION);

  if (!session) return null;

  if (session.access_token && isJwtExpired(session.access_token)) {
    clearSession();
    return null;
  }

  const claims = session.access_token ? decodeJwtPayload(session.access_token) : null;
  return claims ? { ...session, jwt_claims: claims } : session;
}

export function saveSession(session) {
  setStorageItem(STORAGE_KEYS.AUTH_SESSION, session);
  setStorageItem(STORAGE_KEYS.LEGACY_AUTH_SESSION, session);
}

export function clearSession() {
  removeStorageItem(STORAGE_KEYS.AUTH_SESSION);
  removeStorageItem(STORAGE_KEYS.LEGACY_AUTH_SESSION);
}

export async function logoutSession() {
  const session = getSession();
  if (session?.access_token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch {
      // prossegue com limpeza local caso a rede falhe
    }
  }
  clearSession();
}

