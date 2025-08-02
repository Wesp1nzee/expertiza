// components/StatsPanel.js
export class StatsPanel {
  constructor() {
    this.elements = {
      total: document.querySelector('.stat-card:first-child h2'),
      today: document.querySelector('.stat-card:nth-child(3) h2'),
      // Можно добавить другие статистические элементы
    };

    this.stats = {
      total: 0,
      today: 0,
      week: 0,
      month: 0
    };

    this.init();
  }

  init() {
    this.loadInitialStats();
  }

  loadInitialStats() {
    // Загружаем начальные значения из DOM если они есть
    if (this.elements.total) {
      this.stats.total = parseInt(this.elements.total.textContent) || 0;
    }
    
    if (this.elements.today) {
      this.stats.today = parseInt(this.elements.today.textContent) || 0;
    }
  }

  updateTotal(count) {
    this.stats.total = count;
    if (this.elements.total) {
      this.elements.total.textContent = this.formatNumber(count);
    }
  }

  updateToday(count) {
    this.stats.today = count;
    if (this.elements.today) {
      this.elements.today.textContent = this.formatNumber(count);
    }
  }

  incrementTotal(increment = 1) {
    this.updateTotal(this.stats.total + increment);
  }

  incrementToday(increment = 1) {
    this.updateToday(this.stats.today + increment);
  }

  updateFromPagination(paginationData) {
    if (paginationData && paginationData.total_count !== undefined) {
      this.updateTotal(paginationData.total_count);
    }
  }

  updateStats(statsData) {
    // Обновление всех статистик одновременно
    if (statsData.total !== undefined) {
      this.updateTotal(statsData.total);
    }
    
    if (statsData.today !== undefined) {
      this.updateToday(statsData.today);
    }
    
    // Можно добавить обновление других метрик
    if (statsData.week !== undefined) {
      this.stats.week = statsData.week;
    }
    
    if (statsData.month !== undefined) {
      this.stats.month = statsData.month;
    }
  }

  formatNumber(number) {
    // Форматирование чисел для красивого отображения
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M';
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    return number.toString();
  }

  animateCounter(element, from, to, duration = 1000) {
    // Анимированный счетчик для красивого обновления цифр
    if (!element || from === to) return;

    const start = Date.now();
    const step = (to - from) / duration;

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      
      const current = Math.floor(from + (to - from) * progress);
      element.textContent = this.formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  animateUpdate(statType, newValue) {
    // Анимированное обновление конкретной статистики
    const element = this.elements[statType];
    if (!element) return;

    const currentValue = this.stats[statType];
    this.stats[statType] = newValue;
    
    this.animateCounter(element, currentValue, newValue);
  }

  showLoading(statType) {
    // Показать индикатор загрузки для конкретной статистики
    const element = this.elements[statType];
    if (element) {
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
  }

  hideLoading(statType, value) {
    // Скрыть индикатор загрузки и показать значение
    const element = this.elements[statType];
    if (element) {
      element.textContent = this.formatNumber(value);
    }
  }

  reset() {
    // Сброс всех статистик
    this.stats = {
      total: 0,
      today: 0,
      week: 0,
      month: 0
    };

    Object.keys(this.elements).forEach(key => {
      if (this.elements[key]) {
        this.elements[key].textContent = '0';
      }
    });
  }

  getStats() {
    return { ...this.stats };
  }
}