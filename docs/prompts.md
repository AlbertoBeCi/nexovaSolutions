# Registro de Prompts — Proyecto Nexova Solutions (2026)

## Prompt 01: Creación del Prompt de Diseño para Inteligencia Artificial

> Gem Nexova en Gemini: con toda la información que tienes de la empresa, dame un prompt para hacer el diseño de la landing page, para cloude design.

## Prompt 02: Generación de la Landing Page Corporativa B2B en Cloude Design

> Actúa como un Diseñador UI/UX Principal y Desarrollador Frontend Senior Experto en Tailwind CSS, Accesibilidad Web (WCAG 2.1 AA) y SEO Técnico. Genera el código completo (HTML/JSX + Tailwind) de una Landing Page corporativa B2B de conversión masiva para la nueva web de 'Nexova Solutions'.

### 1. Contexto real de la empresa & dolores a resolver

- **Empresa:** Nexova Solutions (Fundada en 2011, sedes en Valencia, España y oficina de expansión en Miami, Florida). 120 empleados.
- **Situación actual:** La web anterior (2019) es lenta, no accesible y no convierte. Hay que posicionar a Nexova no solo como una consultora tradicional, sino como una potencia de gestión de talento optimizada con Ingeniería de IA.
- **Propuesta de valor:** Combinar 12+ años de experiencia humana profunda en reclutamiento con automatización inteligente y modelos de IA (Scoring, RAG, Búsqueda Semántica).
- **Target:** Medianas empresas de los sectores Tecnológico, Retail y Servicios Financieros.

### 2. Arquitectura de información (secciones estructuradas)

Diseña una SPA fluida, scannable y semántica con las siguientes secciones:

- **[HEADER / NAVIGATION]:** Barra de navegación fija (`backdrop-blur-md`) con logotipo, enlaces de sección y un CTA claro de conversión ("Solicitar Demo de IA").
- **[HERO SECTION (Mobile-First-Ready)]:** H1 con copy persuasivo enfocado a CEOs y Directores de RRHH de empresas Tech/Retail/Finanzas. Explicar cómo escalamos su gestión de talento con IA. Botón principal de CTA y badges de confianza ("Sedes en Valencia y Miami" | "12+ Años de Experiencia").
- **[MÉTRICAS DE IMPACTO REAL]:** Un grid responsivo que destaque los números reales de la firma: +12 Años de Trayectoria, 120+ Expertos Internos, 8M+ Facturación Anual, y SLAs Garantizados (< 24h en Soporte).
- **[NUESTRAS 3 LÍNEAS DE NEGOCIO INTEGRADAS CON IA]:** Reemplazar la percepción artesanal por una propuesta tecnológica robusta a través de 3 cards de servicio detalladas:
  1. **Operaciones de Selección Inteligente:** Reclutamiento asistido por IA, pipeline con scoring y ranking automático de CVs, y búsquedas semánticas (RAG) sobre base de datos global.
  2. **Outsourcing de Soporte al Cliente:** Equipos dedicados para Tech/Retail/Finanzas que operan bajo una base de conocimiento semántica y agentes de IA en primera línea que resuelven el 40% de incidencias, garantizando SLAs < 24h.
  3. **Plataforma de Formación Corporativa:** Catálogo digital inteligente e interactivo con sistemas de recomendación automatizados según el perfil de la empresa cliente (Liderazgo, Habilidades Blandas).
- **[SECCIÓN DE CONFIANZA B2B / INTEGRACIONES]:** Mención sutil a flujos y tecnologías (como integración nativa con entornos empresariales y CRM como HubSpot).
- **[FOOTER OPTIMIZADO PARA GEO-SEO]:** Direcciones físicas e información local clara para Valencia (España) y Miami (USA). Enlaces legales y zona preparada para la inserción de datos estructurados Schema.org (LocalBusiness / CorporateService).

### 3. Directrices técnicas de maquetación (Tailwind & Responsive)

- **Filosofía de desarrollo:** Estricto enfoque MOBILE-FIRST. Todos los layouts de grid y flexbox deben declararse para móviles por defecto (ej. `grid-cols-1`) y escalar progresivamente usando los breakpoints de Tailwind (`md:grid-cols-2 lg:grid-cols-3`).
- **Estilo visual:** Premium B2B Tech, ultra-limpio, corporativo moderno (estilo Vercel/Linear). Fondo principal claro de alta legibilidad (`bg-slate-50` o `bg-white`) con tipografía oscura contrastada (`text-slate-900`), o modo oscuro profundo de alto contraste (`bg-slate-950` / `text-slate-50`).
- **Colores de acento:** Indigo corporativo (`indigo-600`) para acciones primarias y Emerald/Cyan (`emerald-600`) para remarcar las ventajas tecnológicas de la IA.
- **Interactividad y accesibilidad (WCAG 2.1 AA):**
  - Uso obligado de etiquetas semánticas (`<header>`, `<main>`, `<section>`, `<footer>`).
  - Todos los elementos interactivos deben contar con estados `:hover`, `:focus-visible` claramente definidos con anillos de foco (`focus-visible:ring-4`).
  - Asegurar ratios de contraste de texto superiores a 4.5:1.
  - Iconos SVG limpios acompañados de `aria-hidden='true'` u hojas de estilo con textos ocultos para lectores de pantalla.

### 4. SEO y rendimiento

- Mantener una jerarquía de encabezados estricta (H1 → H2 → H3).
- El copy debe entrelazar orgánicamente las palabras clave de negocio ("outsourcing de soporte", "headhunting", "formación corporativa") con los modificadores geográficos ("Valencia", "Miami").

> Genera el código frontend completo, modular, responsivo y optimizado para una conversión impecable.

## Prompt 03: Sincronización de Repositorio

> Haz un pull al repositorio.

## Prompt 04: Consulta sobre Directivas en el IDE (Selección de Código)

> (Selección de código en el IDE) Explícame por qué si usamos Tailwind necesitamos esto aquí.

## Prompt 05: Auditoría de Accesibilidad Web (ARIA tags)

> Comprueba todas las etiquetas aria y si están puestas todas las necesarias.

## Prompt 06: Aplicación de Modificaciones

> Haz las dos modificaciones.

## Prompt 07: Consulta Técnica sobre Tailwind Avanzado

> (Consulta técnica sobre la implementación de `::selection` y `@keyframes` mediante utilidades y configuración de Tailwind CSS).

## Prompt 08: Cambio a Entorno de Producción Rápido (CDN)

> Quiero que usemos Tailwind CDN.

## Prompt 09: Estilos Personalizados y Animaciones Externas

> Crea el archivo `styles.css` y añade dentro el efecto.

## Prompt 10: Integración de Formulario Global e Interacción de CTAs

> Quiero quitar el formulario del index y utilizar el que tenemos en `@application.html`, por lo tanto al darle a los botones CTA quiero que se abra ese formulario.

## Prompt 11: Control de Versiones (Git)

> Haz `git add .`, commit y push.

## Prompt 12: Ajuste de Diseño y Estilos de Texto

> Quiero que realices el primer y segundo punto, el tercero de las mayúsculas estilo inglés me gusta.

## Prompt 13: Adaptación Responsiva del Logotipo Corporativo

> Quiero que cuando se vea desde un móvil, el logo "nexovasolution", solo se vea "nexova" y se oculte solution, cuando la pantalla pasa a `md`, aparece el nombre completo.

## Prompt 14: Corrección de Bug Visual en Botón Inclusivo

> El botón "ver servicios" tiene un bug, por defecto no se ve el texto del botón hasta que paso el ratón por encima.

## Prompt 15: Solicitud del Historial del Proyecto (Este prompt)

> ¿Puedes darme el registro de todos los prompts que hemos utilizado en este proyecto?

## Prompt 16: Refactorización Visual de Componentes (Reemplazo por Iconos)

> Quiero cambiar los 3 diferentes por icons:
> ```html
> <span class='inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg' style='background:#818cf820' aria-hidden='true'>
>   <span class='h-3 w-3 rounded-full' style='background:#818cf8'></span>
> </span>
> ```

## Prompt 17: Explicación de Comando de Consola (Bash Terminal)

> Explicame qué hace este comando:
> ```bash
> taskkill //F //IM python.exe 2>&1 | tail -5 || true
> ```
> (Motivo: Detener el servidor de pruebas local).

---

# Milestone 3

## Prompt 1: Configuración inicial y variables de entorno

Crea un archivo llamado `.env.local` en la raíz de este proyecto con el siguiente contenido:

```
NEXT_PUBLIC_API_URL=https://playground.4geeks.com/tracker/api/v1
```

## Prompt 2: Tipos de datos y mapeos de Nexova

Crea el archivo `src/types/candidate.ts`.

Este archivo debe definir los tipos de TypeScript para el proyecto de Nexova:

1. Tipo `CandidateStatus` con los valores: `'received' | 'in_progress' | 'selected' | 'discarded'`.
2. Tipo `CandidateStage` con los valores: `'pending' | 'review' | 'personal_interview' | 'technical_interview' | 'offer_presented'`.
3. Interfaz `Candidate` con los campos: id (number o string), name, email, phone, position, linkedin_url, cv_url, years_of_experience (number), status (CandidateStatus), stage (CandidateStage), created_at.
4. Interfaz `CandidateNote` con: id (number o string), candidate_id (number o string), note (string), created_at.
5. Objetos constantes para mapear los textos en español (porque en la UI nunca deben verse los valores crudos de la API):
   - **STATUS_LABELS:**
     - `received` → 'Recibida'
     - `in_progress` → 'En proceso'
     - `selected` → 'Seleccionada'
     - `discarded` → 'Descartada'
   - **STAGE_LABELS:**
     - `pending` → 'Pendiente de revisión'
     - `review` → 'En revisión'
     - `personal_interview` → 'Entrevista personal'
     - `technical_interview` → 'Entrevista técnica'
     - `offer_presented` → 'Oferta presentada'

## Prompt 3: Crear las funciones conectadas con la API

Ahora crea un archivo llamado `api.ts` dentro de la carpeta `src/services/`.

Este archivo debe tener todas las funciones necesarias para conectarse a la API usando `fetch` y `async/await`.
La URL base debe tomarse de `process.env.NEXT_PUBLIC_API_URL || 'https://playground.4geeks.com/tracker/api/v1'`.

Crea y exporta las siguientes funciones con TypeScript:

1. `getCandidates(params)`: Para pedir la lista de candidatos (GET /records). Debe aceptar filtros opcionales de búsqueda, estado y etapa.
2. `getCandidateById(id)`: Para pedir los datos de un candidato específico (GET /records/:id).
3. `createCandidate(data)`: Para guardar un nuevo candidato (POST /records).
4. `updateCandidate(id, data)`: Para editar todos los datos de un candidato (PUT /records/:id).
5. `patchCandidate(id, data)`: Para cambiar rápidamente el estado o etapa de un candidato (PATCH /records/:id).
6. `getCandidateNotes(id)`: Para pedir las notas de un candidato (GET /records/:id/notes).
7. `addCandidateNote(id, noteText)`: Para añadir una nueva nota (POST /records/:id/notes).
8. `deleteCandidateNote(id, noteId)`: Para borrar una nota existente (DELETE /records/:id/notes/:note_id).

Asegúrate de importar los tipos desde `src/types/candidate` y de que si la API da error, lance un mensaje claro para que la interfaz pueda mostrarlo.

## Prompt 4: Pantalla principal de listado de candidaturas

Crea la página principal de la aplicación en el archivo `src/app/page.tsx`.

Debe cumplir con lo siguiente para la empresa Nexova:

1. Al entrar a la página, pide la lista de candidatos a la API usando la función `getCandidates`.
2. Muestra un mensaje de "Cargando..." mientras llegan los datos y un mensaje de error si algo sale mal.
3. Arriba coloca los filtros:
   - Una barra para buscar candidatos por nombre o por correo en tiempo real.
   - Un menú desplegable para filtrar por Estado (Recibida, En proceso, Seleccionada, Descartada).
   - Un menú desplegable para filtrar por Etapa (Pendiente de revisión, En revisión, Entrevista personal, Entrevista técnica, Oferta presentada).
   - Recuerda: el usuario siempre debe ver los textos en español, pero por dentro el filtro debe usar los valores en inglés que pide la API.
   - Guarda los filtros en la URL de la página para que no se pierdan si se recarga.
4. Muestra la lista de candidatos en una tabla o tarjetas con:
   - Nombre completo
   - Puesto
   - Estado (en español)
   - Etapa (en español)
   - Un botón o enlace en cada candidato para abrir su ficha completa en la ruta `/candidates/[id]`.
5. Arriba en la cabecera pon el título "Nexova - Talent Pipeline" y un botón para "Registrar candidato" que lleve a `/candidates/new`.

Usa Tailwind CSS.

## Prompt 5: Página de Detalle del Candidato

Crea la página de detalle del candidato. Debe estar en la ruta `src/app/candidates/[id]/page.tsx`.

La página debe hacer lo siguiente:

1. Tomar el `id` de la URL y pedir los datos del candidato a la API usando `getCandidateById`.
2. Pedir las notas del candidato a la API usando `getCandidateNotes`.
3. Mostrar mensajes claros de "Cargando..." y mensajes de error si la API falla.
4. Mostrar toda la información del candidato de forma ordenada:
   - Nombre completo
   - Puesto (position)
   - Email y Teléfono
   - Enlace a su perfil de LinkedIn y enlace a su CV (deben abrirse en una pestaña nueva)
   - Años de experiencia
   - Fecha de aplicación
   - Estado actual y Etapa actual (siempre con las etiquetas en español).
5. Controles rápidos para cambiar Estado y Etapa:
   - Agrega dos menús desplegables para cambiar el Estado o la Etapa al instante.
   - Cuando el usuario seleccione uno nuevo, debe llamar a `patchCandidate` sin tener que recargar toda la página.
6. Sección de Notas internas:
   - Lista con todas las notas que tenga el candidato, mostrando el texto y su fecha.
   - Un botón de "Eliminar" en cada nota para borrarla llamando a `deleteCandidateNote`.
   - Un campo de texto con un botón "Añadir nota" para crear una nueva nota llamando a `addCandidateNote`.
   - Las notas deben actualizarse en pantalla de inmediato tras añadir o borrar.
7. Un botón arriba a la izquierda para "Volver al listado" que regrese a `/`.

## Prompt 6: Página de Detalle del Candidato

Crea los formularios para registrar y editar candidaturas:

1. Crea el archivo `src/app/candidates/new/page.tsx`:
   - Formulario para registrar un candidato con estos campos: nombre, email, teléfono, puesto, enlace de LinkedIn, enlace de CV y años de experiencia.
   - Menús de selección para Estado inicial y Etapa inicial con opciones en español.
   - Validación básica para asegurar que los campos requeridos no se envíen vacíos.
   - Al hacer submit, llama a `createCandidate` de `api.ts`.
   - Muestra mensajes claros si el guardado fue exitoso o si ocurrió un error.
   - Botón para volver a la página principal `/`.

2. Crea el archivo `src/app/candidates/[id]/edit/page.tsx`:
   - Carga los datos actuales del candidato usando `getCandidateById` y rellena el formulario automáticamente.
   - Permite modificar todos los campos.
   - Al hacer submit, llama a `updateCandidate` de `api.ts`.
   - Muestra feedback de éxito o error al enviar los cambios.
   - Botón para cancelar y volver a `/candidates/[id]`.

3. En la página de detalle `src/app/candidates/[id]/page.tsx`, añade un botón que enlace a `/candidates/[id]/edit` para abrir el formulario de edición.

## Prompt 7: Después de estar haciendo pruebas faltaban 2 páginas

Revisa las rutas del proyecto porque faltan los formularios de creación y edición. Crea los siguientes archivos:

1. `src/app/candidates/new/page.tsx`:
   - Formulario para crear un nuevo candidato (nombre, email, teléfono, puesto, linkedin_url, cv_url, years_of_experience, status inicial y stage inicial).
   - Opciones de status y stage en español.
   - Envío con `createCandidate` (POST /records).
   - Mensaje de éxito o error tras enviar.
   - Botón para volver al inicio.

2. `src/app/candidates/[id]/edit/page.tsx`:
   - Carga los datos del candidato por su ID con `getCandidateById` y rellena el formulario.
   - Permite editar todos los campos.
   - Envío con `updateCandidate` (PUT /records/:id).
   - Mensaje de éxito o error tras guardar.
   - Botón para cancelar y volver a la ficha del candidato.

3. En `src/app/candidates/[id]/page.tsx`, añade un enlace/botón visible que lleve a `/candidates/[id]/edit`.
