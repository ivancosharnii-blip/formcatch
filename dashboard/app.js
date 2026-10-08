// Formcatch — кабинет владельца: вход через Google, заявки, сайты, подключение.
import { WIDGET_URL } from './config.js';
import { t, getLang, setLang } from './texts.js';
import { sb, h, show, fail, formatDate, loadSites } from './core.js';
import { renderLeads, openSiteLeads } from './leads.js';

let user = null;
let poll = null;          // опрос «подключился ли сайт»

// --- Мелкие помощники ---

function duration(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return t('sec', { n: s });
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return t('min', { n: m }) + (s % 60 ? ' ' + t('sec', { n: s % 60 }) : '');
  }
  if (s < 86400) return t('hour', { n: Math.floor(s / 3600) }) + ' ' + t('min', { n: Math.floor((s % 3600) / 60) });
  return '';
}

function snippet(site) {
  return `<script src="${WIDGET_URL}" data-site="${site.id}" defer></script>`;
}

// «Это не мой сайт» — скрытые предупреждения о новых доменах (только в этом браузере)
function dismissed() {
  try { return JSON.parse(localStorage.getItem('formcatch:dismissed') || '[]'); } catch { return []; }
}
function dismiss(siteId, domain) {
  try { localStorage.setItem('formcatch:dismissed', JSON.stringify([...dismissed(), siteId + '|' + domain])); } catch { /* ничего */ }
}

// --- Данные ---

async function countLeads(siteId) {
  const { count, error } = await sb.from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId).eq('blocked', false);
  if (error) throw error;
  return count ?? 0;
}

// Заявки с чужого домена: { siteId: [{ domain, count }] }
async function loadNewDomains(sites) {
  const { data, error } = await sb.from('leads')
    .select('site_id, domain')
    .eq('blocked', true)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  const hidden = dismissed();
  const bound = Object.fromEntries(sites.map((s) => [s.id, s.domain]));
  const result = {};
  for (const row of data) {
    if (row.domain === bound[row.site_id] || hidden.includes(row.site_id + '|' + row.domain)) continue;
    const list = (result[row.site_id] ||= []);
    const item = list.find((x) => x.domain === row.domain);
    if (item) item.count++;
    else list.push({ domain: row.domain, count: 1 });
  }
  return result;
}

// --- Экраны ---

function renderLogin(error) {
  show(h('section', { class: 'login card' },
    h('h1', {}, t('appTagline')),
    h('p', {}, t('loginLead')),
    h('button', {
      type: 'button', class: 'btn', onclick: async (e) => {
        e.currentTarget.disabled = true;
        const { error: err } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: location.origin + location.pathname },
        });
        if (err) renderLogin(err.message);
      },
    }, t('loginGoogle')),
    error ? h('p', { class: 'error', role: 'alert' }, t('loginError', { error })) : null,
  ));
}

async function renderSites() {
  show(h('p', { class: 'muted' }, t('loading')));
  let sites, counts, domains;
  try {
    sites = await loadSites();
    [counts, domains] = await Promise.all([
      Promise.all(sites.map((s) => countLeads(s.id))),
      loadNewDomains(sites),
    ]);
  } catch (e) {
    console.error(e);
    return show(h('p', { class: 'error' }, t('loadError')));
  }

  const addBox = h('div', { class: 'card', hidden: true });
  const addBtn = h('button', { type: 'button', class: 'btn', onclick: () => openAdd() }, '+ ' + t('addSite'));

  function openAdd() {
    const input = h('input', { type: 'text', maxlength: '60', placeholder: t('siteNamePlaceholder') });
    const create = h('button', { type: 'submit', class: 'btn' }, t('create'));
    addBox.replaceChildren(h('form', {
      class: 'add-form',
      onsubmit: async (e) => {
        e.preventDefault();
        create.disabled = true;
        const name = input.value.trim() || t('defaultSiteName');
        const { data, error } = await sb.from('sites').insert({ name }).select('id').single();
        if (error) { create.disabled = false; return fail(error); }
        location.hash = '#/site/' + data.id;
      },
    },
    h('label', {}, t('siteNameLabel'), input),
    create,
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { addBox.hidden = true; addBtn.hidden = false; } }, t('cancel')),
    ));
    addBox.hidden = false;
    addBtn.hidden = true;
    input.focus();
  }

  const list = sites.length
    ? h('div', { class: 'sites' }, sites.map((s, i) => h('a', { class: 'site', href: '#/site/' + s.id, 'aria-label': s.name + ' — ' + (s.domain || t('notConnected')) },
      h('div', {},
        h('div', { class: 'site-name' }, s.name),
        h('div', { class: 'site-meta' }, s.domain || t('notConnected')),
      ),
      h('div', { class: 'site-side' },
        domains[s.id] ? h('span', { class: 'badge warn' }, t('newDomainBadge')) : null,
        s.connected_at
          ? h('span', { class: 'badge ok' }, t('leadsCount', { count: counts[i] }))
          : h('span', { class: 'badge wait' }, t('notConnected')),
      ),
    )))
    : h('div', { class: 'card empty' },
      h('h2', {}, t('emptyTitle')),
      h('p', { class: 'muted' }, t('emptyText')),
    );

  show(
    h('div', { class: 'head-row' }, h('h1', {}, t('mySites')), addBtn),
    addBox,
    list,
  );
  if (!sites.length) openAdd();
}

async function renderSite(id) {
  show(h('p', { class: 'muted' }, t('loading')));
  let site, count, domains, last;
  try {
    const sites = await loadSites();
    site = sites.find((s) => s.id === id);
    if (!site) { location.hash = '#/sites'; return; }
    [count, domains, last] = await Promise.all([
      countLeads(id),
      loadNewDomains(sites),
      sb.from('leads').select('created_at').eq('site_id', id).eq('blocked', false)
        .order('created_at', { ascending: false }).limit(1),
    ]);
  } catch (e) {
    console.error(e);
    return show(h('p', { class: 'error' }, t('loadError')));
  }

  show(
    h('a', { class: 'back', href: '#/sites' }, t('back')),
    h('h1', {}, site.name),
    ...(domains[id] || []).map((d) => domainAlert(site, d)),
    connectCard(site),
    h('section', { class: 'card' },
      h('h2', {}, t('leadsTitle')),
      h('p', { class: 'muted' }, count
        ? t('leadsSummary', { count, date: formatDate(last.data[0].created_at) })
        : t('leadsNone')),
      count ? h('a', { class: 'btn ghost', href: '#/', onclick: () => openSiteLeads(id) }, t('openSiteLeads')) : null,
    ),
    settingsCard(site),
  );

  // Ждём первый сигнал с сайта: опрашиваем базу каждые 3 сек
  if (!site.connected_at) {
    poll = setInterval(async () => {
      const { data } = await sb.from('sites').select('connected_at, domain').eq('id', id).single();
      if (data?.connected_at) {
        clearInterval(poll);
        poll = null;
        renderSite(id);
      }
    }, 3000);
  }
}

function connectCard(site) {
  const code = snippet(site);
  const copyBtn = h('button', {
    type: 'button', class: 'btn small', onclick: async () => {
      try { await navigator.clipboard.writeText(code); } catch { /* старый браузер: выделим текст */ }
      copyBtn.textContent = t('copied');
      setTimeout(() => { copyBtn.textContent = t('copy'); }, 2000);
    },
  }, t('copy'));

  const platforms = [
    ['tilda', t('platformTilda'), t('howTilda')],
    ['wordpress', t('platformWordpress'), t('howWordpress')],
    ['wix', t('platformWix'), t('howWix')],
    ['other', t('platformOther'), t('howOther')],
  ];
  const how = h('ol', { class: 'how' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  function pick(key) {
    const [, , steps] = platforms.find((p) => p[0] === key);
    // Последний пункт у Tilda и Wix — примечание про тариф
    const withNote = key === 'tilda' || key === 'wix';
    how.replaceChildren(...steps.map((s, i) => h('li', { class: withNote && i === steps.length - 1 ? 'note' : null }, s)));
    for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.key === key));
  }
  for (const [key, label] of platforms) {
    tabs.append(h('button', { type: 'button', class: 'tab', role: 'tab', 'data-key': key, onclick: () => pick(key) }, label));
  }
  pick('tilda');

  const instructions = [
    h('div', { class: 'code' }, h('pre', {}, code), copyBtn),
    tabs,
    how,
  ];

  if (site.connected_at) {
    const time = duration(new Date(site.connected_at) - new Date(site.created_at));
    return h('section', { class: 'card' },
      h('h2', {}, t('connectTitle')),
      h('div', { class: 'status ok' }, time ? t('connectedIn', { time }) : t('connected')),
      site.domain ? h('p', { class: 'muted' }, t('connectedDomain', { domain: site.domain })) : null,
      h('details', {}, h('summary', {}, t('showCode')), ...instructions),
    );
  }

  return h('section', { class: 'card' },
    h('h2', {}, t('connectTitle')),
    h('ol', { class: 'steps' }, h('li', {}, t('connectStep1')), h('li', {}, t('connectStep2')), h('li', {}, t('connectStep3'))),
    ...instructions,
    h('div', { class: 'status wait', style: 'margin-top:16px' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), t('waiting')),
  );
}

function domainAlert(site, d) {
  const box = h('div', { class: 'alert', role: 'alert' },
    h('span', {}, t('domainAlert', { domain: d.domain, count: d.count })),
    h('div', { class: 'alert-actions' },
      h('button', {
        type: 'button', class: 'btn small', onclick: async () => {
          const { error } = await sb.rpc('allow_domain', { p_site: site.id, p_domain: d.domain });
          if (error) return fail(error);
          box.replaceWith(h('p', { class: 'note-ok' }, t('domainAllowed', { domain: d.domain })));
          setTimeout(() => renderSite(site.id), 1500);
        },
      }, t('domainAllow')),
      h('button', {
        type: 'button', class: 'btn ghost small', onclick: () => { dismiss(site.id, d.domain); box.remove(); },
      }, t('domainDismiss')),
    ),
  );
  return box;
}

function settingsCard(site) {
  const nameInput = h('input', { type: 'text', maxlength: '60', value: site.name });
  const saveBtn = h('button', { type: 'submit', class: 'btn ghost' }, t('rename'));

  return h('section', { class: 'card' },
    h('h2', {}, t('settingsTitle')),
    h('form', {
      class: 'row',
      onsubmit: async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;
        const { error } = await sb.from('sites').update({ name }).eq('id', site.id);
        if (error) return fail(error);
        saveBtn.textContent = t('saved');
        document.querySelector('h1').textContent = name;
        setTimeout(() => { saveBtn.textContent = t('rename'); }, 2000);
      },
    }, h('label', {}, t('siteNameLabel'), nameInput), saveBtn),
    h('div', { class: 'setting' },
      h('strong', {}, t('fallbackTitle')),
      h('p', { class: 'muted' }, site.form_found ? t('fallbackOff') : t('fallbackOn')),
      site.form_found ? h('button', {
        type: 'button', class: 'btn ghost small', onclick: async () => {
          const { error } = await sb.from('sites').update({ form_found: false }).eq('id', site.id);
          if (error) return fail(error);
          renderSite(site.id);
        },
      }, t('fallbackReset')) : null,
    ),
    deleteBlock(site),
  );
}

// Удаление в два шага: «Удалить сайт» → «Точно? Да / Нет»
function deleteBlock(site) {
  const box = h('div', { class: 'setting' });
  function ask() {
    box.replaceChildren(
      h('p', { role: 'alert' }, t('deleteConfirm', { name: site.name })),
      h('div', { class: 'alert-actions' },
        h('button', {
          type: 'button', class: 'btn danger', onclick: async (e) => {
            e.currentTarget.disabled = true;
            const { error } = await sb.from('sites').delete().eq('id', site.id);
            if (error) { reset(true); return fail(error); }
            location.hash = '#/sites';
          },
        }, t('deleteYes')),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => reset(true) }, t('cancel')),
      ),
    );
    box.querySelector('.btn.ghost').focus();
  }
  function reset(focus) {
    box.replaceChildren(h('button', { type: 'button', class: 'btn danger', onclick: ask }, t('deleteSite')));
    if (focus) box.firstChild.focus();
  }
  reset();
  return box;
}

// --- Навигация и вход ---

function route() {
  if (poll) { clearInterval(poll); poll = null; }
  const m = location.hash.match(/^#\/site\/([\w-]+)$/);
  const page = !user ? '' : m || location.hash === '#/sites' ? 'sites' : 'leads';
  document.getElementById('nav').hidden = !user;
  for (const a of document.querySelectorAll('#nav a')) {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (!user) return renderLogin();
  if (m) renderSite(m[1]);
  else if (page === 'sites') renderSites();
  else renderLeads();
}

function setUser(u) {
  const changed = (u?.id || null) !== (user?.id || null);
  user = u;
  document.getElementById('user').hidden = !u;
  document.getElementById('user-email').textContent = u?.email || '';
  if (changed) route();
}

// Тексты шапки и переключатель языка RU / EN
function applyLang() {
  document.documentElement.lang = t('htmlLang');
  document.title = t('pageTitle');
  document.getElementById('logout').textContent = t('logout');
  document.getElementById('nav-leads').textContent = t('navLeads');
  document.getElementById('nav-sites').textContent = t('navSites');
  const privacy = document.getElementById('privacy-link');
  privacy.textContent = t('privacy');
  privacy.href = 'privacy.html' + (getLang() === 'en' ? '#en' : '');
  const sw = document.getElementById('lang');
  sw.textContent = t('langSwitch');
  sw.setAttribute('aria-label', t('langSwitchLabel'));
  sw.setAttribute('lang', getLang() === 'ru' ? 'en' : 'ru');
}
applyLang();
document.getElementById('lang').addEventListener('click', () => {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  applyLang();
  route();
});
document.getElementById('logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.hash = '#/';
});
window.addEventListener('hashchange', route);

// Ошибка входа приходит в адресе (?error_description=…)
const params = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
const loginError = params.get('error_description');

sb.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
const { data: { session } } = await sb.auth.getSession();
if (!session && loginError) renderLogin(loginError);
else setUser(session?.user || null);
if (!session && !loginError && !user) renderLogin();
