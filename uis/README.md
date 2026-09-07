# `uis` folder

This folder contains **all projects with a user interface** for the cross-functional AI Engineering company project — for example: a public website, admin dashboard frontend, ecommerce UI, customer portals, Streamlit/Gradio app or other frontend-only tools.

The two main projects stored here are:

- **`website`** — the company's public-facing web presence.
- **`backoffice`** — the internal admin application. This is the ideal place to develop multiple solutions within a single project: authentication, people management, operations management, internal communication, and other back-office capabilities.

Organize `uis/` by **different concerns** — each subfolder covers a distinct area of the company (for example, public web vs internal operations) and includes its own technical and functional documentation.

- **Main purpose**: to centralize in a single place all frontend applications that support the company's use cases.
- **Recommendation**: document in this file (or in sub-READMEs) the applications you add, their objective, the technology used, and how to run them.

## Apps en este monorepo

| App | Carpeta | Objetivo | Stack | Arrancar |
| --- | --- | --- | --- | --- |
| **Website** | [`website/`](./website/) | Web corporativa pública (landing + banco de talento) | Next.js 16, React 19, Tailwind v4 | `cd website && npm install && npm run dev` |
| **Backoffice** | [`backoffice/`](./backoffice/) | Apps internas: pipeline de talento y gestión de candidaturas (Hito 3). Antes `talent-pipeline-tracker/` | Next.js 16, React 19, Tailwind v4 | `cd backoffice && npm install && npm run dev` |

Cada app corre en `http://localhost:3000`; levanta solo una a la vez o usa
`npm run dev -- -p <puerto>`.

> _Estas instrucciones también están disponibles en [español](./README.es.md)._
