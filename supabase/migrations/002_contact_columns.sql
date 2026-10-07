-- Formcatch, этап 4: колонки «Имя / Телефон / Email» у заявок.
-- Скрипт сам угадывает их среди полей формы, сервер проверяет формат и кладёт сюда.
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.

alter table public.leads
  add column if not exists name  text,
  add column if not exists phone text,
  add column if not exists email text;

-- Приём заявки: добавлен p_contact = {name, phone, email}.
-- У параметра есть значение по умолчанию — старая версия серверной функции продолжит работать.
drop function if exists public.submit_lead(text, text, text, text, text, text, jsonb);

create or replace function public.submit_lead(
  p_site    text,
  p_domain  text,
  p_ip_hash text,
  p_page    text,
  p_title   text,
  p_kind    text,
  p_fields  jsonb,
  p_contact jsonb default '{}'::jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site    public.sites%rowtype;
  v_blocked boolean;
begin
  select * into v_site from public.sites where id = p_site for update;
  if not found then
    return 'unknown_site';
  end if;

  -- Лимит: 5 заявок за 10 минут с одного устройства
  if (select count(*) from public.leads
      where site_id = p_site and ip_hash = p_ip_hash
        and created_at > now() - interval '10 minutes') >= 5 then
    return 'rate_limited';
  end if;

  -- Лимит: 300 заявок в час на сайт (защита от массового спама)
  if (select count(*) from public.leads
      where site_id = p_site and created_at > now() - interval '1 hour') >= 300 then
    return 'rate_limited';
  end if;

  -- Привязка к домену: первая заявка запоминает домен
  if v_site.domain is null then
    update public.sites
      set domain = p_domain, connected_at = coalesce(connected_at, now())
      where id = p_site;
    v_blocked := false;
  else
    v_blocked := v_site.domain <> p_domain;
  end if;

  insert into public.leads (site_id, domain, blocked, page, title, kind, fields, ip_hash, name, phone, email)
  values (p_site, p_domain, v_blocked, p_page, p_title, p_kind, p_fields, p_ip_hash,
          nullif(p_contact ->> 'name', ''),
          nullif(p_contact ->> 'phone', ''),
          nullif(p_contact ->> 'email', ''));

  return case when v_blocked then 'blocked' else 'ok' end;
end;
$$;

revoke execute on function public.submit_lead from public, anon, authenticated;
grant execute on function public.submit_lead to service_role;

-- Заявки, пришедшие до этапа 4: заполняем колонки по подписям и формату значений.
update public.leads l set
  email = (select f ->> 'value' from jsonb_array_elements(l.fields) f
           where f ->> 'value' ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' limit 1),
  phone = (select f ->> 'value' from jsonb_array_elements(l.fields) f
           where (f ->> 'type' = 'tel' or (f ->> 'label') || ' ' || (f ->> 'name') ~* 'phone|телефон|(^|[^a-z])tel')
             and f ->> 'value' ~ '^\+?[0-9\s().-]+$'
             and length(regexp_replace(f ->> 'value', '\D', '', 'g')) between 7 and 15
           limit 1),
  name  = (select f ->> 'value' from jsonb_array_elements(l.fields) f
           where (f ->> 'label') || ' ' || (f ->> 'name') ~* '(^|[^a-z])name|имя|фио|обращаться'
             and (f ->> 'label') || ' ' || (f ->> 'name') !~* 'компани|company|логин|login|user|пользовател'
             and f ->> 'value' ~ '^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё .''-]{0,59}$'
           limit 1)
where l.name is null and l.phone is null and l.email is null;
