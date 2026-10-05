/** Utilidades de test para los clientes HTTP: un `fetch` falso que responde
 *  en orden y un par de constructores de `Response`. */

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

export function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

/** Sustituye `global.fetch` por un mock que devuelve las respuestas dadas, en orden. */
export function mockFetch(...responses: Array<Response | Error>): jest.Mock {
  const fn = jest.fn();
  for (const response of responses) {
    if (response instanceof Error) fn.mockRejectedValueOnce(response);
    else fn.mockResolvedValueOnce(response);
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Cuerpo JSON de la n-esima llamada a fetch (para comprobar el mapeo de campos). */
export function sentJson(fetchMock: jest.Mock, call = 0): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

/** URL de la n-esima llamada a fetch. */
export function sentUrl(fetchMock: jest.Mock, call = 0): URL {
  return new URL(fetchMock.mock.calls[call][0] as string);
}
