import api from './axios';

export const efApi = {
  // Evaluation Forms
  getEFs: (params = {}) => api.get('/ef', { params }),
  getEF: (id) => api.get(`/ef/${id}`),
  createEF: (data) => api.post('/ef', data),
  updateEF: (id, data) => api.put(`/ef/${id}`, data),
  deleteEF: (id) => api.delete(`/ef/${id}`),
  issueEF: (id) => api.post(`/ef/${id}/issue`),
  cancelEF: (id, cancelReason) => api.post(`/ef/${id}/cancel`, { cancelReason }),
  exportEF: (id) => api.get(`/ef/${id}/export`, {
    params: { format: 'xlsx' },
    responseType: 'blob'
  }),

  // Book lookup (reuse existing)
  lookupBook: (isbn) => api.get(`/books/lookup/${isbn}`)
};