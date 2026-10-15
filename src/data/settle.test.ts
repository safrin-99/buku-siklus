import { describe, expect, it, vi } from 'vitest';
import { settleWrite } from './settle';

type Err = { code: string };
const NETWORK: Err = { code: '' };
const PG_ERROR: Err = { code: 'P0001' };
const isNetwork = (e: Err) => !e.code;

describe('settleWrite', () => {
  it('berhasil langsung → saved, tanpa memeriksa keberadaan baris', async () => {
    const exists = vi.fn();
    expect(await settleWrite<Err>(async () => null, exists, isNetwork)).toBe('saved');
    expect(exists).not.toHaveBeenCalled();
  });

  it('respons hilang: galat jaringan tetapi baris ada → saved (bukan menyuruh pengguna mengulang)', async () => {
    expect(await settleWrite<Err>(async () => NETWORK, async () => true, isNetwork)).toBe('saved');
  });

  it('retry setelah berhasil: galat server menyesatkan tetapi baris ada → saved', async () => {
    expect(await settleWrite<Err>(async () => PG_ERROR, async () => true, isNetwork)).toBe('saved');
  });

  it('galat server dan baris tidak ada → rejected', async () => {
    expect(await settleWrite<Err>(async () => PG_ERROR, async () => false, isNetwork)).toBe('rejected');
  });

  it('galat jaringan dan baris terbukti tidak ada → network (aman diulang)', async () => {
    expect(await settleWrite<Err>(async () => NETWORK, async () => false, isNetwork)).toBe('network');
  });

  it('pemeriksaan keberadaan ikut gagal → unknown, apa pun galat awalnya', async () => {
    const boom = async () => {
      throw new Error('putus');
    };
    expect(await settleWrite<Err>(async () => NETWORK, boom, isNetwork)).toBe('unknown');
    expect(await settleWrite<Err>(async () => PG_ERROR, boom, isNetwork)).toBe('unknown');
  });

  it('attempt yang melempar dianggap galat transport', async () => {
    const throws = async (): Promise<Err | null> => {
      throw new TypeError('Failed to fetch');
    };
    expect(await settleWrite<Err>(throws, async () => false, isNetwork)).toBe('network');
    expect(await settleWrite<Err>(throws, async () => true, isNetwork)).toBe('saved');
  });

  it('attempt dipanggil sekali, pemeriksaan sekali', async () => {
    const attempt = vi.fn(async () => PG_ERROR);
    const exists = vi.fn(async () => false);
    await settleWrite<Err>(attempt, exists, isNetwork);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(exists).toHaveBeenCalledTimes(1);
  });
});
