/**
 * Resolves the API base URL.
 * In development, defaults to '/api' (proxied by Vite).
 * In production with a separate domain, uses VITE_API_BASE_URL (e.g. 'https://api.yourdomain.com/api').
 */
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
