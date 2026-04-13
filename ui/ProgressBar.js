class ProgressBar {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = {
      showPercentage: options.showPercentage !== false,
      showSteps: options.showSteps || false,
      steps: options.steps || [],
      animated: options.animated !== false
    };
    this.element = null;
    this.progressFill = null;
    this.progressText = null;
    this.stepsContainer = null;
    this.currentStep = 0;
    this.currentPercent = 0;
  }

  render() {
    this.container.innerHTML = '';

    this.element = document.createElement('div');
    this.element.className = 'ce-progress-bar';

    const barContainer = document.createElement('div');
    barContainer.className = 'ce-progress-bar-container';

    const bar = document.createElement('div');
    bar.className = 'ce-progress-bar-track';

    this.progressFill = document.createElement('div');
    this.progressFill.className = 'ce-progress-bar-fill';
    if (this.options.animated) {
      this.progressFill.classList.add('ce-progress-bar-animated');
    }
    bar.appendChild(this.progressFill);

    barContainer.appendChild(bar);

    if (this.options.showPercentage) {
      this.progressText = document.createElement('span');
      this.progressText.className = 'ce-progress-bar-text';
      this.progressText.textContent = '0%';
      barContainer.appendChild(this.progressText);
    }

    this.element.appendChild(barContainer);

    if (this.options.showSteps && this.options.steps.length > 0) {
      this.stepsContainer = document.createElement('div');
      this.stepsContainer.className = 'ce-progress-steps';

      for (let i = 0; i < this.options.steps.length; i++) {
        const step = document.createElement('div');
        step.className = 'ce-progress-step';
        step.dataset.index = i;

        const icon = document.createElement('span');
        icon.className = 'ce-progress-step-icon';
        icon.textContent = '○';

        const label = document.createElement('span');
        label.className = 'ce-progress-step-label';
        label.textContent = this.options.steps[i].name || `Step ${i + 1}`;

        step.appendChild(icon);
        step.appendChild(label);
        this.stepsContainer.appendChild(step);
      }

      this.element.appendChild(this.stepsContainer);
    }

    this.container.appendChild(this.element);
  }

  setProgress(percent, message) {
    this.currentPercent = Math.min(100, Math.max(0, percent));

    if (this.progressFill) {
      this.progressFill.style.width = `${this.currentPercent}%`;
    }

    if (this.progressText) {
      this.progressText.textContent = `${Math.round(this.currentPercent)}%`;
    }

    if (message && this.progressText) {
      this.progressText.textContent = `${Math.round(this.currentPercent)}% — ${message}`;
    }
  }

  setStep(stepIndex, state = 'active') {
    this.currentStep = stepIndex;

    if (!this.stepsContainer) return;

    const steps = this.stepsContainer.querySelectorAll('.ce-progress-step');
    steps.forEach((step, i) => {
      const icon = step.querySelector('.ce-progress-step-icon');
      step.classList.remove('ce-progress-step-done', 'ce-progress-step-active', 'ce-progress-step-pending');

      if (i < stepIndex) {
        step.classList.add('ce-progress-step-done');
        if (icon) icon.textContent = '✅';
      } else if (i === stepIndex) {
        step.classList.add('ce-progress-step-active');
        if (icon) icon.textContent = state === 'active' ? '🔄' : '○';
      } else {
        step.classList.add('ce-progress-step-pending');
        if (icon) icon.textContent = '○';
      }
    });
  }

  complete() {
    this.setProgress(100);

    if (this.stepsContainer) {
      const steps = this.stepsContainer.querySelectorAll('.ce-progress-step');
      steps.forEach(step => {
        step.classList.remove('ce-progress-step-active', 'ce-progress-step-pending');
        step.classList.add('ce-progress-step-done');
        const icon = step.querySelector('.ce-progress-step-icon');
        if (icon) icon.textContent = '✅';
      });
    }
  }

  reset() {
    this.currentStep = 0;
    this.currentPercent = 0;
    this.setProgress(0);

    if (this.stepsContainer) {
      const steps = this.stepsContainer.querySelectorAll('.ce-progress-step');
      steps.forEach(step => {
        step.classList.remove('ce-progress-step-done', 'ce-progress-step-active');
        step.classList.add('ce-progress-step-pending');
        const icon = step.querySelector('.ce-progress-step-icon');
        if (icon) icon.textContent = '○';
      });
    }
  }

  destroy() {
    this.element = null;
    this.progressFill = null;
    this.progressText = null;
    this.stepsContainer = null;
    this.container.innerHTML = '';
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ProgressBar };
}
