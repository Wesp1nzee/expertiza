// components/SubmissionModal.js
import { DateUtils, ClipboardUtils } from '../utils/index.js';
import { EventBus } from '../utils/eventBus.js';
import { notificationService } from '../services/notificationService.js';

export class SubmissionModal {
  constructor() {
    this.modal = document.getElementById('messageModal');
    this.currentSubmission = null;
    
    // Элементы модального окна
    this.elements = {
      name: document.getElementById('modal-name'),
      email: document.getElementById('modal-email'),
      phone: document.getElementById('modal-phone'),
      date: document.getElementById('modal-date'),
      uuid: document.getElementById('modal-uuid'),
      message: document.getElementById('modal-message'),
      status: document.getElementById('modal-status'),
      copyBtn: document.getElementById('copyUuidBtn')
    };

    if (!this.modal) {
      throw new Error('Modal element not found');
    }

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Кнопки закрытия
    this.modal.querySelectorAll('.close-btn, .close-modal').forEach(btn => {
      btn.addEventListener('click', this.close.bind(this));
    });

    // Закрытие по клику вне модального окна
    window.addEventListener('click', this.handleOutsideClick.bind(this));

    // Кнопка копирования UUID
    if (this.elements.copyBtn) {
      this.elements.copyBtn.addEventListener('click', this.copyUuid.bind(this));
    }

    // Изменение статуса
    if (this.elements.status) {
      this.elements.status.addEventListener('change', this.handleStatusChange.bind(this));
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
    
    // Показываем индикатор загрузки
    this.elements.status.disabled = true;

    try {
      // Эмитируем событие изменения статуса
      EventBus.emit('submission:status-change', {
        submissionId: this.currentSubmission.submission_id,
        newStatus: newStatus,
        originalStatus: originalValue
      });

    } catch (error) {
      // В случае ошибки возвращаем предыдущее значение
      this.elements.status.value = originalValue;
      notificationService.error('Ошибка при изменении статуса');
    } finally {
      this.elements.status.disabled = false;
    }
  }

  open(submission) {
    if (!submission) return;

    this.currentSubmission = submission;
    this.modal.dataset.currentId = submission.submission_id;

    this.fillData(submission);
    this.show();
  }

  fillData(submission) {
    const formattedDate = DateUtils.formatDate(submission.created_at);

    // Заполняем все поля
    if (this.elements.name) this.elements.name.textContent = submission.name;
    if (this.elements.email) this.elements.email.textContent = submission.email;
    if (this.elements.phone) this.elements.phone.textContent = submission.phone || 'не указан';
    if (this.elements.date) this.elements.date.textContent = formattedDate;
    if (this.elements.uuid) this.elements.uuid.textContent = submission.submission_id;
    if (this.elements.message) this.elements.message.textContent = submission.message;
    if (this.elements.status) this.elements.status.value = submission.status;
  }

  show() {
    if (this.modal) {
      this.modal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Предотвращаем прокрутку фона
    }
  }

  close() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = ''; // Восстанавливаем прокрутку
    }
    
    this.currentSubmission = null;
    this.modal.dataset.currentId = '';
  }

  updateSubmission(submission) {
    if (this.currentSubmission && 
        this.currentSubmission.submission_id === submission.submission_id) {
      this.currentSubmission = submission;
      this.fillData(submission);
    }
  }

  destroy() {
    // Удаляем все обработчики событий
    this.modal.querySelectorAll('.close-btn, .close-modal').forEach(btn => {
      btn.removeEventListener('click', this.close);
    });

    window.removeEventListener('click', this.handleOutsideClick);

    if (this.elements.copyBtn) {
      this.elements.copyBtn.removeEventListener('click', this.copyUuid);
    }

    if (this.elements.status) {
      this.elements.status.removeEventListener('change', this.handleStatusChange);
    }
  }
}