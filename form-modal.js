'use strict';

/**
 * NEXOVA SOLUTIONS - MODAL DE PASOS PARA application.html
 * Controla la apertura del modal y la navegación entre pasos del #applicationForm.
 * Depende de validation.js (state, validate, touchAndValidate, fieldInputEl), cargado antes en la página.
 */

(function () {
  const STEP_FIELDS = [
    ['fullName', 'email', 'phone', 'country'],
    ['yearsExperience', 'englishLevel', 'sector', 'availability', 'linkedin'],
    ['comments', 'terms'],
  ];

  const STEP_LABELS = ['Datos de contacto', 'Perfil profesional', 'Confirmación y envío'];

  let currentStep = 0;
  let triggerElement = null;

  function stepPanels() {
    return document.querySelectorAll('[data-step-panel]');
  }

  function goToStep(index) {
    currentStep = index;

    stepPanels().forEach((panel, i) => {
      panel.classList.toggle('hidden', i !== index);
    });

    document.querySelectorAll('[data-step-dot]').forEach((dot, i) => {
      dot.classList.toggle('bg-[var(--accent)]', i <= index);
      dot.classList.toggle('bg-[var(--line)]', i > index);
    });

    const progressLabel = document.getElementById('stepProgressLabel');
    if (progressLabel) {
      progressLabel.textContent = `Paso ${index + 1} de ${STEP_FIELDS.length} — ${STEP_LABELS[index]}`;
    }

    const isLastStep = index === STEP_FIELDS.length - 1;
    document.getElementById('stepBackBtn')?.classList.toggle('invisible', index === 0);
    document.getElementById('stepNextBtn')?.classList.toggle('hidden', isLastStep);
    document.getElementById('stepSubmitBtn')?.classList.toggle('hidden', !isLastStep);

    stepPanels()[index]?.querySelector('[data-step-heading]')?.focus();
  }

  function validateCurrentStep() {
    const fields = STEP_FIELDS[currentStep];
    fields.forEach((field) => touchAndValidate(field));
    return fields.every((field) => !state.errors[field]);
  }

  function handleNext() {
    if (!validateCurrentStep()) {
      const firstInvalidField = STEP_FIELDS[currentStep].find((field) => state.errors[field]);
      fieldInputEl(firstInvalidField)?.focus();
      return;
    }
    goToStep(currentStep + 1);
  }

  function handleBack() {
    goToStep(Math.max(currentStep - 1, 0));
  }

  function trapFocus(event) {
    const modal = document.getElementById('applicationModal');
    const focusableElements = modal.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const visibleElements = Array.from(focusableElements).filter((el) => el.offsetParent !== null);
    if (visibleElements.length === 0) return;

    const first = visibleElements[0];
    const last = visibleElements[visibleElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onModalKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
    } else if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function openModal(trigger) {
    triggerElement = trigger;
    const modal = document.getElementById('applicationModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    document.addEventListener('keydown', onModalKeydown);
    goToStep(0);
  }

  function closeModal() {
    const modal = document.getElementById('applicationModal');
    if (!modal) return;

    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    document.removeEventListener('keydown', onModalKeydown);
    triggerElement?.focus();
  }

  function init() {
    document.querySelectorAll('[data-open-modal]').forEach((trigger) => {
      trigger.addEventListener('click', () => openModal(trigger));
    });

    document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalBackdrop')?.addEventListener('click', closeModal);
    document.getElementById('stepNextBtn')?.addEventListener('click', handleNext);
    document.getElementById('stepBackBtn')?.addEventListener('click', handleBack);
    document.getElementById('clear-form-btn')?.addEventListener('click', () => goToStep(0));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
