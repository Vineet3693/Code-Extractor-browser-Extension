class FileEditor {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = {
      placeholder: options.placeholder || 'Enter file name...',
      validate: options.validate || null,
      onConfirm: options.onConfirm || null,
      onCancel: options.onCancel || null,
      initialPath: options.initialPath || '',
      initialName: options.initialName || '',
      autocomplete: options.autocomplete || []
    };
    this.element = null;
    this.input = null;
    this.autocompleteList = null;
    this.currentValue = '';
  }

  render() {
    this.container.innerHTML = '';

    this.element = document.createElement('div');
    this.element.className = 'ce-file-editor';

    const inputRow = document.createElement('div');
    inputRow.className = 'ce-file-editor-row';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'ce-file-editor-input';
    this.input.placeholder = this.options.placeholder;
    this.input.value = this.options.initialPath || this.options.initialName;
    this.currentValue = this.input.value;

    this.input.addEventListener('input', () => {
      this.currentValue = this.input.value;
      this.handleAutocomplete();
      this.validate();
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.applyAutocomplete();
      }
    });

    inputRow.appendChild(this.input);

    const actions = document.createElement('div');
    actions.className = 'ce-file-editor-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'ce-file-editor-btn ce-file-editor-confirm';
    confirmBtn.textContent = '✓';
    confirmBtn.title = 'Confirm';
    confirmBtn.addEventListener('click', () => this.confirm());

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ce-file-editor-btn ce-file-editor-cancel';
    cancelBtn.textContent = '✕';
    cancelBtn.title = 'Cancel';
    cancelBtn.addEventListener('click', () => this.cancel());

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
    inputRow.appendChild(actions);

    this.element.appendChild(inputRow);

    this.autocompleteList = document.createElement('div');
    this.autocompleteList.className = 'ce-file-editor-autocomplete hidden';
    this.element.appendChild(this.autocompleteList);

    this.container.appendChild(this.element);
    this.input.focus();
    this.input.select();

    this.validate();
  }

  handleAutocomplete() {
    const value = this.input.value;
    const parts = value.split('/');
    const currentPart = parts[parts.length - 1];

    if (!currentPart || this.options.autocomplete.length === 0) {
      this.hideAutocomplete();
      return;
    }

    const matches = this.options.autocomplete.filter(item =>
      item.toLowerCase().startsWith(currentPart.toLowerCase())
    );

    if (matches.length === 0) {
      this.hideAutocomplete();
      return;
    }

    this.showAutocomplete(matches);
  }

  showAutocomplete(matches) {
    this.autocompleteList.innerHTML = '';
    this.autocompleteList.classList.remove('hidden');

    for (const match of matches.slice(0, 5)) {
      const item = document.createElement('div');
      item.className = 'ce-file-editor-autocomplete-item';
      item.textContent = match;
      item.addEventListener('click', () => {
        this.applyAutocompleteMatch(match);
      });
      this.autocompleteList.appendChild(item);
    }
  }

  hideAutocomplete() {
    this.autocompleteList.classList.add('hidden');
    this.autocompleteList.innerHTML = '';
  }

  applyAutocomplete() {
    const items = this.autocompleteList.querySelectorAll('.ce-file-editor-autocomplete-item');
    if (items.length > 0) {
      this.applyAutocompleteMatch(items[0].textContent);
    }
  }

  applyAutocompleteMatch(match) {
    const parts = this.input.value.split('/');
    parts[parts.length - 1] = match;
    this.input.value = parts.join('/');
    this.currentValue = this.input.value;
    this.hideAutocomplete();
    this.validate();
  }

  validate() {
    const value = this.input.value.trim();
    let isValid = true;

    if (value.length === 0) {
      isValid = false;
    }

    if (this.options.validate) {
      isValid = this.options.validate(value);
    }

    this.input.classList.toggle('ce-file-editor-input-invalid', !isValid);
    return isValid;
  }

  confirm() {
    const value = this.input.value.trim();
    if (!value) return;

    if (this.options.validate && !this.options.validate(value)) return;

    this.hideAutocomplete();

    if (this.options.onConfirm) {
      this.options.onConfirm(value);
    }
  }

  cancel() {
    this.hideAutocomplete();

    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }

  getValue() {
    return this.currentValue;
  }

  setValue(value) {
    if (this.input) {
      this.input.value = value;
      this.currentValue = value;
    }
  }

  focus() {
    if (this.input) {
      this.input.focus();
      this.input.select();
    }
  }

  destroy() {
    this.hideAutocomplete();
    this.element = null;
    this.input = null;
    this.autocompleteList = null;
    this.container.innerHTML = '';
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FileEditor };
}
