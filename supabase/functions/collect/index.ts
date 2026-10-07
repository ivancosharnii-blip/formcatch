// Formcatch — приём заявок от скрипта formcatch.js.
// Адрес: https://<проект>.supabase.co/functions/v1/collect
// ВАЖНО: в настройках функции выключить «Verify JWT» — скрипт на чужих сайтах ключей не знает.

import { createClient } from 'npm:@supabase/supabase-js@2';

// Секретный ключ: новый формат (JSON-словарь) или старый service_role
function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      const key = parsed.default ?? Object.values(parsed)[0];
      if (typeof key === 'string') return key;
    } catch { /* старый формат ниже */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const MAX_BODY = 20_000;      // байт
const MAX_FIELDS = 50;
const MIN_TIME_ON_PAGE = 1500; // мс: быстрее человек форму не заполнит

function reply(status: number, result: string) {
  return new Response(JSON.stringify({ result }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

const ROLES = new Set(['name', 'phone', 'email']);
const NAME_RE = /^\p{L}[\p{L} .'’-]*$/u;
const PHONE_RE = /^\+?[\d\s().-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function valid(v: string, re: RegExp, extra: (v: string) => boolean = () => true): string {
  return v && re.test(v) && extra(v) ? v : '';
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Домен сайта, с которого пришёл запрос (заголовок Origin ставит браузер)
function originDomain(req: Request): string {
  try {
    return new URL(req.headers.get('origin') ?? '').hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

// GET ?site=ID[&form=1] — есть ли на сайте форма (для запасной мини-формы).
// form=1: «на этой странице есть форма» — запомнить. Ответ: found | none | unknown_site
async function ping(req: Request) {
  const url = new URL(req.url);
  const site = str(url.searchParams.get('site'), 64);
  if (!site) return reply(400, 'bad_request');
  const domain = originDomain(req);
  if (!domain) return reply(403, 'no_origin');

  const { data, error } = await db.rpc('site_ping', {
    p_site: site,
    p_domain: domain,
    p_form: url.searchParams.get('form') === '1',
  });
  if (error) {
    console.error('site_ping error', error);
    return reply(500, 'db_error');
  }
  return reply(data === 'unknown_site' ? 404 : 200, data as string);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method === 'GET') return ping(req);
  if (req.method !== 'POST') return reply(405, 'method_not_allowed');

  // 1. Разбор заявки
  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(413, 'too_big');

  let lead: Record<string, unknown>;
  try {
    lead = JSON.parse(raw);
  } catch {
    return reply(400, 'bad_json');
  }

  const site = str(lead.site, 64);
  if (!site || !Array.isArray(lead.fields)) return reply(400, 'bad_lead');

  const fields = (lead.fields as Record<string, unknown>[])
    .slice(0, MAX_FIELDS)
    .map((f) => {
      const field: Record<string, string> = {
        label: str(f?.label, 100),
        name: str(f?.name, 100),
        type: str(f?.type, 20),
        value: str(f?.value, 1000),
      };
      const role = str(f?.role, 10);
      if (ROLES.has(role)) field.role = role;
      return field;
    })
    .filter((f) => f.value);
  if (!fields.length) return reply(400, 'empty');

  // Имя / телефон / email, которые угадал скрипт. Берём, только если формат правильный.
  const c = (lead.contact ?? {}) as Record<string, unknown>;
  const contact = {
    name: valid(str(c.name, 100), NAME_RE),
    phone: valid(str(c.phone, 40), PHONE_RE, (v) => {
      const digits = v.replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15;
    }),
    email: valid(str(c.email, 200), EMAIL_RE),
  };

  // 2. Ловушка для ботов: не было реальных действий человека или слишком быстро
  if (lead.human !== true || typeof lead.tp !== 'number' || lead.tp < MIN_TIME_ON_PAGE) {
    return reply(202, 'ignored');
  }

  // 3. Домен сайта, с которого пришла заявка
  const domain = originDomain(req);
  if (!domain) return reply(403, 'no_origin');

  // 4. Хэш IP — для лимита заявок. Сам IP не храним.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const ipHash = await sha256(ip + '|' + site);

  // 5. Запись в базу (проверки домена и лимитов — внутри submit_lead)
  const { data, error } = await db.rpc('submit_lead', {
    p_site: site,
    p_domain: domain,
    p_ip_hash: ipHash,
    p_page: str(lead.page, 500),
    p_title: str(lead.title, 200),
    p_kind: str(lead.kind, 20),
    p_fields: fields,
    p_contact: contact,
  });

  if (error) {
    console.error('submit_lead error', error);
    return reply(500, 'db_error');
  }

  const status = { ok: 201, blocked: 202, rate_limited: 429, unknown_site: 404 }[data as string] ?? 200;
  return reply(status, data as string);
});
