class ContactFormHandler {
    constructor() {
        this.csrfToken = null;
        this.csrfTokenExpiry = null;
        this.API_BASE = '/api/v1';
        this.form = document.getElementById('contactForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.csrfStatus = document.getElementById('csrfStatus');
        this.phoneInput = document.getElementById('phone');

        this.init();
    }

    async init() {
        await this.loadCsrfToken();
        this.setupEventListeners();
        this.startTokenRefreshTimer();
        this.setupPhoneMask();
    }

    setupPhoneMask() {
        const phoneInput = this.phoneInput;
        
        phoneInput.addEventListener('input', function(e) {
            const value = phoneInput.value.replace(/\D/g, '');
            let formattedValue = '';
            
            if (value.length > 0) {
                formattedValue = '(' + value.substring(0, 3);
            }
            if (value.length > 3) {
                formattedValue += ') ' + value.substring(3, 6);
            }
            if (value.length > 6) {
                formattedValue += '-' + value.substring(6, 8);
            }
            if (value.length > 8) {
                formattedValue += '-' + value.substring(8, 10);
            }
            
            phoneInput.value = formattedValue;
        });

        phoneInput.addEventListener('keydown', function(e) {
            // backspace, delete, tab, escape, enter
            if ([46, 8, 9, 27, 13].includes(e.key) || 
                // Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.key === 65 && e.ctrlKey === true) || 
                (e.key === 67 && e.ctrlKey === true) ||
                (e.key === 86 && e.ctrlKey === true) ||
                (e.key === 88 && e.ctrlKey === true)) {
                return;
            }
            
            // Запрещаем не-цифры
            if ((e.key < 48 || e.key > 57) && (e.key < 96 || e.key > 105)) {
                e.preventDefault();
            }
        });
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
            
            // Попробуем использовать meta-тег как запасной вариант
            const metaToken = document.querySelector('meta[name="csrf-token"]')?.content;
            if (metaToken) {
                this.csrfToken = metaToken;
                this.updateCsrfStatus(true);
                this.submitBtn.disabled = false;
                console.warn('⚠️ Using fallback CSRF token from meta tag');
            } else {
                this.updateCsrfStatus(false, error.message);
                this.submitBtn.disabled = true;
            }
        }
    }

    updateCsrfStatus(success, errorMessage = null) {
        if (success) {
            this.csrfStatus.className = 'csrf-status csrf-ready';
        } else {
            this.csrfStatus.className = 'csrf-status csrf-error';
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
                if (value) {
                    // Удаляем все нецифровые символы, кроме ведущего +
                    const digits = value.replace(/\D/g, '');
                    
                    // Должно быть ровно 10 цифр (т.к. префикс +7 уже указан отдельно)
                    if (digits.length !== 10) {
                        this.showError(fieldId, 'Некорректный формат телефона. Введите 10 цифр номера. Пример: (999) 999-99-99');
                        return false;
                    }
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

        const honeypot = document.getElementById('honeypot').value;
        if (honeypot) {
            console.warn('🤖 Bot detected via honeypot');
            return false;
        }

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
            message: document.getElementById('message').value.trim()
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

            // Сначала получаем текстовый ответ
            const responseText = await response.text();
            
            let result;
            try {
                // Пытаемся распарсить JSON
                result = JSON.parse(responseText);
            } catch (jsonError) {
                // Если не JSON - создаем объект ошибки
                result = {
                    message: responseText || `HTTP Error: ${response.status}`,
                    code: 'INVALID_RESPONSE'
                };
            }

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
                // Обработка ошибок валидации
                let fieldErrors = '';
                
                if (result.code === "VALIDATION_ERROR") {
                    if (result.message.includes("Имя")) {
                        this.showError('name', result.message);
                    } else if (result.message.includes("email")) {
                        this.showError('email', result.message);
                    } else if (result.message.includes("Сообщение")) {
                        this.showError('message', result.message);
                    }
                    fieldErrors = `<p>Проверьте правильность заполнения полей</p>`;
                }
                
                // Если сервер вернул детализированные ошибки
                if (result.errors) {
                    result.errors.forEach(error => {
                        this.showError(error.field, error.message);
                        fieldErrors += `<p>${error.field}: ${error.message}</p>`;
                    });
                }
                
                this.showResponse('error', 
                    `❌ Ошибка: ${result.message || 'Произошла неизвестная ошибка'}<br>
                        <p>Код ошибки: ${result.code || 'UNKNOWN'}</p>
                        ${fieldErrors}`
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
        
        // Блокируем всю форму на время отправки
        this.form.querySelectorAll('input, textarea, button').forEach(el => {
            if (el !== this.submitBtn) {
                el.disabled = isSubmitting;
            }
        });
    }

    showResponse(type, message) {
        const responseElement = document.getElementById('responseMessage');
        // Очищаем предыдущие сообщения
        responseElement.innerHTML = '';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = type;
        messageDiv.innerHTML = message;
        responseElement.appendChild(messageDiv);
        
        responseElement.style.display = 'block';
        responseElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        if (type === 'success') {
            setTimeout(() => {
                responseElement.style.display = 'none';
            }, 10000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ContactFormHandler();
});