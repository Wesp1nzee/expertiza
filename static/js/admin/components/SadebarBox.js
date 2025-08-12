import { EventBus } from '../utils/eventBus.js';

export class SidebarBox {
  constructor() {
    this.init();
    this.bindEvents();
  }

  init() {
    EventBus.on('some:event', this.handleEvent.bind(this));
  }

  handleEvent(data) {
    // Обработка других событий
  }

  bindEvents() {
    const logoutBtn = document.querySelector('.logout-item');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', this.handleLogout.bind(this));
    }
  }

  handleLogout(e) {
    e.preventDefault();
    EventBus.emit('user:logout'); // Отправляем событие выхода
  }
}