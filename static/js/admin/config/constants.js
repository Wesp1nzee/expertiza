export const CONFIG = {
  API: {
    BASE_URL: '/admin/api/v1',
    ENDPOINTS: {
      SUBMISSIONS: '/dashboard-page',
      UPDATE_STATUS: '/update-submission-status',
      ADD_SUBMISSION: '/add-submissions'
    }
  },
  PAGINATION: {
    PAGE_SIZE: 10,
    DEFAULT_PAGE: 1
  },
  UI: {
    SEARCH_DELAY: 300,
    NOTIFICATION_DURATION: 3000
  }
};

export const SUBMISSION_STATUSES = {
  NEW: 'new',
  VIEWED: 'viewed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REJECTED: 'rejected'
};

export const STATUS_LABELS = {
  [SUBMISSION_STATUSES.NEW]: 'Новая',
  [SUBMISSION_STATUSES.VIEWED]: 'Просмотрено',
  [SUBMISSION_STATUSES.IN_PROGRESS]: 'В работе',
  [SUBMISSION_STATUSES.COMPLETED]: 'Завершено',
  [SUBMISSION_STATUSES.REJECTED]: 'Отклонено'
};

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

