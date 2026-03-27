"use client";

import { useEffect, useMemo, useState } from "react";

import { formatElapsed } from "@/lib/utils";

export function useStopwatch() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const elapsedSeconds = useMemo(
    () => Math.max(0, Math.floor((now - startedAt) / 1000)),
    [now, startedAt],
  );

  return {
    elapsedSeconds,
    formatted: formatElapsed(elapsedSeconds),
  };
}
