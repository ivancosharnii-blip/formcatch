# Formcatch

**One line of code on any website — and all its existing forms send their leads into one table.**
No form rebuilding, no developer, connection in under a minute. Works on Tilda, WordPress, Wix and plain HTML.

**Одна строка кода на любом сайте — и все уже существующие формы сами собираются в одну таблицу.**
Ничего не переделываешь, программист не нужен, подключение меньше чем за минуту.

```html
<script src="https://formcatch.vercel.app/formcatch.js" data-site="SITE_ID" defer></script>
```

## Как устроено

| Папка | Что внутри |
|---|---|
| `widget/` | `formcatch.js` — скрипт для сайтов: перехватывает отправку форм, угадывает имя / телефон / email, никогда не берёт пароли и карты; если на сайте нет форм — показывает кнопку «Оставить заявку» |
| `dashboard/` | кабинет владельца: вход через Google, сайты и подключение, общая таблица заявок, график, выгрузка в Excel, RU / EN |
| `supabase/` | база данных (PostgreSQL + правила доступа RLS) и серверная функция приёма заявок с защитой от спама |
| `test-site/` | тестовый стенд: разные виды форм и автопроверка угадывания полей |

**Стек:** JavaScript без фреймворков · Supabase (база, вход, Edge Function) · Vercel (хостинг).

**Запустить у себя:** `python -m http.server 8080` → http://localhost:8080/dashboard/ и http://localhost:8080/test-site/

**Сборка для публикации:** `node build.mjs` → папка `public/` (Vercel делает это сам, см. `vercel.json`).

Подробный журнал разработки, решения и проверки — в [PROJECT.md](PROJECT.md).

Проект для олимпиады FIRST STEP → INFOMATRIX.
