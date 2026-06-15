"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { healthService } from "@/services/healthService";
import { formatHeaderDate } from "@/lib/page-titles";

type ApiStatus = "online" | "offline" | "checking";

interface SystemStatusContextValue {
  apiStatus: ApiStatus;
  lastSyncAt: Date | null;
  refresh: () => Promise<void>;
  now: Date;
}

const SystemStatusContext = createContext<SystemStatusContextValue | null>(null);

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(async () => {
    setApiStatus("checking");
    try {
      await healthService.ping();
      setApiStatus("online");
      setLastSyncAt(new Date());
    } catch {
      setApiStatus("offline");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const syncTimer = window.setInterval(() => void refresh(), 60_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(syncTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ apiStatus, lastSyncAt, refresh, now }),
    [apiStatus, lastSyncAt, refresh, now],
  );

  return <SystemStatusContext.Provider value={value}>{children}</SystemStatusContext.Provider>;
}

export function useSystemStatus(): SystemStatusContextValue {
  const ctx = useContext(SystemStatusContext);
  if (!ctx) throw new Error("useSystemStatus must be used within SystemStatusProvider");
  return ctx;
}

export function useHeaderClock() {
  const { now, lastSyncAt, apiStatus, refresh } = useSystemStatus();
  const { dateLabel, weekday, timeLabel } = formatHeaderDate(now);
  const syncLabel =
    apiStatus === "online"
      ? lastSyncAt
        ? `Oxirgi yangilanish: ${formatHeaderDate(lastSyncAt).timeLabel}`
        : "Sinxronizatsiya: faol"
      : apiStatus === "offline"
        ? "API offline"
        : "Tekshirilmoqda...";

  return { dateLabel, weekday, timeLabel, syncLabel, apiStatus, refresh };
}
