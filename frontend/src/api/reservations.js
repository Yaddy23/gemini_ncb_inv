import api from './axios';

export const reservationsApi = {
  getReservations: (params = {}) => api.get('/stock/reservations', { params }),
  expireStale: () => api.post('/stock/reservations/expire-stale'),
  releaseItem: (drId, isbn, lineIndex) => api.post('/stock/reservations/release-item', { drId, isbn, lineIndex })
};
