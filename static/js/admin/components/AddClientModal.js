// components/AddClientModal.js
import { ValidationUtils } from '../utils/index.js';
import { EventBus } from '../utils/eventBus.js';
import { notificationService } from '../services/notificationService.js';

export class AddClientModal {
  constructor() {
    this.modal = document.getElementById('addClientModal');
    this.form = document.getElementById('addClientForm');
    
    // Элементы формы
    this.elements = {
      saveBtn: document.getElementById('saveClient'),
      cancelBtn: document.getElementById('cancelAddClient'),
      closeBtn: document.getElementById('closeAddClientModal'),
      openBtn: document.getElementById('addClientBtn')
    };

    if (!this.modal || !this.form) {
      throw new Error('Add client modal elements not found');
    }

    this.init();
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Кнопка открытия модального окна
    if (this.elements.openBtn) {
      this.elements.openBtn.addEventListener('click', this.open.bind(this));
    }

    // Кнопки закрытия
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', this.close.bind(this));
    }
    
    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.addEventListener('click', this.close.bind(this));
    }

    // Кнопка сохранения
    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener('click', this.handleSave.bind(this));
    }

    // Закрытие по клику вне модального окна
    window.addEventListener('click', this.handleOutsideClick.bind(this));

    // Отправка формы по Enter
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }

  handleOutsideClick(event) {
    if (event.target === this.modal) {
      this.close();
    }
  }

  handleSubmit(event) {
    event.preventDefault();
    this.handleSave();
  }

  async handleSave() {
    const formData = this.getFormData();
    
    if (!this.validateForm(formData)) {
      return;
    }

    await this.saveClient(formData);
  }

  getFormData() {
    const formData = new FormData(this.form);
    
    return {
      name: formData.get('name')?.trim() || '',
      email: formData.get('email')?.trim() || '',
      phone: formData.get('phone')?.trim() || '',
      comment: formData.get('comment')?.trim() || ''
    };
  }

  validateForm(data) {
    // Проверка обязательных полей
    if (!ValidationUtils.isRequired(data.name)) {
      notificationService.error('Пожалуйста, введите имя клиента');
      this.focusField('name');
      return false;
    }

    if (!ValidationUtils.isRequired(data.email)) {
      notificationService.error('Пожалуйста, введите email адрес');
      this.focusField('email');
      return false;
    }

    // Проверка корректности email
    if (!ValidationUtils.isValidEmail(data.email)) {
      notificationService.error('Пожалуйста, введите корректный email адрес');
      this.focusField('email');
      return false;
    }

    return true;
  }

  focusField(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (field) {
      field.focus();
    }
  }

  async saveClient(formData) {
    if (!this.elements.saveBtn) return;

    // Сохраняем оригинальное состояние кнопки
    const originalText = this.elements.saveBtn.innerHTML;
    const originalDisabled = this.elements.saveBtn.disabled;

    try {
      // Показываем индикатор загрузки
      this.setButtonLoading(true);

      // Подготавливаем данные для отправки
      const clientData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        message: formData.comment || 'Клиент добавлен администратором'
      };

      // Эмитируем событие сохранения клиента
      EventBus.emit('client:save', clientData);

    } catch (error) {
      console.error('Error in saveClient:', error);
      notificationService.error('Произошла ошибка при сохранении');
    } finally {
      // Восстанавливаем состояние кнопки
      this.setButtonLoading(false, originalText, originalDisabled);
    }
  }

  setButtonLoading(loading, originalText = null, originalDisabled = false) {
    if (!this.elements.saveBtn) return;

    if (loading) {
      this.elements.saveBtn.disabled = true;
      this.elements.saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
    } else {
      this.elements.saveBtn.disabled = originalDisabled;
      this.elements.saveBtn.innerHTML = originalText || '<i class="fas fa-save"></i> Сохранить';
    }
  }

  open() {
    this.resetForm();
    this.show();
  }

  close() {
    this.hide();
  }

  show() {
    if (this.modal) {
      this.modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      
      // Фокус на первом поле
      setTimeout(() => {
        const firstField = this.form.querySelector('input[name="name"]');
        if (firstField) firstField.focus();
      }, 100);
    }
  }

  hide() {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  resetForm() {
    if (this.form) {
      this.form.reset();
    }
    
    // Сбрасываем состояние кнопки сохранения
    this.setButtonLoading(false);
  }

  onSaveSuccess() {
    this.close();
    notificationService.success('Клиент успешно добавлен!');
  }

  onSaveError(error) {
    notificationService.error(error?.message || 'Ошибка при сохранении клиента');
  }

  destroy() {
    // Удаляем все обработчики событий
    if (this.elements.openBtn) {
      this.elements.openBtn.removeEventListener('click', this.open);
    }

    if (this.elements.closeBtn) {
      this.elements.closeBtn.removeEventListener('click', this.close);
    }

    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.removeEventListener('click', this.close);
    }

    if (this.elements.saveBtn) {
      this.elements.saveBtn.removeEventListener('click', this.handleSave);
    }

    window.removeEventListener('click', this.handleOutsideClick);
    this.form.removeEventListener('submit', this.handleSubmit);
  }
}