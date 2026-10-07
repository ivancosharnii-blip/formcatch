-- Formcatch, этап 6: кабинет владельца.
-- Владелец (вошёл через Google) добавляет, переименовывает и удаляет СВОИ сайты.
-- Секундомер «сайт подключён за N сек»: первый сигнал скрипта с сайта привязывает домен и ставит connected_at.
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.

-- 1. Новый сайт принадлежит тому, кто его создал
alter table public.sites alter column owner_id set default auth.uid();

drop policy if exists "Владелец добавляет сайты" on public.sites;
drop policy if exists "Владелец меняет свои сайты" on public.sites;
drop policy if exists "Владелец удаляет свои сайты" on public.sites;

-- Не больше 20 сайтов на аккаунт
create policy "Владелец добавляет сайты" on public.sites
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select count(*) from public.sites s where s.owner_id = (select auth.uid())) < 20
  );

create policy "Владелец меняет свои сайты" on public.sites
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Владелец удаляет свои сайты" on public.sites
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Из кабинета можно задать только название; id и владелец — автоматически.
-- Менять можно название и отметку «форма есть» (сброс, если владелец убрал формы).
-- Домен меняется только через allow_domain (ниже).
-- Supabase по умолчанию даёт всем ролям все права на таблицы — сначала забираем, потом выдаём точечно.
revoke insert, update, delete, truncate on public.sites, public.leads from anon, authenticated;
grant insert (name) on public.sites to authenticated;
grant update (name, form_found) on public.sites to authenticated;
grant delete on public.sites to authenticated;

-- 2. «Заявки с нового домена X — разрешить?»
-- Сайт переехал (например, с tilda.ws на свой домен): привязываем новый домен
-- и показываем владельцу заявки, которые уже пришли с него.
create or replace function public.allow_domain(p_site text, p_domain text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.sites where id = p_site and owner_id = (select auth.uid())) then
    raise exception 'not_owner';
  end if;
  update public.sites set domain = p_domain where id = p_site;
  update public.leads set blocked = false where site_id = p_site and domain = p_domain;
end;
$$;

revoke execute on function public.allow_domain from public, anon;
grant execute on function public.allow_domain to authenticated;

-- 3. Первый сигнал скрипта = сайт подключён (раньше — только первая заявка).
-- Нужен для секундомера: владелец вставил код, открыл свой сайт — кабинет сразу показывает «подключён».
create or replace function public.site_ping(
  p_site   text,
  p_domain text,
  p_form   boolean
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site public.sites%rowtype;
begin
  select * into v_site from public.sites where id = p_site for update;
  if not found then
    return 'unknown_site';
  end if;

  -- Первый сигнал: запоминаем домен и время подключения
  if v_site.domain is null then
    update public.sites
      set domain = p_domain, connected_at = coalesce(connected_at, now())
      where id = p_site;
    v_site.domain := p_domain;
  end if;

  -- «Форма есть» принимаем только с домена сайта
  if p_form and not v_site.form_found and v_site.domain = p_domain then
    update public.sites set form_found = true where id = p_site;
    return 'found';
  end if;

  return case when v_site.form_found then 'found' else 'none' end;
end;
$$;

revoke execute on function public.site_ping from public, anon, authenticated;
grant execute on function public.site_ping to service_role;
