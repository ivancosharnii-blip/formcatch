// Formcatch — все тексты кабинета в одном месте (английский добавим на этапе 8).
// {name} в тексте заменяется значением: t('key', { name: '…' }).

const RU = {
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

let lang = RU;

export function t(key, vars) {
  let text = lang[key] ?? key;
  if (vars && typeof text === 'string') {
    for (const k in vars) text = text.split('{' + k + '}').join(String(vars[k]));
  }
  return text;
}
