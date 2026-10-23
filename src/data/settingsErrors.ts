// Failure kinds for saving settings. Saving settings is idempotent (it sets values, it does not append), so unlike the
// ledger there is no "unknown" outcome: a retry is always safe. Server messages are never shown or logged.

export type SettingsWriteFailure = 'rejected' | 'network' | 'offline' | 'readonly';

export const SETTINGS_WRITE_MESSAGES: Record<SettingsWriteFailure, string> = {
  rejected: 'Server menolak perubahan ini. Muat ulang halaman, lalu coba lagi.',
  network: 'Tidak tersambung ke server. Perubahan belum tersimpan. Periksa koneksi, lalu coba lagi.',
  offline: 'Kamu sedang offline. Perubahan belum bisa disimpan.',
  readonly: 'Mode contoh: perubahan tidak disimpan.',
};

export class SettingsWriteError extends Error {
  readonly kind: SettingsWriteFailure;
  constructor(kind: SettingsWriteFailure) {
    super(SETTINGS_WRITE_MESSAGES[kind]);
    this.name = 'SettingsWriteError';
    this.kind = kind;
  }
}
