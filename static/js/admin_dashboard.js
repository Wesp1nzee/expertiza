// Конфигурация пагинации
const PAGE_SIZE = 20;
let currentPage = 1;
let submissionsData = [];
let paginationInfo = null;

// API функции
async function fetchSubmissions(page, perPage) {
    try {
        const response = await fetch(`/api/v1/admin/dashboard-submission-page?page=${page}&per_page=${perPage}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching submissions:', error);
        showNotification('Ошибка загрузки данных', 'error');
        return null;
    }
}

async function updateSubmissionStatus(submissionId, status) {
    try {
        const response = await fetch('/api/v1/admin/update-submission-status', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                submission_id: submissionId,
                status: status
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Ошибка обновления статуса', 'error');
        return false;
    }
}

// Функция загрузки и отрисовки данных
async function loadAndRenderTable(page) {
    // Показываем индикатор загрузки
    const tableBody = document.getElementById("submissionsTable");
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Загрузка...</td></tr>';
    
    const result = await fetchSubmissions(page, PAGE_SIZE);
    if (!result) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--error);">Ошибка загрузки данных</td></tr>';
        return;
    }
    
    submissionsData = result.data;
    paginationInfo = result;
    currentPage = page;
    
    renderTable();
    updatePaginationControls();
    updateStats();
}

// Функция отрисовки таблицы
function renderTable() {
    const tableBody = document.getElementById("submissionsTable");
    tableBody.innerHTML = "";
    
    if (submissionsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Нет данных для отображения</td></tr>';
        return;
    }
    
    submissionsData.forEach(submission => {
        const row = document.createElement("tr");
        
        // Генерация инициалов для аватара
        const initials = submission.name.split(" ")
            .map(part => part[0])
            .join("")
            .toUpperCase();
        
        // Форматирование телефона
        const phoneDisplay = submission.phone ? submission.phone : "не указан";
        
        // Сокращение UUID для таблицы
        const shortUuid = submission.submission_id.substring(0, 8) + "...";
        
        // Форматирование даты
        const date = new Date(submission.created_at);
        const formattedDate = date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Определение текста статуса
        let statusText;
        switch(submission.status) {
            case "new": statusText = "Новая"; break;
            case "viewed": statusText = "Просмотрено"; break;
            case "in_progress": statusText = "В работе"; break;
            case "completed": statusText = "Завершено"; break;
            case "rejected": statusText = "Отклонено"; break;
            default: statusText = submission.status;
        }
        
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
        
        tableBody.appendChild(row);
    });
    
    // Добавление обработчиков событий для кнопок просмотра
    document.querySelectorAll('.view-btn').forEach(button => {
        button.addEventListener('click', function() {
            const submissionId = this.getAttribute('data-id');
            const submission = submissionsData.find(s => s.submission_id === submissionId);
            
            if (submission) {
                openSubmissionModal(submission);
            }
        });
    });
    
    // Обработчики для UUID-баджей
    document.querySelectorAll('.uuid-badge').forEach(badge => {
        badge.addEventListener('click', function() {
            const uuid = this.getAttribute('title');
            copyToClipboard(uuid);
            showNotification('UUID скопирован в буфер обмена!');
        });
    });
}

// Функция открытия модального окна
function openSubmissionModal(submission) {
    const modal = document.getElementById('messageModal');
    modal.dataset.currentId = submission.submission_id;
    
    // Форматирование даты для модального окна
    const date = new Date(submission.created_at);
    const formattedDate = date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Заполняем данные в модальном окне
    document.getElementById('modal-name').textContent = submission.name;
    document.getElementById('modal-email').textContent = submission.email;
    document.getElementById('modal-phone').textContent = submission.phone || "не указан";
    document.getElementById('modal-date').textContent = formattedDate;
    document.getElementById('modal-uuid').textContent = submission.submission_id;
    document.getElementById('modal-message').textContent = submission.message;
    
    // Устанавливаем текущий статус
    document.getElementById('modal-status').value = submission.status;
    
    // Открываем модальное окно
    modal.style.display = 'flex';
}

// Обновление контролов пагинации
function updatePaginationControls() {
    if (!paginationInfo) return;
    
    document.getElementById("paginationInfo").textContent = 
        `Страница ${paginationInfo.page} из ${paginationInfo.total_pages}`;
    
    document.getElementById("prevPageBtn").classList.toggle("disabled", !paginationInfo.has_prev);
    document.getElementById("nextPageBtn").classList.toggle("disabled", !paginationInfo.has_next);
}

// Обновление статистики (примерная реализация)
function updateStats() {
    if (!paginationInfo) return;
    
    // Обновляем общее количество заявок
    const totalElement = document.querySelector('.stat-card:first-child h2');
    if (totalElement) {
        totalElement.textContent = paginationInfo.total_count;
    }
    
    // Для остальной статистики потребуются дополнительные API endpoints
    // Пока оставляем как есть или можно добавить отдельный запрос для статистики
}

// Функция копирования в буфер обмена
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        // Используем современный API если доступен
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

// Fallback для копирования
function fallbackCopyTextToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback: Failed to copy', err);
    }
    
    document.body.removeChild(textarea);
}

// Показать уведомление
function showNotification(message, type = 'success') {
    const notification = document.getElementById('copiedNotification');
    
    // Обновляем текст и стиль
    notification.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
    
    if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else {
        notification.style.backgroundColor = '#4CAF50';
    }
    
    notification.style.opacity = 0;
    
    // Перезапуск анимации
    notification.style.animation = 'none';
    setTimeout(() => {
        notification.style.animation = 'fadeInOut 3s ease';
    }, 10);
}

// Инициализация пагинации
document.getElementById("prevPageBtn").addEventListener("click", function() {
    if (paginationInfo && paginationInfo.has_prev) {
        loadAndRenderTable(currentPage - 1);
    }
});

document.getElementById("nextPageBtn").addEventListener("click", function() {
    if (paginationInfo && paginationInfo.has_next) {
        loadAndRenderTable(currentPage + 1);
    }
});

// Обработчики для открытия/закрытия модального окна
document.querySelectorAll('.close-btn, .close-modal').forEach(button => {
    button.addEventListener('click', function() {
        document.getElementById('messageModal').style.display = 'none';
    });
});

// Закрытие модального окна при клике вне его области
window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('messageModal')) {
        document.getElementById('messageModal').style.display = 'none';
    }
});

// Копирование UUID в модальном окне
document.getElementById('copyUuidBtn').addEventListener('click', function() {
    const uuid = document.getElementById('modal-uuid').textContent;
    copyToClipboard(uuid);
    showNotification('UUID скопирован в буфер обмена!');
});

// Обработчик изменения статуса
document.getElementById('modal-status').addEventListener('change', async function() {
    const modal = document.getElementById('messageModal');
    const submissionId = modal.dataset.currentId;
    const newStatus = this.value;
    
    if (!submissionId || !newStatus) return;
    
    // Показываем индикатор загрузки
    const originalValue = this.value;
    this.disabled = true;
    
    const success = await updateSubmissionStatus(submissionId, newStatus);
    
    if (success) {
        // Обновляем данные локально
        const submissionIndex = submissionsData.findIndex(s => s.submission_id === submissionId);
        if (submissionIndex !== -1) {
            submissionsData[submissionIndex].status = newStatus;
        }
        
        // Перерисовываем таблицу
        renderTable();
        
        // Показываем уведомление об успешном изменении
        showNotification('Статус успешно обновлен!');
    } else {
        // Возвращаем предыдущее значение при ошибке
        this.value = submissionsData.find(s => s.submission_id === submissionId)?.status || originalValue;
    }
    
    this.disabled = false;
});

// Обработчик поиска (базовая реализация)
const searchBox = document.querySelector('.search-box');
if (searchBox) {
    let searchTimeout;
    searchBox.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm === '') {
                // Если поиск пустой, загружаем первую страницу
                loadAndRenderTable(1);
            } else {
                // Здесь можно реализовать поиск по загруженным данным
                // Или добавить параметр поиска в API запрос
                filterCurrentData(searchTerm);
            }
        }, 300);
    });
}

// Фильтрация текущих данных (клиентская фильтрация)
function filterCurrentData(searchTerm) {
    const filteredData = submissionsData.filter(submission => 
        submission.name.toLowerCase().includes(searchTerm) ||
        submission.email.toLowerCase().includes(searchTerm) ||
        submission.submission_id.toLowerCase().includes(searchTerm)
    );
    
    const originalData = submissionsData;
    submissionsData = filteredData;
    renderTable();
    
    // Сброс пагинации при поиске
    document.getElementById("paginationInfo").textContent = 
        filteredData.length > 0 ? `Найдено: ${filteredData.length}` : 'Ничего не найдено';
    document.getElementById("prevPageBtn").classList.add("disabled");
    document.getElementById("nextPageBtn").classList.add("disabled");
}

function openAddClientModal() {
    document.getElementById('addClientModal').style.display = 'flex';
    // Очищаем форму
    document.getElementById('addClientForm').reset();
}

function closeAddClientModal() {
    document.getElementById('addClientModal').style.display = 'none';
}
function updateStatsAfterAdd() {
    const totalElement = document.querySelector('.stat-card:first-child h2');
    const todayElement = document.querySelector('.stat-card:nth-child(3) h2');
    
    if (totalElement) {
        const currentTotal = parseInt(totalElement.textContent);
        totalElement.textContent = currentTotal + 1;
    }
    
    if (todayElement) {
        const currentToday = parseInt(todayElement.textContent);
        todayElement.textContent = currentToday + 1;
    }
}
// Функция для отправки данных нового клиента
async function saveNewClient() {
    const form = document.getElementById('addClientForm');
    const formData = new FormData(form);
    
    // Получаем кнопку и сохраняем оригинальное состояние
    const saveBtn = document.getElementById('saveClient');
    const originalText = saveBtn.innerHTML;
    const originalState = saveBtn.disabled;
    
    try {
        // Блокируем кнопку во время валидации и отправки
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        
        // Валидация формы
        const name = formData.get('name').trim();
        const email = formData.get('email').trim();
        
        if (!name || !email) {
            showNotification('Пожалуйста, заполните обязательные поля', 'error');
            return;
        }
        
        // Проверка корректности email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification('Пожалуйста, введите корректный email адрес', 'error');
            return;
        }
        
        // Подготовка данных для отправки
        const clientData = {
            name: name,
            email: email,
            phone: formData.get('phone').trim() || null,
            message: formData.get('comment').trim() || 'Клиент добавлен администратором',
        };
        
        // API запрос для создания клиента
        const response = await fetch('/api/v1/admin/add-submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clientData)
        });

        if (!response.ok) { 
            const errorData = await response.json().catch(() => null);
            console.error('Ошибка при сохранении клиента:', response.status, errorData);
            showNotification(errorData?.message || 'Ошибка при сохранении клиента', 'error');
            return;
        }

        const responseData = await response.json();
        const newUuid = responseData.submission_id;

        // Добавляем нового клиента в таблицу
        addClientToTable({
            submission_id: newUuid,
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            message: clientData.message,
            status: 'new',
            created_at: new Date().toISOString()
        });
        
        // Обновляем статистику
        updateStatsAfterAdd();
        
        showNotification('Клиент успешно добавлен!', 'success');
        closeAddClientModal();
        
    } catch (error) {
        console.error('Error saving client:', error);
        showNotification('Ошибка при сохранении клиента', 'error');
    } finally {
        // Всегда восстанавливаем кнопку в исходное состояние
        saveBtn.disabled = originalState;
        saveBtn.innerHTML = originalText;
    }
}

// Функция генерации UUID (для демонстрации)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Функция добавления клиента в таблицу
function addClientToTable(client) {
    const tableBody = document.getElementById('submissionsTable');
    const row = document.createElement('tr');
    
    // Генерация инициалов для аватара
    const initials = client.name.split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase();
    
    // Форматирование телефона
    const phoneDisplay = client.phone ? client.phone : 'не указан';
    
    // Сокращение UUID для таблицы
    const shortUuid = client.submission_id.substring(0, 8) + '...';
    
    // Форматирование даты
    const date = new Date(client.created_at);
    const formattedDate = date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    row.innerHTML = `
        <td>
            <div class="user-cell">
                <div class="user-avatar-small">${initials}</div>
                <div>${client.name}</div>
            </div>
        </td>
        <td>
            <div>${client.email}</div>
            <div style="font-size: 14px; color: var(--secondary);">${phoneDisplay}</div>
        </td>
        <td>${formattedDate}</td>
        <td>
            <div class="uuid-badge" title="${client.submission_id}">
                <i class="fas fa-fingerprint"></i>${shortUuid}
            </div>
        </td>
        <td>
            <span class="status-badge status-new">Новая</span>
        </td>
        <td>
            <button class="action-btn view-btn" data-id="${client.submission_id}">
                <i class="fas fa-eye"></i> Просмотр
            </button>
        </td>
    `;
    
    // Добавляем строку в начало таблицы
    tableBody.insertBefore(row, tableBody.firstChild);
    
    // Добавляем обработчик для новой кнопки просмотра
    const viewBtn = row.querySelector('.view-btn');
    viewBtn.addEventListener('click', function() {
        openSubmissionModal(client);
    });
    
    // Добавляем обработчик для UUID
    const uuidBadge = row.querySelector('.uuid-badge');
    uuidBadge.addEventListener('click', function() {
        copyToClipboard(client.submission_id);
        showNotification('UUID скопирован в буфер обмена!');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveClient').addEventListener('click', saveNewClient);
    document.getElementById('closeAddClientModal').addEventListener('click', closeAddClientModal);
    document.getElementById('cancelAddClient').addEventListener('click', closeAddClientModal);
    document.getElementById('addClientBtn').addEventListener('click', openAddClientModal);
    loadAndRenderTable(1);
});