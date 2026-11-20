/* Szabályzat fejezetcím felismerése. (a korábbi legacy/core.ts része, S15) */
export const isHead=(r: readonly [string, string, ...unknown[]])=>/^\d{3}$/.test(r[0])&&r[1].length<70&&!/[.:]$/.test(r[1]);
