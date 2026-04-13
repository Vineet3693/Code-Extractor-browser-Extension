class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.systemTheme = this.getSystemTheme();
    this.listeners = [];
  }

  async init() {
    try {
      const result = await chrome.storage.sync.get('theme');
      this.currentTheme = result.theme || 'dark';
    } catch (e) {
      this.currentTheme = 'dark';
    }

    this.apply();
    this.watchSystemTheme();
  }

  apply() {
    let theme = this.currentTheme;

    if (theme === 'auto') {
      theme = this.systemTheme;
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    const root = document.documentElement;
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';

    this.notifyListeners(theme);
  }

  async setTheme(theme) {
    if (!['dark', 'light', 'auto'].includes(theme)) return;

    this.currentTheme = theme;

    try {
      await chrome.storage.sync.set({ theme });
    } catch (e) {
      console.error('[ThemeManager] Failed to save theme:', e);
    }

    this.apply();
  }

  getTheme() {
    return this.currentTheme;
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.systemTheme;
    }
    return this.currentTheme;
  }

  getSystemTheme() {
    if (typeof window === 'undefined') return 'dark';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  watchSystemTheme() {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');

    const handler = (e) => {
      this.systemTheme = e.matches ? 'light' : 'dark';
      if (this.currentTheme === 'auto') {
        this.apply();
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(theme) {
    for (const listener of this.listeners) {
      try {
        listener(theme);
      } catch (e) {
        console.error('[ThemeManager] Listener error:', e);
      }
    }
  }

  toggle() {
    const current = this.getEffectiveTheme();
    const newTheme = current === 'dark' ? 'light' : 'dark';
    return this.setTheme(newTheme);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ThemeManager };
}
