import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
const OUT = process.argv[2]; const WORKERS = +process.argv[3] || 4;
fs.mkdirSync(OUT, { recursive: true });
const VARS = { d: { w: 1920, h: 1080, enc: ['-crf', '20', '-g', '8', '-keyint_min', '8'] },
               m: { w: 720, h: 1280, enc: ['-crf', '23', '-g', '4', '-keyint_min', '4'] } };
const names = ['palacio', 'gourmand', 'floral', 'oud', 'fresco', 'mayor'];
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let jobs = null;
async function openPage(b, v) {
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto(`http://localhost:8767/world.html?w=${v.w}&h=${v.h}`);
  await p.waitForFunction('window.READY === true', null, { timeout: 180000 });
  return p;
}
function encoder(file, v) {
  return spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'slow', ...v.enc, '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
}
async function worker(id) {
  const b = await chromium.launch({ args });
  const pages = {};
  while (jobs.length) {
    const j = jobs.shift(); const v = VARS[j.v];
    pages[j.v] = pages[j.v] || await openPage(b, v);
    const p = pages[j.v];
    const f0 = Math.round(j.s.t0 * 30), f1 = Math.round(j.s.t1 * 30);
    const ff = encoder(`${OUT}/${j.file}`, v);
    const t = Date.now();
    for (let f = f0; f <= f1; f++) {
      const d = await p.evaluate(T => window.renderAt(T, 0.95), f / 30);
      const buf = Buffer.from(d.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(`[w${id}] ${j.file} ${f1 - f0 + 1}f ${((Date.now() - t) / 1000).toFixed(0)}s, left ${jobs.length}`);
  }
  await b.close();
}
const b0 = await chromium.launch({ args }); const p0 = await openPage(b0, VARS.d);
const SEGS = await p0.evaluate(() => window.FILM.SEGS); await b0.close();
jobs = [];
for (const v of ['d', 'm']) for (const s of SEGS) {
  const base = s.kind === 'dive' ? names[s.i] : `conn${s.i + 1}`;
  jobs.push({ v, s, file: base + (v === 'm' ? '-m' : '') + '.mp4' });
}
// longest jobs first for better packing
jobs.sort((a, b) => (b.s.t1 - b.s.t0) * (b.v === 'd' ? 2 : 1) - (a.s.t1 - a.s.t0) * (a.v === 'd' ? 2 : 1));
await Promise.all([...Array(WORKERS).keys()].map(worker));
console.log('DONE');
