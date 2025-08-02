/**
 * Утилиты для работы с буфером обмена
 */
export class ClipboardUtils {
  static async copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.error('Failed to copy: ', err);
        return this.fallbackCopy(text);
      }
    } else {
      return this.fallbackCopy(text);
    }
  }

  static fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      console.error('Fallback: Failed to copy', err);
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Утилиты для работы с датами
 */
export class DateUtils {
  static formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Утилиты для работы с пользователями
 */
export class UserUtils {
  static generateInitials(name) {
    return name.split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  static formatPhone(phone) {
    return phone || 'не указан';
  }
}

/**
 * Утилиты для работы с UUID
 */
export class UuidUtils {
  static generate() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static shorten(uuid) {
    return uuid.substring(0, 8) + '...';
  }
}

/**
 * Утилиты для валидации
 */
export class ValidationUtils {
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isRequired(value) {
    return value && value.trim().length > 0;
  }
}

/**
 * Утилиты для работы с DOM
 */
export class DomUtils {
  static createElement(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.innerHTML = content;
    return element;
  }

  static removeAllChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
}

/**
 * Дебаунс функция
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}