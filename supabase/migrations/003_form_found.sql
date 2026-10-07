-- Formcatch, этап 5: «есть ли на сайте форма?» — для запасной мини-формы.
-- Скрипт на странице с формой сообщает «форма есть» (p_form = true), сервер запоминает в sites.form_found.
-- Скрипт на странице без форм спрашивает: если форм на сайте не видели нигде — показывает кнопку «Оставить заявку».
-- Запуск: Supabase → SQL Editor → вставить файл целиком → Run.
-- Ответ: found | none | unknown_site

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
  select * into v_site from public.sites where id = p_site;
  if not found then
    return 'unknown_site';
  end if;

  -- «Форма есть» принимаем только с домена сайта (или пока домен ещё не привязан)
  if p_form and not v_site.form_found
     and (v_site.domain is null or v_site.domain = p_domain) then
    update public.sites set form_found = true where id = p_site;
    return 'found';
  end if;

  return case when v_site.form_found then 'found' else 'none' end;
end;
$$;

revoke execute on function public.site_ping from public, anon, authenticated;
grant execute on function public.site_ping to service_role;
