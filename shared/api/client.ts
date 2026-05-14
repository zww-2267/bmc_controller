import axios from 'axios';

const port = (typeof window !== 'undefined' && (window as any).__BACKEND_PORT__)
  ? (window as any).__BACKEND_PORT__
  : 3001;

const api = axios.create({
  baseURL: `http://127.0.0.1:${port}/api`,
  timeout: 10_000,
});

export default api;
