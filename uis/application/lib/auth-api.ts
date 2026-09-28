/**
 * NEXOVA SOLUTIONS - lib/auth-api.ts
 * Cliente HTTP contra services/api (FastAPI) para login, sesión actual y
 * recuperación/cambio de contraseña (/auth). Mismo patrón que
 * lib/suppliers-api.ts: mapea el DTO snake_case de la API a camelCase y
 * traduce los errores de validación a español.
 */

import { API_URL, apiRequest, genericTranslateIssue, jsonInit, type ValidationIssue } from "@/lib/api-client";
import { clearToken, getToken, setToken } from "@/lib/auth-storage";
import type { LoginCredentials, User, UserProfile, UserRole } from "@/types/auth";

// ─── DTOs de la API (snake_case, ver services/api/models.py) ──────────

interface ProfileDto {
  id: number;
  user_id: number;
  name: string;
  phone: string | null;
  address: string | null;
}

interface UserDto {
  id: number;
  email: string;
  is_active: boolean;
  role: UserRole;
  created_at: string;
  profile: ProfileDto | null;
}

interface TokenDto {
  access_token: string;
  token_type: string;
}

interface MessageDto {
  detail: string;
}

function toProfile(dto: ProfileDto): UserProfile {
  return { id: dto.id, userId: dto.user_id, name: dto.name, phone: dto.phone, address: dto.address };
}

function toUser(dto: UserDto): User {
  return {
    id: dto.id,
    email: dto.email,
    isActive: dto.is_active,
    role: dto.role,
    createdAt: dto.created_at,
    profile: dto.profile ? toProfile(dto.profile) : null,
  };
}

// ─── Manejo de errores ────────────────────────────────────────────────

/** Los mensajes de validacion de contrasena que devuelve la API no llevan
 *  tildes (services/api/models.py); aca se muestran con la ortografia
 *  correcta para el usuario. */
function translateIssue(issue: ValidationIssue): string {
  const field = issue.loc?.[issue.loc.length - 1];

  if (field === "email") return "Ingresa un email válido.";

  if (issue.type === "value_error" && issue.msg) {
    const detail = issue.msg.replace(/^Value error,\s*/i, "");
    if (detail.includes("8 caracteres")) return "La contraseña debe tener al menos 8 caracteres.";
    if (detail.includes("mayuscula")) return "La contraseña debe incluir al menos una mayúscula.";
    if (detail.includes("minuscula")) return "La contraseña debe incluir al menos una minúscula.";
    if (detail.includes("numero")) return "La contraseña debe incluir al menos un número.";
    return detail;
  }

  if (field === "new_password" || field === "current_password" || field === "password") {
    if (issue.type === "string_too_short") return "La contraseña debe tener al menos 8 caracteres.";
    if (issue.type === "missing") return "La contraseña es obligatoria.";
  }

  if (field === "token" && issue.type === "missing") return "Falta el token de restablecimiento.";

  return genericTranslateIssue(issue);
}

/** routes/auth.py no lleva tildes en sus mensajes de error (ver la nota en
 *  ese archivo); esto los muestra con la ortografia correcta para el
 *  usuario cuando la API los devuelve como `detail` en texto plano (401,
 *  400 y 429 no pasan por translateIssue, que solo ve errores 422). */
const KNOWN_MESSAGE_FIXES: Record<string, string> = {
  "El token de reset es invalido, expiro o ya se utilizo.":
    "El token de restablecimiento no es válido, expiró o ya se utilizó.",
  "La nueva contrasena debe ser diferente a la actual.":
    "La nueva contraseña debe ser diferente a la actual.",
  "La contrasena actual no es correcta.": "La contraseña actual no es correcta.",
};

async function withPolishedErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof Error) throw new Error(KNOWN_MESSAGE_FIXES[err.message] ?? err.message);
    throw err;
  }
}

// ─── Endpoints: auth ────────────────────────────────────────────────

/** Inicia sesion y guarda el access token. Lanza si las credenciales son invalidas. */
export async function login(credentials: LoginCredentials): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: credentials.email, password: credentials.password }),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Comprueba que la API está en marcha.");
  }

  // 401 en login siempre es "credenciales invalidas": se ignora el detail
  // crudo de la API (routes/auth.py no lleva tildes) y se muestra la frase
  // con la ortografia correcta.
  if (!response.ok) {
    throw new Error("Email o contraseña incorrectos.");
  }

  const dto = (await response.json()) as TokenDto;
  setToken(dto.access_token);
}

export function logout(): void {
  clearToken();
}

/** Usuario autenticado actual. Lanza si no hay token guardado o si la API lo rechaza (401). */
export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  if (!token) throw new Error("No hay una sesión activa.");

  const response = await apiRequest(
    "/auth/me",
    { headers: { Authorization: `Bearer ${token}` } },
    "No se pudo obtener la sesión.",
    translateIssue
  );
  return toUser((await response.json()) as UserDto);
}

/** Siempre resuelve con el mismo mensaje generico, exista o no el email. */
export async function forgotPassword(email: string): Promise<string> {
  return withPolishedErrors(async () => {
    const response = await apiRequest(
      "/auth/forgot-password",
      jsonInit("POST", { email }),
      "No se pudo procesar la solicitud.",
      translateIssue
    );
    return ((await response.json()) as MessageDto).detail;
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  return withPolishedErrors(async () => {
    const response = await apiRequest(
      "/auth/reset-password",
      jsonInit("POST", { token, new_password: newPassword }),
      "No se pudo restablecer la contraseña.",
      translateIssue
    );
    return ((await response.json()) as MessageDto).detail;
  });
}

/** Requiere sesion activa. Guarda el access token nuevo que devuelve la API
 *  (el cambio invalida el token anterior, incluido el que se uso para
 *  llamar a este endpoint). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("No hay una sesión activa.");

  await withPolishedErrors(async () => {
    const response = await apiRequest(
      "/auth/change-password",
      jsonInit(
        "POST",
        { current_password: currentPassword, new_password: newPassword },
        { Authorization: `Bearer ${token}` }
      ),
      "No se pudo cambiar la contraseña.",
      translateIssue
    );
    const dto = (await response.json()) as TokenDto;
    setToken(dto.access_token);
  });
}
