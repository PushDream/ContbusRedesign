import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, ArrowRight, CalendarDays, Clock, MapPin, Search, Users } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { fares } from "../data/content.js";
import { fetchDepartures } from "../lib/database.js";

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ResultsPage() {
  const { t } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || "Lublin";
  const to = searchParams.get("to") || "Warszawa Marriott";
  const date = searchParams.get("date") || getTodayDate();
  const passengers = Number(searchParams.get("passengers") || 1);
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingSearch, setEditingSearch] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftDate, setDraftDate] = useState(date);
  const [draftPassengers, setDraftPassengers] = useState(passengers);
  const locations = ["Lublin", "Lotnisko Chopina", "Warszawa Marriott", "Lotnisko Modlin"];

  const matchedFare =
    fares.find(
      (f) =>
        f.from.toLowerCase() === from.toLowerCase() &&
        f.to.toLowerCase() === to.toLowerCase(),
    ) || fares[0];

  useEffect(() => {
    let active = true;

    fetchDepartures({ from, to, date })
      .then((items) => {
        if (!active) return;
        setDepartures(items);
        setErrorMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setDepartures([]);
        setErrorMessage(error.message || "Nie udało się pobrać kursów.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, from, to]);

  const handleBook = (departure) => {
    const params = new URLSearchParams({
      from,
      to,
      date,
      departure: departure.departureTime,
      passengers: String(passengers),
      fareId: departure.fareId || matchedFare.id,
      tripId: departure.tripId,
      arrival: departure.arrivalTime,
      price: String(departure.price),
      platform: departure.platform || "",
    });
    navigate(`/booking?${params.toString()}`);
  };

  const handleSearchUpdate = (event) => {
    event.preventDefault();
    const params = new URLSearchParams({
      from: draftFrom,
      to: draftTo,
      date: draftDate,
      passengers: String(draftPassengers),
    });
    setEditingSearch(false);
    setLoading(true);
    navigate(`/results?${params.toString()}`);
  };

  const [dateFormatted] = (() => {
    try {
      const d = new Date(date + "T00:00:00");
      return [d.toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })];
    } catch {
      return [date];
    }
  })();

  return (
    <div className="page-wrapper results-page">
      <div className="results-header">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} />
          {t.navHome}
        </Link>
        <div className="results-route-summary">
          <h1 className="results-heading">
            {from} <ArrowRight size={22} /> {to}
          </h1>
          <div className="results-meta">
            <span>
              <MapPin size={14} />
              {matchedFare.duration}
            </span>
            <span>
              <Users size={14} />
              {passengers} {t.passengerUnit}
            </span>
            <span>
              <Clock size={14} />
              {dateFormatted}
            </span>
          </div>
        </div>
        <button
          aria-expanded={editingSearch}
          className="secondary-button results-edit-button"
          onClick={() => setEditingSearch((value) => !value)}
          type="button"
        >
          <Search size={16} />
          Zmień wyszukiwanie
        </button>
      </div>

      {editingSearch && (
        <form className="results-search-panel" onSubmit={handleSearchUpdate}>
          <label>
            <span>Skąd</span>
            <select value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)}>
              {locations.map((place) => <option key={place}>{place}</option>)}
            </select>
          </label>
          <button
            aria-label="Zamień miejsca"
            className="icon-button results-swap-button"
            onClick={() => { setDraftFrom(draftTo); setDraftTo(draftFrom); }}
            type="button"
          >
            <ArrowLeftRight size={17} />
          </button>
          <label>
            <span>Dokąd</span>
            <select value={draftTo} onChange={(event) => setDraftTo(event.target.value)}>
              {locations.map((place) => <option key={place}>{place}</option>)}
            </select>
          </label>
          <label>
            <span>Data podróży</span>
            <div className="results-date-input">
              <CalendarDays size={16} />
              <input min={getTodayDate()} type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} />
            </div>
          </label>
          <label>
            <span>Pasażerowie</span>
            <input min="1" max="8" type="number" value={draftPassengers} onChange={(event) => setDraftPassengers(Math.min(8, Math.max(1, Number(event.target.value) || 1)))} />
          </label>
          <button className="primary-button results-search-submit" type="submit">
            <Search size={16} />
            Pokaż kursy
          </button>
        </form>
      )}

      <div className="results-list">
        {!loading && errorMessage && (
          <div className="secure-box manage-empty">
            <span>{errorMessage}</span>
          </div>
        )}

        {!loading && !errorMessage && departures.length === 0 && (
          <div className="secure-box manage-empty">
            <span>Brak kursów dla wybranej trasy i daty.</span>
          </div>
        )}

        {loading && (
          <div aria-label="Ładowanie kursów" className="results-skeleton-list" role="status">
            {[1, 2, 3, 4].map((item) => (
              <div className="result-card skeleton-card" key={item}>
                <span className="skeleton-block wide" />
                <span className="skeleton-block medium" />
                <span className="skeleton-block action" />
              </div>
            ))}
          </div>
        )}

        {departures.map((departure) => {
          const seats = departure.capacity;
          const totalPrice = departure.price * passengers;

          return (
            <article className="result-card" key={departure.tripId}>
              <div className="result-card-times">
                <div className="result-time">
                  <strong>{departure.departureTime}</strong>
                  <span>{from}</span>
                  {departure.platform && <span className="result-platform">{departure.platform}</span>}
                </div>
                <div className="result-duration">
                  <div className="result-duration-line" />
                  <span>{departure.duration}</span>
                </div>
                <div className="result-time result-time-right">
                  <strong>{departure.arrivalTime}</strong>
                  <span>{to}</span>
                </div>
              </div>

              <div className="result-card-meta">
                <span className={seats <= 5 ? "seats-low" : "seats-ok"}>
                  {seats} miejsc
                </span>
                <span className="result-note">{departure.note}</span>
              </div>

              <div className="result-card-action">
                <div className="result-price">
                  <strong>{totalPrice} zł</strong>
                  {passengers > 1 && (
                    <small>
                      {departure.price} zł / {t.passengerUnit}
                    </small>
                  )}
                </div>
                <button className="primary-button" onClick={() => handleBook(departure)} type="button">
                  Kup bilet
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
