class SearchBar {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.options = {
      placeholder: options.placeholder || 'Search...',
      debounceMs: options.debounceMs || 300,
      onSearch: options.onSearch || null,
      onClear: options.onClear || null,
      minLength: options.minLength || 1
    };
    this.element = null;
    this.input = null;
    this.clearBtn = null;
    this.debounceTimer = null;
    this.currentQuery = '';
  }

  render() {
    this.container.innerHTML = '';

    this.element = document.createElement('div');
    this.element.className = 'ce-search-bar';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'ce-search-bar-icon';
    searchIcon.textContent = '🔍';
    this.element.appendChild(searchIcon);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'ce-search-bar-input';
    this.input.placeholder = this.options.placeholder;
    this.input.addEventListener('input', () => this.handleInput());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clear();
      }
    });
    this.element.appendChild(this.input);

    this.clearBtn = document.createElement('button');
    this.clearBtn.className = 'ce-search-bar-clear hidden';
    this.clearBtn.textContent = '✕';
    this.clearBtn.addEventListener('click', () => this.clear());
    this.element.appendChild(this.clearBtn);

    this.container.appendChild(this.element);
  }

  handleInput() {
    const query = this.input.value.trim();

    this.clearBtn.classList.toggle('hidden', query.length === 0);

    if (query.length < this.options.minLength) {
      if (this.currentQuery !== '') {
        this.currentQuery = '';
        if (this.options.onClear) this.options.onClear();
      }
      return;
    }

    if (query === this.currentQuery) return;

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.currentQuery = query;
      if (this.options.onSearch) {
        this.options.onSearch(query);
      }
    }, this.options.debounceMs);
  }

  clear() {
    this.input.value = '';
    this.currentQuery = '';
    this.clearBtn.classList.add('hidden');

    if (this.options.onClear) {
      this.options.onClear();
    }
  }

  getValue() {
    return this.input.value.trim();
  }

  setValue(value) {
    this.input.value = value;
    this.currentQuery = value.trim();
    this.clearBtn.classList.toggle('hidden', value.trim().length === 0);
  }

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  setPlaceholder(placeholder) {
    if (this.input) {
      this.input.placeholder = placeholder;
    }
  }

  destroy() {
    clearTimeout(this.debounceTimer);
    this.element = null;
    this.input = null;
    this.clearBtn = null;
    this.container.innerHTML = '';
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SearchBar };
}
