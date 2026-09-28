/**
 * NEXOVA SOLUTIONS - types/auth.ts
 * Modelo de usuario/perfil que usa la UI (camelCase). Contrato de la API en
 * services/api/models.py (UserResponse, ProfileResponse, Token).
 */

export const USER_ROLES = ["admin", "manager", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserProfile {
  id: number;
  userId: number;
  name: string;
  phone: string | null;
  address: string | null;
}

export interface User {
  id: number;
  email: string;
  isActive: boolean;
  role: UserRole;
  createdAt: string;
  profile: UserProfile | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
