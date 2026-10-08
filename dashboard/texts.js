// Formcatch — все тексты кабинета в одном месте: русский и английский.
// {name} в тексте заменяется значением: t('key', { name: '…' }).
// Язык: выбранный вручную (переключатель в шапке) → язык браузера → русский.

const RU = {
  htmlLang: 'ru',
  locale: 'ru-RU',
  pageTitle: 'Formcatch — кабинет',
  langSwitch: 'EN',
  langSwitchLabel: 'Switch to English',
  privacy: 'Политика конфиденциальности',
  appTagline: 'Все заявки с ваших сайтов — в одной таблице',
  loginLead: 'Одна строка кода на сайте — и все формы сами собирают заявки сюда. Без программиста.',
  loginGoogle: 'Войти через Google',
  loginError: 'Не получилось войти: {error}',
  logout: 'Выйти',
  loading: 'Загрузка…',
  loadError: 'Не удалось загрузить данные. Проверьте интернет и обновите страницу.',

  navLeads: 'Заявки',
  navSites: 'Сайты',

  leadsH1: 'Заявки',
  downloadExcel: 'Скачать Excel',
  downloading: 'Готовим файл…',
  filterSite: 'Сайт',
  allSites: 'Все сайты',
  filterPeriod: 'Период',
  period7: 'За 7 дней',
  period30: 'За 30 дней',
  period90: 'За 90 дней',
  periodAll: 'За всё время',
  search: 'Поиск',
  searchPlaceholder: 'Имя, телефон, email…',
  statPeriod: 'Заявок за период',
  statToday: 'Сегодня',
  statWeek: 'За 7 дней',
  chartTitle: 'Заявки по дням',
  chartLabel: 'Заявки по дням: всего {count} за {days} дн.',
  colDate: 'Дата',
  colSite: 'Сайт',
  colName: 'Имя',
  colPhone: 'Телефон',
  colEmail: 'Email',
  colOther: 'Другие поля',
  colPage: 'Страница',
  colForm: 'Откуда',
  formMain: 'Форма сайта',
  formFallback: 'Кнопка «Оставить заявку»',
  allFields: 'Все поля заявки',
  openRow: 'Показать все поля',
  showMore: 'Показать ещё',
  shownOf: 'Показано {shown} из {total}',
  noSitesLeads: 'Сначала добавьте сайт — заявки с него появятся здесь.',
  goSites: 'Добавить сайт',
  noLeadsYet: 'Заявок за этот период нет. Как только клиент отправит форму на вашем сайте, она появится здесь.',
  noLeadsFound: 'Ничего не найдено. Измените поиск или фильтры.',
  excelFile: 'formcatch-zayavki',
  excelSheet: 'Заявки',

  mySites: 'Мои сайты',
  addSite: 'Добавить сайт',
  emptyTitle: 'Пока нет ни одного сайта',
  emptyText: 'Добавьте первый — подключение займёт меньше минуты.',
  siteNamePlaceholder: 'Например: Салон «Лаванда»',
  siteNameLabel: 'Название сайта (видите только вы)',
  create: 'Создать',
  cancel: 'Отмена',
  defaultSiteName: 'Мой сайт',
  notConnected: 'Ещё не подключён',
  leadsCount: 'Заявок: {count}',
  newDomainBadge: 'Новый домен',
  back: '← Мои сайты',

  connectTitle: 'Подключение',
  connectStep1: 'Скопируйте код',
  connectStep2: 'Вставьте его на сайт',
  connectStep3: 'Откройте свой сайт — кабинет сам увидит подключение',
  copy: 'Скопировать',
  copied: 'Скопировано ✓',
  waiting: 'Ждём сигнал с вашего сайта…',
  connectedIn: '✅ Сайт подключён за {time}',
  connected: '✅ Сайт подключён',
  connectedDomain: 'Домен: {domain}',
  showCode: 'Показать код для вставки',
  sec: '{n} сек',
  min: '{n} мин',
  hour: '{n} ч',

  platformTilda: 'Tilda',
  platformWordpress: 'WordPress',
  platformWix: 'Wix',
  platformOther: 'Другой сайт',
  howTilda: [
    'Откройте страницу с формой в редакторе Tilda.',
    'Нажмите «Все блоки» → раздел «Другое» → блок T123 «HTML-код».',
    'В блоке нажмите «Контент», вставьте код и нажмите «Сохранить и закрыть».',
    'Нажмите «Опубликовать».',
    'Нужен платный тариф Tilda. Если Tilda попросит подтвердить телефон — это один раз.'
  ],
  howWordpress: [
    'В админке WordPress откройте «Плагины» → «Добавить новый».',
    'Найдите плагин WPCode, нажмите «Установить», затем «Активировать».',
    'Откройте Code Snippets → Header & Footer.',
    'Вставьте код в поле «Footer» и нажмите «Сохранить».'
  ],
  howWix: [
    'Откройте «Настройки» сайта → «Пользовательский код» (Custom Code).',
    'Нажмите «+ Добавить код» и вставьте код.',
    'Выберите «Все страницы», место — «Body — конец». Нажмите «Применить».',
    'Нужен платный тариф Wix и подключённый свой домен.'
  ],
  howOther: [
    'Вставьте код перед закрывающим тегом </body> на всех страницах сайта.',
    'Если у сайта общий шаблон или подвал (footer) — достаточно вставить туда один раз.'
  ],

  domainAlert: 'Заявки с нового домена {domain} ({count}). Сайт переехал?',
  domainAllow: 'Да, разрешить',
  domainDismiss: 'Это не мой сайт',
  domainAllowed: 'Готово: заявки с {domain} теперь видны.',

  leadsTitle: 'Заявки',
  leadsNone: 'Заявок пока нет. Как только клиент отправит форму на сайте, она появится здесь.',
  leadsSummary: 'Всего заявок: {count}. Последняя: {date}.',
  openSiteLeads: 'Открыть заявки этого сайта',

  settingsTitle: 'Настройки',
  rename: 'Сохранить название',
  saved: 'Сохранено ✓',
  fallbackTitle: 'Кнопка «Оставить заявку»',
  fallbackOff: 'Не показывается: на вашем сайте найдены формы.',
  fallbackOn: 'Появится сама, если на сайте не будет ни одной формы.',
  fallbackReset: 'Я убрал формы с сайта — включить кнопку',
  deleteSite: 'Удалить сайт',
  deleteConfirm: 'Удалить «{name}» и все его заявки? Это нельзя отменить.',
  deleteYes: 'Да, удалить',
  actionError: 'Не получилось: {error}'
};

const EN = {
  htmlLang: 'en',
  locale: 'en-GB',
  pageTitle: 'Formcatch — dashboard',
  langSwitch: 'RU',
  langSwitchLabel: 'Переключить на русский',
  privacy: 'Privacy policy',

  appTagline: 'All leads from your websites in one table',
  loginLead: 'One line of code on your site, and every form sends its leads here. No developer needed.',
  loginGoogle: 'Sign in with Google',
  loginError: 'Could not sign in: {error}',
  logout: 'Sign out',
  loading: 'Loading…',
  loadError: 'Could not load data. Check your connection and refresh the page.',

  navLeads: 'Leads',
  navSites: 'Websites',

  leadsH1: 'Leads',
  downloadExcel: 'Download Excel',
  downloading: 'Preparing file…',
  filterSite: 'Website',
  allSites: 'All websites',
  filterPeriod: 'Period',
  period7: 'Last 7 days',
  period30: 'Last 30 days',
  period90: 'Last 90 days',
  periodAll: 'All time',
  search: 'Search',
  searchPlaceholder: 'Name, phone, email…',
  statPeriod: 'Leads in period',
  statToday: 'Today',
  statWeek: 'Last 7 days',
  chartTitle: 'Leads per day',
  chartLabel: 'Leads per day: {count} in {days} days',
  colDate: 'Date',
  colSite: 'Website',
  colName: 'Name',
  colPhone: 'Phone',
  colEmail: 'Email',
  colOther: 'Other fields',
  colPage: 'Page',
  colForm: 'Source',
  formMain: 'Website form',
  formFallback: '“Leave a request” button',
  allFields: 'All fields',
  openRow: 'Show all fields',
  showMore: 'Show more',
  shownOf: 'Showing {shown} of {total}',
  noSitesLeads: 'Add a website first — its leads will appear here.',
  goSites: 'Add website',
  noLeadsYet: 'No leads in this period. As soon as a visitor submits a form on your website, it will appear here.',
  noLeadsFound: 'Nothing found. Change the search or filters.',
  excelFile: 'formcatch-leads',
  excelSheet: 'Leads',

  mySites: 'My websites',
  addSite: 'Add website',
  emptyTitle: 'No websites yet',
  emptyText: 'Add your first one — it takes less than a minute.',
  siteNamePlaceholder: 'For example: Lavender Beauty Salon',
  siteNameLabel: 'Website name (only you see it)',
  create: 'Create',
  cancel: 'Cancel',
  defaultSiteName: 'My website',
  notConnected: 'Not connected yet',
  leadsCount: 'Leads: {count}',
  newDomainBadge: 'New domain',
  back: '← My websites',

  connectTitle: 'Connection',
  connectStep1: 'Copy the code',
  connectStep2: 'Paste it into your website',
  connectStep3: 'Open your website — the dashboard will detect the connection',
  copy: 'Copy',
  copied: 'Copied ✓',
  waiting: 'Waiting for a signal from your website…',
  connectedIn: '✅ Website connected in {time}',
  connected: '✅ Website connected',
  connectedDomain: 'Domain: {domain}',
  showCode: 'Show the embed code',
  sec: '{n} s',
  min: '{n} min',
  hour: '{n} h',

  platformTilda: 'Tilda',
  platformWordpress: 'WordPress',
  platformWix: 'Wix',
  platformOther: 'Other website',
  howTilda: [
    'Open the page with your form in the Tilda editor.',
    'Click “All blocks” → “Other” → block T123 “HTML code”.',
    'In the block, click “Content”, paste the code and click “Save & close”.',
    'Click “Publish”.',
    'Requires a paid Tilda plan. If Tilda asks you to confirm your phone number, it is a one-time step.'
  ],
  howWordpress: [
    'In the WordPress admin, open “Plugins” → “Add New Plugin”.',
    'Find the WPCode plugin, click “Install Now”, then “Activate”.',
    'Open Code Snippets → Header & Footer.',
    'Paste the code into the “Footer” field and click “Save Changes”.'
  ],
  howWix: [
    'Open your site’s “Settings” → “Custom Code”.',
    'Click “+ Add Custom Code” and paste the code.',
    'Choose “All pages” and place it in “Body - end”. Click “Apply”.',
    'Requires a paid Wix plan and your own connected domain.'
  ],
  howOther: [
    'Paste the code before the closing </body> tag on every page of your website.',
    'If your website has a shared template or footer, pasting it there once is enough.'
  ],

  domainAlert: 'Leads from a new domain {domain} ({count}). Did your website move?',
  domainAllow: 'Yes, allow',
  domainDismiss: 'Not my website',
  domainAllowed: 'Done: leads from {domain} are now visible.',

  leadsTitle: 'Leads',
  leadsNone: 'No leads yet. As soon as a visitor submits a form on your website, it will appear here.',
  leadsSummary: 'Total leads: {count}. Latest: {date}.',
  openSiteLeads: 'Open this website’s leads',

  settingsTitle: 'Settings',
  rename: 'Save name',
  saved: 'Saved ✓',
  fallbackTitle: '“Leave a request” button',
  fallbackOff: 'Hidden: forms were found on your website.',
  fallbackOn: 'Appears automatically if your website has no forms.',
  fallbackReset: 'I removed the forms — turn the button on',
  deleteSite: 'Delete website',
  deleteConfirm: 'Delete “{name}” and all its leads? This cannot be undone.',
  deleteYes: 'Yes, delete',
  actionError: 'Something went wrong: {error}'
};

const LANGS = { ru: RU, en: EN };
const KEY = 'formcatch:lang';

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS[saved]) return saved;
  } catch { /* приватный режим */ }
  const browser = (navigator.language || 'ru').slice(0, 2).toLowerCase();
  return /^(ru|uk|be|kk|ky)$/.test(browser) ? 'ru' : 'en';
}

let code = detect();
let lang = LANGS[code];

export function getLang() {
  return code;
}

export function setLang(next) {
  if (!LANGS[next]) return;
  code = next;
  lang = LANGS[next];
  try { localStorage.setItem(KEY, next); } catch { /* ничего */ }
}

export function locale() {
  return lang.locale;
}

export function t(key, vars) {
  let text = lang[key] ?? key;
  if (vars && typeof text === 'string') {
    for (const k in vars) text = text.split('{' + k + '}').join(String(vars[k]));
  }
  return text;
}
