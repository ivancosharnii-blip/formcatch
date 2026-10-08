/*!
 * Formcatch — перехват форм сайта.
 * Подключение: <script src=".../formcatch.js" data-site="ID_САЙТА" defer></script>
 *
 * Как работает:
 *  1. Один обработчик submit на весь документ (фаза захвата) — ловит любые <form>,
 *     в том числе появившиеся после загрузки (попапы) и отправляемые через AJAX.
 *  2. Обработчик click — ловит «формы» без тега <form> (поля в div + кнопка).
 *  3. Собирает заполненные поля, пропуская пароли, карты и служебные поля,
 *     и угадывает, где имя, телефон и email.
 *  4. Отправляет заявку на сервер Formcatch через sendBeacon.
 *  5. Если на всём сайте нет ни одной формы — показывает свою кнопку «Оставить заявку».
 * Скрипт ничего не отменяет и не меняет на сайте: любая ошибка внутри глушится.
 */
(function () {
  'use strict';

  if (window.__formcatchLoaded) return; // защита от двойного подключения
  window.__formcatchLoaded = true;

  var VERSION = '0.4.1';
  var MAX_FIELDS = 50;
  var MAX_VALUE = 1000;
  var DEDUP_MS = 2000;

  // --- Настройки из тега <script> ---
  var script = document.currentScript ||
    document.querySelector('script[src*="formcatch.js"][data-site]');
  var SITE = script && script.getAttribute('data-site');
  var DEFAULT_ENDPOINT = 'https://gdevndktdjppgmmusalo.supabase.co/functions/v1/collect';
  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || DEFAULT_ENDPOINT;
  if (ENDPOINT === 'none') ENDPOINT = ''; // для тестов: ничего никуда не отправлять
  var DEBUG = !!(script && script.hasAttribute('data-debug'));
  var FALLBACK = !(script && script.getAttribute('data-fallback') === 'off'); // запасная мини-форма
  // Политика конфиденциальности — для строки согласия под мини-формой
  var HOME = 'https://formcatch.vercel.app';
  try { if (/\.vercel\.app$/.test(new URL(script.src).hostname)) HOME = new URL(script.src).origin; } catch (e) {}

  if (!SITE) {
    if (window.console) console.warn('[Formcatch] нет атрибута data-site — скрипт выключен');
    return;
  }

  // --- Признак живого человека (для ловушки ботов на сервере) ---
  // Настоящие нажатия и ввод браузер помечает isTrusted; скрипт-бот так не умеет.
  var human = false;
  function markHuman(e) { if (e.isTrusted) human = true; }
  ['pointerdown', 'keydown', 'input', 'touchstart'].forEach(function (type) {
    document.addEventListener(type, markHuman, true);
  });

  // --- Что никогда не забираем ---
  var SKIP_TYPES = /^(password|hidden|file|submit|button|reset|image)$/i;
  var SECRET_NAME = /pass|pwd|card|cc-?num|cvc|cvv|csc|iban|expir|secret|token|csrf/i;
  var SEARCH_NAME = /^(q|s|query|search)$/i;
  // Скрытые поля обычно служебные, но конструкторы кладут туда полный телефон (Tilda: Phone с кодом страны)
  var CONTACT_HIDDEN = /^(phone|tel|telephone|email|name)$/i;
  // Служебные поля конструкторов: части телефона Tilda, ловушка для ботов Tilda
  var BUILDER_TECH = /^form-spec-|^tildaspec-.*-iso$/i;
  var TILDA_PHONE_PART = /^tildaspec-phone-part/i;

  // Текст кнопок, похожих на «отправить заявку» (для форм без <form>)
  var SUBMIT_TEXT = /отправ|заявк|записат|запис|заказ|оформ|получ|перезвон|консульт|оставить|подписат|забронир|send|submit|order|book|sign ?up|subscribe|request|contact|apply/i;

  function isSecret(el) {
    if ((el.type || '').toLowerCase() === 'password') return true;
    var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.indexOf('cc-') === 0 || ac.indexOf('password') !== -1 || ac === 'one-time-code') return true;
    return SECRET_NAME.test(el.name || '') || SECRET_NAME.test(el.id || '');
  }

  // Подпись поля: <label for>, обёртка <label>, aria-label, placeholder, name
  function labelOf(el, index) {
    var text = '';
    if (el.id) {
      var forLabel = document.querySelector('label[for="' + cssEscape(el.id) + '"]');
      if (forLabel) text = cleanLabel(forLabel);
    }
    if (!text) {
      var wrap = el.closest('label');
      if (wrap) text = cleanLabel(wrap);
    }
    if (!text) text = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    if (!text) text = el.name || el.id || ('Поле ' + (index + 1));
    return text.replace(/\s+/g, ' ').replace(/[*:]+\s*$/, '').trim().slice(0, 100);
  }

  // Текст label без вложенных полей (иначе туда попадут варианты из <select>)
  function cleanLabel(label) {
    var copy = label.cloneNode(true);
    var inner = copy.querySelectorAll('input, select, textarea, button');
    for (var i = 0; i < inner.length; i++) inner[i].remove();
    return copy.textContent.trim();
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
  }

  function valueOf(el) {
    var tag = el.tagName;
    var type = (el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return el.checked ? (el.value === 'on' ? 'да' : el.value) : '';
    if (tag === 'SELECT') {
      var opts = [];
      for (var i = 0; i < el.options.length; i++) if (el.options[i].selected) opts.push(el.options[i].text);
      return opts.join(', ');
    }
    return el.value || '';
  }

  // Собрать заполненные поля внутри формы или контейнера
  function collect(root) {
    var els = root.querySelectorAll('input, select, textarea');
    var fields = [];
    var hasNonSearch = false;
    var hasFullPhone = false;
    for (var i = 0; i < els.length && fields.length < MAX_FIELDS; i++) {
      var el = els[i];
      var type = (el.type || el.tagName).toLowerCase();
      var name = el.name || '';
      var contactHidden = type === 'hidden' && CONTACT_HIDDEN.test(name);
      if ((SKIP_TYPES.test(type) && !contactHidden) || el.disabled || isSecret(el) || BUILDER_TECH.test(name)) continue;
      var value = String(valueOf(el)).trim();
      if (contactHidden && /^(phone|tel|telephone)$/i.test(name) && value) hasFullPhone = true;
      if (!value) continue;
      if (type !== 'search' && !SEARCH_NAME.test(el.name || '')) hasNonSearch = true;
      var label = labelOf(el, i);
      var field = {
        label: label,
        name: el.name || el.id || '',
        type: type,
        value: value.slice(0, MAX_VALUE)
      };
      var role = roleOf(el, label, field.value);
      if (role) field.role = role;
      fields.push(field);
    }
    // Поиск по сайту — не заявка
    if (!hasNonSearch) return [];
    // Tilda: есть полный телефон с кодом страны — видимую часть номера убираем
    if (hasFullPhone) fields = fields.filter(function (f) { return !TILDA_PHONE_PART.test(f.name); });
    return fields;
  }

  // --- Автоугадывание: имя / телефон / email ---
  // Подсказки берём из типа поля, autocomplete, подписи, name/id, placeholder;
  // роль ставим, только если значение подходит по формату.
  var EMAIL_HINT = /e-?mail|почт|мейл|мэйл|имейл/i;
  var PHONE_HINT = /phone|телефон|(^|[^a-zа-яё])(тел|tel|моб|mob)([^a-zа-яё]|$)|mobile|мобильн|whats ?app|ватсап|вотсап|viber|вайбер/i;
  var NAME_HINT = /(^|[^a-z])name|firstname|lastname|fullname|surname|имя|фио|ф\.\s?и\.\s?о|фамили|отчеств|обращаться|как вас зовут|контактное лицо|contact ?person/i;
  // Похоже на имя/телефон, но не они
  var NAME_NOT = /компани|company|организац|фирм|бренд|brand|логин|login|user ?name|пользовател|никнейм|nickname|назван|(^|[^a-z])(title|city|site|pet)([^a-z]|$)|город|улиц|street|адрес|address|товар|product|проект|project|домен|domain|сайт|ребен|child|питом/i;
  var PHONE_NOT = /заказ|order|инн|снилс|паспорт|сч[её]т|account|индекс|zip|postal|промо|promo|кол-?во|количеств|сумм|цена|цены|price|возраст|(^|[^a-z])age([^a-z]|$)|дата|date/i;
  // Подпись ни о чём не говорит: field_1, input_2, «Поле 3»
  var GENERIC_LABEL = /^(field|input|text|fld|f|поле)[\s_-]*\d*$/i;

  var EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NAME_VALUE = /^[A-Za-zÀ-ɏЀ-ӿ][A-Za-zÀ-ɏЀ-ӿ .'’-]{0,59}$/;

  function isPhoneValue(v) {
    if (!/^\+?[\d\s().-]+$/.test(v)) return false;
    var digits = v.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }
  // Телефон без всяких подсказок: только «телефонного вида» (+код или 10–12 цифр с 7/8 в начале)
  function looksLikePhoneByItself(v) {
    if (!isPhoneValue(v)) return false;
    var digits = v.replace(/\D/g, '');
    return v.charAt(0) === '+' || (/^[78]/.test(digits) && digits.length >= 10 && digits.length <= 12);
  }

  function roleOf(el, label, value) {
    var tag = el.tagName;
    var type = (el.type || '').toLowerCase();
    if (tag === 'SELECT' || tag === 'TEXTAREA' || type === 'checkbox' || type === 'radio') return '';
    var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    var hints = [label, el.name, el.id, el.getAttribute('placeholder'), el.getAttribute('aria-label')]
      .join(' ').toLowerCase();

    if (EMAIL_VALUE.test(value)) return 'email'; // email узнаётся по самому значению

    var phoneHint = type === 'tel' || ac.indexOf('tel') === 0 || PHONE_HINT.test(hints);
    if (phoneHint && !PHONE_NOT.test(label) && isPhoneValue(value)) return 'phone';

    var nameHint = /^(name|given-name|family-name|additional-name)$/.test(ac) ||
      (NAME_HINT.test(hints) && !NAME_NOT.test(hints));
    if (nameHint && NAME_VALUE.test(value)) return 'name';

    // Подписи нет вообще (field_1) — угадываем по самому значению
    var generic = GENERIC_LABEL.test(label.trim()) || label === el.name || label === el.id;
    if (generic && !PHONE_NOT.test(hints) && looksLikePhoneByItself(value)) return 'phone';
    if (generic && !NAME_NOT.test(hints) && type !== 'number' && NAME_VALUE.test(value)) return 'maybe-name';
    return '';
  }

  // Сводка контакта: имя (имя + фамилия через пробел), первый телефон, первый email
  function contactOf(fields) {
    var names = [], phone = '', email = '';
    var hasSureName = fields.some(function (f) { return f.role === 'name'; });
    fields.forEach(function (f) {
      if (f.role === 'phone' && !phone) phone = f.value;
      if (f.role === 'email' && !email) email = f.value;
      if (f.role === 'name' && names.indexOf(f.value) === -1 && names.length < 3) names.push(f.value);
    });
    // Безымянное поле считаем именем, только если настоящего имени нет и оно одно такое
    if (!hasSureName) {
      var maybe = fields.filter(function (f) { return f.role === 'maybe-name'; });
      if (maybe.length === 1) { maybe[0].role = 'name'; names.push(maybe[0].value); }
    }
    fields.forEach(function (f) { if (f.role === 'maybe-name') f.role = ''; });
    return { name: names.join(' ').slice(0, 100), phone: phone, email: email };
  }

  function isSearchForm(form) {
    if ((form.getAttribute('role') || '').toLowerCase() === 'search') return true;
    return /search|поиск/i.test(form.getAttribute('action') || '');
  }

  // --- Отправка ---
  var lastKey = '';
  var lastTime = 0;

  function send(fields, kind) {
    if (!fields.length) return;

    // Одна и та же заявка дважды подряд (клик + submit) — отправляем один раз
    var key = JSON.stringify(fields);
    var now = Date.now();
    if (key === lastKey && now - lastTime < DEDUP_MS) return;
    lastKey = key;
    lastTime = now;

    var contact = contactOf(fields);
    var lead = {
      site: SITE,
      page: location.href,
      title: document.title,
      kind: kind,            // 'form' — обычная форма, 'formless' — без тега <form>
      fields: fields,        // у полей имени/телефона/email есть role: name | phone | email
      contact: contact,      // сводка: { name, phone, email }
      sentAt: new Date().toISOString(),
      human: human,                                  // были ли реальные действия человека
      tp: Math.round(performance.now()),             // мс с открытия страницы
      v: VERSION
    };

    if (ENDPOINT) {
      // text/plain — чтобы браузер не делал лишний предварительный запрос (CORS preflight)
      var body = JSON.stringify(lead);
      var ok = false;
      try { ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' })); } catch (e) {}
      if (!ok && window.fetch) {
        fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () {});
      }
    }

    if (DEBUG && window.console) console.log('[Formcatch] заявка', lead);
    // Сигнал для тестов и отладки
    try { document.dispatchEvent(new CustomEvent('formcatch:lead', { detail: lead })); } catch (e) {}
  }

  // Сайт показал ошибку в форме («неверный email») — значит, отправки не было
  function hasVisibleError(form) {
    var els = form.querySelectorAll('[aria-invalid="true"], [class*="error"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // Только реально видимое: Tilda держит в форме блок ошибок нулевой высоты с текстом
      if (!el.offsetWidth || !el.offsetHeight) continue;
      if (el.getAttribute('aria-invalid') === 'true' || (el.innerText || '').trim()) return true;
    }
    return false;
  }

  // Форма, по кнопке которой кликнули, но submit ещё не случился
  var pendingForm = null;

  // --- 1. Обычные формы ---
  document.addEventListener('submit', function (e) {
    try {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      if (pendingForm === form) pendingForm = null; // поймали штатно — запасной путь не нужен
      if (isSearchForm(form)) return;
      send(collect(form), 'form');
    } catch (err) { if (DEBUG) console.error('[Formcatch]', err); }
  }, true);

  // Кнопка отправки нажата, а submit не произошёл: сайт отправляет форму сам, в фоне
  // (так делают Tilda и многие конструкторы). Проверяем сразу после обработчиков сайта.
  function watchSubmitClick(form) {
    if (isSearchForm(form)) return;
    var snapshot = collect(form); // на случай, если сайт мгновенно очистит поля
    pendingForm = form;
    setTimeout(function () {
      try {
        if (pendingForm !== form) return; // submit уже обработан
        pendingForm = null;
        if (!form.noValidate && form.checkValidity && !form.checkValidity()) return; // браузер не пустил
        if (hasVisibleError(form)) return; // сайт показал ошибку — клиент ещё исправляет форму
        var fields = collect(form); // после обработчика сайта: Tilda уже заполнила полный телефон
        send(fields.length ? fields : snapshot, 'form');
      } catch (err) { if (DEBUG) console.error('[Formcatch]', err); }
    }, 0);
  }

  // --- 2. «Формы» без тега <form> и кнопки type="button" ---
  document.addEventListener('click', function (e) {
    try {
      var btn = e.target && e.target.closest &&
        e.target.closest('button, input[type="submit"], input[type="button"], [role="button"], a');
      if (!btn) return;

      var form = btn.closest('form');
      var type = (btn.getAttribute('type') || (btn.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
      // Кнопка submit внутри <form>: обычно её поймает обработчик submit, но страхуемся
      if (form && type === 'submit') {
        watchSubmitClick(form);
        return;
      }

      var text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
      if (!SUBMIT_TEXT.test(text)) return;

      if (form) {
        if (!isSearchForm(form)) send(collect(form), 'form');
        return;
      }

      // Ищем ближайший контейнер с полями (не выше 6 уровней)
      var box = btn.parentElement;
      for (var depth = 0; box && box !== document.body && depth < 6; depth++) {
        if (box.querySelector('input, textarea, select')) {
          send(collect(box), 'formless');
          return;
        }
        box = box.parentElement;
      }
    } catch (err) { if (DEBUG) console.error('[Formcatch]', err); }
  }, true);

  // --- 3. Запасная мини-форма ---
  // Показываем кнопку «Оставить заявку», только если на ВСЁМ сайте нет форм.
  // Страница с формой один раз сообщает серверу «форма есть» (sites.form_found).
  // Страница без форм спрашивает сервер и показывает кнопку, только если формы не видели нигде.
  var FORM_IFRAME = /google\.com\/forms|forms\.gle|typeform|jotform|tally\.so|formstack|cognitoforms|hsforms|hubspot|forms\.yandex|webask|anketolog|calendly|bitrix|amocrm/i;
  var FOUND_KEY = 'formcatch:form-found:' + SITE;

  function pageHasForm() {
    var forms = document.forms;
    for (var i = 0; i < forms.length; i++) if (!isSearchForm(forms[i]) && collectable(forms[i])) return true;
    // «Формы» без тега <form>: поле ввода вне форм (не поиск)
    var els = document.querySelectorAll('input, textarea, select');
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      var type = (el.type || el.tagName).toLowerCase();
      if (el.form || SKIP_TYPES.test(type) || type === 'search' || type === 'checkbox' || type === 'radio') continue;
      if (SEARCH_NAME.test(el.name || '') || /search|поиск/i.test(el.getAttribute('placeholder') || '')) continue;
      return true;
    }
    // Встроенные формы сервисов (Google Forms, Typeform…): перехватить нельзя, но форма у сайта есть
    var frames = document.querySelectorAll('iframe[src]');
    for (var k = 0; k < frames.length; k++) if (FORM_IFRAME.test(frames[k].src)) return true;
    return false;
  }

  // В форме есть хоть одно поле, куда человек что-то вводит
  function collectable(form) {
    var els = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < els.length; i++) {
      var type = (els[i].type || els[i].tagName).toLowerCase();
      if (!SKIP_TYPES.test(type) && type !== 'search') return true;
    }
    return false;
  }

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* приватный режим — просто спросим сервер ещё раз */ }
    return null;
  }

  // Запрос к серверу: form=true — «на этой странице есть форма». Ответ: found | none | unknown_site
  function ping(form, done) {
    if (!ENDPOINT || !window.fetch) return done && done('');
    fetch(ENDPOINT + '?site=' + encodeURIComponent(SITE) + (form ? '&form=1' : ''), { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (done) done(j && j.result); })
      .catch(function () { if (done) done(''); });
  }

  function reportForm() {
    if (storage(FOUND_KEY) === '1') return;
    ping(true, function (result) { if (result === 'found') storage(FOUND_KEY, '1'); });
  }

  var TEXTS = {
    ru: {
      open: 'Оставить заявку', title: 'Оставьте заявку — мы свяжемся с вами',
      name: 'Ваше имя', phone: 'Телефон', send: 'Отправить', close: 'Закрыть',
      noName: 'Укажите имя', badPhone: 'Проверьте номер телефона',
      consent: 'Нажимая «Отправить», вы соглашаетесь с ', consentLink: 'политикой конфиденциальности', privacy: '/privacy.html',
      thanks: 'Спасибо! Заявка отправлена, скоро с вами свяжутся.'
    },
    en: {
      open: 'Leave a request', title: 'Leave your details and we will contact you',
      name: 'Your name', phone: 'Phone', send: 'Send', close: 'Close',
      noName: 'Please enter your name', badPhone: 'Please check the phone number',
      consent: 'By sending, you agree to the ', consentLink: 'privacy policy', privacy: '/privacy.html#en',
      thanks: 'Thank you! Your request has been sent.'
    }
  };

  function texts() {
    var lang = (document.documentElement.lang || navigator.language || 'ru').slice(0, 2).toLowerCase();
    return /^(ru|uk|be|kk|ky)$/.test(lang) ? TEXTS.ru : TEXTS.en;
  }

  var CSS =
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.fc{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483646;display:flex;flex-direction:column;align-items:flex-end;gap:10px}' +
    '.open{min-height:48px;padding:0 22px;border:0;border-radius:999px;background:#1d1f24;color:#fff;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)}' +
    '.open:focus-visible,.send:focus-visible,.x:focus-visible,input:focus-visible{outline:3px solid #2f6fed;outline-offset:2px}' +
    '.panel{width:320px;max-width:calc(100vw - 32px);padding:20px;border-radius:16px;background:#fff;color:#1d1f24;box-shadow:0 12px 40px rgba(0,0,0,.25)}' +
    '.head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}' +
    '.title{margin:0;font-size:17px;font-weight:600;line-height:1.35}' +
    '.x{flex:none;width:32px;height:32px;margin:-6px -6px 0 0;border:0;border-radius:8px;background:none;color:#5b616e;font-size:22px;line-height:1;cursor:pointer}' +
    'label{display:block;margin-bottom:12px;font-size:14px;color:#3c414b}' +
    'input{display:block;width:100%;height:44px;margin-top:4px;padding:0 12px;border:1px solid #c9cdd4;border-radius:10px;background:#fff;color:#1d1f24;font-size:16px}' +
    '.err{min-height:20px;margin:0 0 8px;color:#c62828;font-size:14px}' +
    '.send{width:100%;height:46px;border:0;border-radius:10px;background:#1d1f24;color:#fff;font-size:16px;font-weight:600;cursor:pointer}' +
    '.thanks{margin:0;font-size:16px;line-height:1.45}' +
    '.consent{margin:10px 0 0;font-size:12px;line-height:1.4;color:#5b616e}' +
    '.consent a{color:inherit;text-decoration:underline}' +
    '[hidden]{display:none!important}';

  var fallbackHost = null;

  function showFallback() {
    if (fallbackHost || !document.body || !document.body.attachShadow) return;
    var t = texts();
    fallbackHost = document.createElement('div');
    fallbackHost.setAttribute('data-formcatch', 'fallback');
    // Shadow DOM: стили сайта не ломают кнопку, а наши стили не трогают сайт
    var root = fallbackHost.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' + CSS + '</style>' +
      '<div class="fc">' +
        '<div class="panel" role="dialog" aria-labelledby="fc-title" hidden>' +
          '<div class="head"><p class="title" id="fc-title"></p><button type="button" class="x">×</button></div>' +
          '<form novalidate>' +
            '<label><span class="l-name"></span><input name="name" autocomplete="name" maxlength="100"></label>' +
            '<label><span class="l-phone"></span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40"></label>' +
            '<p class="err" role="alert"></p>' +
            '<button type="submit" class="send"></button>' +
            '<p class="consent"><span class="c-text"></span><a target="_blank" rel="noopener"></a></p>' +
          '</form>' +
          '<p class="thanks" hidden></p>' +
        '</div>' +
        '<button type="button" class="open" aria-expanded="false"></button>' +
      '</div>';

    function $(sel) { return root.querySelector(sel); }
    var panel = $('.panel'), openBtn = $('.open'), form = $('form'), err = $('.err');
    var nameInput = $('input[name="name"]'), phoneInput = $('input[name="phone"]');
    $('.title').textContent = t.title;
    $('.l-name').textContent = t.name;
    $('.l-phone').textContent = t.phone;
    $('.send').textContent = t.send;
    $('.thanks').textContent = t.thanks;
    $('.c-text').textContent = t.consent;
    $('.consent a').textContent = t.consentLink;
    $('.consent a').href = HOME + t.privacy;
    $('.x').setAttribute('aria-label', t.close);
    openBtn.textContent = t.open;

    function toggle(open) {
      panel.hidden = !open;
      openBtn.hidden = open;
      openBtn.setAttribute('aria-expanded', String(open));
      if (open) nameInput.focus(); else openBtn.focus();
    }
    openBtn.addEventListener('click', function () { toggle(true); });
    $('.x').addEventListener('click', function () { toggle(false); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      try {
        var name = nameInput.value.trim();
        var phone = phoneInput.value.trim();
        if (!name) { err.textContent = t.noName; nameInput.focus(); return; }
        if (!isPhoneValue(phone)) { err.textContent = t.badPhone; phoneInput.focus(); return; }
        err.textContent = '';
        send([
          { label: t.name, name: 'name', type: 'text', value: name.slice(0, 100), role: 'name' },
          { label: t.phone, name: 'phone', type: 'tel', value: phone.slice(0, 40), role: 'phone' }
        ], 'fallback');
        form.hidden = true;
        $('.thanks').hidden = false;
      } catch (ex) { if (DEBUG) console.error('[Formcatch]', ex); }
    });

    document.body.appendChild(fallbackHost);
    watchForForms();
    if (DEBUG && window.console) console.log('[Formcatch] на сайте нет форм — показана кнопка «Оставить заявку»');
  }

  function hideFallback() {
    if (fallbackHost && fallbackHost.parentNode) fallbackHost.parentNode.removeChild(fallbackHost);
    fallbackHost = null;
  }

  // Форма появилась позже (попап, ленивая загрузка) — у сайта есть форма, наша кнопка не нужна
  function watchForForms() {
    if (!window.MutationObserver) return;
    var timer = null;
    var observer = new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        if (!fallbackHost) { observer.disconnect(); return; }
        if (pageHasForm()) { observer.disconnect(); hideFallback(); reportForm(); }
      }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function initFallback() {
    try {
      if (pageHasForm()) { reportForm(); return; }
      if (!FALLBACK || storage(FOUND_KEY) === '1') return;
      ping(false, function (result) {
        if (result === 'found') { storage(FOUND_KEY, '1'); return; }
        if (result === 'none' && !pageHasForm()) showFallback();
      });
    } catch (err) { if (DEBUG) console.error('[Formcatch]', err); }
  }

  // Ждём, пока конструктор сайта дорисует страницу (формы часто появляются не сразу)
  function later() { setTimeout(initFallback, 1500); }
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later);

  if (DEBUG && window.console) console.log('[Formcatch] запущен, сайт:', SITE);
})();
