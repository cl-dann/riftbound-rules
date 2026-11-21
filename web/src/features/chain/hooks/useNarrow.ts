import { useEffect, useState } from 'react';

/** Keskeny nézet (mobil): itt a lépéseket a varázsló (bottom sheet) építi. */
export function useNarrow() {
  const q = '(max-width: 700px)';
  const [n, setN] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => { if (typeof matchMedia !== 'function') return; const m = matchMedia(q); const on = () => setN(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return n;
}
