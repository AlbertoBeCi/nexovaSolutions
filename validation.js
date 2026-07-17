'use strict';

// Contenido de negocio (servicios y estadísticas) vive aquí, no en el HTML,
// para que renderServices()/renderStats() sean la única fuente de verdad al pintar las tarjetas.
const SERVICES = [
  {
    title: 'Operaciones de Selección Inteligente',
    desc: 'Reclutamiento con scoring algorítmico de candidatos y base de datos RAG semántica para encontrar el mejor talento en horas, no semanas.',
    color: '#4f46e5',
  },
  {
    title: 'Outsourcing de Soporte al Cliente',
    desc: 'Equipos dedicados con bases de conocimiento avanzadas para cumplir estrictamente SLAs menores a 24h.',
    color: '#10b981',
  },
  {
    title: 'Formación Corporativa Avanzada',
    desc: 'Catálogo interactivo e inteligente, personalizado por rol, de habilidades blandas y liderazgo.',
    color: '#818cf8',
  },
];

const STATS = [
  { value: '12 años', label: 'de experiencia en RRHH' },
  { value: '120', label: 'profesionales en plantilla' },
  { value: '<24h', label: 'SLA garantizado de soporte' },
  { value: '2 sedes', label: 'Valencia y Miami' },
];

const EMPTY_VALUES = {
  fullName: '',
  email: '',
  phone: '',
  company: '',
  role: '',
  sector: '',
  interestSeleccion: false,
  interestOutsourcing: false,
  interestFormacion: false,
  teamSize: '',
};

// Estado en memoria del formulario. El DOM se actualiza a partir de este objeto
// (no al revés), evitando leer valores directamente de los inputs al validar o enviar.
const state = {
  values: { ...EMPTY_VALUES },
  errors: {},
  submitted: false,
  showForm: false,
};

/**
 * Valida los datos del formulario y devuelve un mapa { campo: mensaje } solo con los campos inválidos.
 * Un objeto vacío significa que el formulario es válido.
 */
function validate(values) {
  const errors = {};
  if (!values.fullName.trim()) errors.fullName = 'Este campo es obligatorio.';
  if (!values.email.trim()) errors.email = 'Este campo es obligatorio.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Introduce un email con formato válido.';
  if (!values.phone.trim()) errors.phone = 'Este campo es obligatorio.';
  if (!values.company.trim()) errors.company = 'Este campo es obligatorio.';
  if (!values.role.trim()) errors.role = 'Este campo es obligatorio.';
  if (!values.sector) errors.sector = 'Selecciona un sector.';
  if (!values.interestSeleccion && !values.interestOutsourcing && !values.interestFormacion) {
    errors.interests = 'Selecciona al menos una línea de interés.';
  }
  return errors;
}

/** Pinta las tarjetas de SERVICES dentro de #services-list. */
function renderServices() {
  const container = document.getElementById('services-list');
  if (!container) return;
  container.innerHTML = SERVICES.map((svc) => `
    <article class="grid gap-3.5 rounded-2xl border border-slate-800 bg-slate-900 p-7">
      <span class="block h-9 w-9 rounded-lg" style="background:${svc.color}" aria-hidden="true"></span>
      <h3 class="m-0 font-manrope text-lg font-bold">${svc.title}</h3>
      <p class="m-0 text-sm leading-relaxed text-slate-400">${svc.desc}</p>
    </article>
  `).join('');
}

/** Pinta las tarjetas de STATS dentro de #stats-list. */
function renderStats() {
  const container = document.getElementById('stats-list');
  if (!container) return;
  container.innerHTML = STATS.map((stat) => `
    <div class="grid gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <span class="font-manrope text-2xl font-extrabold text-emerald-400">${stat.value}</span>
      <span class="text-sm font-medium text-slate-300">${stat.label}</span>
    </div>
  `).join('');
}

function fieldErrorEl(field) {
  return document.getElementById(`${field}-err`);
}

function fieldInputEl(field) {
  return document.getElementById(field);
}

/**
 * Sincroniza el error de un campo con el DOM: alterna aria-invalid, el borde rojo
 * y el texto del <p role="alert"> asociado (referenciado vía aria-describedby).
 */
function applyFieldError(field) {
  const input = fieldInputEl(field);
  const errorEl = fieldErrorEl(field);
  const message = state.errors[field] || '';
  if (input) {
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.classList.toggle('border-red-500', Boolean(message));
    input.classList.toggle('border-slate-700', !message);
  }
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);
  }
}

/**
 * Aplica todos los errores actuales al DOM. Los checkboxes de interés se tratan aparte
 * porque el error pertenece al <fieldset> del grupo, no a un input individual.
 */
function applyAllFieldErrors() {
  ['fullName', 'email', 'phone', 'company', 'role', 'sector'].forEach(applyFieldError);
  const interestsFieldset = document.getElementById('interests-fieldset');
  const interestsError = document.getElementById('interests-err');
  const message = state.errors.interests || '';
  if (interestsFieldset) {
    interestsFieldset.classList.toggle('border-red-500', Boolean(message));
    interestsFieldset.classList.toggle('border-slate-800', !message);
  }
  if (interestsError) {
    interestsError.textContent = message;
    interestsError.classList.toggle('hidden', !message);
  }
}

/** Revela el formulario y oculta el botón "Mostrar formulario" que lo activó. */
function showForm() {
  state.showForm = true;
  document.getElementById('show-form-btn')?.classList.add('hidden');
  document.getElementById('registration-form-wrapper')?.classList.remove('hidden');
}

/** Limpia estado y DOM para permitir un nuevo envío tras un registro exitoso. */
function resetForm() {
  state.values = { ...EMPTY_VALUES };
  state.errors = {};
  state.submitted = false;

  const form = document.getElementById('registration-form');
  if (form) form.reset();
  applyAllFieldErrors();

  document.getElementById('success-message')?.classList.add('hidden');
  document.getElementById('registration-form')?.classList.remove('hidden');
}

/** Mantiene state.values sincronizado con cada input/checkbox marcado como data-field. */
function onField(e) {
  const { name, type, checked, value } = e.target;
  state.values[name] = type === 'checkbox' ? checked : value;
}

/**
 * Valida en el envío (no en cada tecla) y, si falla, mueve el foco al primer campo
 * con error para que el flujo de teclado/lector de pantalla sea inmediato.
 */
function onSubmit(e) {
  e.preventDefault();
  state.errors = validate(state.values);
  applyAllFieldErrors();

  if (Object.keys(state.errors).length) {
    const firstErrorField = Object.keys(state.errors)[0];
    const target = fieldInputEl(firstErrorField) || document.getElementById('interests-fieldset');
    target?.focus();
    return;
  }

  state.submitted = true;
  document.getElementById('registration-form')?.classList.add('hidden');
  document.getElementById('success-message')?.classList.remove('hidden');
}

/** Cablea los listeners una sola vez al cargar el DOM. */
function initEventListeners() {
  document.getElementById('show-form-btn')?.addEventListener('click', showForm);
  document.getElementById('registration-form')?.addEventListener('submit', onSubmit);
  document.getElementById('reset-form-btn')?.addEventListener('click', resetForm);

  document.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', onField);
    el.addEventListener('input', onField);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderServices();
  renderStats();
  initEventListeners();
});
