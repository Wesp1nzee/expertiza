// controllers/AdminDashboardController.js
import { apiService } from '../services/apiService.js';
import { notificationService } from '../services/notificationService.js';
import { submissionStore } from '../stores/submissionStore.js';
import { SubmissionTable } from '../components/SubmissionTable.js';
import { Pagination } from '../components/Pagination.js';
import { SubmissionModal } from '../components/SubmissionModal.js';
import { AddClientModal } from '../components/AddClientModal.js';
import { SearchBox } from '../components/SearchBox.js';
import { StatsPanel } from '../components/StatsPanel.js';
import { EventBus } from '../utils/eventBus.js';
import { CONFIG } from '../config/constants.js';

export class AdminDashboardController {
  constructor() {
    this.isInitialized = false;
    this.components = {};
    
    this.init();
  }

  async init() {
    try {
      this.initializeComponents();
      this.bindEvents();
      await this.loadInitialData();
      this.isInitialized = true;
      
      console.log('Admin Dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Admin Dashboard:', error);
      notificationService.error('Ошибка инициализации панели администратора');
    }
  }

  initializeComponents() {
    try {
      // Инициализация всех компонентов
      this.components.table = new SubmissionTable('submissionsTable');
      this.components.pagination = new Pagination();
      this.components.modal = new SubmissionModal();
      this.components.addClientModal = new AddClientModal();
      this.components.searchBox = new SearchBox();
      this.components.statsPanel = new StatsPanel();

      console.log('All components initialized');
    } catch (error) {
      console.error('Error initializing components:', error);
      throw new Error('Component initialization failed');
    }
  }

  bindEvents() {
    // События от store
    submissionStore.on('submissions:updated', this.handleSubmissionsUpdate.bind(this));
    submissionStore.on('pagination:updated', this.handlePaginationUpdate.bind(this));
    submissionStore.on('loading:changed', this.handleLoadingChange.bind(this));
    submissionStore.on('submission:added', this.handleSubmissionAdded.bind(this));
    submissionStore.on('submission:updated', this.handleSubmissionUpdated.bind(this));
    submissionStore.on('submissions:filtered', this.handleSubmissionsFiltered.bind(this));

    // События от компонентов
    EventBus.on('pagination:prev', this.handlePageChange.bind(this));
    EventBus.on('pagination:next', this.handlePageChange.bind(this));
    EventBus.on('submission:view', this.handleSubmissionView.bind(this));
    EventBus.on('submission:status-change', this.handleStatusChange.bind(this));
    EventBus.on('search:query', this.handleSearch.bind(this));
    EventBus.on('client:save', this.handleClientSave.bind(this));

    // События от API
    EventBus.on('api:error', this.handleApiError.bind(this));
  }

  async loadInitialData() {
    await this.loadData(CONFIG.PAGINATION.DEFAULT_PAGE);
  }

  async loadData(page) {
    try {
      submissionStore.setLoading(true);
      this.components.table.renderLoading();

      const result = await apiService.fetchSubmissions(page, CONFIG.PAGINATION.PAGE_SIZE);
      
      if (result) {
        submissionStore.updateState(result);
        submissionStore.setCurrentPage(page);
      } else {
        throw new Error('No data received');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.components.table.renderError();
      notificationService.error('Ошибка загрузки данных');
    }
  }

  // Обработчики событий store
  handleSubmissionsUpdate(submissions) {
    this.components.table.render(submissions);
  }

  handlePaginationUpdate(pagination) {
    this.components.pagination.update(pagination);
    this.components.statsPanel.updateFromPagination(pagination);
  }

  handleLoadingChange(loading) {
    if (loading) {
      this.components.table.renderLoading();
    }
  }

  handleSubmissionAdded(submission) {
    this.components.table.addRow(submission);
    this.components.statsPanel.incrementTotal();
    this.components.statsPanel.incrementToday();
  }

  handleSubmissionUpdated(submission) {
    this.components.table.updateRow(submission);
    this.components.modal.updateSubmission(submission);
  }

  handleSubmissionsFiltered(submissions) {
    this.components.table.render(submissions);
    this.components.pagination.showSearchResult(submissions.length);
  }

  // Обработчики событий компонентов
  async handlePageChange(page) {
    if (submissionStore.getFilters().search) {
      // Если активен поиск, сбрасываем его при смене страницы
      this.components.searchBox.clear();
      submissionStore.resetFilters();
    }
    
    await this.loadData(page);
  }

  handleSubmissionView(submissionId) {
    const submission = submissionStore.findSubmissionById(submissionId);
    if (submission) {
      this.components.modal.open(submission);
    }
  }

  async handleStatusChange({ submissionId, newStatus, originalStatus }) {
    try {
      const success = await apiService.updateSubmissionStatus(submissionId, newStatus);
      
      if (success) {
        submissionStore.updateSubmissionStatus(submissionId, newStatus);
        notificationService.success('Статус успешно обновлен!');
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      
      // Возвращаем оригинальный статус в модальном окне
      const submission = submissionStore.findSubmissionById(submissionId);
      if (submission) {
        submission.status = originalStatus;
        this.components.modal.updateSubmission(submission);
      }
      
      notificationService.error('Ошибка обновления статуса');
    }
  }

  handleSearch({ term, immediate, isEmpty }) {
    if (isEmpty) {
      // Если поиск пустой, загружаем первую страницу
      this.loadData(CONFIG.PAGINATION.DEFAULT_PAGE);
    } else {
      // Применяем клиентскую фильтрацию
      submissionStore.applySearchFilter(term);
    }
  }

  async handleClientSave(clientData) {
    try {
      const response = await apiService.addSubmission(clientData);
      
      if (response && response.submission_id) {
        // Создаем объект новой заявки
        const newSubmission = {
          submission_id: response.submission_id,
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
          message: clientData.message,
          status: 'new',
          created_at: new Date().toISOString()
        };

        submissionStore.addSubmission(newSubmission);
        this.components.addClientModal.onSaveSuccess();
      }
    } catch (error) {
      console.error('Error saving client:', error);
      this.components.addClientModal.onSaveError(error);
    }
  }

  handleApiError({ endpoint, error }) {
    console.error(`API Error on ${endpoint}:`, error);
    
    // Можно добавить специфичную обработку для разных endpoints
    switch (endpoint) {
      case CONFIG.API.ENDPOINTS.SUBMISSIONS:
        this.components.table.renderError();
        break;
      default:
        notificationService.error('Произошла ошибка при обращении к серверу');
    }
  }

  // Публичные методы для внешнего управления
  async refresh() {
    await this.loadData(submissionStore.getCurrentPage());
  }

  async goToPage(page) {
    await this.loadData(page);
  }

  openAddClientModal() {
    this.components.addClientModal.open();
  }

  clearSearch() {
    this.components.searchBox.clear();
  }

  getSubmissions() {
    return submissionStore.getSubmissions();
  }

  getStats() {
    return this.components.statsPanel.getStats();
  }

  // Методы жизненного цикла
  destroy() {
    // Очистка всех компонентов и подписок
    Object.values(this.components).forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });

    // Очистка store
    submissionStore.clear();

    // Очистка всех обработчиков событий
    EventBus.events = {};

    console.log('Admin Dashboard destroyed');
  }

  isReady() {
    return this.isInitialized;
  }
}