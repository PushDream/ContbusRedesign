import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, MapPin, Users } from "lucide-react";
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
      </div>

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
          <div className="secure-box results-loading">
            <span className="spinner" aria-hidden="true" />
            <span>Ładowanie kursów z bazy...</span>
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
