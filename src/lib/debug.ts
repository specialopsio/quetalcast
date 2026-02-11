/** Debug logging gated by VITE_DEBUG env variable */
const DEBUG = import.meta.env.VITE_DEBUG === 'true';

export function dbg(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

export function dbgWarn(...args: unknown[]) {
  if (DEBUG) console.warn(...args);
}
