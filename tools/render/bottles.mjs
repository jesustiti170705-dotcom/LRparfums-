import { chromium } from 'playwright';
import fs from 'fs';
const out = process.argv[2]; const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const src = fs.readFileSync('catalog.js', 'utf8');
const CAT = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const p of CAT) {
  if (only && !only.split(',').includes(p.h)) continue;
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  await pg.goto(`http://localhost:8767/world.html?w=600&h=760&bottle=${encodeURIComponent(p.h)}`);
  await pg.waitForFunction('window.READY === true', null, { timeout: 120000 });
  const d = await pg.evaluate(() => window.renderBottle());
  fs.writeFileSync(`${out}/${p.h}.png`, Buffer.from(d.split(',')[1], 'base64'));
  await pg.close();
}
await b.close(); console.log('bottles done');
