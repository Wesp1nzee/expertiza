import { DateUtils, UserUtils, UuidUtils, ClipboardUtils, DomUtils } from '../utils/index.js';
import { STATUS_LABELS } from '../config/constants.js';
import { EventBus } from '../utils/eventBus.js';
import { notificationService } from '../services/notificationService.js';

export class SubmissionTable {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tableBody = document.getElementById('submissionsTable');
    
    if (!this.tableBody) {
      throw new Error('Table body element not found');
    }

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Делегирование событий для динамически создаваемых элементов
    this.tableBody.addEventListener('click', this.handleTableClick.bind(this));
  }

  handleTableClick(event) {
    const target = event.target.closest('button, .uuid-badge');
    if (!target) return;

    if (target.classList.contains('view-btn')) {
      const submissionId = target.dataset.id;
      EventBus.emit('submission:view', submissionId);
    }

    if (target.classList.contains('uuid-badge')) {
      const uuid = target.getAttribute('title');
      this.copyUuid(uuid);
    }
  }

  async copyUuid(uuid) {
    const success = await ClipboardUtils.copy(uuid);
    if (success) {
      notificationService.success('UUID скопирован в буфер обмена!');
    } else {
      notificationService.error('Не удалось скопировать UUID');
    }
  }

  render(submissions) {
    if (!this.tableBody) return;

    DomUtils.removeAllChildren(this.tableBody);

    if (!submissions || submissions.length === 0) {
      this.renderEmpty();
      return;
    }

    submissions.forEach(submission => {
      const row = this.createSubmissionRow(submission);
      this.tableBody.appendChild(row);
    });
  }

  renderEmpty() {
    const row = DomUtils.createElement('tr');
    row.innerHTML = '<td colspan="6" style="text-align: center; padding: 2rem;">Нет данных для отображения</td>';
    this.tableBody.appendChild(row);
  }

  renderLoading() {
    if (!this.tableBody) return;
    
    DomUtils.removeAllChildren(this.tableBody);
    const row = DomUtils.createElement('tr');
    row.innerHTML = '<td colspan="6" style="text-align: center; padding: 2rem;">Загрузка...</td>';
    this.tableBody.appendChild(row);
  }

  renderError() {
    if (!this.tableBody) return;
    
    DomUtils.removeAllChildren(this.tableBody);
    const row = DomUtils.createElement('tr');
    row.innerHTML = '<td colspan="6" style="text-align: center; padding: 2rem; color: var(--error);">Ошибка загрузки данных</td>';
    this.tableBody.appendChild(row);
  }

  createSubmissionRow(submission) {
    const row = DomUtils.createElement('tr');
    
    // Генерация данных для отображения
    const initials = UserUtils.generateInitials(submission.name);
    const phoneDisplay = UserUtils.formatPhone(submission.phone);
    const shortUuid = UuidUtils.shorten(submission.submission_id);
    const formattedDate = DateUtils.formatDate(submission.created_at);
    const statusText = STATUS_LABELS[submission.status] || submission.status;

    row.innerHTML = `
      <td>
        <div class="user-cell">
          <div class="user-avatar-small">${initials}</div>
          <div>${submission.name}</div>
        </div>
      </td>
      <td>
        <div>${submission.email}</div>
        <div style="font-size: 14px; color: var(--secondary);">${phoneDisplay}</div>
      </td>
      <td>${formattedDate}</td>
      <td>
        <div class="uuid-badge" title="${submission.submission_id}">
          <i class="fas fa-fingerprint"></i>${shortUuid}
        </div>
      </td>
      <td>
        <span class="status-badge status-${submission.status}">
          ${statusText}
        </span>
      </td>
      <td>
        <button class="action-btn view-btn" data-id="${submission.submission_id}">
          <i class="fas fa-eye"></i> Просмотр
        </button>
      </td>
    `;

    return row;
  }

  addRow(submission) {
    if (!this.tableBody) return;

    // Проверяем, не пустая ли таблица
    const emptyRow = this.tableBody.querySelector('td[colspan="6"]');
    if (emptyRow) {
      DomUtils.removeAllChildren(this.tableBody);
    }

    const row = this.createSubmissionRow(submission);
    this.tableBody.insertBefore(row, this.tableBody.firstChild);
  }

  updateRow(submission) {
    const existingRow = this.tableBody.querySelector(`[data-id="${submission.submission_id}"]`);
    if (existingRow) {
      const row = this.createSubmissionRow(submission);
      existingRow.closest('tr').replaceWith(row);
    }
  }

  destroy() {
    if (this.tableBody) {
      this.tableBody.removeEventListener('click', this.handleTableClick);
    }
  }
}