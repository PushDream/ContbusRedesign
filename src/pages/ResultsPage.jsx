import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, MapPin, Users } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { estimateArrival, fares, getPlatform, hashString, seededRandom } from "../data/content.js";

const DEPARTURES = [
  { time: "06:40" },
  { time: "08:15" },
  { time: "09:50" },
  { time: "11:30" },
  { time: "13:00" },
  { time: "14:10" },
  { time: "15:45" },
  { time: "16:45" },
  { time: "18:20" },
  { time: "19:20" },
  { time: "21:50" },
];

function getSeatsLeft(fareId, time) {
  const rng = seededRandom(hashString(`${fareId}-${time}-seats`));
  return 3 + Math.floor(rng() * 20);
}

export default function ResultsPage() {
  const { t } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || "Lublin";
  const to = searchParams.get("to") || "Warszawa Marriott";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const passengers = Number(searchParams.get("passengers") || 1);

  const matchedFare =
    fares.find(
      (f) =>
        f.from.toLowerCase() === from.toLowerCase() &&
        f.to.toLowerCase() === to.toLowerCase(),
    ) || fares[0];

  const handleBook = (depTime) => {
    navigate(
      `/booking?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}&departure=${encodeURIComponent(depTime)}&passengers=${passengers}&fareId=${matchedFare.id}`,
    );
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
        {DEPARTURES.map((dep) => {
          const arrival = estimateArrival(dep.time);
          const seats = getSeatsLeft(matchedFare.id, dep.time);
          const totalPrice = matchedFare.price * passengers;
          const platform = getPlatform(from, to, dep.time);

          return (
            <article className="result-card" key={dep.time}>
              <div className="result-card-times">
                <div className="result-time">
                  <strong>{dep.time}</strong>
                  <span>{from}</span>
                  {platform && <span className="result-platform">{platform}</span>}
                </div>
                <div className="result-duration">
                  <div className="result-duration-line" />
                  <span>{matchedFare.duration}</span>
                </div>
                <div className="result-time result-time-right">
                  <strong>{arrival}</strong>
                  <span>{to}</span>
                </div>
              </div>

              <div className="result-card-meta">
                <span className={seats <= 5 ? "seats-low" : "seats-ok"}>
                  {seats} {t.seatsLeft}
                </span>
                <span className="result-note">{matchedFare.note}</span>
              </div>

              <div className="result-card-action">
                <div className="result-price">
                  <strong>{totalPrice} zł</strong>
                  {passengers > 1 && (
                    <small>
                      {matchedFare.price} zł / {t.passengerUnit}
                    </small>
                  )}
                </div>
                <button className="primary-button" onClick={() => handleBook(dep.time)} type="button">
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
