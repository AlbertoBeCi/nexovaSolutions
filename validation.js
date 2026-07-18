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
  },
  {
    title: 'Externalización de Soporte al Cliente',
    desc: 'Dirigido por Roberto Díaz. Equipos dedicados con bases de conocimiento avanzadas para cumplir estrictamente los niveles de SLA en menos de 24 horas.',
    color: '#10b981', // Emerald 500
  },
  {
    title: 'Formación Corporativa Avanzada',
    desc: 'Dirigido por Elena Vargas. Catálogo inteligente y personalizado por rol para el desarrollo de habilidades blandas, comunicación y liderazgo.',
    color: '#818cf8', // Indigo 400
  },
];

const STATS = [
  { value: '12 años', label: 'de experiencia humana en RRHH' },
  { value: '120', label: 'profesionales en plantilla activa' },
  { value: '<24h', label: 'SLA garantizado en soporte' },
  { value: '2 sedes', label: 'Hubs globales en Valencia y Miami' },
];

// Sectores autorizados explícitamente en el Briefing corporativo de Nexova
const ALLOWED_SECTORS = ['tecnologico', 'retail', 'finanzas'];

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

// Estado único en memoria (Patrón Single Source of Truth)
const state = {
  values: { ...EMPTY_VALUES },
  errors: {},
  submitted: false,
  showForm: false,
};

/**
 * Valida de forma geo-estratégica y accesible los datos introducidos en el cliente.
 * Cumple estrictamente con las directrices del Core de Negocio de Nexova.
 */
function validate(values) {
  const errors = {};
  
  // 1. Validación de Identidad y Empresa
  if (!values.fullName.trim()) errors.fullName = 'El nombre completo es obligatorio para el registro.';
  if (!values.company.trim()) errors.company = 'Debes indicar el nombre de tu organización.';
  if (!values.role.trim()) errors.role = 'El cargo u ocupación actual es requerido.';

  // 2. Validación de Contacto (Cumplimiento de estándares internacionales de comunicación)
  if (!values.email.trim()) {
    errors.email = 'El correo electrónico corporativo es obligatorio.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Introduce una dirección de email corporativa válida (ejemplo@empresa.com).';
  }

  if (!values.phone.trim()) {
    errors.phone = 'El número de teléfono de contacto es obligatorio.';
  } else if (!/^\+?[0-9\s\-]{7,15}$/.test(values.phone.trim())) {
    errors.phone = 'Introduce un número de teléfono válido (entre 7 y 15 dígitos).';
  }

  // 3. Validación de Sector del Mercado (Filtro estricto del Briefing de Nexova)
  if (!values.sector) {
    errors.sector = 'Selecciona el sector principal de tu empresa.';
  } else if (!ALLOWED_SECTORS.includes(values.sector.toLowerCase())) {
    errors.sector = 'El sector seleccionado no se corresponde con nuestras líneas de servicio activas.';
  }

  // 4. Validación de Líneas de Interés (Estructura de Unidades de Negocio)
  if (!values.interestSeleccion && !values.interestOutsourcing && !values.interestFormacion) {
    errors.interests = 'Debes seleccionar al menos una línea de negocio de Nexova para procesar tu solicitud.';
  }

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
          <span class="h-3 w-3 rounded-full" style="background:${svc.color}"></span>
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
  return document.getElementById(`${field}-err`);
}

function fieldInputEl(field) {
  return document.getElementById(field);
}

/**
 * Sincroniza dinámicamente el estado de error de un campo con el árbol DOM.
 * Garantiza la accesibilidad inyectando propiedades aria de forma quirúrgica.
 */
function applyFieldError(field) {
  const input = fieldInputEl(field);
  const errorEl = fieldErrorEl(field);
  const message = state.errors[field] || '';
  
  if (input) {
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) {
      input.classList.add('border-red-500', 'focus:ring-red-500');
      input.classList.remove('border-slate-700', 'focus:ring-indigo-500');
    } else {
      input.classList.remove('border-red-500', 'focus:ring-red-500');
      input.classList.add('border-slate-700', 'focus:ring-indigo-500');
    }
  }
  
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.toggle('hidden', !message);
  }
}

/**
 * Aplica de forma masiva los errores detectados en el envío, aislando fieldsets complejos.
 */
function applyAllFieldErrors() {
  ['fullName', 'email', 'phone', 'company', 'role', 'sector'].forEach(applyFieldError);
  
  const interestsFieldset = document.getElementById('interests-fieldset');
  const interestsError = document.getElementById('interests-err');
  const message = state.errors.interests || '';
  
  if (interestsFieldset) {
    if (message) {
      interestsFieldset.classList.add('border-red-500/50', 'bg-red-500/5');
      interestsFieldset.classList.remove('border-slate-800', 'bg-slate-900/20');
    } else {
      interestsFieldset.classList.remove('border-red-500/50', 'bg-red-500/5');
      interestsFieldset.classList.add('border-slate-800', 'bg-slate-900/20');
    }
  }
  
  if (interestsError) {
    interestsError.textContent = message;
    interestsError.classList.toggle('hidden', !message);
  }
}

/** Revela el contenedor del formulario bajo demanda */
function showForm() {
  state.showForm = true;
  document.getElementById('show-form-btn')?.classList.add('hidden');
  document.getElementById('registration-form-wrapper')?.classList.remove('hidden');
}

/** Limpia de forma segura el estado de memoria y reinicia los componentes del DOM */
function resetForm() {
  state.values = { ...EMPTY_VALUES };
  state.errors = {};
  state.submitted = false;

  const form = document.getElementById('registration-form');
  if (form) form.reset();
  
  applyAllFieldErrors();

  document.getElementById('success-message')?.classList.add('hidden');
  document.getElementById('registration-form')?.classList.remove('hidden');
  
  // Devolvemos el foco al primer elemento para una navegación fluida
  document.getElementById('fullName')?.focus();
}

/** Sincroniza las mutaciones del DOM directamente hacia el estado centralizado */
function onField(e) {
  const { name, type, checked, value } = e.target;
  state.values[name] = type === 'checkbox' ? checked : value;
  
  // Limpieza en tiempo real: Si el campo se corrige, eliminamos el error visual de inmediato
  if (state.errors[name] || (name.startsWith('interest') && state.errors.interests)) {
    state.errors = validate(state.values);
    applyAllFieldErrors();
  }
}

/**
 * Manejador de envío: Intercepta, valida y gestiona la accesibilidad del foco en errores.
 */
function onSubmit(e) {
  e.preventDefault();
  state.errors = validate(state.values);
  applyAllFieldErrors();

  // Si existen errores, gestionamos el foco de manera accesible
  if (Object.keys(state.errors).length > 0) {
    const firstErrorField = Object.keys(state.errors)[0];
    let target = fieldInputEl(firstErrorField);
    
    if (firstErrorField === 'interests') {
      target = document.getElementById('interests-fieldset');
    }
    
    if (target) {
      // Hacemos el contenedor enfocable temporalmente si es un fieldset para no romper el lector de pantalla
      if (target.tagName === 'FIELDSET') {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    }
    return;
  }

  // Flujo de Éxito - Datos listos para persistencia en el Hito 2
  state.submitted = true;
  document.getElementById('registration-form')?.classList.add('hidden');
  
  const successMessage = document.getElementById('success-message');
  if (successMessage) {
    successMessage.classList.remove('hidden');
    successMessage.setAttribute('tabindex', '-1');
    successMessage.focus(); // El lector lee inmediatamente la confirmación de envío
  }
}

/** Inicialización optimizada de escuchas de eventos */
function initEventListeners() {
  document.getElementById('show-form-btn')?.addEventListener('click', showForm);
  document.getElementById('registration-form')?.addEventListener('submit', onSubmit);
  document.getElementById('reset-form-btn')?.addEventListener('click', resetForm);

  // Delegación o asignación quirúrgica según el tipo de control interactivo
  document.querySelectorAll('[data-field]').forEach((el) => {
    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.addEventListener('change', onField);
    } else {
      el.addEventListener('input', onField);
    }
  });
}

// Inicialización del hilo principal al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  renderServices();
  renderStats();
  initEventListeners();
});