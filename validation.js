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
  touched: new Set(),
  submitAttempted: false,
  submitted: false,
};

/** Valida los datos del formulario de solicitud y devuelve un mapa { campo: mensaje } con los campos inválidos.
 *  Los textos coinciden literalmente con "Mensajes de error esperados" en CONTEXT.md. */
function validate(values) {
  const errors = {};

  const fullNameWords = values.fullName.trim().split(/\s+/).filter(Boolean);
  if (!values.fullName.trim() || fullNameWords.length < 2) {
    errors.fullName = 'El nombre debe contener al menos nombre y apellido';
  }

  if (!values.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Ingresa un email válido (ejemplo: nombre@empresa.com)';
  }

  if (!values.phone.trim() || !/^\+\d{1,3}[\d\s-]{6,14}$/.test(values.phone.trim())) {
    errors.phone = 'El teléfono debe incluir código de país (ejemplo: +34 612 345 678)';
  }

  if (!values.country) errors.country = 'Selecciona tu país de residencia';

  const years = Number(values.yearsExperience);
  if (!String(values.yearsExperience).trim() || Number.isNaN(years) || years < 0 || years > 50) {
    errors.yearsExperience = 'Los años de experiencia deben estar entre 0 y 50';
  }

  if (!values.sector) errors.sector = 'Selecciona el sector de tu interés';
  if (!values.englishLevel) errors.englishLevel = 'Indica tu nivel de inglés';
  if (!values.availability) errors.availability = 'Selecciona tu disponibilidad';

  if (values.linkedin.trim()) {
    let validUrl = false;
    try {
      const url = new URL(values.linkedin.trim());
      validUrl = /^https?:$/.test(url.protocol);
    } catch {
      validUrl = false;
    }
    if (!validUrl) errors.linkedin = 'Si incluyes LinkedIn, debe ser una URL válida';
  }

  if (values.comments.length > 500) {
    const remaining = Math.max(0, 500 - values.comments.length);
    errors.comments = `Los comentarios no pueden exceder 500 caracteres (quedan ${remaining})`;
  }

  if (!values.terms) errors.terms = 'Debes aceptar la política de tratamiento de datos para continuar';

  return errors;
}

function fieldErrorEl(field) {
  return document.getElementById(`${field}Error`);
}

function fieldInputEl(field) {
  return document.getElementById(field);
}

/** Sincroniza el estado de error de un campo con el DOM: aria-invalid, borde rojo y su <p role="status">.
 *  Solo se muestra el error si el campo ya fue tocado (blur/change) o se intentó enviar el formulario. */
function applyFieldError(field) {
  const input = fieldInputEl(field);
  const errorEl = fieldErrorEl(field);
  const shouldShow = state.touched.has(field) || state.submitAttempted;
  const message = shouldShow ? (state.errors[field] || '') : '';

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
    <p class="m-0 text-sm text-emerald-200">Mientras tanto, síguenos en <a href="https://linkedin.com/company/nexova" target="_blank" rel="noopener noreferrer" class="font-semibold underline hover:text-emerald-100">LinkedIn</a> para estar al día de nuestras vacantes y contenido sobre desarrollo profesional.</p>
    <button type="button" id="reset-application-btn" class="mt-1 justify-self-start rounded-lg border border-emerald-500 bg-transparent px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500">
      Enviar otra solicitud
    </button>
  `;

  form.replaceWith(success);
  success.focus();
  document.getElementById('reset-application-btn')?.addEventListener('click', () => window.location.reload());
}

/** Marca un campo como "tocado", revalida todo el formulario y refleja los errores en el DOM. */
function touchAndValidate(name) {
  state.touched.add(name);
  state.errors = validate(state.values);
  applyAllFieldErrors();
}

/** Mantiene state.values sincronizado con cada campo con [name] dentro de #applicationForm.
 *  En selects/checkbox/radio, el "change" ya es la interacción completa: validamos ahí mismo.
 *  En campos de texto, solo revalidamos en vivo mientras escribe si el campo ya fue tocado (blur previo). */
function onField(e) {
  const { name, type, checked, value } = e.target;
  if (!name) return;
  state.values[name] = type === 'checkbox' ? checked : value;

  if (name === 'comments') {
    const counter = document.getElementById('commentsCounter');
    if (counter) counter.textContent = `${value.length}/500`;
  }

  const isDiscreteControl = type === 'checkbox' || type === 'radio' || e.target.tagName === 'SELECT';
  if (isDiscreteControl || state.touched.has(name)) {
    touchAndValidate(name);
  }
}

/** Validación al perder el foco: primera vez que se revisa un campo de texto/número/url/textarea. */
function onBlur(e) {
  const { name } = e.target;
  if (!name) return;
  touchAndValidate(name);
}

/** Valida en el envío y, si falla, mueve el foco al primer campo con error. */
function onSubmit(e) {
  e.preventDefault();
  state.submitAttempted = true;
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

/** Restablece el formulario y el estado a sus valores iniciales, sin recargar la página. */
function onClear() {
  const form = document.getElementById('applicationForm');
  if (!form) return;

  form.reset();
  state.values = { ...EMPTY_VALUES };
  state.errors = {};
  state.touched = new Set();
  state.submitAttempted = false;
  applyAllFieldErrors();

  const counter = document.getElementById('commentsCounter');
  if (counter) counter.textContent = '0/500';

  fieldInputEl(FIELDS[0])?.focus();
}

/** Cablea los listeners una sola vez al cargar el DOM. */
function initEventListeners() {
  document.getElementById('applicationForm')?.addEventListener('submit', onSubmit);
  document.getElementById('clear-form-btn')?.addEventListener('click', onClear);

  document.querySelectorAll('#applicationForm [name]').forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') {
      el.addEventListener('change', onField);
    } else {
      el.addEventListener('input', onField);
      el.addEventListener('blur', onBlur);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
});