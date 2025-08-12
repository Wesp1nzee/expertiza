// static/js/admin/services/apiService.js
import { CONFIG } from '../config/constants.js';
import { EventBus } from '../utils/eventBus.js';

class ApiService {
  constructor() {
    this.baseUrl = CONFIG.API.BASE_URL || '';
  }

  async request(endpoint, options = {}) {
    const ep = (endpoint && endpoint.startsWith('/')) ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${ep}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const fetchOptions = {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    // Удалим body для GET-запросов (fetch не любит body в GET)
    if (fetchOptions.method && fetchOptions.method.toUpperCase() === 'GET') {
      delete fetchOptions.body;
    }

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        let errBody;
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          errBody = await response.json().catch(() => null);
        } else {
          errBody = await response.text().catch(() => null);
        }
        const err = new Error(`HTTP ${response.status}`);
        err.body = errBody;
        throw err;
      }

      if (response.status === 204 || response.status === 201) {
        const ct = response.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return null;
        return await response.json();
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      EventBus.emit('api:error', { endpoint, error });
      throw error;
    }
  }

  // Загрузка списка заявок (как было)
  async fetchSubmissions(page, perPage, { sortBy, order } = {}) {
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage)
      });

      if (sortBy) params.append('sort_by', sortBy);
      if (order) params.append('order', order);

      return await this.request(`${CONFIG.API.ENDPOINTS.SUBMISSIONS}?${params.toString()}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('fetchSubmissions error', error);
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
      console.error('updateSubmissionStatus error', error);
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
      console.error('addSubmission error', error);
      throw new Error('Ошибка при сохранении клиента');
    }
  }


  async fetchAdminComments(submissionId) {
    try {
      if (!submissionId) throw new Error('submissionId required');
      const payload = { submissions_id: submissionId };
      return await this.request(CONFIG.API.ENDPOINTS.GET_COMMENTS, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('fetchAdminComments error', err);
      throw err;
    }
  }

  async addAdminComment(submissionId, commentText) {
    try {
      if (!submissionId) throw new Error('submissionId required');
      if (!commentText || !commentText.trim()) throw new Error('commentText required');
  
      const body = {
        submissions_id: submissionId,
        text: commentText
      };
  
      return await this.request(CONFIG.API.ENDPOINTS.ADD_COMMENTS, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('addAdminComment error', err);
      throw err;
    }
  }
}

export const apiService = new ApiService();
