import { useState, useEffect } from 'react';

/**
 * Formats elapsed milliseconds (from a start ISO string) as MM:SS or H:MM:SS.
 * pausedAtIso: if provided, time is frozen at that point.
 */
export function formatElapsed(
  startedAtIso: string,
  pausedAtIso?: string | null,
  pausedDurationMs = 0,
): string {
  const nowMs = pausedAtIso ? Date.parse(pausedAtIso) : Date.now();
  const totalSec = Math.max(0, Math.floor((nowMs - Date.parse(startedAtIso) - pausedDurationMs) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Hook that returns the formatted elapsed time string.
 * The setInterval drives re-renders only — actual time is always computed
 * fresh from the ISO string, so it cannot drift or stop when backgrounded.
 */
export function useElapsedTimer(
  startedAtIso: string | null,
  pausedAtIso?: string | null,
  pausedDurationMs = 0,
): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAtIso || pausedAtIso) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [startedAtIso, pausedAtIso]);

  if (!startedAtIso) return '00:00';
  return formatElapsed(startedAtIso, pausedAtIso, pausedDurationMs);
}
