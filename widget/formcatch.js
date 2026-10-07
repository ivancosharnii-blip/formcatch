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
 * Скрипт ничего не отменяет и не меняет на сайте: любая ошибка внутри глушится.
 */
(function () {
  'use strict';

  if (window.__formcatchLoaded) return; // защита от двойного подключения
  window.__formcatchLoaded = true;

  var VERSION = '0.3.0';
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

  if (DEBUG && window.console) console.log('[Formcatch] запущен, сайт:', SITE);
})();
