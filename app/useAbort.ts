'use client';

import { useCallback, useRef } from 'react';

/**
 * One in-flight request per caller. Starting a new one aborts the last, so
 * switching a partner slot or the language twice in a row can never let the
 * slower, older reply land last and overwrite the newer one.
 */
export function useAbort(): () => AbortSignal {
  const ref = useRef<AbortController | null>(null);
  return useCallback(() => {
    ref.current?.abort();
    const c = new AbortController();
    ref.current = c;
    return c.signal;
  }, []);
}
