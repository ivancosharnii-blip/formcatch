-- Тестовые сайты для стенда test-site/. Запуск: SQL Editor → Run (после 001_init.sql).
insert into public.sites (id, name) values
  ('test-site',     'Тестовый стенд'),
  ('test-no-forms', 'Тест: сайт без форм')
on conflict (id) do nothing;
