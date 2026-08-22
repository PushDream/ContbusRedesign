import { useState } from "react";
import { ArrowLeftRight, CalendarDays, Navigation, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";

const locations = ["Lublin", "Lotnisko Chopina", "Warszawa Marriott", "Lotnisko Modlin"];

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = getTodayDate();

const dateFormatLocale = { pl: "pl-PL", en: "en-GB", ua: "uk-UA" };
const dateFormatOptions = {
  pl: { day: "numeric", month: "long", year: "numeric" },
  en: { day: "numeric", month: "short", year: "numeric" },
  ua: { day: "numeric", month: "long", year: "numeric" },
};

function formatDisplayDate(value, language) {
  if (!value) return "";
  const locale = dateFormatLocale[language] || dateFormatLocale.en;
  const options = dateFormatOptions[language] || dateFormatOptions.en;
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, options);
}

function handleDatePickerClick(event) {
  const input = event.currentTarget;
  if (typeof input.showPicker !== "function") return;

  try {
    input.showPicker();
  } catch {
    // Keep the browser's trusted native click as the fallback.
  }
}

export default function BookingSearch({ passengers, setPassengers }) {
  const { t, language } = useApp();
  const navigate = useNavigate();
  const [tripType, setTripType] = useState("oneWay");
  const [from, setFrom] = useState("Lublin");
  const [to, setTo] = useState("Warszawa Marriott");
  const [date, setDate] = useState(today);
  const [returnDate, setReturnDate] = useState(today);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(
      `/results?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}&passengers=${passengers}`,
    );
  };

  return (
    <form className="search-card" onSubmit={handleSearch}>
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
        <button aria-label={t.swapLabel} className="swap-button" onClick={swap} type="button">
          <ArrowLeftRight size={16} />
          <span className="swap-button-label">{t.swap}</span>
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
          <div className="input-shell date-input-shell">
            <CalendarDays size={18} />
            <input
              className="date-input-native"
              type="date"
              value={date}
              onClick={handleDatePickerClick}
              onChange={(e) => setDate(e.target.value)}
            />
            <span aria-hidden="true" className="date-display">
              {formatDisplayDate(date, language)}
            </span>
          </div>
        </label>
        {tripType === "roundTrip" && (
          <label>
            <span>{t.returnDate}</span>
            <div className="input-shell date-input-shell">
              <CalendarDays size={18} />
              <input
                className="date-input-native"
                type="date"
                value={returnDate}
                onClick={handleDatePickerClick}
                onChange={(e) => setReturnDate(e.target.value)}
              />
              <span aria-hidden="true" className="date-display">
                {formatDisplayDate(returnDate, language)}
              </span>
            </div>
          </label>
        )}
      </div>

      <label className="passengers-row">
        <span>{t.passengers}</span>
        <div className="stepper compact">
          <button type="button" onClick={() => setPassengers((v) => Math.max(1, v - 1))}>
            -
          </button>
          <strong>{passengers}</strong>
          <button type="button" onClick={() => setPassengers((v) => Math.min(8, v + 1))}>
            +
          </button>
        </div>
      </label>

      <button className="primary-button full" type="submit">
        <Search size={18} />
        {t.search}
      </button>
    </form>
  );
}
