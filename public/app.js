/**
 * app.js — Shared client-side utilities for MeetupPass
 */

// ── Toast notification ─────────────────────────────────────────
let _toastContainer;
function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 * @param {number} [duration=3500]
 */
export function toast(message, type = 'info', duration = 3500) {
  const container = getToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── API fetch wrapper ──────────────────────────────────────────
/**
 * Thin fetch wrapper that always parses JSON and throws on error.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function api(url, options = {}) {
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
    options.headers = { 'Content-Type': 'application/json', ...options.headers };
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ── Query param helpers ────────────────────────────────────────
/**
 * Get a URL query parameter value.
 * @param {string} key
 * @returns {string|null}
 */
export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ── Format helpers ─────────────────────────────────────────────
/**
 * Format an ISO date string as a human-readable date.
 * @param {string} iso
 * @returns {string}
 */
export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format an ISO datetime string as "12 Aug 2026, 3:45 PM".
 * @param {string} iso
 * @returns {string}
 */
export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Get initials from a name string.
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Active nav link ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href')?.split('/').pop() || 'index.html';
    if (href === current) a.classList.add('active');
  });
});
