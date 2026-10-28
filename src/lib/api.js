const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const SESSION_KEY = "infraroute-session";

export async function apiRequest(path, options = {}) {
  const session = getSession();
  const authHeader = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeader,
      ...options.headers,
    },
  });

  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    const detail = data?.detalhe || data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join(" ")
      : detail;
    throw new Error(
      message || `Falha na API (${response.status}).`,
    );
  }
  return data;
}

export function getSession() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
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
