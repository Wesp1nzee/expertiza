class ContactFormHandler {
    constructor() {
        this.csrfToken = null;
        this.csrfTokenExpiry = null;
        this.API_BASE = '/api/v1';
        this.form = document.getElementById('contactForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.csrfStatus = document.getElementById('csrfStatus');
        
        this.init();
    }

    async init() {
        await this.loadCsrfToken();
        this.setupEventListeners();
        this.startTokenRefreshTimer();
    }

    async loadCsrfToken() {
        try {
            const response = await fetch(`${this.API_BASE}/csrf-token`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.csrfToken = data.token;
            this.csrfTokenExpiry = Date.now() + (data.expires_in * 1000);
            
            this.updateCsrfStatus(true);
            this.submitBtn.disabled = false;
            
            console.log('✅ CSRF token loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load CSRF token:', error);
            this.updateCsrfStatus(false, error.message);
            this.submitBtn.disabled = true;
        }
    }

    updateCsrfStatus(success, errorMessage = null) {
        if (success) {
            this.csrfStatus.className = 'csrf-status csrf-ready';
            this.csrfStatus.textContent = '✅ CSRF защита активна';
        } else {
            this.csrfStatus.className = 'csrf-status csrf-error';
            this.csrfStatus.textContent = `❌ Ошибка CSRF защиты: ${errorMessage || 'Неизвестная ошибка'}`;
        }
    }

    startTokenRefreshTimer() {
        // Обновляем токен за 5 минут до истечения
        setInterval(async () => {
            if (this.csrfTokenExpiry && Date.now() > (this.csrfTokenExpiry - 5 * 60 * 1000)) {
                console.log('🔄 Refreshing CSRF token...');
                await this.loadCsrfToken();
            }
        }, 60000); // Проверяем каждую минуту
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Валидация в реальном времени
        document.getElementById('name').addEventListener('blur', () => this.validateField('name'));
        document.getElementById('email').addEventListener('blur', () => this.validateField('email'));
        document.getElementById('phone').addEventListener('blur', () => this.validateField('phone'));
        document.getElementById('message').addEventListener('blur', () => this.validateField('message'));
    }

    showError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    hideError(fieldId) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    resetErrors() {
        document.querySelectorAll('.error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        const value = field.value.trim();
        
        switch(fieldId) {
            case 'name':
                if (!/^[a-zA-Zа-яА-ЯёЁ\s\-']{2,50}$/.test(value)) {
                    this.showError(fieldId, 'Имя должно содержать 2-50 буквенных символов');
                    return false;
                }
                break;
                
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    this.showError(fieldId, 'Введите корректный email');
                    return false;
                }
                break;
                
            case 'phone':
                if (value && !/^[\d\s+\-()]{7,15}$/.test(value)) {
                    this.showError(fieldId, 'Некорректный формат телефона');
                    return false;
                }
                break;
                
            case 'message':
                if (value.length < 10 || value.length > 1000) {
                    this.showError(fieldId, 'Сообщение должно быть 10-1000 символов');
                    return false;
                }
                break;
        }
        
        this.hideError(fieldId);
        return true;
    }

    validateForm() {
        this.resetErrors();
        let isValid = true;

        // Honeypot проверка
        const honeypot = document.getElementById('honeypot').value;
        if (honeypot) {
            console.warn('🤖 Bot detected via honeypot');
            return false;
        }

        // Проверяем все поля
        ['name', 'email', 'phone', 'message'].forEach(fieldId => {
            if (!this.validateField(fieldId)) {
                isValid = false;
            }
        });

        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            console.warn('📝 Form validation failed');
            return;
        }

        if (!this.csrfToken) {
            this.showResponse('error', '❌ CSRF токен недоступен. Попробуйте перезагрузить страницу.');
            return;
        }

        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim() || null,
            message: document.getElementById('message').value.trim(),
            timestamp: new Date().toISOString()
        };

        this.setSubmitState(true);

        try {
            const response = await fetch(`${this.API_BASE}/contact-submissions`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showResponse('success', 
                    `✅ Сообщение успешно отправлено!<br>
                        <p>Спасибо за обращение! Мы ответим вам в течение 24 часов.</p>
                        <p>ID заявки: <strong>${result.submission_id}</strong></p>
                        <p>На ваш email <strong>${formData.email}</strong> будет отправлено подтверждение.</p>`
                );
                this.form.reset();
                this.resetErrors();
            } else {
                this.showResponse('error', 
                    `❌ Ошибка: ${result.message || 'Произошла неизвестная ошибка'}<br>
                        <p>Код ошибки: ${result.code || 'UNKNOWN'}</p>
                        <p>Попробуйте отправить форму позже или свяжитесь другим способом</p>`
                );
            }

        } catch (error) {
            console.error('🌐 Network error:', error);
            this.showResponse('error', 
                `❌ Сетевая ошибка<br>
                    <p>Проверьте интернет-соединение и попробуйте снова</p>
                    <p>Техническая информация: ${error.message}</p>`
            );
        } finally {
            this.setSubmitState(false);
        }
    }

    setSubmitState(isSubmitting) {
        this.submitBtn.disabled = isSubmitting;
        this.submitBtn.textContent = isSubmitting ? 'Отправка...' : 'Отправить сообщение';
    }

    showResponse(type, message) {
        const responseElement = document.getElementById('responseMessage');
        responseElement.innerHTML = `<div class="${type}">${message}</div>`;
        responseElement.style.display = 'block';
        
        responseElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ContactFormHandler();
});