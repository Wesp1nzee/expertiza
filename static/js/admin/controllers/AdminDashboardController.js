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
    this.currentSort = { sortBy: null, order: null };

    this._logoutBtn = null;
    this._boundHandleLogout = this.handleLogout.bind(this);

    this.init();
  }

  async init() {
    try {
      this.initializeComponents();
      this.bindEvents();
      this.initSortHandlers();
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
      this.components.table = new SubmissionTable('submissionsTable');
      this.components.pagination = new Pagination();
      this.components.modal = new SubmissionModal();
      this.components.addClientModal = new AddClientModal();
      this.components.searchBox = new SearchBox();
      this.components.statsPanel = new StatsPanel();
      this.currentSort = { sortBy: null, order: null };

      console.log('All components initialized');
    } catch (error) {
      console.error('Error initializing components:', error);
      throw new Error('Component initialization failed');
    }
  }

  bindEvents() {
    submissionStore.on('submissions:updated', this.handleSubmissionsUpdate.bind(this));
    submissionStore.on('pagination:updated', this.handlePaginationUpdate.bind(this));
    submissionStore.on('loading:changed', this.handleLoadingChange.bind(this));
    submissionStore.on('submission:added', this.handleSubmissionAdded.bind(this));
    submissionStore.on('submission:updated', this.handleSubmissionUpdated.bind(this));
    submissionStore.on('submissions:filtered', this.handleSubmissionsFiltered.bind(this));

    EventBus.on('pagination:prev', this.handlePageChange.bind(this));
    EventBus.on('pagination:next', this.handlePageChange.bind(this));
    EventBus.on('submission:view', this.handleSubmissionView.bind(this));
    EventBus.on('submission:status-change', this.handleStatusChange.bind(this));
    EventBus.on('search:query', this.handleSearch.bind(this));
    EventBus.on('client:save', this.handleClientSave.bind(this));
    EventBus.on('table:sort', this.handleTableSort.bind(this));
    EventBus.on('api:error', this.handleApiError.bind(this));

    const logoutBtn = document.querySelector('.logout-item');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', this._boundHandleLogout);
      this._logoutBtn = logoutBtn;
    }
  }

  async loadInitialData() {
    await this.loadData(CONFIG.PAGINATION.DEFAULT_PAGE);
  }

  async loadData(page, sort = {}) {
    try {
      submissionStore.setLoading(true);
      this.components.table.renderLoading();

      const sortBy = (sort && typeof sort.sortBy !== 'undefined') ? sort.sortBy : this.currentSort.sortBy;
      const order  = (sort && typeof sort.order !== 'undefined') ? sort.order : this.currentSort.order;

      const result = await apiService.fetchSubmissions(page, CONFIG.PAGINATION.PAGE_SIZE, { sortBy, order });

      if (result) {
        submissionStore.updateState(result);
        submissionStore.setCurrentPage(page);
        this.currentSort = { sortBy: sortBy ?? null, order: order ?? null };
      } else {
        throw new Error('No data received');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.components.table.renderError();
      notificationService.error('Ошибка загрузки данных');
    } finally {
      submissionStore.setLoading(false);
    }
  }

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

  async handlePageChange(page) {
    if (submissionStore.getFilters().search) {
      this.components.searchBox.clear();
      submissionStore.resetFilters();
    }

    await this.loadData(page);
  }

  initSortHandlers() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.sort-btn')) {
        e.preventDefault();

        const button = e.target.closest('.sort-btn');
        const sortBy = button.dataset.sort;
        let order = button.dataset.order;

        order = order === 'asc' ? 'desc' : 'asc';

        this.updateSortIcons(button, order);

        button.dataset.order = order;

        this.handleTableSort({ sortBy, order });
      }
    });
  }

  updateSortIcons(activeButton, order) {
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.dataset.order = 'asc';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = 'fas fa-sort';
      }
    });

    activeButton.dataset.order = order;
    const activeIcon = activeButton.querySelector('i');
    if (activeIcon) {
      activeIcon.className = order === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
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
      this.loadData(CONFIG.PAGINATION.DEFAULT_PAGE);
    } else {
      submissionStore.applySearchFilter(term);
    }
  }

  async handleClientSave(clientData) {
    try {
      const response = await apiService.addSubmission(clientData);

      if (response && response.submission_id) {
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

    switch (endpoint) {
      case CONFIG.API.ENDPOINTS.SUBMISSIONS:
        this.components.table.renderError();
        break;
      default:
        notificationService.error('Произошла ошибка при обращении к серверу');
    }
  }

  async handleTableSort({ sortBy, order }) {
    try {
      await this.loadData(CONFIG.PAGINATION.DEFAULT_PAGE, { sortBy, order });

      console.log(`Loaded page 1 sorted by ${sortBy} ${order}`);
    } catch (err) {
      console.error('Error while handling table sort:', err);
      notificationService.error('Не удалось применить сортировку');
    }
  }

  handleLogout(e) {
    e && e.preventDefault && e.preventDefault();

    // Optional: you can use a configured base path if you have one:
    // const logoutPath = (CONFIG && CONFIG.BASE_PATH) ? `${CONFIG.BASE_PATH}/admin/logout` : '/admin/logout';
    // window.location.assign(logoutPath);

    // Simple redirect to logout endpoint
    window.location.assign('/admin/logout');
  }

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

  destroy() {
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy();
      }
    });

    submissionStore.clear();

    if (this._logoutBtn && this._boundHandleLogout) {
      this._logoutBtn.removeEventListener('click', this._boundHandleLogout);
      this._logoutBtn = null;
      this._boundHandleLogout = null;
    }

    EventBus.events = {};

    console.log('Admin Dashboard destroyed');
  }

  isReady() {
    return this.isInitialized;
  }
}
