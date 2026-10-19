import { clearToken, getToken, setToken, subscribeToken } from "@/lib/auth-storage";

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("auth-storage", () => {
  it("guarda, lee y borra el token", () => {
    expect(getToken()).toBeNull();

    setToken("abc");
    expect(getToken()).toBe("abc");

    clearToken();
    expect(getToken()).toBeNull();
  });

  it("sobrescribe el token anterior", () => {
    setToken("uno");
    setToken("dos");

    expect(getToken()).toBe("dos");
  });

  it("notifica a los suscriptores al guardar y al borrar", () => {
    const listener = jest.fn();
    subscribeToken(listener);

    setToken("abc");
    clearToken();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifica a todos los suscriptores", () => {
    const [a, b] = [jest.fn(), jest.fn()];
    subscribeToken(a);
    subscribeToken(b);

    setToken("abc");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("deja de notificar tras cancelar la suscripción", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToken(listener);

    unsubscribe();
    setToken("abc");

    expect(listener).not.toHaveBeenCalled();
  });

  it("no rompe si localStorage lanza (modo privado, almacenamiento bloqueado)", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const listener = jest.fn();
    subscribeToken(listener);

    expect(getToken()).toBeNull();
    expect(() => setToken("abc")).not.toThrow();
    expect(() => clearToken()).not.toThrow();
    // aun asi se notifica: la UI debe refrescarse
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
