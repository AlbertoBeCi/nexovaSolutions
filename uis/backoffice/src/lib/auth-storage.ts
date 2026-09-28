/**
 * NEXOVA SOLUTIONS - lib/auth-storage.ts
 * Guarda el access token en localStorage. Con try/catch y guard de `window`
 * porque puede correr en SSR o en un navegador con storage bloqueado.
 *
 * Expone subscribeToken() para que componentes como nav-links.tsx puedan
 * leerlo con useSyncExternalStore (el evento nativo "storage" del navegador
 * no se dispara para cambios hechos por la propia pestaña).
 */

const TOKEN_KEY = "nexova_auth_token";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // almacenamiento no disponible (navegación privada, storage lleno, etc.)
  }
  notify();
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignorar
  }
  notify();
}
