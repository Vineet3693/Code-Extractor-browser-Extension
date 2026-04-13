class Modal {
  constructor(options = {}) {
    this.options = {
      title: options.title || '',
      message: options.message || '',
      content: options.content || null,
      buttons: options.buttons || [{ text: 'OK', primary: true }],
      closable: options.closable !== false,
      width: options.width || '400px',
      onClose: options.onClose || null
    };
    this.element = null;
    this.overlay = null;
    this.isOpen = false;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    this.overlay = document.createElement('div');
    this.overlay.className = 'ce-modal-overlay';

    this.element = document.createElement('div');
    this.element.className = 'ce-modal';
    this.element.style.maxWidth = this.options.width;

    const header = document.createElement('div');
    header.className = 'ce-modal-header';

    const title = document.createElement('h3');
    title.className = 'ce-modal-title';
    title.textContent = this.options.title;
    header.appendChild(title);

    if (this.options.closable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'ce-modal-close';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', () => this.close());
      header.appendChild(closeBtn);
    }

    this.element.appendChild(header);

    const body = document.createElement('div');
    body.className = 'ce-modal-body';

    if (this.options.content) {
      if (typeof this.options.content === 'string') {
        body.innerHTML = this.options.content;
      } else if (this.options.content instanceof Node) {
        body.appendChild(this.options.content);
      }
    } else if (this.options.message) {
      const msg = document.createElement('p');
      msg.textContent = this.options.message;
      body.appendChild(msg);
    }

    this.element.appendChild(body);

    if (this.options.buttons && this.options.buttons.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'ce-modal-footer';

      for (const btn of this.options.buttons) {
        const button = document.createElement('button');
        button.className = 'ce-modal-btn';
        if (btn.primary) button.classList.add('ce-modal-btn-primary');
        if (btn.danger) button.classList.add('ce-modal-btn-danger');
        button.textContent = btn.text;
        button.addEventListener('click', () => {
          if (btn.action) btn.action();
          if (btn.close !== false) this.close();
        });
        footer.appendChild(button);
      }

      this.element.appendChild(footer);
    }

    this.overlay.appendChild(this.element);
    document.body.appendChild(this.overlay);

    if (this.options.closable) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }

    document.addEventListener('keydown', this._handleKeydown);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    document.removeEventListener('keydown', this._handleKeydown);

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  _handleKeydown = (e) => {
    if (e.key === 'Escape' && this.options.closable) {
      this.close();
    }
  };

  setTitle(title) {
    if (this.element) {
      const titleEl = this.element.querySelector('.ce-modal-title');
      if (titleEl) titleEl.textContent = title;
    }
  }

  setMessage(message) {
    if (this.element) {
      const body = this.element.querySelector('.ce-modal-body');
      if (body) body.innerHTML = `<p>${message}</p>`;
    }
  }

  setContent(content) {
    if (this.element) {
      const body = this.element.querySelector('.ce-modal-body');
      if (body) {
        body.innerHTML = '';
        if (typeof content === 'string') {
          body.innerHTML = content;
        } else if (content instanceof Node) {
          body.appendChild(content);
        }
      }
    }
  }

  static confirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        message,
        closable: true,
        buttons: [
          {
            text: options.cancelText || 'Cancel',
            action: () => resolve(false)
          },
          {
            text: options.confirmText || 'Confirm',
            primary: true,
            action: () => resolve(true)
          }
        ],
        ...options
      });
      modal.open();
    });
  }

  static alert(title, message, options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        message,
        closable: true,
        buttons: [
          {
            text: options.buttonText || 'OK',
            primary: true,
            action: () => resolve()
          }
        ],
        ...options
      });
      modal.open();
    });
  }

  static prompt(title, message, options = {}) {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        message,
        closable: true,
        width: options.width || '450px',
        buttons: [
          {
            text: 'Cancel',
            action: () => resolve(null)
          },
          {
            text: options.confirmText || 'OK',
            primary: true,
            action: () => {
              const input = document.querySelector('.ce-modal-prompt-input');
              resolve(input ? input.value : null);
            }
          }
        ],
        content: `<input type="text" class="ce-modal-prompt-input" value="${options.defaultValue || ''}" placeholder="${options.placeholder || ''}" />`,
        ...options
      });
      modal.open();

      setTimeout(() => {
        const input = document.querySelector('.ce-modal-prompt-input');
        if (input) {
          input.focus();
          input.select();
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              resolve(input.value);
              modal.close();
            } else if (e.key === 'Escape') {
              resolve(null);
              modal.close();
            }
          });
        }
      }, 50);
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Modal };
}
