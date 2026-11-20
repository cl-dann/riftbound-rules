/* A golden kimenetek szöveges alakja: esetenként egy fejléc, utána kulcsonként egy sor tömör JSON-nal,
   így egy eltérés a diffben a kulcsnál látszik. */
import { createHash } from 'node:crypto';

export const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function block(label: string, out: Record<string, unknown>) {
  const keys = Object.keys(out).sort();
  return '### ' + label + '\n' + keys.map((k) => k + ': ' + JSON.stringify(out[k])).join('\n') + '\n';
}
