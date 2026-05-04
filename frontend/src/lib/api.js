// API Client - wraps all backend calls
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('tm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-redirect on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('tm_token');
      localStorage.removeItem('tm_user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// ---- Jobs ----
export const jobsApi = {
  list: (params) => api.get('/jobs', { params }),
  get: (id) => api.get(`/jobs/${id}`),
  create: (data) => api.post('/jobs', data),
  update: (id, data) => api.patch(`/jobs/${id}`, data),
  close: (id) => api.delete(`/jobs/${id}`),
  myJobs: () => api.get('/jobs/employer/mine'),
};

// ---- Applications ----
export const applicationsApi = {
  apply: (data) => api.post('/applications', data),
  mine: () => api.get('/applications/mine'),
  forJob: (jobId) => api.get(`/applications/job/${jobId}`),
  get: (id) => api.get(`/applications/${id}`),
  updateStatus: (id, data) => api.patch(`/applications/${id}/status`, data),
};

// ---- AI / Resume ----
export const aiApi = {
  uploadResume: (formData) => api.post('/ai/resume/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getResume: () => api.get('/ai/resume'),
  rescore: (applicationId) => api.post(`/ai/score/${applicationId}`),
};

// ---- Payments ----
export const paymentsApi = {
  createCheckout: (data) => api.post('/payments/create-checkout', data),
  history: () => api.get('/payments/history'),
  verify: (sessionId) => api.get(`/payments/verify/${sessionId}`),
};

// ---- Admin ----
export const adminApi = {
  stats: () => api.get('/admin/stats'),
  users: (params) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle`),
  jobs: (params) => api.get('/admin/jobs', { params }),
  updateJobStatus: (id, status) => api.patch(`/admin/jobs/${id}/status`, { status }),
  payments: () => api.get('/admin/payments'),
};

export default api;
