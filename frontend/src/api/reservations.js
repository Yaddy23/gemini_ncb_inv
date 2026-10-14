import api from './axios';

export const reservationsApi = {
  getReservations: (params = {}) => api.get('/stock/reservations', { params }),
  expireStale: () => api.post('/stock/reservations/expire-stale')
};
