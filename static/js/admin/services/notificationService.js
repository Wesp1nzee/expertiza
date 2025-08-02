import { NOTIFICATION_TYPES, CONFIG } from '../config/constants.js';

class NotificationService {
  constructor() {
    this.notificationElement = null;
    this.init();
  }

  init() {
    this.notificationElement = document.getElementById('copiedNotification');
    if (!this.notificationElement) {
      console.warn('Notification element not found');
    }
  }

  show(message, type = NOTIFICATION_TYPES.SUCCESS) {
    if (!this.notificationElement) {
      console.error('Notification element not available');
      return;
    }

    const iconMap = {
      [NOTIFICATION_TYPES.ERROR]: 'exclamation-circle',
      [NOTIFICATION_TYPES.SUCCESS]: 'check-circle',
      [NOTIFICATION_TYPES.INFO]: 'info-circle',
      [NOTIFICATION_TYPES.WARNING]: 'exclamation-triangle'
    };

    const colorMap = {
      [NOTIFICATION_TYPES.ERROR]: '#f44336',
      [NOTIFICATION_TYPES.SUCCESS]: '#4CAF50',
      [NOTIFICATION_TYPES.INFO]: '#2196F3',
      [NOTIFICATION_TYPES.WARNING]: '#ff9800'
    };

    // Обновляем содержимое
    this.notificationElement.innerHTML = `
      <i class="fas fa-${iconMap[type]}"></i> ${message}
    `;

    // Устанавливаем цвет
    this.notificationElement.style.backgroundColor = colorMap[type];
    this.notificationElement.style.opacity = 0;

    // Перезапуск анимации
    this.notificationElement.style.animation = 'none';
    setTimeout(() => {
      this.notificationElement.style.animation = `fadeInOut ${CONFIG.UI.NOTIFICATION_DURATION}ms ease`;
    }, 10);
  }

  success(message) {
    this.show(message, NOTIFICATION_TYPES.SUCCESS);
  }

  error(message) {
    this.show(message, NOTIFICATION_TYPES.ERROR);
  }

  info(message) {
    this.show(message, NOTIFICATION_TYPES.INFO);
  }

  warning(message) {
    this.show(message, NOTIFICATION_TYPES.WARNING);
  }
}

export const notificationService = new NotificationService();