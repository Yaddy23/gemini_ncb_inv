import api from './axios';

export const drsiApi = {
  // Delivery Receipts
  getDRs: (params = {}) => api.get('/drsi/dr', { params }),
  getDR: (id) => api.get(`/drsi/dr/${id}`),
  createDR: (data) => api.post('/drsi/dr', data),
  updateDR: (id, data) => api.put(`/drsi/dr/${id}`, data),
  deleteDR: (id) => api.delete(`/drsi/dr/${id}`),
  issueDR: (id) => api.post(`/drsi/dr/${id}/issue`),
  exportDR: (id, format = 'pdf') => api.get(`/drsi/dr/${id}/export`, {
    params: { format },
    responseType: 'blob'
  }),

  // Sales Invoices
  getSIs: (params = {}) => api.get('/drsi/si', { params }),
  getSI: (id) => api.get(`/drsi/si/${id}`),
  createSI: (data) => api.post('/drsi/si', data),
  updateSI: (id, data) => api.put(`/drsi/si/${id}`, data),
  deleteSI: (id) => api.delete(`/drsi/si/${id}`),
  issueSI: (id) => api.post(`/drsi/si/${id}/issue`),
  exportSI: (id, format = 'pdf') => api.get(`/drsi/si/${id}/export`, {
    params: { format },
    responseType: 'blob'
  }),

  // Book lookup (reuse existing)
  lookupBook: (isbn) => api.get(`/books/lookup/${isbn}`)
};