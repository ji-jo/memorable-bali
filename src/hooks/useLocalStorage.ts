import { useCallback, useState } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

/**
 * Typed localStorage state. Versioned and defensive — a corrupt or stale
 * record falls back to the initial value rather than crashing (lib/storage.ts).
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeStorage(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}
