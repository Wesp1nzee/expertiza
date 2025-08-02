// app.js - Главный файл приложения
import { AdminDashboardController } from './controllers/AdminDashboardController.js';

class App {
  constructor() {
    this.dashboard = null;
    this.isReady = false;
  }

  async init() {
    try {
      console.log('Initializing Admin Dashboard Application...');
      
      // Проверяем готовность DOM
      if (document.readyState === 'loading') {
        await this.waitForDOMReady();
      }

      // Инициализируем главный контроллер
      this.dashboard = new AdminDashboardController();
      
      // Ждем полной инициализации
      await this.waitForDashboardReady();
      
      this.isReady = true;
      console.log('Application ready!');
      
      // Уведомляем о готовности приложения
      window.dispatchEvent(new CustomEvent('app:ready', {
        detail: { dashboard: this.dashboard }
      }));

    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.handleInitError(error);
    }
  }

  waitForDOMReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  async waitForDashboardReady() {
    // Ждем пока dashboard будет готов
    const maxAttempts = 50; // 5 секунд максимум
    let attempts = 0;

    while (!this.dashboard.isReady() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.dashboard.isReady()) {
      throw new Error('Dashboard initialization timeout');
    }
  }

  handleInitError(error) {
    // Показываем пользователю сообщение об ошибке
    const errorContainer = document.createElement('div');
    errorContainer.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f44336;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        text-align: center;
        max-width: 400px;
      ">
        <h3 style="margin: 0 0 10px 0;">Ошибка инициализации</h3>
        <p style="margin: 0 0 15px 0;">Не удалось загрузить панель администратора</p>
        <button onclick="window.location.reload()" style="
          background: white;
          color: #f44336;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">
          Обновить страницу
        </button>
      </div>
    `;
    
    document.body.appendChild(errorContainer);
  }

  // Публичные методы для внешнего API
  getDashboard() {
    return this.dashboard;
  }

  async reload() {
    if (this.dashboard) {
      await this.dashboard.refresh();
    }
  }

  destroy() {
    if (this.dashboard) {
      this.dashboard.destroy();
    }
    this.isReady = false;
  }
}

// Создаем экземпляр приложения
const app = new App();

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Экспортируем для внешнего использования
window.AdminDashboard = app;

// Экспорт для модульной системы
export default app;