// Failure kinds for creating, editing and deleting records. Server messages are never shown or logged.

export type DebtWriteFailure = 'rejected' | 'network' | 'unknown' | 'offline' | 'readonly' | 'has_payments';

export const DEBT_WRITE_MESSAGES: Record<DebtWriteFailure, string> = {
  rejected: 'Server menolak perubahan ini. Periksa isian, lalu coba lagi.',
  network: 'Tidak tersambung ke server. Belum ada yang tersimpan. Periksa koneksi, lalu coba lagi.',
  // Creating reuses the same id on retry, so a resend can never create a second record.
  unknown: 'Koneksi terputus sebelum ada jawaban, jadi belum pasti tersimpan. Kirim ulang aman: catatan tidak akan tercatat dua kali.',
  offline: 'Kamu sedang offline. Perubahan belum bisa disimpan.',
  readonly: 'Mode contoh: perubahan tidak disimpan.',
  has_payments: 'Catatan ini sudah punya riwayat pembayaran, jadi tidak bisa dihapus. Riwayat pembayaran tidak pernah dihapus.',
};

export class DebtWriteError extends Error {
  readonly kind: DebtWriteFailure;
  constructor(kind: DebtWriteFailure) {
    super(DEBT_WRITE_MESSAGES[kind]);
    this.name = 'DebtWriteError';
    this.kind = kind;
  }
}
