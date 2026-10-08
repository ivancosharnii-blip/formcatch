// Formcatch — общее для всех экранов кабинета: подключение к базе и мелкие помощники.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { t } from './texts.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

export const app = document.getElementById('app');

// Создать элемент: h('div', { class: 'x', onclick: fn }, 'текст', child)
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// Элемент SVG (для графика)
export function s(tag, attrs, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : String(c));
  return el;
}

export function show(...nodes) {
  app.replaceChildren(...nodes.filter((n) => n != null && n !== false));
}

// Сообщение об ошибке внизу экрана (вместо alert — его блокируют некоторые браузеры)
export function fail(error) {
  console.error(error);
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = h('div', { id: 'toast', class: 'toast', role: 'alert' });
    document.body.append(toast);
  }
  toast.textContent = t('actionError', { error: error?.message || error });
  toast.hidden = false;
  clearTimeout(fail.timer);
  fail.timer = setTimeout(() => { toast.hidden = true; }, 6000);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export async function loadSites() {
  const { data, error } = await sb.from('sites')
    .select('id, name, domain, form_found, connected_at, created_at')
    .order('created_at');
  if (error) throw error;
  return data;
}
