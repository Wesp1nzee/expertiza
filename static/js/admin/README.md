## Структура файлов

```
admin-dashboard/
├── app.js                                 # Главный файл приложения
├── config/
│   └── constants.js                       # Конфигурация и константы
├── services/
│   ├── apiService.js                      # Сервис для работы с API
│   └── notificationService.js             # Сервис уведомлений
├── stores/
│   └── submissionStore.js                 # Хранилище состояния заявок
├── components/
│   ├── SubmissionTable.js                 # Компонент таблицы заявок
│   ├── Pagination.js                      # Компонент пагинации
│   ├── SubmissionModal.js                 # Модальное окно просмотра заявки
│   ├── AddClientModal.js                  # Модальное окно добавления клиента
│   ├── SearchBox.js                       # Компонент поиска
│   └── StatsPanel.js                      # Панель статистики
├── controllers/
│   └── AdminDashboardController.js        # Главный контроллер
├── utils/
│   ├── eventBus.js                        # Шина событий
│   └── index.js                           # Утилиты и хелперы
└── README.md                              # Документация
```

## Использование

### Инициализация
```javascript
// Автоматическая инициализация
// Приложение запускается при загрузке DOM

// Ручная инициализация
import app from './app.js';
await app.init();
```

### Доступ к компонентам
```javascript
// Через глобальный объект
const dashboard = window.AdminDashboard.getDashboard();

// Обновление данных
await dashboard.refresh();

// Переход на страницу
await dashboard.goToPage(2);
```

### Подписка на события
```javascript
import { EventBus } from './utils/eventBus.js';

EventBus.on('submission:added', (submission) => {
  console.log('Новая заявка:', submission);
});
```

## Примеры Использования

### Добавление нового компонента
```javascript
// components/NewComponent.js
export class NewComponent {
  constructor() {
    this.init();
  }
  
  init() {
    EventBus.on('some:event', this.handleEvent.bind(this));
  }
  
  handleEvent(data) {
    // Обработка события
  }
}
```

### Добавление нового API метода
```javascript
// services/apiService.js
async getSubmissionStats() {
  return await this.request('/admin/stats', { method: 'GET' });
}
```

### Расширение store
```javascript
// stores/submissionStore.js
setStats(stats) {
  this.state.stats = stats;
  this.emit('stats:updated', stats);
}
```