// Failure kinds for writing to the ledger, each with one Indonesian message that says what happened and what to do.
// Server messages are never shown (they can name tables and constraints) and nothing is logged here.

export type PaymentWriteFailure = 'rejected' | 'network' | 'unknown' | 'offline' | 'readonly';

export const PAYMENT_WRITE_MESSAGES: Record<PaymentWriteFailure, string> = {
  rejected: 'Server menolak perubahan ini. Data sudah dimuat ulang; periksa sisa dan riwayat catatan, lalu coba lagi.',
  network: 'Tidak tersambung ke server. Belum ada yang tersimpan. Periksa koneksi, lalu coba lagi.',
  unknown: 'Belum pasti tersimpan. Periksa riwayat pembayaran dulu; kirim ulang hanya bila belum tercatat.',
  offline: 'Kamu sedang offline. Perubahan belum bisa dicatat.',
  readonly: 'Mode contoh: perubahan tidak disimpan.',
};

export class PaymentWriteError extends Error {
  readonly kind: PaymentWriteFailure;
  constructor(kind: PaymentWriteFailure) {
    super(PAYMENT_WRITE_MESSAGES[kind]);
    this.name = 'PaymentWriteError';
    this.kind = kind;
  }
}
