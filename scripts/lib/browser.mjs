// Helpers shared by scripts/audit-ui.mjs and scripts/e2e-local.mjs.
import { existsSync, readdirSync } from 'node:fs';

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (existsSync(root)) {
    for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      const p = `${root}/${dir}/chrome-linux/chrome`;
      if (existsSync(p)) return p;
    }
    if (existsSync(`${root}/chromium/chrome`)) return `${root}/chromium/chrome`;
  }
  return undefined; // biarkan playwright mencari sendiri
}

export async function waitForServer(url, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('vite preview tidak siap');
}
