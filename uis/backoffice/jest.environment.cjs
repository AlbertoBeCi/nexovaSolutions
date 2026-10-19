// jsdom no incluye las APIs de fetch (Response, Headers, Request) que usan los
// clientes HTTP; se exponen las de Node para poder construir respuestas reales.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TestEnvironment } = require("jest-environment-jsdom");

class FetchJsdomEnvironment extends TestEnvironment {
  constructor(...args) {
    super(...args);
    this.global.Response = Response;
    this.global.Headers = Headers;
    this.global.Request = Request;
  }
}

module.exports = FetchJsdomEnvironment;
