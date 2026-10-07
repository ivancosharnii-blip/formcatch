-- Formcatch: таблицы сайтов и заявок + приём заявки.
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.

-- Сайты владельцев. id — то, что стоит в data-site у скрипта.
create table public.sites (
  id            text primary key default 'fc_' || substr(md5(random()::text), 1, 10),
  owner_id      uuid references auth.users (id) on delete cascade, -- заполнится на этапе 6 (кабинет)
  name          text not null default 'Мой сайт',
  domain        text,                               -- привязывается автоматически при первой заявке
  form_found    boolean not null default false,     -- нашёл ли скрипт форму на сайте (этап 5)
  connected_at  timestamptz,                        -- первая заявка = сайт подключён
  created_at    timestamptz not null default now()
);

-- Заявки клиентов.
create table public.leads (
  id          bigint generated always as identity primary key,
  site_id     text not null references public.sites (id) on delete cascade,
  domain      text not null,                     -- с какого домена пришла
  blocked     boolean not null default false,    -- true = домен чужой, владельцу не показываем
  page        text,
  title       text,
  kind        text,                              -- form | formless
  fields      jsonb not null,                    -- [{label, name, type, value}]
  ip_hash     text,                              -- хэш IP (сам IP не храним)
  created_at  timestamptz not null default now()
);

create index leads_site_time on public.leads (site_id, created_at desc);
create index leads_site_ip_time on public.leads (site_id, ip_hash, created_at desc);

-- Защита на уровне строк: владелец видит только свои сайты и заявки.
alter table public.sites enable row level security;
alter table public.leads enable row level security;

create policy "Владелец видит свои сайты" on public.sites
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Владелец видит заявки своих сайтов" on public.leads
  for select to authenticated
  using (exists (
    select 1 from public.sites s
    where s.id = leads.site_id and s.owner_id = (select auth.uid())
  ));

grant select on public.sites, public.leads to authenticated;

-- Приём заявки. Вызывает только серверная функция collect.
-- Ответ: ok | blocked | rate_limited | unknown_site
create or replace function public.submit_lead(
  p_site    text,
  p_domain  text,
  p_ip_hash text,
  p_page    text,
  p_title   text,
  p_kind    text,
  p_fields  jsonb
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

  insert into public.leads (site_id, domain, blocked, page, title, kind, fields, ip_hash)
  values (p_site, p_domain, v_blocked, p_page, p_title, p_kind, p_fields, p_ip_hash);

  return case when v_blocked then 'blocked' else 'ok' end;
end;
$$;

revoke execute on function public.submit_lead from public, anon, authenticated;
grant execute on function public.submit_lead to service_role;
