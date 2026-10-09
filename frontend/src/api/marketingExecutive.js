import api from './axios';

export const marketingExecutiveApi = {
  // Marketing Executives
  getExecutives: (params = {}) => api.get('/marketing-executives', { params }),
  getActiveExecutives: () => api.get('/marketing-executives/active'),
  getExecutive: (id) => api.get(`/marketing-executives/${id}`),
  createExecutive: (data) => api.post('/marketing-executives', data),
  updateExecutive: (id, data) => api.put(`/marketing-executives/${id}`, data),
  deleteExecutive: (id) => api.delete(`/marketing-executives/${id}`),
};