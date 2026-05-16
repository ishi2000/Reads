import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Bearer token fallback (some PWA contexts strip 3rd-party cookies)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cosift_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export function saveToken(token) {
  if (token) localStorage.setItem("cosift_token", token);
}
export function clearToken() {
  localStorage.removeItem("cosift_token");
}
