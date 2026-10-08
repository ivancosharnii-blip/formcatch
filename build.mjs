// Formcatch — сборка папки public/ для публикации на Vercel.
// Запуск из корня проекта: node build.mjs (Vercel запускает её сам — см. vercel.json).
// В public/ попадают: кабинет (dashboard/), политика конфиденциальности и скрипт для сайтов.
import { rmSync, mkdirSync, cpSync, copyFileSync, readdirSync, statSync } from 'node:fs';

const OUT = 'public';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
cpSync('dashboard', OUT, { recursive: true, filter: (src) => !src.endsWith('.gitkeep') });
copyFileSync('widget/formcatch.js', OUT + '/formcatch.js');

let total = 0;
for (const name of readdirSync(OUT)) {
  const size = statSync(OUT + '/' + name).size;
  total += size;
  console.log(name.padEnd(16), (size / 1024).toFixed(1).padStart(6), 'КБ');
}
console.log('Готово: папка public/,', (total / 1024).toFixed(1), 'КБ');
