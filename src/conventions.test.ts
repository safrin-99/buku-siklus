// Menegakkan aturan DESIGN.md bagian 2 dan CLAUDE.md "UI" secara otomatis.
// Bila tes ini gagal, jangan melonggarkan tesnya: perbaiki komponennya atau ubah token di index.css.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk(join(root, 'src')).filter(
  (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f),
);
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => f.slice(root.length);

function offenders(pattern: RegExp): string[] {
  return sourceFiles.filter((f) => pattern.test(read(f))).map(rel);
}

describe('konvensi UI', () => {
  it('tidak ada hex warna di komponen (hex hanya di src/index.css)', () => {
    expect(offenders(/(?<![\w&])#[0-9a-fA-F]{6}\b/)).toEqual([]);
  });

  it('tidak ada nilai arbitrer untuk warna atau ukuran teks (text-[11px], bg-[#...])', () => {
    expect(offenders(/\btext-\[\d/)).toEqual([]);
    expect(offenders(/\b(?:text|bg|border|ring|fill|stroke|shadow|from|to|via|divide|outline)-\[#/)).toEqual([]);
  });

  it('tidak memakai palet bawaan Tailwind (hanya token desain)', () => {
    expect(
      offenders(/\b(?:text|bg|border)-(?:gray|slate|zinc|neutral|stone|red|green|amber|blue|indigo|black|white)(?:-\d{2,3})?\b/),
    ).toEqual([]);
  });

  it('tanpa gradient dan tanpa emoji di UI', () => {
    expect(offenders(/\bbg-gradient|\bfrom-[a-z]|\bvia-[a-z]/)).toEqual([]);
    expect(offenders(/\p{Extended_Pictographic}/u)).toEqual([]);
  });

  it('tanpa kata terlarang di copy (DESIGN.md bagian 8) dan tanpa sapaan "Anda"', () => {
    expect(offenders(/\b(?:Tenang|Nikmati|Prima|Magic|Anda)\b/)).toEqual([]);
  });

  it('tanpa badge AI/OCR/realtime di UI', () => {
    expect(offenders(/\b(?:OCR|Realtime|Real-time)\b/i)).toEqual([]);
  });

  it('semua nominal memakai komponen Money (tabular-nums)', () => {
    expect(read(join(root, 'src/components/ui/Money.tsx'))).toContain('tabular-nums');
  });
});

describe('konvensi dokumen HTML', () => {
  const html = read(join(root, 'index.html'));
  const viewport = /<meta[^>]*name="viewport"[^>]*>/.exec(html)?.[0] ?? '';

  it('viewport ada dan tidak memblokir zoom', () => {
    expect(viewport).not.toBe('');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it('bahasa Indonesia dan tanpa CDN (script, font, ikon)', () => {
    expect(html).toContain('lang="id"');
    const cdn = /https?:\/\/(?:cdn\.|fonts\.googleapis|fonts\.gstatic|unpkg|cdnjs|code\.jquery)/;
    expect(html).not.toMatch(cdn);
    expect(offenders(cdn)).toEqual([]);
  });
});

describe('token tema', () => {
  const css = read(join(root, 'src/index.css'));
  const sizes = [...css.matchAll(/--text-([a-z0-9-]+):\s*(\d+)px;/g)].map((m) => ({ name: m[1]!, px: Number(m[2]) }));

  it('ada token ukuran teks dan semuanya ≥ 12px', () => {
    expect(sizes.length).toBeGreaterThanOrEqual(8);
    expect(sizes.filter((s) => s.px < 12)).toEqual([]);
  });

  it('warna bawaan Tailwind direset sehingga hanya token yang tersedia', () => {
    expect(css).toContain('--color-*: initial');
    expect(css).toContain('--text-*: initial');
  });

  it('tidak ada gradient di CSS', () => {
    expect(css).not.toMatch(/gradient\(/);
  });
});
