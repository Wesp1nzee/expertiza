// components/SearchBox.js
import { debounce } from '../utils/index.js';
import { CONFIG } from '../config/constants.js';
import { EventBus } from '../utils/eventBus.js';

export class SearchBox {
  constructor(selector = '.search-box') {
    this.searchInput = document.querySelector(selector);
    this.currentValue = '';
    
    if (!this.searchInput) {
      console.warn('Search box element not found');
      return;
    }

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Дебаунсированный обработчик ввода
    this.debouncedSearch = debounce(this.handleSearch.bind(this), CONFIG.UI.SEARCH_DELAY);
    
    this.searchInput.addEventListener('input', this.handleInput.bind(this));
    this.searchInput.addEventListener('keydown', this.handleKeydown.bind(this));
    this.searchInput.addEventListener('focus', this.handleFocus.bind(this));
    this.searchInput.addEventListener('blur', this.handleBlur.bind(this));
  }

  handleInput(event) {
    const value = event.target.value;
    this.currentValue = value;
    this.debouncedSearch(value);
  }

  handleKeydown(event) {
    // Обработка специальных клавиш
    switch (event.key) {
      case 'Escape':
        this.clear();
        this.searchInput.blur();
        break;
      case 'Enter':
        event.preventDefault();
        this.handleSearch(this.currentValue, true); // Немедленный поиск
        break;
    }
  }

  handleFocus() {
    this.searchInput.classList.add('focused');
    EventBus.emit('search:focus');
  }

  handleBlur() {
    this.searchInput.classList.remove('focused');
    EventBus.emit('search:blur');
  }

  handleSearch(searchTerm, immediate = false) {
    const trimmedTerm = searchTerm.trim();
    
    // Эмитируем событие поиска
    EventBus.emit('search:query', {
      term: trimmedTerm,
      immediate: immediate,
      isEmpty: trimmedTerm === ''
    });
  }

  clear() {
    this.searchInput.value = '';
    this.currentValue = '';
    this.handleSearch('', true);
    EventBus.emit('search:cleared');
  }

  setValue(value) {
    this.searchInput.value = value;
    this.currentValue = value;
  }

  getValue() {
    return this.currentValue;
  }

  focus() {
    if (this.searchInput) {
      this.searchInput.focus();
    }
  }

  disable() {
    if (this.searchInput) {
      this.searchInput.disabled = true;
      this.searchInput.classList.add('disabled');
    }
  }

  enable() {
    if (this.searchInput) {
      this.searchInput.disabled = false;
      this.searchInput.classList.remove('disabled');
    }
  }

  setPlaceholder(text) {
    if (this.searchInput) {
      this.searchInput.placeholder = text;
    }
  }

  showSuggestions(suggestions) {
    EventBus.emit('search:suggestions', suggestions);
  }

  hideSuggestions() {
    EventBus.emit('search:suggestions-hide');
  }

  destroy() {
    if (this.searchInput) {
      this.searchInput.removeEventListener('input', this.handleInput);
      this.searchInput.removeEventListener('keydown', this.handleKeydown);
      this.searchInput.removeEventListener('focus', this.handleFocus);
      this.searchInput.removeEventListener('blur', this.handleBlur);
    }
  }
}