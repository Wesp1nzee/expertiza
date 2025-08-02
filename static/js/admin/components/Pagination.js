// components/Pagination.js
import { EventBus } from '../utils/eventBus.js';

export class Pagination {
  constructor() {
    this.paginationInfo = document.getElementById('paginationInfo');
    this.prevBtn = document.getElementById('prevPageBtn');
    this.nextBtn = document.getElementById('nextPageBtn');
    this.currentPagination = null;

    if (!this.paginationInfo || !this.prevBtn || !this.nextBtn) {
      throw new Error('Pagination elements not found');
    }

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    this.prevBtn.addEventListener('click', this.handlePrevClick.bind(this));
    this.nextBtn.addEventListener('click', this.handleNextClick.bind(this));
  }

  handlePrevClick() {
    if (this.currentPagination && this.currentPagination.has_prev) {
      EventBus.emit('pagination:prev', this.currentPagination.page - 1);
    }
  }

  handleNextClick() {
    if (this.currentPagination && this.currentPagination.has_next) {
      EventBus.emit('pagination:next', this.currentPagination.page + 1);
    }
  }

  update(paginationData) {
    this.currentPagination = paginationData;

    if (!paginationData) {
      this.hide();
      return;
    }

    this.show();
    this.updateInfo(paginationData);
    this.updateControls(paginationData);
  }

  updateInfo(data) {
    if (!this.paginationInfo) return;

    this.paginationInfo.textContent = 
      `Страница ${data.page} из ${data.total_pages}`;
  }

  updateControls(data) {
    if (!this.prevBtn || !this.nextBtn) return;

    // Обновляем состояние кнопок
    this.prevBtn.classList.toggle('disabled', !data.has_prev);
    this.nextBtn.classList.toggle('disabled', !data.has_next);

    // Устанавливаем атрибуты доступности
    this.prevBtn.disabled = !data.has_prev;
    this.nextBtn.disabled = !data.has_next;
  }

  showSearchResult(count) {
    if (!this.paginationInfo) return;

    this.paginationInfo.textContent = count > 0 
      ? `Найдено: ${count}` 
      : 'Ничего не найдено';

    // Отключаем кнопки при поиске
    this.prevBtn.classList.add('disabled');
    this.nextBtn.classList.add('disabled');
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
  }

  hide() {
    if (this.paginationInfo) {
      this.paginationInfo.textContent = '';
    }
    
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.classList.add('disabled');
      this.nextBtn.classList.add('disabled');
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
    }
  }

  show() {
    // Метод для показа пагинации, если она была скрыта
    // TODO
  }

  reset() {
    this.currentPagination = null;
    this.hide();
  }

  destroy() {
    if (this.prevBtn) {
      this.prevBtn.removeEventListener('click', this.handlePrevClick);
    }
    if (this.nextBtn) {
      this.nextBtn.removeEventListener('click', this.handleNextClick);
    }
  }
}