// Theme: 'dark' (default) | 'light'
const STORAGE_KEY = 'hd_theme';

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'dark';
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

// Apply on load
applyTheme(getTheme());
