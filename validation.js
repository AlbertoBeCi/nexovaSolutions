'use strict';

/**
 * NEXOVA SOLUTIONS - INFRAESTRUCTURA DE LÓGICA Y VALIDACIÓN (HITO 1)
 * Fuente de verdad unificada para la Landing Page y el Formulario de Aplicación.
 */

// Contenido de negocio corporativo blindado según el BRIEFING oficial
const SERVICES = [
  {
    title: 'Operaciones de Selección Inteligente',
    desc: 'Dirigido por Javier Almeida. Reclutamiento con puntuación algorítmica de candidatos y búsqueda semántica RAG para encontrar el talento idóneo en horas.',
    color: '#4f46e5', // Indigo 600
    icon: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z', // lupa: búsqueda/scoring de candidatos
  },
  {
    title: 'Externalización de Soporte al Cliente',
    desc: 'Dirigido por Roberto Díaz. Equipos dedicados con bases de conocimiento avanzadas para cumplir estrictamente los niveles de SLA en menos de 24 horas.',
    color: '#10b981', // Emerald 500
    icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155', // chat: soporte al cliente
  },
  {
    title: 'Formación Corporativa Avanzada',
    desc: 'Dirigido por Elena Vargas. Catálogo inteligente y personalizado por rol para el desarrollo de habilidades blandas, comunicación y liderazgo.',
    color: '#818cf8', // Indigo 400
    icon: 'M4.26 10.147a60.436 60.436 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347M4.26 10.147a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814M4.26 10.147A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5', // birrete: formación corporativa
  },
];

const STATS = [
  { value: '12 años', label: 'de experiencia humana en RRHH' },
  { value: '120', label: 'profesionales en plantilla activa' },
  { value: '<24h', label: 'SLA garantizado en soporte' },
  { value: '2 sedes', label: 'Hubs globales en Valencia y Miami' },
];

// Campos reales del formulario de application.html (#applicationForm)
const FIELDS = ['fullName', 'companyName', 'email', 'phone', 'industry', 'serviceType', 'companySize', 'terms'];

const EMPTY_VALUES = {
  fullName: '',
  companyName: '',
  email: '',
  phone: '',
  industry: '',
  serviceType: '',
  companySize: '',
  terms: false,
};

// Estado único en memoria (Patrón Single Source of Truth)
const state = {
  values: { ...EMPTY_VALUES },
  errors: {},
  submitted: false,
};

/** Valida los datos del formulario de solicitud y devuelve un mapa { campo: mensaje } con los campos inválidos. */
function validate(values) {
  const errors = {};

  if (!values.fullName.trim()) errors.fullName = 'El nombre completo es obligatorio.';
  if (!values.companyName.trim()) errors.companyName = 'El nombre de la empresa es obligatorio.';

  if (!values.email.trim()) {
    errors.email = 'El correo electrónico es obligatorio.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Introduce un correo electrónico con formato válido.';
  }

  if (!values.phone.trim()) {
    errors.phone = 'El teléfono de contacto es obligatorio.';
  } else if (!/^\+?[0-9\s-]{7,15}$/.test(values.phone.trim())) {
    errors.phone = 'Introduce un teléfono válido (entre 7 y 15 dígitos).';
  }

  if (!values.industry) errors.industry = 'Selecciona el sector económico de tu empresa.';
  if (!values.serviceType) errors.serviceType = 'Selecciona la línea operativa que necesitas.';
  if (!values.companySize) errors.companySize = 'Indica el tamaño de tu organización.';
  if (!values.terms) errors.terms = 'Debes aceptar el tratamiento de datos para continuar.';

  return errors;
}

/** Pinta las tarjetas de SERVICES dentro de #services-list (Landing Page) */
function renderServices() {
  const container = document.getElementById('services-list');
  if (!container) return;
  container.innerHTML = SERVICES.map((svc) => `
    <article class="group relative flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-all duration-300 hover:border-indigo-500/50 hover:bg-slate-900 shadow-xl select-none">
      <div class="space-y-4">
        <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg" style="background:${svc.color}20" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${svc.color}" stroke-width="1.5" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="${svc.icon}" />
          </svg>
        </span>
        <h3 class="font-manrope text-xl font-bold text-white">${svc.title}</h3>
        <p class="text-sm leading-relaxed text-slate-400">${svc.desc}</p>
      </div>
      <div class="pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-indigo-400 font-semibold tracking-wider uppercase">
        <span>Garantía Nexova</span>
        <span class="font-mono opacity-60">SLA Check ✓</span>
      </div>
    </article>
  `).join('');
}

/** Pinta las tarjetas de STATS dentro de #stats-list (Landing Page) */
function renderStats() {
  const container = document.getElementById('stats-list');
  if (!container) return;
  container.innerHTML = STATS.map((stat) => `
    <div class="grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition-colors hover:border-slate-700/60 text-center sm:text-left backdrop-blur-sm">
      <span class="font-manrope text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">${stat.value}</span>
      <span class="text-xs font-medium text-slate-400 tracking-wide uppercase">${stat.label}</span>
    </div>
  `).join('');
}

function fieldErrorEl(field) {
  return document.getElementById(`${field}Error`);
}

function fieldInputEl(field) {
  return document.getElementById(field);
}

/** Sincroniza el estado de error de un campo con el DOM: aria-invalid, borde rojo y su <p role="status">. */
function applyFieldError(field) {
  const input = fieldInputEl(field);
  const errorEl = fieldErrorEl(field);
  const message = state.errors[field] || '';

  if (input) {
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.classList.toggle('border-red-500', Boolean(message));
    input.classList.toggle('focus:ring-red-500', Boolean(message));
    input.classList.toggle('border-slate-800', !message);
  }

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);
  }
}

/** Aplica todos los errores actuales a los campos y al resumen global (#errorSummary/#errorList). */
function applyAllFieldErrors() {
  FIELDS.forEach(applyFieldError);

  const messages = Object.values(state.errors);
  const errorSummary = document.getElementById('errorSummary');
  const errorList = document.getElementById('errorList');

  if (errorList) errorList.innerHTML = messages.map((msg) => `<li>${msg}</li>`).join('');
  if (errorSummary) errorSummary.classList.toggle('hidden', messages.length === 0);
}

/** Sustituye el formulario por un mensaje de confirmación accesible tras un envío válido. */
function showSuccessMessage() {
  const form = document.getElementById('applicationForm');
  if (!form) return;

  const success = document.createElement('div');
  success.setAttribute('role', 'status');
  success.setAttribute('tabindex', '-1');
  success.className = 'grid gap-3 rounded-xl border border-emerald-500 bg-emerald-500/10 p-6';
  success.innerHTML = `
    <p class="m-0 text-base font-bold text-emerald-400">✓ Solicitud recibida correctamente</p>
    <p class="m-0 text-sm text-emerald-200">Un miembro de nuestro equipo se pondrá en contacto contigo en menos de 24h.</p>
    <button type="button" id="reset-application-btn" class="mt-1 justify-self-start rounded-lg border border-emerald-500 bg-transparent px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500">
      Enviar otra solicitud
    </button>
  `;

  form.replaceWith(success);
  success.focus();
  document.getElementById('reset-application-btn')?.addEventListener('click', () => window.location.reload());
}

/** Mantiene state.values sincronizado con cada campo con [name] dentro de #applicationForm. */
function onField(e) {
  const { name, type, checked, value } = e.target;
  if (!name) return;
  state.values[name] = type === 'checkbox' ? checked : value;

  // Limpieza en tiempo real: si el campo se corrige, quitamos el error visual de inmediato
  if (state.errors[name]) {
    state.errors = validate(state.values);
    applyAllFieldErrors();
  }
}

/** Valida en el envío y, si falla, mueve el foco al primer campo con error. */
function onSubmit(e) {
  e.preventDefault();
  state.errors = validate(state.values);
  applyAllFieldErrors();

  if (Object.keys(state.errors).length > 0) {
    const firstErrorField = Object.keys(state.errors)[0];
    fieldInputEl(firstErrorField)?.focus();
    return;
  }

  state.submitted = true;
  showSuccessMessage();
}

/** Cablea los listeners una sola vez al cargar el DOM. */
function initEventListeners() {
  document.getElementById('applicationForm')?.addEventListener('submit', onSubmit);

  document.querySelectorAll('#applicationForm [name]').forEach((el) => {
    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.addEventListener('change', onField);
    } else {
      el.addEventListener('input', onField);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderServices();
  renderStats();
  initEventListeners();
});