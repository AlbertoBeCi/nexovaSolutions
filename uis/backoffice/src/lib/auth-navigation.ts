/** Return-to helpers shared by the protected routes and login. */

export function getSafeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  try {
    const parsed = new URL(value, "https://nexova.invalid");
    if (parsed.origin !== "https://nexova.invalid" || parsed.pathname === "/login") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getLoginHref(returnTo: string | null | undefined): string {
  const safeReturnTo = getSafeReturnTo(returnTo);
  return safeReturnTo ? `/login?next=${encodeURIComponent(safeReturnTo)}` : "/login";
}
