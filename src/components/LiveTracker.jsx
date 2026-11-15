import { useEffect, useMemo, useState } from "react";
import { Bus } from "lucide-react";
import { fetchTripLive } from "../lib/database.js";
import { deriveTracking, routePath, shouldPoll, stopIdForStation } from "../lib/tracking.js";
import { warsawToday } from "../lib/warsawTime.js";

const POLL_MS = 15 * 1000;

function minutesBetween(start, end) {
  const [startHour, startMinute] = String(start).split(":").map(Number);
  const [endHour, endMinute] = String(end).split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return minutes > 0 ? minutes : minutes + 24 * 60;
}

function previousDay(date) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

function formatAge(ageMs, t) {
  const seconds = Math.round(ageMs / 1000);
  return seconds < 60
    ? t.trackerSeconds.replace("{n}", Math.max(1, seconds))
    : t.trackerMinutes.replace("{n}", Math.round(seconds / 60));
}

// What the passenger sees for each phase of the trip. A null fraction leaves
// the route line out, because there is no honest position to draw.
function describe(tracking, booking, platform, t) {
  const age = tracking.ageMs != null ? formatAge(tracking.ageMs, t) : "";
  const fraction = tracking.progress ? tracking.progress.fraction : null;
  const boardingLabel = platform ? `${t.trackerBoarding} · ${t.platformShort} ${platform}` : t.trackerBoarding;
  const departs = { figureLabel: t.trackerDeparts, figure: booking.departureTime };
  const arrives = { figureLabel: t.trackerScheduledArrival, figure: booking.arrivalTime };

  switch (tracking.phase) {
    case "cancelled":
      return { tone: "danger", label: t.trackerCancelled, hint: t.trackerHintCancelled, fraction: null };
    case "arrived":
      return { tone: "brand", label: t.trackerArrived, hint: t.trackerHintArrived, fraction: 1 };
    case "scheduled":
      return { tone: "muted", label: t.trackerPlanned, ...departs, hint: t.trackerHintPlanned, fraction: 0 };
    case "waiting":
      return tracking.boarding
        ? { tone: "brand", pulse: true, label: boardingLabel, ...departs, hint: t.trackerHintWaiting, fraction: 0 }
        : {
            tone: tracking.delayed ? "warning" : "brand",
            label: tracking.delayed ? t.trackerDelayed : t.trackerOnRoute,
            ...arrives,
            hint: t.trackerHintWaiting,
            fraction: null,
          };
    case "stale":
      return { tone: "muted", label: t.trackerNoSignal, ...arrives, hint: t.trackerHintStale.replace("{age}", age), fraction };
    case "live": {
      if (tracking.boarding) {
        return { tone: "brand", pulse: true, label: boardingLabel, ...departs, hint: t.trackerHintLive.replace("{age}", age), fraction };
      }
      const gps = t.trackerHintLive.replace("{age}", age);
      const eta = tracking.etaMinutes
        ? {
            figureLabel: t.trackerEta,
            figure: t.trackerMinutes.replace("{n}", tracking.etaMinutes),
            hint: `${gps} ${t.trackerHintEstimate}`,
          }
        : { ...arrives, hint: gps };
      return {
        tone: tracking.delayed ? "warning" : "brand",
        pulse: true,
        label: tracking.delayed ? t.trackerDelayed : t.trackerOnRoute,
        ...eta,
        fraction,
      };
    }
    default:
      return null;
  }
}

// The booked bus, as the driver's phone reports it. On the travel day it
// refreshes every 15 seconds until the trip ends; on other days it is read once,
// so a cancelled trip still shows up ahead of time.
export default function LiveTracker({ booking, t }) {
  const [live, setLive] = useState(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const today = warsawToday();
  const travelDay = booking.departureDate === today || booking.departureDate === previousDay(today);
  const [from, to] = String(booking.route || "").split(" - ");
  const path = useMemo(() => routePath(stopIdForStation(from), stopIdForStation(to)), [from, to]);
  const durationMinutes =
    booking.departureTime && booking.arrivalTime ? minutesBetween(booking.departureTime, booking.arrivalTime) : null;

  useEffect(() => {
    if (!booking.tripId) return undefined;
    let stopped = false;
    let timer = null;

    const load = async () => {
      if (document.hidden) {
        timer = setTimeout(load, POLL_MS);
        return;
      }
      try {
        const data = await fetchTripLive(booking.tripId);
        if (stopped) return;
        setLive(data);
        setFailed(false);
        setNow(Date.now());
        if (travelDay && data && shouldPoll(deriveTracking({ live: data }))) timer = setTimeout(load, POLL_MS);
      } catch {
        if (stopped) return;
        setFailed(true);
        setNow(Date.now());
        if (travelDay) timer = setTimeout(load, POLL_MS);
      }
    };

    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [booking.tripId, travelDay]);

  const tracking = deriveTracking({ live, path, durationMinutes, now });
  if (tracking.phase === "unknown") return null;
  if (!travelDay && tracking.phase !== "cancelled") return null;

  const view = describe(tracking, booking, live.platform || booking.platform, t);
  if (!view) return null;

  const percent = view.fraction != null ? Math.round(view.fraction * 100) : null;

  return (
    <section aria-label={t.trackerTitle} className={`trip-live tone-${view.tone}`}>
      <div className="trip-live-top">
        <span aria-live="polite" className="trip-live-pill">
          <span aria-hidden="true" className={view.pulse ? "trip-live-dot is-pulsing" : "trip-live-dot"} />
          {view.label}
        </span>
        {view.figure && (
          <div className="trip-live-figure">
            <span>{view.figureLabel}</span>
            <strong>{view.figure}</strong>
          </div>
        )}
      </div>

      {percent != null && (
        <div
          aria-label={t.trackerProgress.replace("{percent}", percent)}
          className={percent === 100 ? "trip-live-track is-done" : "trip-live-track"}
          role="img"
        >
          <div className="trip-live-fill" style={{ width: `${percent}%` }} />
          <span aria-hidden="true" className="trip-live-end start" />
          <span aria-hidden="true" className="trip-live-end finish" />
          <span aria-hidden="true" className="trip-live-bus" style={{ left: `${percent}%` }}>
            <Bus size={15} strokeWidth={2.4} />
          </span>
        </div>
      )}

      <p className="trip-live-note">{failed ? t.trackerHintOffline : view.hint}</p>
    </section>
  );
}
