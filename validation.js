'use strict';

/**
 * NEXOVA SOLUTIONS - INFRAESTRUCTURA DE LÓGICA Y VALIDACIÓN (HITO 1)
 * Fuente de verdad unificada para la Landing Page y el Formulario de Aplicación.
 */

// Campos reales del formulario de application.html (#applicationForm)
const FIELDS = ['fullName', 'email', 'phone', 'country', 'yearsExperience', 'sector', 'englishLevel', 'availability', 'linkedin', 'comments', 'terms'];

const EMPTY_VALUES = {
  fullName: '',
  email: '',
  phone: '',
  country: '',
  yearsExperience: '',
  sector: '',
  englishLevel: '',
  availability: '',
  linkedin: '',
  comments: '',
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

  const fullNameWords = values.fullName.trim().split(/\s+/).filter(Boolean);
  if (!values.fullName.trim()) {
    errors.fullName = 'El nombre completo es obligatorio.';
  } else if (fullNameWords.length < 2) {
    errors.fullName = 'Introduce nombre y apellido (mínimo 2 palabras).';
  }

  if (!values.email.trim()) {
    errors.email = 'El correo electrónico es obligatorio.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Introduce un correo electrónico con formato válido.';
  }

  if (!values.phone.trim()) {
    errors.phone = 'El teléfono de contacto es obligatorio.';
  } else if (!/^\+\d{1,3}[\d\s-]{6,14}$/.test(values.phone.trim())) {
    errors.phone = 'El teléfono debe comenzar con + seguido del código de país (ej: +34 612 345 678).';
  }

  if (!values.country) errors.country = 'Selecciona tu país de residencia.';

  if (!String(values.yearsExperience).trim()) {
    errors.yearsExperience = 'Indica tus años de experiencia.';
  } else {
    const years = Number(values.yearsExperience);
    if (Number.isNaN(years) || years < 0 || years > 50) {
      errors.yearsExperience = 'Introduce un valor entre 0 y 50.';
    }
  }

  if (!values.sector) errors.sector = 'Selecciona tu sector de interés.';
  if (!values.englishLevel) errors.englishLevel = 'Selecciona tu nivel de inglés.';
  if (!values.availability) errors.availability = 'Selecciona tu disponibilidad.';

  if (values.linkedin.trim()) {
    try {
      const url = new URL(values.linkedin.trim());
      if (!/^https?:$/.test(url.protocol)) throw new Error('protocolo no soportado');
    } catch {
      errors.linkedin = 'Introduce una URL válida (ej: https://www.linkedin.com/in/tu-perfil).';
    }
  }

  if (values.comments.length > 500) errors.comments = 'Máximo 500 caracteres.';

  if (!values.terms) errors.terms = 'Debes aceptar la política de tratamiento de datos para continuar.';

  return errors;
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
    <p class="m-0 text-base font-bold text-emerald-400">¡Gracias por tu interés en Nexova!</p>
    <p class="m-0 text-sm text-emerald-200">Hemos recibido tu información. Nuestro equipo de selección la revisará y te contactaremos en caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o futuras.</p>
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

  if (name === 'comments') {
    const counter = document.getElementById('commentsCounter');
    if (counter) counter.textContent = `${value.length}/500`;
  }

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
    if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') {
      el.addEventListener('change', onField);
    } else {
      el.addEventListener('input', onField);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
});