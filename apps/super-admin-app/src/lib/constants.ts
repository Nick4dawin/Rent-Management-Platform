export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  MANDATORS: '/mandators',
  MANDATOR_DETAILS: (id: string) => `/mandators/${id}`,
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/super-admin/auth/login',
    LOGOUT: '/api/v1/super-admin/auth/logout',
    REFRESH: '/api/v1/super-admin/auth/refresh',
  },
  MANDATORS: {
    LIST: '/api/v1/super-admin/mandators',
    CREATE: '/api/v1/super-admin/mandators',
    GET: (id: string) => `/api/v1/super-admin/mandators/${id}`,
    ACTIVATE: (id: string) => `/api/v1/super-admin/mandators/${id}/activate`,
    DEACTIVATE: (id: string) => `/api/v1/super-admin/mandators/${id}/deactivate`,
  },
  ANALYTICS: {
    OVERVIEW: '/api/v1/super-admin/analytics/overview',
  },
} as const;
