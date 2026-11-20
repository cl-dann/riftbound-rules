/* A #c= chain link: a helyzet (CS) JSON-ja URL-biztos base64-ben. Érvénytelen link esetén null, ekkor a builder
   a korábbi módon nem tölt be semmit. A bemenet változatlanul megy tovább (a séma csak ellenőriz, nem alakít át). */
import { b64d } from '../text/b64';
import { ChainStateSchema, type ChainState } from './state';

export function chainFromLink(enc: string): ChainState | null {
  let raw: unknown;
  try { raw = JSON.parse(b64d(enc)); } catch { return null; }
  return ChainStateSchema.safeParse(raw).success ? (raw as ChainState) : null;
}
