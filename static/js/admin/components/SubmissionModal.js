// static/js/admin/components/SubmissionModal.js
import { DateUtils, ClipboardUtils } from '../utils/index.js';
import { EventBus } from '../utils/eventBus.js';
import { notificationService } from '../services/notificationService.js';
import { apiService } from '../services/apiService.js';

export class SubmissionModal {
  constructor() {
    this.modal = document.getElementById('messageModal');
    this.currentSubmission = null;
    this.comments = [];

    this.elements = {
      name: document.getElementById('modal-name'),
      email: document.getElementById('modal-email'),
      phone: document.getElementById('modal-phone'),
      date: document.getElementById('modal-date'),
      uuid: document.getElementById('modal-uuid'),
      message: document.getElementById('modal-message'),
      status: document.getElementById('modal-status'),
      copyBtn: document.getElementById('copyUuidBtn'),

      // блок комментариев
      adminInput: document.getElementById('adminCommentInput'),
      saveBtn: document.getElementById('saveAdminCommentBtn'),
      commentsList: document.getElementById('adminCommentsList')
    };

    if (!this.modal) {
      throw new Error('Modal element not found');
    }

    // Привязанные обработчики (чтобы потом можно было удалить)
    this._boundClose = this.close.bind(this);
    this._boundOutsideClick = this.handleOutsideClick.bind(this);
    this._boundCopy = this.copyUuid.bind(this);
    this._boundStatusChange = this.handleStatusChange.bind(this);
    this._boundSave = this.saveAdminComment.bind(this);
    this._boundKeydown = this._onAdminInputKeydown.bind(this);

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // кнопки закрытия
    this.modal.querySelectorAll('.close-btn, .close-modal').forEach(btn => {
      btn.addEventListener('click', this._boundClose);
    });

    // клик по фону
    window.addEventListener('click', this._boundOutsideClick);

    // копирование UUID
    if (this.elements.copyBtn) {
      this.elements.copyBtn.addEventListener('click', this._boundCopy);
    }

    // смена статуса
    if (this.elements.status) {
      this.elements.status.addEventListener('change', this._boundStatusChange);
    }

    // комментарии
    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener('click', this._boundSave);
    }
    if (this.elements.adminInput) {
      this.elements.adminInput.addEventListener('keydown', this._boundKeydown);
    }
  }

  handleOutsideClick(event) {
    if (event.target === this.modal) {
      this.close();
    }
  }

  async copyUuid() {
    if (!this.currentSubmission) return;

    const success = await ClipboardUtils.copy(this.currentSubmission.submission_id);
    if (success) {
      notificationService.success('UUID скопирован в буфер обмена!');
    } else {
      notificationService.error('Не удалось скопировать UUID');
    }
  }

  async handleStatusChange(event) {
    const newStatus = event.target.value;
    if (!this.currentSubmission || !newStatus) return;

    const originalValue = this.currentSubmission.status;
    this.elements.status.disabled = true;

    try {
      EventBus.emit('submission:status-change', {
        submissionId: this.currentSubmission.submission_id,
        newStatus,
        originalStatus: originalValue
      });
    } catch (error) {
      this.elements.status.value = originalValue;
      notificationService.error('Ошибка при изменении статуса');
    } finally {
      this.elements.status.disabled = false;
    }
  }

  /**
   * Нормализуем серверный формат:
   * { comment_id, comment, created_at, admin_name } => { id, text, author, created_at }
   */
  _normalizeComment(raw) {
    if (!raw) return null;
    return {
      id: raw.comment_id || raw.id || `local-${Date.now()}`,
      text: raw.comment ?? raw.comment_text ?? raw.text ?? '',
      author: raw.admin_name ?? raw.author ?? 'admin',
      created_at: raw.created_at ?? raw.createdAt ?? new Date().toISOString()
    };
  }

  // Загрузка комментариев с сервера (сервер всегда возвращает { data: [...] })
  async loadComments() {
    if (!this.currentSubmission) return;

    const submissionId = this.currentSubmission.submission_id;
    this.renderCommentsLoading();

    try {
      const res = await apiService.fetchAdminComments(submissionId);
      // Для дебага оставим в консоли raw ответ
      console.debug('[SubmissionModal] raw comments response', res);

      let rawList = [];
      if (!res) {
        rawList = [];
      } else if (Array.isArray(res)) {
        rawList = res;
      } else if (res.data && Array.isArray(res.data)) {
        rawList = res.data;
      } else if (res.comments && Array.isArray(res.comments)) {
        rawList = res.comments;
      } else {
        rawList = [];
      }

      this.comments = rawList.map(r => this._normalizeComment(r)).filter(Boolean);
      this.renderComments();
    } catch (err) {
      console.error('Failed to load comments', err);
      this.comments = [];
      this.renderCommentsError();
      notificationService.error('Не удалось загрузить комментарии');
    }
  }

  async saveAdminComment() {
    if (!this.currentSubmission) return;

    const inputEl = this.elements.adminInput;
    const saveBtn = this.elements.saveBtn;
    if (!inputEl || !saveBtn) return;

    const text = (inputEl.value || '').trim();
    if (!text) {
      notificationService.error('Комментарий не может быть пустым');
      return;
    }

    // Блокируем кнопку, показываем индикатор
    saveBtn.disabled = true;
    saveBtn.dataset.origText = saveBtn.textContent;
    saveBtn.textContent = 'Сохранение...';

    try {
      // Сервер извлекает admin_id из cookie, отправляем только submissions_id и text
      const res = await apiService.addAdminComment(this.currentSubmission.submission_id, text);

      console.debug('[SubmissionModal] raw add comment response', res);

      // Сервер может вернуть { data: [...] } или null (201 created without body)
      let createdRaw = null;
      if (!res) {
        createdRaw = null;
      } else if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        // иногда create возвращает массив data
        createdRaw = res.data[0];
      } else if (res.data && typeof res.data === 'object' && res.data.comment_id) {
        createdRaw = res.data;
      } else if (res.comment) {
        createdRaw = res.comment;
      } else if (res.id || res.comment_id) {
        createdRaw = res;
      }

      const newComment = createdRaw ? this._normalizeComment(createdRaw) : {
        id: `local-${Date.now()}`,
        text,
        author: 'admin',
        created_at: new Date().toISOString()
      };

      // Добавляем в локальный список и рендерим
      this.comments.unshift(newComment);
      this.renderComments();

      inputEl.value = '';
      notificationService.success('Комментарий сохранён');

      EventBus.emit('submission:comment-added', {
        submissionId: this.currentSubmission.submission_id,
        comment: newComment
      });
    } catch (err) {
      console.error('saveAdminComment error', err);
      notificationService.error('Ошибка при сохранении комментария');
    } finally {
      // Восстанавливаем кнопку
      saveBtn.disabled = false;
      saveBtn.textContent = saveBtn.dataset.origText || 'Сохранить комментарий';
      delete saveBtn.dataset.origText;
    }
  }

  // Отрисовка списка комментариев
  renderComments() {
    const container = this.elements.commentsList;
    if (!container) return;

    // Очистка контейнера
    while (container.firstChild) container.removeChild(container.firstChild);

    if (!this.comments || this.comments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'admin-comments-empty';
      empty.textContent = 'Комментариев пока нет';
      container.appendChild(empty);
      return;
    }

    this.comments.forEach(comment => {
      const item = document.createElement('div');
      item.className = 'admin-comment-item';

      const header = document.createElement('div');
      header.className = 'admin-comment-header';

      const author = document.createElement('span');
      author.className = 'admin-comment-author';
      author.textContent = comment.author || 'admin';

      const sep = document.createTextNode(' · ');

      const date = document.createElement('span');
      date.className = 'admin-comment-date';
      date.textContent = comment.created_at ? DateUtils.formatDate(comment.created_at) : '';

      header.appendChild(author);
      header.appendChild(sep);
      header.appendChild(date);

      const body = document.createElement('div');
      body.className = 'admin-comment-body';
      body.textContent = comment.text || '';

      item.appendChild(header);
      item.appendChild(body);

      container.appendChild(item);
    });
  }

  renderCommentsLoading() {
    const container = this.elements.commentsList;
    if (!container) return;
    container.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'admin-comments-loading';
    el.textContent = 'Загрузка комментариев...';
    container.appendChild(el);
  }

  renderCommentsError() {
    const container = this.elements.commentsList;
    if (!container) return;
    container.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'admin-comments-error';
    el.textContent = 'Ошибка загрузки комментариев';
    container.appendChild(el);
  }

  _onAdminInputKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (this.elements.saveBtn && !this.elements.saveBtn.disabled) {
        this.elements.saveBtn.click();
      }
    }
  }

  open(submission) {
    if (!submission) return;

    this.currentSubmission = submission;
    this.modal.dataset.currentId = submission.submission_id;

    this.fillData(submission);
    this.show();

    // Загружаем комментарии, не блокируя UI
    this.loadComments().catch(() => {
      // ошибки уже обработаны в loadComments
    });
  }

  fillData(submission) {
    const formattedDate = DateUtils.formatDate(submission.created_at);

    if (this.elements.name) this.elements.name.textContent = submission.name;
    if (this.elements.email) this.elements.email.textContent = submission.email;
    if (this.elements.phone) this.elements.phone.textContent = submission.phone || 'не указан';
    if (this.elements.date) this.elements.date.textContent = formattedDate;
    if (this.elements.uuid) this.elements.uuid.textContent = submission.submission_id;
    if (this.elements.message) this.elements.message.textContent = submission.message;
    if (this.elements.status) this.elements.status.value = submission.status;

    if (this.elements.adminInput) this.elements.adminInput.value = '';
    if (this.elements.commentsList) this.elements.commentsList.innerHTML = '';
    this.comments = [];
  }

  show() {
    if (this.modal) {
      this.modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  close() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
    }
    this.currentSubmission = null;
    this.modal.dataset.currentId = '';
    this.comments = [];
  }

  updateSubmission(submission) {
    if (this.currentSubmission &&
        this.currentSubmission.submission_id === submission.submission_id) {
      this.currentSubmission = submission;
      this.fillData(submission);
    }
  }

  destroy() {
    // удалить обработчики
    this.modal.querySelectorAll('.close-btn, .close-modal').forEach(btn => {
      btn.removeEventListener('click', this._boundClose);
    });

    window.removeEventListener('click', this._boundOutsideClick);

    if (this.elements.copyBtn) {
      this.elements.copyBtn.removeEventListener('click', this._boundCopy);
    }

    if (this.elements.status) {
      this.elements.status.removeEventListener('change', this._boundStatusChange);
    }

    if (this.elements.saveBtn) {
      this.elements.saveBtn.removeEventListener('click', this._boundSave);
    }

    if (this.elements.adminInput) {
      this.elements.adminInput.removeEventListener('keydown', this._boundKeydown);
    }
  }
}
