// Formcatch — экран «Заявки»: одна таблица со всех сайтов, статистика, график, Excel.
import { t } from './texts.js';
import { sb, h, s, show, fail, formatDate, loadSites } from './core.js';

const PAGE = 50;            // строк таблицы за раз
const MAX_LOAD = 5000;      // заявок за один запрос
const DAY = 86400000;

// Фильтры запоминаем на время сеанса (при возврате на экран — те же)
const state = { site: '', period: '30', query: '' };

// Ключ дня по местному времени: 2026-10-08
function dayKey(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function shortDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

// Коротко для таблицы: «7 окт, 21:50»
function formatShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') + ', ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfToday() {
  return startOfDay(new Date());
}

// Поля, которые не попали в Имя / Телефон / Email (сообщение, город, услуга…)
function otherFields(lead) {
  const main = [lead.name, lead.phone, lead.email].filter(Boolean);
  return (lead.fields || []).filter((f) => !f.role && !main.includes(f.value));
}

function otherText(lead) {
  return otherFields(lead).map((f) => f.label + ': ' + f.value).join('; ');
}

async function loadLeads() {
  let q = sb.from('leads')
    .select('id, site_id, created_at, name, phone, email, fields, page, kind')
    .eq('blocked', false)
    .order('created_at', { ascending: false })
    .limit(MAX_LOAD);
  if (state.site) q = q.eq('site_id', state.site);
  if (state.period !== 'all') q = q.gte('created_at', new Date(startOfToday() - (Number(state.period) - 1) * DAY).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function matches(lead, query) {
  if (!query) return true;
  const text = [lead.name, lead.phone, lead.email, ...(lead.fields || []).map((f) => f.value)].join(' ').toLowerCase();
  if (text.includes(query.toLowerCase())) return true;
  // Телефон ищем по цифрам: «9001234» найдёт «+7 900 123-45-67»
  const digits = query.replace(/\D/g, '');
  return digits.length >= 3 && text.replace(/\D/g, '').includes(digits);
}

// Со страницы сайта: открыть общую таблицу с фильтром по этому сайту
export function openSiteLeads(siteId) {
  state.site = siteId;
  state.query = '';
}

export async function renderLeads() {
  show(h('p', { class: 'muted' }, t('loading')));
  let sites, leads;
  try {
    sites = await loadSites();
    if (state.site && !sites.some((x) => x.id === state.site)) state.site = '';
    leads = sites.length ? await loadLeads() : [];
  } catch (e) {
    console.error(e);
    return show(h('p', { class: 'error' }, t('loadError')));
  }

  if (!sites.length) {
    return show(
      h('h1', {}, t('leadsH1')),
      h('div', { class: 'card empty' },
        h('p', { class: 'muted' }, t('noSitesLeads')),
        h('a', { class: 'btn', href: '#/sites' }, '+ ' + t('goSites')),
      ),
    );
  }

  const siteName = Object.fromEntries(sites.map((x) => [x.id, x.name]));
  const filtered = () => leads.filter((l) => matches(l, state.query));

  // --- Фильтры ---
  const siteSelect = h('select', { id: 'f-site', onchange: (e) => { state.site = e.target.value; renderLeads(); } },
    h('option', { value: '' }, t('allSites')),
    sites.map((x) => h('option', { value: x.id, selected: x.id === state.site }, x.name)),
  );
  const periodSelect = h('select', { id: 'f-period', onchange: (e) => { state.period = e.target.value; renderLeads(); } },
    [['7', 'period7'], ['30', 'period30'], ['90', 'period90'], ['all', 'periodAll']]
      .map(([v, k]) => h('option', { value: v, selected: v === state.period }, t(k))),
  );
  const searchInput = h('input', {
    type: 'search', id: 'f-search', value: state.query, placeholder: t('searchPlaceholder'), autocomplete: 'off',
    oninput: (e) => { state.query = e.target.value.trim(); drawTable(); },
  });
  const excelBtn = h('button', { type: 'button', class: 'btn', onclick: () => downloadExcel(filtered(), siteName, excelBtn) }, t('downloadExcel'));

  // --- Статистика: считаем без учёта поиска ---
  const today = startOfToday();
  const countToday = leads.filter((l) => new Date(l.created_at) >= today).length;
  const countWeek = leads.filter((l) => new Date(l.created_at) >= today - 6 * DAY).length;
  const tiles = h('div', { class: 'tiles' },
    tile(t('statPeriod'), leads.length),
    tile(t('statToday'), countToday),
    state.period === '7' ? null : tile(t('statWeek'), countWeek),
  );

  // --- Таблица ---
  const tableBox = h('div');
  let limit = PAGE;
  function drawTable() {
    const rows = filtered();
    excelBtn.disabled = !rows.length;
    if (!rows.length) {
      tableBox.replaceChildren(h('div', { class: 'card empty' },
        h('p', { class: 'muted' }, state.query ? t('noLeadsFound') : t('noLeadsYet'))));
      return;
    }
    const body = h('tbody');
    for (const lead of rows.slice(0, limit)) body.append(...leadRows(lead, siteName, sites.length > 1));
    tableBox.replaceChildren(...[
      h('div', { class: 'table-wrap' },
        h('table', { class: 'leads' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col' }, t('colDate')),
            sites.length > 1 ? h('th', { scope: 'col' }, t('colSite')) : null,
            h('th', { scope: 'col' }, t('colName')),
            h('th', { scope: 'col' }, t('colPhone')),
            h('th', { scope: 'col' }, t('colEmail')),
            h('th', { scope: 'col' }, t('colOther')),
          )),
          body,
        ),
      ),
      rows.length > limit
        ? h('div', { class: 'more' },
          h('span', { class: 'muted' }, t('shownOf', { shown: limit, total: rows.length })),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { limit += PAGE; drawTable(); } }, t('showMore')))
        : null,
    ].filter(Boolean));
  }

  show(
    h('div', { class: 'head-row' }, h('h1', {}, t('leadsH1')), excelBtn),
    h('div', { class: 'filters' },
      h('label', {}, t('filterSite'), siteSelect),
      h('label', {}, t('filterPeriod'), periodSelect),
      h('label', { class: 'grow' }, t('search'), searchInput),
    ),
    tiles,
    leads.length ? chartCard(leads) : null,
    tableBox,
  );
  drawTable();
}

function tile(label, value) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value' }, value.toLocaleString('ru-RU')));
}

// Строка заявки + скрытая строка со всеми полями
function leadRows(lead, siteName, showSite) {
  const cols = showSite ? 6 : 5;
  const other = otherText(lead);
  const details = h('tr', { class: 'details', hidden: true },
    h('td', { colspan: cols },
      h('div', { class: 'details-title' }, t('allFields')),
      h('dl', {}, (lead.fields || []).flatMap((f) => [h('dt', {}, f.label), h('dd', {}, f.value)])),
      h('p', { class: 'muted' },
        t('colForm') + ': ' + (lead.kind === 'fallback' ? t('formFallback') : t('formMain')) + ' · ' + t('colPage') + ': ',
        lead.page ? h('a', { href: lead.page, target: '_blank', rel: 'noopener noreferrer' }, lead.page) : '—'),
    ),
  );
  const toggle = h('button', { type: 'button', class: 'row-toggle', 'aria-expanded': 'false', 'aria-label': t('openRow') }, '▸');
  function flip() {
    details.hidden = !details.hidden;
    toggle.setAttribute('aria-expanded', String(!details.hidden));
    toggle.textContent = details.hidden ? '▸' : '▾';
    row.classList.toggle('open', !details.hidden);
  }
  toggle.addEventListener('click', (e) => { e.stopPropagation(); flip(); });
  const link = (href, text) => h('a', { href, onclick: (e) => e.stopPropagation() }, text);
  const row = h('tr', { class: 'lead', onclick: flip },
    h('td', { class: 'nowrap', title: formatDate(lead.created_at) }, toggle, ' ', formatShort(lead.created_at)),
    showSite ? h('td', { class: 'site-cell', title: siteName[lead.site_id] || '' }, siteName[lead.site_id] || '') : null,
    h('td', {}, lead.name || '—'),
    h('td', { class: 'nowrap' }, lead.phone ? link('tel:' + lead.phone.replace(/[^\d+]/g, ''), lead.phone) : '—'),
    h('td', {}, lead.email ? link('mailto:' + lead.email, lead.email) : '—'),
    h('td', { class: 'other' }, other || '—'),
  );
  return [row, details];
}

// --- График: заявки по дням (одна серия, столбики) ---
function chartCard(leads) {
  const today = startOfToday();
  // «За всё время» — от первой заявки, но не больше 90 и не меньше 7 дней
  let days = Number(state.period);
  if (state.period === 'all') {
    const first = startOfDay(leads[leads.length - 1].created_at);
    days = Math.min(90, Math.max(7, Math.round((today - first) / DAY) + 1));
  }
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(today - i * DAY + 12 * 3600000)));
  const counts = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const l of leads) {
    const k = dayKey(l.created_at);
    if (k in counts) counts[k]++;
  }
  const total = keys.reduce((sum, k) => sum + counts[k], 0);

  const box = h('div', { class: 'chart' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const ro = new ResizeObserver(() => draw());
  let lastWidth = 0;

  function draw() {
    const W = box.clientWidth;
    if (!W || W === lastWidth) return;
    lastWidth = W;
    const H = 180, left = 32, right = 4, top = 8, bottom = 24;
    const plotW = W - left - right, plotH = H - top - bottom;
    const max = Math.max(...keys.map((k) => counts[k]), 1);
    const step = max <= 4 ? 1 : Math.ceil(max / 4);
    const yMax = Math.ceil(max / step) * step;
    const slot = plotW / keys.length;
    const barW = Math.max(2, Math.min(24, slot - 2));
    const y = (v) => top + plotH - (v / yMax) * plotH;

    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('chartLabel', { count: total, days }) });
    for (let v = 0; v <= yMax; v += step) {
      svg.append(s('line', { x1: left, x2: W - right, y1: y(v), y2: y(v), class: v ? 'grid' : 'base' }));
      svg.append(s('text', { x: left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, v));
    }
    // Подписи дат: первая, середина, последняя
    const labelAt = new Set([0, Math.floor((keys.length - 1) / 2), keys.length - 1]);
    keys.forEach((k, i) => {
      const cx = left + slot * i + slot / 2;
      const v = counts[k];
      if (v) {
        const x = cx - barW / 2, yt = y(v), r = Math.min(4, barW / 2, (top + plotH - yt));
        // Скруглён только верх столбика, низ — ровный, на базовой линии
        svg.append(s('path', {
          class: 'bar',
          d: `M${x},${top + plotH}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + barW - r}Q${x + barW},${yt} ${x + barW},${yt + r}V${top + plotH}Z`,
        }));
      }
      if (labelAt.has(i)) svg.append(s('text', { x: cx, y: H - 6, 'text-anchor': i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle', class: 'axis' }, shortDay(k)));
      // Зона наведения шире столбика — на всю колонку
      const hit = s('rect', { x: left + slot * i, y: top, width: slot, height: plotH, class: 'hit' });
      hit.addEventListener('pointerenter', () => {
        tip.replaceChildren(h('strong', {}, String(v)), ' · ' + shortDay(k));
        tip.hidden = false;
        const tx = Math.min(Math.max(cx, 40), W - 40);
        tip.style.left = tx + 'px';
        tip.style.top = (v ? y(v) : top + plotH) - 8 + 'px';
      });
      hit.addEventListener('pointerleave', () => { tip.hidden = true; });
      svg.append(hit);
    });
    box.replaceChildren(svg, tip);
  }

  // Рисуем, как только блок появится на странице, и заново при изменении ширины
  setTimeout(() => { ro.observe(box); draw(); }, 0);
  return h('section', { class: 'card' }, h('h2', {}, t('chartTitle')), box);
}

// --- Excel: настоящий .xlsx с текущими фильтрами и поиском ---
async function downloadExcel(rows, siteName, btn) {
  btn.disabled = true;
  btn.textContent = t('downloading');
  try {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const data = rows.map((l) => ({
      [t('colDate')]: new Date(l.created_at),
      [t('colSite')]: siteName[l.site_id] || '',
      [t('colName')]: l.name || '',
      [t('colPhone')]: l.phone || '',
      [t('colEmail')]: l.email || '',
      [t('colOther')]: otherText(l),
      [t('colForm')]: l.kind === 'fallback' ? t('formFallback') : t('formMain'),
      [t('colPage')]: l.page || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data, { cellDates: true });
    // Дата — настоящая дата Excel (сортируется), в привычном виде: 07.10.2026 21:50
    for (let r = 1; r <= data.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (cell) cell.z = String.raw`dd\.mm\.yyyy hh:mm`; // точки экранированы, иначе формат читается как доли секунды
    }
    ws['!cols'] = [18, 22, 22, 20, 28, 50, 24, 40].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('excelSheet'));
    XLSX.writeFile(wb, `${t('excelFile')}-${dayKey(new Date())}.xlsx`);
  } catch (e) {
    fail(e);
  } finally {
    btn.disabled = false;
    btn.textContent = t('downloadExcel');
  }
}
