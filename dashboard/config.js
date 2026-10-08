// Formcatch — настройки кабинета.
// Ключ publishable — публичный по замыслу Supabase (как адрес сайта): доступ к данным решают правила RLS в базе.
export const SUPABASE_URL = 'https://gdevndktdjppgmmusalo.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_g3vqpVFG_yM4HJUN8kwFJg_-X1m8xG0';

// Скрипт для сайтов. В интернете — с адреса самого кабинета (formcatch.vercel.app/formcatch.js),
// на компьютере разработчика — копия в Supabase Storage (localhost чужим сайтам недоступен).
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const WIDGET_URL = LOCAL
  ? SUPABASE_URL + '/storage/v1/object/public/widget/formcatch.js'
  : location.origin + '/formcatch.js';
