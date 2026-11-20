/* Mérés segéd a Vitest 5 bench API-hoz: lefuttatja a függvényt, és kiírja az átlagot és a p95-öt (ms).
   Az eredmény a bench-results.json-ba is kerül (nincs verziókezelve), a riport onnan olvas. */
import { appendFileSync } from 'node:fs';

type BenchCtx = (name: string, fn: () => void) => { run: (o?: any) => Promise<any> };

export async function measure(bench: BenchCtx, name: string, fn: () => void) {
  const r = await bench(name, fn).run({ retainSamples: true, time: 1500, warmupTime: 200 });
  const s: number[] = [...(r.latency.samples || [])].sort((a, b) => a - b);
  const p95 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : r.latency.p99;
  const row = { name, n: s.length, mean: +r.latency.mean.toFixed(3), p95: +p95.toFixed(3) };
  console.log(`${name}: átlag ${row.mean} ms, p95 ${row.p95} ms (n=${row.n})`);
  appendFileSync('bench-results.json', JSON.stringify(row) + '\n');
  return row;
}
