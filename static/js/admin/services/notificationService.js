import { NOTIFICATION_TYPES, CONFIG } from '../config/constants.js';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.container = null;
    this.init();
  }

  init() {
    // Создаем контейнер для уведомлений если его нет
    this.container = document.getElementById('notifications-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notifications-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  show(message, type = NOTIFICATION_TYPES.SUCCESS) {
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

    // Создаем новый элемент уведомления
    const notification = document.createElement('div');
    notification.className = 'dynamic-notification';
    notification.innerHTML = `
      <i class="fas fa-${iconMap[type]}"></i> ${message}
    `;

    // Применяем стили
    notification.style.cssText = `
      background: ${colorMap[type]};
      color: white;
      padding: 12px 20px;
      margin-bottom: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
      pointer-events: auto;
      transform: translateX(100%);
      transition: transform 0.3s ease, opacity 0.3s ease;
      opacity: 0;
    `;

    // Добавляем в контейнер
    this.container.appendChild(notification);
    this.notifications.push(notification);

    // Анимация появления
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 10);

    // Автоматическое скрытие
    setTimeout(() => {
      this.hideNotification(notification);
    }, CONFIG.UI.NOTIFICATION_DURATION || 3000);
  }

  hideNotification(notification) {
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
    }, 300);
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

  // Метод для скрытия всех уведомлений
  clearAll() {
    this.notifications.forEach(notification => {
      this.hideNotification(notification);
    });
  }
}

export const notificationService = new NotificationService();