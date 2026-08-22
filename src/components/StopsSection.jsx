import { useState } from "react";
import { Bus, ChevronRight, MapPinned, Plane } from "lucide-react";
import { stops } from "../data/content.js";

export default function StopsSection({ t }) {
  const [activeStop, setActiveStop] = useState(stops[0]);

  return (
    <section className="section stops-section" id="stops">
      <div className="section-heading narrow">
        <div>
          <p className="eyebrow">{t.stops}</p>
          <h2>{t.stopsLead}</h2>
        </div>
      </div>
      <div className="stops-layout">
        <div className="stop-map">
          {stops.map((stop, index) => (
            <button
              className={[
                "map-stop",
                stop.type,
                activeStop.id === stop.id ? "active" : "",
              ].join(" ")}
              key={stop.id}
              style={{ "--x": `${12 + index * 19}%`, "--y": `${64 - (index % 3) * 20}%` }}
              type="button"
              onClick={() => setActiveStop(stop)}
              aria-label={stop.title}
            >
              {stop.type === "airport" ? <Plane size={17} /> : <Bus size={17} />}
            </button>
          ))}
          <div className="map-road" />
        </div>
        <div className="stop-list">
          {stops.map((stop) => (
            <button
              className={activeStop.id === stop.id ? "stop-card active" : "stop-card"}
              key={stop.id}
              type="button"
              onClick={() => setActiveStop(stop)}
            >
              <MapPinned size={19} />
              <span>
                <strong>{stop.title}</strong>
                <small>{stop.meta}</small>
              </span>
            </button>
          ))}
        </div>
        <article className="stop-detail">
          <p className="eyebrow">
            {activeStop.type === "airport" ? t.stopTypeAirport : t.stopTypeCity}
          </p>
          <h3>{activeStop.title}</h3>
          <strong>{activeStop.meta}</strong>
          <p>{activeStop.detail}</p>
          <a href="#tickets">
            {t.buy}
            <ChevronRight size={18} />
          </a>
        </article>
      </div>
    </section>
  );
}
