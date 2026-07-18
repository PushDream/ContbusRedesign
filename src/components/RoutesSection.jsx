import { useMemo, useState } from "react";
import { ArrowRight, Check, Route, ShieldCheck } from "lucide-react";
import { departureTimes, fares, regulationsUrl } from "../data/content.js";

export default function RoutesSection({ activeFare, setActiveFare, passengers, t }) {
  const [sortBy, setSortBy] = useState("time");

  const sortedFares = useMemo(() => {
    const withIndex = fares.map((fare) => ({
      fare,
      index: fares.indexOf(fare),
    }));
    withIndex.sort((a, b) => {
      if (sortBy === "price") return a.fare.price - b.fare.price;
      if (sortBy === "duration") return a.fare.durationMinutes - b.fare.durationMinutes;
      return departureTimes[a.index % departureTimes.length].localeCompare(
        departureTimes[b.index % departureTimes.length],
      );
    });
    return withIndex;
  }, [sortBy]);

  const total = activeFare.price * passengers + 2;

  return (
    <section className="section routes-section" id="routes">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.popular}</p>
          <h2>{t.choose}</h2>
          <p>{t.chooseLead}</p>
        </div>
        <a className="secondary-button" href={regulationsUrl}>
          <ShieldCheck size={18} />
          {t.regulationsLink}
        </a>
      </div>

      <div className="filter-bar">
        <div className="sort-group" role="group" aria-label={t.sortBy}>
          <span>{t.sortBy}</span>
          {[
            ["time", t.sortTime],
            ["price", t.sortPrice],
            ["duration", t.sortDuration],
          ].map(([key, label]) => (
            <button
              className={sortBy === key ? "active" : ""}
              key={key}
              onClick={() => setSortBy(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="routes-layout">
        <div className="fare-list">
          {sortedFares.map(({ fare, index }) => (
            <button
              className={activeFare.id === fare.id ? "fare-card active" : "fare-card"}
              key={fare.id}
              type="button"
              onClick={() => setActiveFare(fare)}
            >
              <span className="time-pill">
                {departureTimes[index % departureTimes.length]}
              </span>
              <div>
                <strong>{fare.from}</strong>
                <Route size={18} />
                <strong>{fare.to}</strong>
              </div>
              <p>{fare.stops.join(" / ")}</p>
              <footer>
                <span>
                  {fare.duration} - {fare.note}
                </span>
                <strong>{fare.price} zł</strong>
              </footer>
            </button>
          ))}
        </div>

        <aside className="booking-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{t.selected}</p>
              <h3>
                {activeFare.from} - {activeFare.to}
              </h3>
            </div>
            <span className="status">
              <Check size={14} />
              {8 + passengers} {t.seatsLeft}
            </span>
          </div>

          <div className="ticket-preview">
            <div>
              <span>{activeFare.from}</span>
              <strong>06:40</strong>
            </div>
            <ArrowRight size={22} />
            <div>
              <span>{activeFare.to}</span>
              <strong>09:15</strong>
            </div>
          </div>

          <div className="fare-box">
            <div>
              <span>{t.passengers}</span>
              <strong>{passengers}</strong>
            </div>
            <div>
              <span>{t.fare}</span>
              <strong>
                {activeFare.price} zł x {passengers}
              </strong>
            </div>
            <div>
              <span>{t.service}</span>
              <strong>2 zł</strong>
            </div>
            <div className="total">
              <span>{t.total}</span>
              <strong>{total} zł</strong>
            </div>
          </div>

          <a className="primary-button full" href="#tickets">
            {t.continue}
            <ArrowRight size={18} />
          </a>
        </aside>
      </div>
    </section>
  );
}
