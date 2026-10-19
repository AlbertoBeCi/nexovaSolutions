import {
  changePassword,
  forgotPassword,
  getCurrentUser,
  getMyProfile,
  login,
  logout,
  register,
  resetPassword,
  updateMyProfile,
} from "@/lib/auth-api";
import { getToken, setToken } from "@/lib/auth-storage";
import { jsonResponse, mockFetch, sentJson, sentUrl } from "./helpers";

const USER_DTO = {
  id: 1,
  email: "a@nexova.com",
  is_active: true,
  role: "user",
  created_at: "2026-01-01T00:00:00Z",
  profile: { id: 5, user_id: 1, name: "Ana", phone: null, address: "Calle 1" },
};

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("login / logout", () => {
  it("guarda el token recibido", async () => {
    mockFetch(jsonResponse(200, { access_token: "tok", token_type: "bearer" }));

    await login({ email: "a@nexova.com", password: "Secreta123" });

    expect(getToken()).toBe("tok");
  });

  it("credenciales incorrectas: mensaje propio con tildes, sin guardar token", async () => {
    mockFetch(jsonResponse(401, { detail: "Email o contrasena incorrectos." }));

    await expect(login({ email: "a@nexova.com", password: "mala" })).rejects.toThrow(
      "Email o contraseña incorrectos."
    );
    expect(getToken()).toBeNull();
  });

  it("cualquier fallo del login se muestra como credenciales incorrectas", async () => {
    mockFetch(jsonResponse(500, { detail: "boom" }));

    await expect(login({ email: "a@nexova.com", password: "x" })).rejects.toThrow(
      "Email o contraseña incorrectos."
    );
  });

  it("red caída: mensaje de conexión", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    await expect(login({ email: "a@nexova.com", password: "x" })).rejects.toThrow(
      "No se pudo conectar con el servidor."
    );
  });

  it("logout borra el token", () => {
    setToken("tok");

    logout();

    expect(getToken()).toBeNull();
  });
});

describe("register", () => {
  const token = () => jsonResponse(200, { access_token: "nuevo", token_type: "bearer" });

  it("crea el usuario e inicia sesión automáticamente", async () => {
    const fetchMock = mockFetch(jsonResponse(201, USER_DTO), token());

    await register({ email: "a@nexova.com", password: "Secreta123" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentUrl(fetchMock, 0).pathname).toBe("/users");
    expect(sentUrl(fetchMock, 1).pathname).toBe("/auth/login");
    expect(getToken()).toBe("nuevo");
  });

  it("sin nombre no envía perfil", async () => {
    const fetchMock = mockFetch(jsonResponse(201, USER_DTO), token());

    await register({ email: "a@nexova.com", password: "Secreta123", name: "   " });

    expect(sentJson(fetchMock).profile).toBeUndefined();
  });

  it("con nombre envía el perfil recortado y los vacíos como null", async () => {
    const fetchMock = mockFetch(jsonResponse(201, USER_DTO), token());

    await register({
      email: "a@nexova.com", password: "Secreta123", name: "  Ana  ", phone: "  ", address: " Calle 1 ",
    });

    expect(sentJson(fetchMock).profile).toEqual({ name: "Ana", phone: null, address: "Calle 1" });
  });

  it("email duplicado (409): muestra el detail y no inicia sesión", async () => {
    const fetchMock = mockFetch(jsonResponse(409, { detail: "Ya existe un usuario con ese email." }));

    await expect(register({ email: "a@nexova.com", password: "Secreta123" })).rejects.toThrow(
      "Ya existe un usuario con ese email."
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it.each([
    [{ type: "string_too_short", loc: ["body", "password"] }, "La contraseña debe tener al menos 8 caracteres."],
    [{ type: "missing", loc: ["body", "password"] }, "La contraseña es obligatoria."],
    [{ type: "value_error", loc: ["body", "email"], msg: "x" }, "Ingresa un email válido."],
    [{ type: "string_too_short", loc: ["body", "profile", "name"] }, "El nombre es obligatorio."],
    [{ type: "missing", loc: ["body", "profile", "name"] }, "El nombre es obligatorio."],
    [{ type: "extra_forbidden", loc: ["body", "role"] }, "Alguno de los datos enviados no es válido."],
  ])("422 %j", async (issue, message) => {
    mockFetch(jsonResponse(422, { detail: [issue] }));

    await expect(register({ email: "a@nexova.com", password: "x" })).rejects.toThrow(message);
  });

  it.each([
    ["La contrasena debe tener al menos 8 caracteres.", "8 caracteres."],
    ["La contrasena debe incluir al menos una mayuscula.", "una mayúscula."],
    ["La contrasena debe incluir al menos una minuscula.", "una minúscula."],
    ["La contrasena debe incluir al menos un numero.", "un número."],
  ])("política de contraseña «%s» se muestra con tildes", async (msg, end) => {
    mockFetch(jsonResponse(422, {
      detail: [{ type: "value_error", loc: ["body", "new_password"], msg: `Value error, ${msg}` }],
    }));

    await expect(resetPassword("t", "x")).rejects.toThrow(end);
  });

  it("value_error desconocido: muestra el texto sin el prefijo", async () => {
    mockFetch(jsonResponse(422, { detail: [{ type: "value_error", loc: ["body"], msg: "Value error, Otra regla" }] }));

    await expect(resetPassword("t", "x")).rejects.toThrow("Otra regla");
  });
});

describe("sesión y perfil", () => {
  it("getCurrentUser exige un token guardado", async () => {
    const fetchMock = mockFetch();

    await expect(getCurrentUser()).rejects.toThrow("No hay una sesión activa.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getCurrentUser mapea el usuario y su perfil", async () => {
    setToken("tok");
    mockFetch(jsonResponse(200, USER_DTO));

    const user = await getCurrentUser();

    expect(user).toEqual({
      id: 1,
      email: "a@nexova.com",
      isActive: true,
      role: "user",
      createdAt: "2026-01-01T00:00:00Z",
      profile: { id: 5, userId: 1, name: "Ana", phone: null, address: "Calle 1" },
    });
  });

  it("getCurrentUser: usuario sin perfil -> profile null", async () => {
    setToken("tok");
    mockFetch(jsonResponse(200, { ...USER_DTO, profile: null }));

    expect((await getCurrentUser()).profile).toBeNull();
  });

  it("getMyProfile devuelve null si todavía no hay perfil", async () => {
    setToken("tok");
    mockFetch(jsonResponse(404, { detail: "Todavia no tienes un perfil creado." }));

    expect(await getMyProfile()).toBeNull();
  });

  it("getMyProfile propaga otros errores", async () => {
    setToken("tok");
    mockFetch(jsonResponse(500, { detail: "Fallo interno." }));

    await expect(getMyProfile()).rejects.toThrow("Fallo interno.");
  });

  it("getMyProfile mapea el perfil existente", async () => {
    setToken("tok");
    mockFetch(jsonResponse(200, USER_DTO.profile));

    expect(await getMyProfile()).toEqual({ id: 5, userId: 1, name: "Ana", phone: null, address: "Calle 1" });
  });

  it("updateMyProfile devuelve el perfil mapeado", async () => {
    setToken("tok");
    mockFetch(jsonResponse(200, USER_DTO.profile));

    expect((await updateMyProfile({ name: "Ana", phone: null, address: "Calle 1" })).userId).toBe(1);
  });

  it("updateMyProfile: nombre vacío -> mensaje en español", async () => {
    setToken("tok");
    mockFetch(jsonResponse(422, { detail: [{ type: "string_too_short", loc: ["body", "name"] }] }));

    await expect(updateMyProfile({ name: "", phone: null, address: null })).rejects.toThrow(
      "El nombre es obligatorio."
    );
  });
});

describe("recuperación y cambio de contraseña", () => {
  it("forgotPassword devuelve el mensaje de la API", async () => {
    mockFetch(jsonResponse(200, { detail: "Si el email existe, recibirás un enlace." }));

    expect(await forgotPassword("a@nexova.com")).toBe("Si el email existe, recibirás un enlace.");
  });

  it("forgotPassword: rate limit (429) muestra el detail", async () => {
    mockFetch(jsonResponse(429, { detail: "Demasiados intentos. Inténtalo más tarde." }));

    await expect(forgotPassword("a@nexova.com")).rejects.toThrow("Demasiados intentos.");
  });

  it.each([
    ["El token de reset es invalido, expiro o ya se utilizo.", "El token de restablecimiento no es válido, expiró o ya se utilizó."],
    ["La nueva contrasena debe ser diferente a la actual.", "La nueva contraseña debe ser diferente a la actual."],
  ])("resetPassword corrige las tildes de «%s»", async (raw, polished) => {
    mockFetch(jsonResponse(400, { detail: raw }));

    await expect(resetPassword("t", "Nueva12345")).rejects.toThrow(polished);
  });

  it("resetPassword devuelve el mensaje de éxito", async () => {
    mockFetch(jsonResponse(200, { detail: "Contraseña actualizada." }));

    expect(await resetPassword("t", "Nueva12345")).toBe("Contraseña actualizada.");
  });

  it("resetPassword: falta el token", async () => {
    mockFetch(jsonResponse(422, { detail: [{ type: "missing", loc: ["body", "token"] }] }));

    await expect(resetPassword("", "Nueva12345")).rejects.toThrow("Falta el token de restablecimiento.");
  });

  it("changePassword exige sesión", async () => {
    const fetchMock = mockFetch();

    await expect(changePassword("a", "b")).rejects.toThrow("No hay una sesión activa.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("changePassword guarda el token nuevo", async () => {
    setToken("viejo");
    mockFetch(jsonResponse(200, { access_token: "nuevo", token_type: "bearer" }));

    await changePassword("Actual123", "Nueva12345");

    expect(getToken()).toBe("nuevo");
  });

  it("changePassword con la contraseña actual incorrecta: mensaje con tildes y token intacto", async () => {
    // El 401 con token cierra la sesion (interceptor): se silencia la navegacion de jsdom.
    jest.spyOn(console, "error").mockImplementation(() => {});
    setToken("viejo");
    mockFetch(jsonResponse(401, { detail: "La contrasena actual no es correcta." }));

    await expect(changePassword("mala", "Nueva12345")).rejects.toThrow(
      "La contraseña actual no es correcta."
    );
  });

  it("changePassword: contraseña nueva igual a la actual", async () => {
    setToken("viejo");
    mockFetch(jsonResponse(400, { detail: "La nueva contrasena debe ser diferente a la actual." }));

    await expect(changePassword("Igual12345", "Igual12345")).rejects.toThrow(
      "La nueva contraseña debe ser diferente a la actual."
    );
    expect(getToken()).toBe("viejo");
  });
});
