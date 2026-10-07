-- Formcatch, этап 6, исправление: правило «не больше 20 сайтов» из 004 считало сайты
-- той же таблицы внутри её же правила доступа → ошибка «infinite recursion detected in policy».
-- Считаем в отдельной функции, которая не проходит через правила доступа.
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.

create or replace function public.my_sites_count()
returns bigint
language sql
security definer
stable
set search_path = ''
as $$
  select count(*) from public.sites where owner_id = (select auth.uid());
$$;

revoke execute on function public.my_sites_count from public, anon;
grant execute on function public.my_sites_count to authenticated;

drop policy if exists "Владелец добавляет сайты" on public.sites;

create policy "Владелец добавляет сайты" on public.sites
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.my_sites_count() < 20
  );
