import React, { useState } from "react";
import { ArrowLeftRight, CalendarDays, Navigation, Search, TimerReset } from "lucide-react";
import { fares } from "../data/content.js";

const locations = ["Lublin", "Lotnisko Chopina", "Warszawa Marriott", "Lotnisko Modlin"];

export default function BookingSearch({ passengers, setPassengers, setActiveFare, t }) {
  const [tripType, setTripType] = useState("oneWay");
  const [from, setFrom] = useState("Lublin");
  const [to, setTo] = useState("Warszawa Marriott");

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const matchRoute = () => {
    const match = fares.find(
      (fare) =>
        fare.from.toLowerCase().includes(from.toLowerCase()) &&
        fare.to.toLowerCase().includes(to.toLowerCase()),
    );
    if (match) setActiveFare(match);
    document.getElementById("routes")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <form className="search-card" onSubmit={(event) => event.preventDefault()}>
      <div className="search-card-header">
        <Navigation size={20} />
        <h2>{t.searchTitle}</h2>
      </div>

      <div className="trip-type" role="tablist" aria-label={t.tripTypeLabel}>
        <button
          className={tripType === "oneWay" ? "active" : ""}
          onClick={() => setTripType("oneWay")}
          role="tab"
          aria-selected={tripType === "oneWay"}
          type="button"
        >
          {t.oneWay}
        </button>
        <button
          className={tripType === "roundTrip" ? "active" : ""}
          onClick={() => setTripType("roundTrip")}
          role="tab"
          aria-selected={tripType === "roundTrip"}
          type="button"
        >
          {t.roundTrip}
        </button>
      </div>

      <div className="from-to-grid">
        <label>
          <span>{t.from}</span>
          <select value={from} onChange={(event) => setFrom(event.target.value)}>
            {locations.map((place) => (
              <option key={place}>{place}</option>
            ))}
          </select>
        </label>
        <button
          aria-label={t.swapLabel}
          className="swap-button"
          onClick={swap}
          type="button"
        >
          <ArrowLeftRight size={16} />
        </button>
        <label>
          <span>{t.to}</span>
          <select value={to} onChange={(event) => setTo(event.target.value)}>
            {locations.map((place) => (
              <option key={place}>{place}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={tripType === "roundTrip" ? "date-grid two" : "date-grid"}>
        <label>
          <span>{t.date}</span>
          <div className="input-shell">
            <CalendarDays size={18} />
            <input type="date" defaultValue="2026-07-18" />
          </div>
        </label>
        {tripType === "roundTrip" && (
          <label>
            <span>{t.returnDate}</span>
            <div className="input-shell">
              <CalendarDays size={18} />
              <input type="date" defaultValue="2026-07-21" />
            </div>
          </label>
        )}
      </div>

      <label>
        <span>{t.passengers}</span>
        <div className="stepper">
          <button type="button" onClick={() => setPassengers((value) => Math.max(1, value - 1))}>
            -
          </button>
          <strong>{passengers}</strong>
          <button type="button" onClick={() => setPassengers((value) => Math.min(8, value + 1))}>
            +
          </button>
        </div>
      </label>

      <button className="primary-button full" type="button" onClick={matchRoute}>
        <Search size={18} />
        {t.search}
      </button>
      <a className="inline-link" href="#tickets">
        <TimerReset size={16} />
        {t.download}
      </a>
    </form>
  );
}
