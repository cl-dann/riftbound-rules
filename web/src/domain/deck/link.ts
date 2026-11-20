/* A #d= deck link: a decklista szövege URL-biztos base64-ben. Hibás link esetén null (a korábbi viselkedés: üres lista). */
import * as z from 'zod/mini';
import { b64d } from '../text/b64';

export function deckFromHash(hash: string): string | null {
  const m = /^#d=(.+)$/.exec(hash); if (!m) return null;
  try { const r = z.string().safeParse(b64d(m[1])); return r.success ? r.data : null; } catch { return null; }
}
