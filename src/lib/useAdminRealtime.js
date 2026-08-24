import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase.js";

// Tables whose changes should refresh the dispatcher console. Each of these
// must be added to the `supabase_realtime` publication in the Supabase project
// before events arrive; RLS still applies, so a dispatcher only receives rows
// their policies already let them read.
const WATCHED_TABLES = ["trips", "bookings", "booking_passengers", "trip_incidents", "trip_events"];

// Changes arrive in bursts (a trip update writes trips + trip_events together),
// so collapse them into a single refetch.
const REFRESH_DEBOUNCE_MS = 700;

/**
 * Keeps the dispatcher console in sync with the database over Supabase realtime.
 *
 * Returns the connection status so the UI can say plainly whether it is live,
 * rather than silently showing stale data when the channel drops.
 */
export function useAdminRealtime({ enabled, onChange }) {
  const active = Boolean(enabled && isSupabaseConfigured && supabase);
  const [channelStatus, setChannelStatus] = useState("connecting");
  const [lastEventAt, setLastEventAt] = useState(null);
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef(null);

  // Derived rather than written from the effect body: writing state there
  // triggers a cascading render, and the inactive case is already knowable at
  // render time.
  const status = active ? channelStatus : "idle";

  // Hold the latest callback in a ref so a new function identity on each render
  // does not tear down and re-create the channel.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!active) return undefined;

    let subscribed = true;

    const scheduleRefresh = () => {
      if (!subscribed) return;
      setLastEventAt(Date.now());
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!subscribed) return;
        // Skip work while the tab is hidden; the visibility handler below
        // catches up on the way back.
        if (document.visibilityState === "hidden") return;
        onChangeRef.current?.();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase.channel("admin-operations");
    WATCHED_TABLES.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    });

    channel.subscribe((nextStatus) => {
      if (!subscribed) return;
      if (nextStatus === "SUBSCRIBED") setChannelStatus("live");
      else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") setChannelStatus("error");
      else if (nextStatus === "CLOSED") setChannelStatus("closed");
    });

    // Anything that changed while the tab was hidden is missed, so refetch once
    // on return rather than waiting for the next write.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") onChangeRef.current?.();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscribed = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
      // Reset so a later re-subscribe does not briefly report "live" from the
      // previous cycle before the new channel has actually connected.
      setChannelStatus("connecting");
    };
  }, [active]);

  return { status, lastEventAt };
}
