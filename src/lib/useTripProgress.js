import { useEffect, useState } from "react";

// Simulated real-time progress (0-1) of a trip lasting durationMinutes,
// looping continuously based on wall-clock time.
export function useTripProgress(durationMinutes, tickMs = 15000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(interval);
  }, [tickMs]);

  const minutesElapsed = (now / 60000) % durationMinutes;
  return Math.min(0.99, Math.max(0.01, minutesElapsed / durationMinutes));
}
