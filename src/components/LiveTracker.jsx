import { useEffect, useState } from "react";
import { Bus, Lock, MapPin, Navigation2 } from "lucide-react";

export default function LiveTracker({ activeFare, t }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const durationMinutes = activeFare.durationMinutes;
  const minutesElapsed = (now / 60000) % durationMinutes;
  const progress = Math.min(0.99, Math.max(0.01, minutesElapsed / durationMinutes));
  const remaining = Math.round(durationMinutes * (1 - progress));

  const status =
    progress < 0.06
      ? t.trackerStatusBoarding
      : progress > 0.94
        ? t.trackerStatusArrived
        : t.trackerStatusRoute;

  const stopIndex = Math.min(
    activeFare.stops.length - 1,
    Math.floor(progress * activeFare.stops.length),
  );
  const nextStop = activeFare.stops[Math.min(stopIndex + 1, activeFare.stops.length - 1)];

  return (
    <div className="tracker-panel">
      <p className="tracker-panel-label">
        <Lock size={13} />
        {t.trackerTitle}
      </p>

      <div className="tracker-card">
        <div className="tracker-top">
          <div>
            <span className="tracker-status-pill">
              <Navigation2 size={14} />
              {status}
            </span>
            <h3>
              {activeFare.from} <ArrowGlyph /> {activeFare.to}
            </h3>
          </div>
          <div className="tracker-eta">
            <span>{t.trackerEta}</span>
            <strong>{remaining} min</strong>
          </div>
        </div>

        <div className="tracker-track">
          <div className="tracker-fill" style={{ width: `${progress * 100}%` }} />
          <div className="tracker-bus" style={{ left: `${progress * 100}%` }}>
            <Bus size={18} />
          </div>
          {activeFare.stops.map((stop, index) => (
            <div
              className="tracker-node"
              key={stop}
              style={{ left: `${(index / (activeFare.stops.length - 1 || 1)) * 100}%` }}
            >
              <MapPin size={14} />
            </div>
          ))}
        </div>

        <div className="tracker-stops-row">
          {activeFare.stops.map((stop) => (
            <span key={stop}>{stop}</span>
          ))}
        </div>

        <div className="secure-box">
          <MapPin size={18} />
          <span>
            {t.trackerNext}: <strong>{nextStop}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function ArrowGlyph() {
  return <span aria-hidden="true">→</span>;
}
