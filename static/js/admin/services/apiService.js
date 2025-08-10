import { CONFIG } from '../config/constants.js';
import { EventBus } from '../utils/eventBus.js';

class ApiService {
  constructor() {
    this.baseUrl = CONFIG.API.BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (options.method === 'PUT' && (!contentType || !contentType.includes('application/json'))) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      EventBus.emit('api:error', { endpoint, error });
      throw error;
    }
  }

  async fetchSubmissions(page, perPage, { sortBy, order } = {}) {
  try {
    // Собираем параметры запроса безопасно
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage)
    });

    if (sortBy) params.append('sort_by', sortBy);
    if (order)  params.append('order', order);

    // Вызов request с query-string. Метод оставлен POST для совместимости с текущей реализацией.
    return await this.request(
      `${CONFIG.API.ENDPOINTS.SUBMISSIONS}?${params.toString()}`,
      { method: 'POST' }
    );
  } catch (error) {
    throw new Error('Ошибка загрузки данных');
  }
}


  async updateSubmissionStatus(submissionId, status) {
    try {
      await this.request(CONFIG.API.ENDPOINTS.UPDATE_STATUS, {
        method: 'PUT',
        body: JSON.stringify({
          submission_id: submissionId,
          status: status
        })
      });
      return true;
    } catch (error) {
      throw new Error('Ошибка обновления статуса');
    }
  }

  async addSubmission(clientData) {
    try {
      return await this.request(CONFIG.API.ENDPOINTS.ADD_SUBMISSION, {
        method: 'POST',
        body: JSON.stringify(clientData)
      });
    } catch (error) {
      throw new Error('Ошибка при сохранении клиента');
    }
  }
}

export const apiService = new ApiService();