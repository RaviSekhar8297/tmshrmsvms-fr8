import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if we get 401 and we're not already on the login page
    // AND if we actually have a token (meaning we were logged in)
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token');
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isUsersRequest = error.config?.url?.includes('/users/');
      
      // Don't redirect for /users/ endpoint - it might be a permission issue, not auth
      // This endpoint is used for optional features like employee dropdowns
      if (isUsersRequest) {
        // Just reject the error without redirecting
        return Promise.reject(error);
      }
      
      // If it's a login request returning 401, it's invalid credentials - don't redirect
      if (!isLoginRequest && token) {
        localStorage.removeItem('token');
        // Only redirect if we're not already on login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// API service functions
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const usersAPI = {
  getAll: (params) => api.get('/users/', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getEmployees: () => api.get('/users/employees'),
  getManagers: () => api.get('/users/managers'),
  getTeam: (userId) => api.get(`/users/${userId}/team`),
  updateDetail: (id, detailType, data) => api.put(`/users/${id}/details/${detailType}`, data),
  updatePayslipBankDetails: (empid, data) => api.put(`/payslip/bank-details/${empid}`, data),
};

export const projectsAPI = {
  getAll: (params) => api.get('/projects/', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  getDetails: (id) => api.get(`/projects/${id}/details`),
  getStats: () => api.get('/projects/stats'),
  create: (data) => api.post('/projects/', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  addTeamMember: (projectId, empid) => api.post(`/projects/${projectId}/team`, null, { params: { empid } }),
  removeTeamMember: (projectId, empid) => api.delete(`/projects/${projectId}/team/${empid}`),
};

export const tasksAPI = {
  getAll: (params) => api.get('/tasks/', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  getDetails: (id) => api.get(`/tasks/${id}/details`),
  getDurations: (id) => api.get(`/tasks/${id}/durations`),
  getStats: () => api.get('/tasks/stats'),
  getByEmployee: () => api.get('/tasks/by-employee'),
  getCalendar: (month, year) => api.get('/tasks/calendar', { params: { month, year } }),
  create: (data) => api.post('/tasks/', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  createSubtask: (taskId, data) => api.post(`/tasks/${taskId}/subtasks`, data),
  updateSubtask: (subtaskId, data) => api.put(`/tasks/subtasks/${subtaskId}`, data),
  createComment: (taskId, content) => api.post(`/tasks/${taskId}/comments`, null, { params: { content } }),
  startTimer: (taskId, notes) => api.post(`/tasks/${taskId}/timer/start`, null, { params: { notes } }),
  stopTimer: (timerId, notes) => api.post(`/tasks/timer/${timerId}/stop`, null, { params: { notes } }),
  getTimers: (taskId) => api.get(`/tasks/${taskId}/timers`),
};

export const meetingsAPI = {
  getAll: (params) => api.get('/meetings/', { params }),
  getById: (id) => api.get(`/meetings/${id}`),
  getToday: () => api.get('/meetings/today'),
  getUpcoming: (days) => api.get('/meetings/upcoming', { params: { days } }),
  getCalendar: (month, year) => api.get('/meetings/calendar', { params: { month, year } }),
  create: (data) => api.post('/meetings/', data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
  addParticipant: (meetingId, empid) => api.post(`/meetings/${meetingId}/participants`, null, { params: { empid } }),
  removeParticipant: (meetingId, empid) => api.delete(`/meetings/${meetingId}/participants/${empid}`),
  getNotes: (meetingId) => api.get(`/meetings/${meetingId}/notes`),
  saveNotes: (meetingId, notes) => api.post(`/meetings/${meetingId}/notes`, { notes }),
  updateNotes: (meetingId, notes) => api.put(`/meetings/${meetingId}/notes`, { notes }),
};

export const googleCalendarAPI = {
  getAuthUrl: () => api.get('/auth/google/authorize'),
  getStatus: () => api.get('/auth/google/status'),
  disconnect: () => api.delete('/auth/google/disconnect'),
};

export const issuesAPI = {
  getAll: (params) => api.get('/issues/', { params }),
  getById: (id) => api.get(`/issues/${id}`),
  getStats: () => api.get('/issues/stats'),
  create: (data) => api.post('/issues/', data),
  update: (id, data) => api.put(`/issues/${id}`, data),
  delete: (id) => api.delete(`/issues/${id}`),
};

export const ratingsAPI = {
  getAll: (params) => api.get('/ratings/', { params }),
  getById: (id) => api.get(`/ratings/${id}`),
  getStats: () => api.get('/ratings/stats'),
  getByEmployee: () => api.get('/ratings/by-employee'),
  getByManager: () => api.get('/ratings/by-manager'),
  getTaskRatings: (taskId) => api.get(`/ratings/task/${taskId}`),
  getUnratedTasks: () => api.get('/ratings/unrated-tasks'),
  create: (data) => api.post('/ratings/', data),
  update: (id, score, comments) => api.put(`/ratings/${id}`, null, { params: { score, comments } }),
  delete: (id) => api.delete(`/ratings/${id}`),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getActivities: (limit) => api.get('/dashboard/activities', { params: { limit } }),
  getProgress: () => api.get('/dashboard/progress'),
  getBirthdays: () => api.get('/dashboard/birthdays'),
  getAnniversaries: () => api.get('/dashboard/anniversaries'),
};

export const reportsAPI = {
  getFilters: () => api.get('/reports/filters'),
  generate: (filters) => api.post('/reports/generate', filters),
  downloadExcel: (filters) => api.post('/reports/download/excel', filters, { responseType: 'blob' }),
  downloadPdf: (filters) => api.post('/reports/download/pdf', filters, { responseType: 'blob' }),
};

export const notificationsAPI = {
  getAll: (params) => api.get('/notifications/', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const conversationsAPI = {
  getProjects: () => api.get('/conversations/projects'),
  getMessages: (projectId, limit = 100) => api.get(`/conversations/projects/${projectId}/messages`, { params: { limit } }),
  sendMessage: (projectId, message) => api.post(`/conversations/projects/${projectId}/messages`, { message }),
};

export const attendanceAPI = {
  getHistoryMonth: (month, year) => api.get('/attendance/history-month', { params: { month, year } }),
  getPrevious: (startDate, endDate) => api.get('/attendance/previous', { params: { start_date: startDate, end_date: endDate } }),
  modify: (data) => api.post('/attendance/modify', data),
  getCycle: () => api.get('/attendance/cycle'),
  createCycle: (data) => api.post('/attendance/cycle', data),
  updateCycle: (data) => api.put('/attendance/cycle', data),
  generate: (data) => api.post('/attendance/generate', data),
};

export const visitorsAPI = {
  getAll: (status) => api.get('/vms/visitors', { params: { status } }),
  getById: (id) => api.get(`/vms/visitors/${id}`),
  add: (data) => api.post('/vms/visitors/add', data),
  checkout: (id) => api.put(`/vms/visitors/${id}/checkout`),
};

export const policiesAPI = {
  getAll: () => api.get('/policies/'),
  getById: (id) => api.get(`/policies/${id}`),
  create: (data) => api.post('/policies/', data),
  upload: (formData) => api.post('/policies/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  update: (id, data) => api.put(`/policies/${id}`, data),
  delete: (id) => api.delete(`/policies/${id}`),
  markAsRead: (id, data) => api.post(`/policies/${id}/mark-read`, data),
  getReadStatus: (id) => api.get(`/policies/${id}/read-status`),
  toggleLike: (id, page) => api.post(`/policies/${id}/like/${page}`),
  getPageLikes: (id, page) => api.get(`/policies/${id}/likes/${page}`),
  getUnread: () => api.get('/policies/unread'),
  acknowledge: (id) => api.post(`/policies/${id}/acknowledge`),
};

export const resignationsAPI = {
  create: (data) => api.post('/resignations', data),
  getSelf: () => api.get('/resignations/self'),
  getAll: (status) => api.get('/resignations', { params: { status } }),
  getById: (id) => api.get(`/resignations/${id}`),
  approveManager: (id, data) => api.post(`/resignations/${id}/approve-manager`, data),
  approveHR: (id, data) => api.post(`/resignations/${id}/approve-hr`, data),
  approveHOD: (id, data) => api.post(`/resignations/${id}/approve-hod`, data),
  withdraw: (id) => api.post(`/resignations/${id}/withdraw`),
  getNoticePeriodInfo: () => api.get('/resignations/notice-period-info'),
};
