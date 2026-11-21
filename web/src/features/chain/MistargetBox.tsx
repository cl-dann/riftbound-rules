import type { MtInfo } from './chainBuild';
import { Refs, ST_TXT } from './bits';

export function MistargetBox({ mt }: { mt: MtInfo }) {
  const rest = mt.instr.some((x) => x.st === 'executed');
  const head = mt.kind === 'full' ? (rest ? 'Teljes mistarget: a célpontokra nem hat, a célponthoz nem kötött utasítás végrehajtódik' : 'Teljes mistarget: az elem nem csinál semmit') : mt.kind === 'partial' ? 'Részleges mistarget: csak a legális célpontokra hat' : 'Nincs mistarget, de egy utasítás elmarad';
  return (
    <div className={'cbv-mt ' + mt.kind}>
      <div className="cbv-mt-h"><Refs r={mt.kind === 'full' ? '359.3.e.9, 359.3.e.7' : mt.kind === 'partial' ? '359.3.e.9, 359.3.e.8' : '359.3.e.6'} /><b>{head}</b><span className="note">{mt.item}</span></div>
      <ul className="cbv-mt-tg">{mt.targets.map((t, k) => (
        <li key={k} className={t.ok ? 'ok' : t.skip ? 'skip' : 'bad'}><span className="cbv-pill">{t.ok ? 'legális' : t.skip ? 'kimarad' : 'illegális'}</span>{t.n}{t.why ? ': ' + t.why : ''}</li>
      ))}</ul>
      {mt.instr.length > 0 && (
        <table className="cbv-mt-in"><tbody>{mt.instr.map((x, k) => (
          <tr key={k}><td className="q">"{x.t}"</td><td><span className={'cbv-st ' + ST_TXT[x.st][1]}>{ST_TXT[x.st][0]}</span></td><td>{x.ref && <Refs r={x.ref} />}{x.why}{x.man && <span className="cbman">kézzel beállítva</span>}</td></tr>
        ))}</tbody></table>
      )}
    </div>
  );
}
