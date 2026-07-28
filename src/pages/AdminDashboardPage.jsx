import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bus,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  RefreshCw,
  Route,
  Ticket,
  Users,
} from "lucide-react";
import { fetchDispatcherOverview } from "../lib/database.js";

const statusLabels = {
  scheduled: "Planowany",
  boarding: "Wsiadanie",
  departed: "W drodze",
  delayed: "Opóźniony",
  arrived: "Zakończony",
  cancelled: "Anulowany",
};

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeText(value) {
  return String(value || "").slice(0, 5);
}

function money(value) {
  return `${Number(value || 0).toLocaleString("pl-PL")} zł`;
}

function occupancy(passengers, capacity) {
  if (!capacity) return 0;
  return Math.min(100, Math.round((Number(passengers || 0) / Number(capacity)) * 100));
}

function MetricCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="admin-metric">
      <div className="admin-metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

export default function AdminDashboardPage() {
  const [date, setDate] = useState(getTodayDate());
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const nextOverview = await fetchDispatcherOverview(date);
      setOverview(nextOverview);
    } catch (error) {
      setOverview(null);
      setErrorMessage(error.message || "Nie udało się pobrać danych dyspozytora.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    let active = true;

    fetchDispatcherOverview(date)
      .then((nextOverview) => {
        if (active) setOverview(nextOverview);
      })
      .catch((error) => {
        if (!active) return;
        setOverview(null);
        setErrorMessage(error.message || "Nie udało się pobrać danych dyspozytora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  const summary = overview?.summary || {};
  const trips = useMemo(() => overview?.trips || [], [overview]);
  const routes = useMemo(() => overview?.routes || [], [overview]);
  const recentBookings = useMemo(() => overview?.recent_bookings || [], [overview]);

  const busiestTrip = useMemo(
    () =>
      trips
        .slice()
        .sort((left, right) => Number(right.passenger_count || 0) - Number(left.passenger_count || 0))[0],
    [trips],
  );

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Contbus Operacje</p>
          <h1>Panel dyspozytora</h1>
          <p>
            Dzisiejsze kursy, obłożenie i sprzedaż z tej samej bazy, której używa strona,
            aplikacja klienta i aplikacja kierowcy.
          </p>
        </div>

        <div className="admin-toolbar">
          <label>
            <CalendarDays size={17} />
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setLoading(true);
                setErrorMessage("");
                setDate(event.target.value);
              }}
            />
          </label>
          <button className="secondary-button" disabled={loading} onClick={loadDashboard} type="button">
            <RefreshCw size={17} />
            Odśwież
          </button>
        </div>
      </section>

      {overview?.isAggregateFallback && (
        <div className="admin-alert">
          <AlertTriangle size={18} />
          <span>Widok sprzedaży czeka na aktywację agregatów dyspozytora w Supabase.</span>
        </div>
      )}

      {errorMessage && (
        <div className="admin-alert danger">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="admin-metrics-grid">
        <MetricCard icon={Bus} label="Kursy" value={summary.trips || 0} hint={date} />
        <MetricCard icon={Ticket} label="Rezerwacje" value={summary.bookings || 0} hint="bez anulowanych" />
        <MetricCard icon={Users} label="Pasażerowie" value={summary.passengers || 0} hint="na wybrany dzień" />
        <MetricCard icon={CircleDollarSign} label="Sprzedaż" value={money(summary.revenue)} hint="demo paid" />
        <MetricCard icon={Route} label="Aktywne trasy" value={summary.routes || routes.length} />
        <MetricCard icon={ClipboardList} label="Pojazdy" value={summary.vehicles || 0} hint="po aktywacji staff auth" />
      </section>

      <section className="admin-layout">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Dzisiaj</p>
              <h2>Kursy operacyjne</h2>
            </div>
            {busiestTrip && (
              <span className="admin-chip">
                Największe obłożenie: {timeText(busiestTrip.departure_time)}
              </span>
            )}
          </div>

          <div className="admin-trip-list">
            {loading && <p className="admin-empty">Ładowanie kursów...</p>}
            {!loading && trips.length === 0 && <p className="admin-empty">Brak kursów dla tej daty.</p>}

            {trips.map((trip) => {
              const load = occupancy(trip.passenger_count, trip.capacity);
              return (
                <article className="admin-trip-row" key={trip.id}>
                  <div className="admin-trip-time">
                    <strong>{timeText(trip.departure_time)}</strong>
                    <span>{timeText(trip.arrival_time)}</span>
                  </div>

                  <div className="admin-trip-main">
                    <div className="admin-trip-title">
                      <strong>
                        {trip.origin_name} → {trip.destination_name}
                      </strong>
                      <span className={`admin-status ${trip.status}`}>{statusLabels[trip.status] || trip.status}</span>
                    </div>
                    <div className="admin-trip-meta">
                      <span>{trip.route_code}</span>
                      <span>{trip.platform || "Bez peronu"}</span>
                      <span>{trip.vehicle_label || "Pojazd do przypisania"}</span>
                    </div>
                    <div className="admin-progress">
                      <span style={{ width: `${load}%` }} />
                    </div>
                  </div>

                  <div className="admin-trip-numbers">
                    <strong>
                      {trip.passenger_count || 0}/{trip.capacity}
                    </strong>
                    <span>{trip.booking_count || 0} rez.</span>
                    <span>{money(trip.revenue_total)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="admin-side">
          <div className="admin-panel compact">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Trasy</p>
                <h2>Sprzedaż wg tras</h2>
              </div>
            </div>
            <div className="admin-route-list">
              {routes.map((route) => (
                <div className="admin-route-row" key={route.id}>
                  <div>
                    <strong>{route.code}</strong>
                    <span>
                      {route.origin_name} → {route.destination_name}
                    </span>
                  </div>
                  <div>
                    <strong>{route.trips_today || 0}</strong>
                    <span>kursy</span>
                  </div>
                  <div>
                    <strong>{money(route.revenue_today)}</strong>
                    <span>{route.bookings_today || 0} rez.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel compact">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">Sprzedaż</p>
                <h2>Ostatnie rezerwacje</h2>
              </div>
              <Activity size={18} />
            </div>
            <div className="admin-booking-list">
              {recentBookings.length === 0 && <p className="admin-empty">Brak widocznych rezerwacji.</p>}
              {recentBookings.map((booking) => (
                <div className="admin-booking-row" key={booking.id}>
                  <div>
                    <strong>{booking.booking_reference}</strong>
                    <span>
                      {booking.origin_name} → {booking.destination_name}
                    </span>
                  </div>
                  <div>
                    <strong>{money(booking.total_amount)}</strong>
                    <span>{booking.passenger_count} pas.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
