import { memo } from 'react';

/** Előre generált (escape-elt) HTML blokk megjelenítése: kártyaszöveg, szabályszöveg, magyarázatok. */
export const Html = memo(function Html({ html, className, id }: { html: string; className?: string; id?: string }) {
  return <div id={id} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});
