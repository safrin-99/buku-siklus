// Audit render: membuka build mode fixture (vite preview, dist-fixture/) di Chromium pada 360px dan 412px,
// memeriksa aturan DESIGN.md yang bisa diukur mesin, dan menyimpan tangkapan layar ke audit-out/.
// Pakai: pnpm audit:ui   (membangun sendiri dalam mode fixture; CHROMIUM_PATH opsional)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { findChromium, waitForServer } from './lib/browser.mjs';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const HENDRA = '20000000-0000-4000-8000-000000000001';
const ARISAN = '20000000-0000-4000-8000-000000000004';
// Fixture payment ids are synthetic (pay-N); pick Hendra's first real payment for the payment detail screen.
const fixture = JSON.parse(readFileSync(new URL('../src/data/fixtures.generated.json', import.meta.url), 'utf8'));
const HENDRA_PAYMENT = fixture.payments.find((p) => p.debt_id === HENDRA && p.amount_idr > 0).id;
const WIDTHS = [360, 412];
const OUT = 'audit-out';

const ROUTES = [
  '/',
  '/catatan',
  '/catatan?tab=piutang',
  '/catatan?f=terlambat',
  `/catatan/${HENDRA}`,
  '/kotak-masuk',
  '/?fixture=loading',
  '/?fixture=error',
  '/?fixture=empty',
  '/catatan?fixture=empty',
  '/catatan?fixture=error',
  `/catatan/${HENDRA}?fixture=error`,
  '/catatan/tidak-ada',
  '/masuk?fixture=signedout',
  '/pengaturan',
  `/catatan/${HENDRA}/bayar`,
  `/catatan/${HENDRA}/bayar?fixture=error`,
  `/catatan/${ARISAN}/bayar`,
  '/catatan/tidak-ada/bayar',
  `/catatan/${HENDRA}/pembayaran/${HENDRA_PAYMENT}`,
  `/catatan/${HENDRA}/pembayaran/tidak-ada`,
];

// Keadaan yang hanya muncul setelah interaksi. Tiap langkah mengembalikan nama keadaan untuk diperiksa.
const INTERACTIONS = [
  {
    route: '/masuk?fixture=signedout',
    name: 'masuk',
    run: async function* (page) {
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      yield 'validasi-kosong';
      await page.getByLabel('Email').fill('pemilik@contoh.id');
      await page.getByLabel('Kata sandi', { exact: true }).fill('rahasia-contoh');
      await page.getByRole('button', { name: 'Masuk', exact: true }).click();
      await page.getByText('Memproses…').waitFor();
      yield 'memproses';
      await page.getByText('Mode contoh: tindakan ini tidak tersedia.').waitFor();
      yield 'galat';
    },
  },
  {
    route: `/catatan/${HENDRA}/bayar`,
    name: 'bayar',
    run: async function* (page) {
      const amount = page.getByLabel('Nominal dibayar');
      assert.equal(await amount.inputValue(), '600.000', 'nominal terisi sebesar tagihan berikutnya');
      await amount.fill('1234567');
      assert.equal(await amount.inputValue(), '1.234.567', 'pemisah ribuan otomatis saat mengetik');
      await amount.fill('');
      await page.getByRole('button', { name: 'Simpan' }).click();
      yield 'validasi-kosong';
      await amount.fill('999999');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Nominal melebihi sisa (Rp600.000).').waitFor();
      yield 'melebihi-sisa';
      await page.getByLabel('Tanggal bayar').fill('2026-10-16');
      await amount.fill('300000');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Tanggal tidak boleh setelah hari ini.').waitFor();
      yield 'tanggal-masa-depan';
      await page.getByLabel('Tanggal bayar').fill('2026-10-15');
      await page.getByRole('button', { name: 'Simpan' }).click();
      await page.getByText('Menyimpan…').waitFor();
      yield 'menyimpan';
      await page.getByText('Mode contoh: perubahan tidak disimpan.').waitFor();
      yield 'galat';
    },
  },
  {
    route: `/catatan/${HENDRA}/pembayaran/${HENDRA_PAYMENT}`,
    name: 'pembayaran',
    run: async function* (page) {
      await page.getByRole('button', { name: 'Batalkan pembayaran' }).click();
      await page.getByText('Pembayaran asli tetap tampil di riwayat.').waitFor();
      yield 'konfirmasi';
      await page.getByRole('button', { name: 'Ya, batalkan pembayaran' }).click();
      await page.getByText('Memproses…').waitFor();
      yield 'memproses';
      await page.getByText('Mode contoh: perubahan tidak disimpan.').waitFor();
      yield 'galat';
    },
  },
  {
    route: '/pengaturan',
    name: 'pengaturan',
    run: async function* (page) {
      await page.getByRole('button', { name: 'Keluar dari semua perangkat' }).click();
      yield 'konfirmasi-keluar-semua';
      await page.getByRole('button', { name: 'Keluar dari semua perangkat' }).click();
      await page.getByText('Mode contoh: tindakan ini tidak tersedia.').waitFor();
      yield 'galat';
    },
  },
];

/** Dijalankan di dalam halaman. Mengembalikan daftar temuan. */
function inPage() {
  const findings = [];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const toRgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (t, b2) => (t * top.a + b2 * bottom.a * (1 - top.a)) / a;
    return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = toRgba(getComputedStyle(n).backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a === 1) break;
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) acc = over(l, acc);
    return acc;
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => {
    const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const id = el.getAttribute('aria-label');
    return `<${el.tagName.toLowerCase()}${id ? ` aria-label="${id}"` : ''}> ${t}`;
  };
  const add = (rule, el, detail) => findings.push({ rule, el: label(el), detail });

  if (document.documentElement.scrollWidth > window.innerWidth) {
    findings.push({
      rule: 'overflow-x',
      el: 'document',
      detail: `scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`,
    });
  }

  // Teks: ukuran minimum, kontras, terpotong.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    if (!(el instanceof HTMLElement) || !visible(el)) continue;
    if (['SCRIPT', 'STYLE'].includes(el.tagName)) continue;
    if (el.closest('.sr-only')) continue;
    const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasOwnText) continue;
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    if (size < 12) add('font<12px', el, `${size}px`);
    const fg = over(toRgba(s.color), backdrop(el));
    const bg = backdrop(el);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < need) add('kontras', el, `${cr.toFixed(2)}:1 (butuh ${need}) warna ${s.color} di atas rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`);
    if (s.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && !el.closest('[data-scroller]')) {
      add('teks-terpotong', el, `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    }
    // Teks keluar dari viewport (di luar scroller horizontal yang disengaja).
    const r = el.getBoundingClientRect();
    const scroller = el.closest('.overflow-x-auto');
    if (!scroller && (r.right > window.innerWidth + 0.5 || r.left < -0.5)) {
      add('di-luar-layar', el, `left ${Math.round(r.left)} right ${Math.round(r.right)}`);
    }
  }

  // Target sentuh dan nama aksesibel.
  const interactive = document.querySelectorAll('a[href], button, input, select, textarea, [role="tab"], [role="button"]');
  for (const el of interactive) {
    if (!(el instanceof HTMLElement) || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 44 - 0.5 || r.width < 44 - 0.5) add('target<44px', el, `${Math.round(r.width)}x${Math.round(r.height)}`);
    const name =
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      (el.labels && el.labels.length ? 'label' : '') ||
      (el.textContent ?? '').trim() ||
      el.getAttribute('title') ||
      '';
    if (!name) add('tanpa-nama', el, 'tidak ada teks/aria-label/label');
  }

  // Gambar tanpa alt, dan emoji di teks yang tampil.
  for (const img of document.querySelectorAll('img:not([alt])')) add('img-tanpa-alt', img, '');
  const emoji = /\p{Extended_Pictographic}/u;
  if (emoji.test(document.body.innerText)) findings.push({ rule: 'emoji', el: 'body', detail: 'ada karakter emoji' });

  // Angka uang harus tabular.
  for (const el of document.querySelectorAll('[data-money], .tabular-nums')) {
    if (!visible(el)) continue;
    const v = getComputedStyle(el).fontVariantNumeric;
    if (!v.includes('tabular-nums')) add('angka-tidak-tabular', el, v);
  }
  return findings;
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const server = spawn(
    'pnpm',
    ['exec', 'vite', 'preview', '--outDir', 'dist-fixture', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { stdio: 'ignore' },
  );
  const stop = () => server.kill();
  process.on('exit', stop);

  let total = 0;
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch({ executablePath: findChromium() });
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, locale: 'id-ID' });
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
      page.on('pageerror', (e) => consoleErrors.push(String(e)));
      const check = async (label, fileName, expectedNoise) => {
        const findings = await page.evaluate(inPage);
        await page.screenshot({ path: `${OUT}/${width}${fileName.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true });
        const errs = expectedNoise ? [] : consoleErrors;
        total += findings.length + errs.length;
        const status = findings.length + errs.length === 0 ? 'OK ' : 'GAGAL';
        console.log(`${status} ${width}px ${label}`);
        for (const f of findings) console.log(`     - [${f.rule}] ${f.el} :: ${f.detail}`);
        for (const e of errs) console.log(`     - [console] ${e}`);
      };
      for (const route of ROUTES) {
        consoleErrors.length = 0;
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(route.includes('error') ? 1800 : 600); // retry galat ±400ms
        await check(route, route, route.includes('error') || route.includes('tidak-ada'));
      }
      for (const item of INTERACTIONS) {
        consoleErrors.length = 0;
        await page.goto(BASE + item.route, { waitUntil: 'networkidle' });
        for await (const state of item.run(page)) await check(`${item.route} [${state}]`, `${item.name}_${state}`, false);
      }
      await ctx.close();
    }
    await browser.close();
  } finally {
    stop();
  }
  console.log(total === 0 ? '\nTidak ada temuan.' : `\n${total} temuan.`);
  process.exitCode = total === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
