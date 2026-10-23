// Email-change links (Supabase Auth /verify) redirect back to the app with the result in the URL fragment. When the
// change completes, the fragment also carries a NEW session (access + refresh token). The app never signs in from a
// URL (detectSessionInUrl: false), so at startup the fragment is read once, removed from the address bar (and from
// the history entry), and that session is revoked. Only a short notice survives, as `?konfirmasi=`.

export type EmailLinkNotice = 'sebagian' | 'selesai' | 'gagal';

export interface AuthLink {
  notice: EmailLinkNotice | null;
  /** Access token of the session the link created: revoked, never used. */
  accessToken: string | null;
}

const NOTICES: readonly string[] = ['sebagian', 'selesai', 'gagal'] satisfies EmailLinkNotice[];

export function isEmailLinkNotice(value: string | null): value is EmailLinkNotice {
  return value !== null && NOTICES.includes(value);
}

/** Null when the fragment is not an auth redirect (then the URL is left alone). */
export function parseAuthLink(hash: string): AuthLink | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const failed = params.has('error') || params.has('error_code');
  if (accessToken === null && !params.has('refresh_token') && !failed && !params.has('message')) return null;

  let notice: EmailLinkNotice | null;
  if (failed) notice = 'gagal';
  else if (accessToken !== null) notice = params.get('type') === 'email_change' ? 'selesai' : null;
  // "Confirmation link accepted. Please proceed to confirm link sent to the other email"
  else notice = params.has('message') ? 'sebagian' : null;
  return { notice, accessToken };
}

/** The same address without the fragment, plus `?konfirmasi=` when there is something to tell. */
export function addressWithoutAuthLink(href: string, link: AuthLink): string {
  const url = new URL(href);
  url.hash = '';
  if (link.notice) url.searchParams.set('konfirmasi', link.notice);
  return `${url.pathname}${url.search}`;
}
