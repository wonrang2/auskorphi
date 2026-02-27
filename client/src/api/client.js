import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

export default api;
