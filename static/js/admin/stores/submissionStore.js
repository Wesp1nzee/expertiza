import { EventBus } from '../utils/eventBus.js';
import { CONFIG } from '../config/constants.js';

class SubmissionStore {
  constructor() {
    this.state = {
      submissions: [],
      pagination: null,
      currentPage: CONFIG.PAGINATION.DEFAULT_PAGE,
      loading: false,
      filters: {
        search: ''
      }
    };
    this.originalData = []; // Для клиентской фильтрации
  }

  // Геттеры
  getSubmissions() {
    return this.state.submissions;
  }

  getPagination() {
    return this.state.pagination;
  }

  getCurrentPage() {
    return this.state.currentPage;
  }

  isLoading() {
    return this.state.loading;
  }

  getFilters() {
    return this.state.filters;
  }

  // Сеттеры с уведомлением об изменениях
  setSubmissions(submissions) {
    this.state.submissions = submissions;
    this.originalData = [...submissions]; // Сохраняем оригинальные данные
    this.emit('submissions:updated', submissions);
  }

  setPagination(pagination) {
    this.state.pagination = pagination;
    this.emit('pagination:updated', pagination);
  }

  setCurrentPage(page) {
    this.state.currentPage = page;
    this.emit('page:changed', page);
  }

  setLoading(loading) {
    this.state.loading = loading;
    this.emit('loading:changed', loading);
  }

  setSearchFilter(search) {
    this.state.filters.search = search;
    this.emit('filters:changed', this.state.filters);
  }

  // Методы для работы с заявками
  addSubmission(submission) {
    this.state.submissions.unshift(submission);
    this.originalData.unshift(submission);
    this.emit('submission:added', submission);
    this.emit('submissions:updated', this.state.submissions);
  }

  updateSubmissionStatus(submissionId, newStatus) {
    const index = this.state.submissions.findIndex(s => s.submission_id === submissionId);
    if (index !== -1) {
      this.state.submissions[index].status = newStatus;
      
      // Обновляем также в оригинальных данных
      const originalIndex = this.originalData.findIndex(s => s.submission_id === submissionId);
      if (originalIndex !== -1) {
        this.originalData[originalIndex].status = newStatus;
      }
      
      this.emit('submission:updated', this.state.submissions[index]);
      this.emit('submissions:updated', this.state.submissions);
    }
  }

  findSubmissionById(submissionId) {
    return this.state.submissions.find(s => s.submission_id === submissionId);
  }

  // Клиентская фильтрация
  applySearchFilter(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      this.state.submissions = [...this.originalData];
    } else {
      const filtered = this.originalData.filter(submission => 
        submission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.submission_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
      this.state.submissions = filtered;
    }
    
    this.setSearchFilter(searchTerm);
    this.emit('submissions:filtered', this.state.submissions);
  }

  // Сброс фильтров
  resetFilters() {
    this.state.filters = { search: '' };
    this.state.submissions = [...this.originalData];
    this.emit('filters:reset');
    this.emit('submissions:updated', this.state.submissions);
  }

  // Обновление полного состояния
  updateState(data) {
    this.setSubmissions(data.data || []);
    this.setPagination(data);
    this.setLoading(false);
  }

  // Очистка состояния
  clear() {
    this.state = {
      submissions: [],
      pagination: null,
      currentPage: CONFIG.PAGINATION.DEFAULT_PAGE,
      loading: false,
      filters: { search: '' }
    };
    this.originalData = [];
    this.emit('store:cleared');
  }

  // Эмиттер событий
  emit(event, data) {
    EventBus.emit(event, data);
  }

  // Подписка на события
  on(event, callback) {
    EventBus.on(event, callback);
  }

  // Отписка от событий
  off(event, callback) {
    EventBus.off(event, callback);
  }
}

export const submissionStore = new SubmissionStore();