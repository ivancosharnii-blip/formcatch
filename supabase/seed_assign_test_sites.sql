-- Formcatch, этап 7: тестовые сайты прошлых этапов → в кабинет Вани
-- (чтобы проверить общую таблицу заявок с нескольких сайтов и график по дням).
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.

update public.sites
   set owner_id = (select id from auth.users where email = 'ivancosharnii@gmail.com')
 where id in ('test-site', 'test-tilda', 'test-wp', 'test-no-forms')
   and owner_id is null;

select s.id, s.name, s.domain, count(l.id) filter (where not l.blocked) as leads
  from public.sites s left join public.leads l on l.site_id = s.id
 group by s.id order by s.id;
