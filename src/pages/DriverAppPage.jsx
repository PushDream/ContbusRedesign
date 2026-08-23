import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  MessageSquare,
  QrCode,
  Radio,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchDriverTrips,
  reportDriverTripIncident,
  setDriverPassengerCheckIn,
  updateDriverTripStatus,
} from "../lib/driver.js";
import { useToast } from "../lib/ToastProvider.jsx";
import { warsawToday } from "../lib/warsawTime.js";

const statusLabels = {
  scheduled: "Przygotowanie",
  boarding: "Odprawa",
  departed: "W trasie",
  delayed: "Opozniony",
  arrived: "Zakonczony",
};

function isAllowedDriverTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  const allowed = {
    scheduled: ["boarding", "delayed"],
    boarding: ["departed", "delayed"],
    delayed: ["boarding", "departed", "arrived"],
    departed: ["delayed", "arrived"],
    arrived: [],
  };
  return (allowed[currentStatus] || []).includes(nextStatus);
}

function DriverMessage({ children, title }) {
  return (
    <section className="driver-hero">
      <div>
        <p className="eyebrow">Contbus Operations</p>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
    </section>
  );
}

export default function DriverAppPage() {
  const notify = useToast();
  const { configured, loadingAuth, loadingProfile, profile, session } = useAuth();
  const [driverTrips, setDriverTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [stopByTrip, setStopByTrip] = useState({});
  const [scanCode, setScanCode] = useState("");
  const [incident, setIncident] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const operationalRole = ["driver", "dispatcher", "admin"].includes(profile?.role);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const trips = await fetchDriverTrips(warsawToday());
      setDriverTrips(trips);
      setSelectedTripId((current) => {
        if (current && trips.some((trip) => trip.id === current)) return current;
        return trips[0]?.id || "";
      });
    } catch (error) {
      setDriverTrips([]);
      setErrorMessage(error.message || "Nie udalo sie pobrac przypisanych kursow.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !operationalRole) return;
    queueMicrotask(loadTrips);
  }, [loadTrips, operationalRole, session]);

  const selectedTrip = driverTrips.find((trip) => trip.id === selectedTripId) || driverTrips[0] || null;
  const checkedSet = useMemo(
    () =>
      new Set(
        (selectedTrip?.passengers || [])
          .filter((passenger) => passenger.checked)
          .map((passenger) => passenger.id),
      ),
    [selectedTrip],
  );
  const activeStop = selectedTrip
    ? Math.min(stopByTrip[selectedTrip.id] || 0, Math.max(0, selectedTrip.stops.length - 1))
    : 0;
  const status = selectedTrip?.status || "scheduled";
  const checkedCount = checkedSet.size;
  const passengerCount = selectedTrip?.passengers.length || 0;
  const completion = passengerCount ? Math.round((checkedCount / passengerCount) * 100) : 0;
  const statusActionDisabled = (nextStatus) =>
    Boolean(savingKey) || (profile?.role === "driver" && !isAllowedDriverTransition(status, nextStatus));

  const setTripStatus = async (nextStatus) => {
    if (!selectedTrip || savingKey) return;
    setSavingKey(`status-${selectedTrip.id}`);
    try {
      await updateDriverTripStatus(selectedTrip.id, nextStatus);
      setDriverTrips((current) =>
        current.map((trip) => (trip.id === selectedTrip.id ? { ...trip, status: nextStatus } : trip)),
      );
      notify("Status kursu zaktualizowany.", "success");
    } catch (error) {
      notify(error.message || "Nie udalo sie zmienic statusu kursu.", "error");
    } finally {
      setSavingKey("");
    }
  };

  const setPassengerChecked = async (passenger, checked) => {
    if (!selectedTrip || savingKey) return;
    setSavingKey(`passenger-${passenger.id}`);
    try {
      await setDriverPassengerCheckIn(passenger.id, checked);
      setDriverTrips((current) =>
        current.map((trip) =>
          trip.id === selectedTrip.id
            ? {
                ...trip,
                passengers: trip.passengers.map((item) =>
                  item.id === passenger.id ? { ...item, checked } : item,
                ),
              }
            : trip,
        ),
      );
      notify(checked ? `${passenger.name} odprawiony.` : `Cofnieto odprawe: ${passenger.name}.`, "success");
    } catch (error) {
      notify(error.message || "Nie udalo sie zapisac odprawy.", "error");
    } finally {
      setSavingKey("");
    }
  };

  const handleScan = (event) => {
    event.preventDefault();
    if (!selectedTrip) return;
    const normalized = scanCode.trim().toUpperCase();
    const match = selectedTrip.passengers.find((passenger) => passenger.code === normalized);

    if (!match) {
      notify("Nie znaleziono biletu na tym kursie.", "error");
      return;
    }

    if (match.checked) {
      notify(`${match.name} jest juz odprawiony.`, "info");
      return;
    }
    setPassengerChecked(match, true);
  };

  const advanceStop = () => {
    if (!selectedTrip) return;
    setStopByTrip((current) => ({
      ...current,
      [selectedTrip.id]: Math.min(activeStop + 1, selectedTrip.stops.length - 1),
    }));
  };

  const saveIncident = async () => {
    if (!selectedTrip || savingKey) return;
    const note = incident.trim();
    if (!note) {
      notify("Dodaj krotka notatke przed zapisaniem.", "info");
      return;
    }
    setSavingKey(`incident-${selectedTrip.id}`);
    try {
      await reportDriverTripIncident(selectedTrip.id, note);
      notify("Notatka operacyjna zapisana.", "success");
      setIncident("");
    } catch (error) {
      notify(error.message || "Nie udalo sie zapisac notatki.", "error");
    } finally {
      setSavingKey("");
    }
  };

  if (!configured) {
    return (
      <div className="driver-shell">
        <DriverMessage title="Aplikacja kierowcy">Supabase nie jest skonfigurowany dla tego wdrozenia.</DriverMessage>
      </div>
    );
  }
  if (loadingAuth || (session && loadingProfile)) {
    return (
      <div className="driver-shell">
        <DriverMessage title="Sprawdzanie dostepu">Trwa weryfikacja konta operacyjnego.</DriverMessage>
      </div>
    );
  }
  if (!session) return <Navigate to="/konto" replace state={{ from: "/driver" }} />;
  if (!operationalRole) {
    return (
      <div className="driver-shell">
        <DriverMessage title="Brak dostepu">To konto nie ma roli kierowcy ani pracownika operacyjnego.</DriverMessage>
      </div>
    );
  }

  return (
    <div className="driver-shell">
      <section className="driver-hero">
        <div>
          <p className="eyebrow">Contbus Operations</p>
          <h1>Aplikacja kierowcy</h1>
          <p>Jedno miejsce do odprawy pasazerow, kontroli trasy i raportowania statusu kursu.</p>
        </div>

        <div className="driver-status-panel" aria-label="Status pracy">
          <div>
            <span>Dzisiaj</span>
            <strong>{driverTrips.length} kursy</strong>
          </div>
          <div>
            <span>Kierowca</span>
            <strong>{profile?.full_name || session.user.email}</strong>
          </div>
          <div>
            <span>Synchronizacja</span>
            <strong>{errorMessage ? "Blad" : "Online"}</strong>
          </div>
        </div>
      </section>

      {loading && <DriverMessage title="Ladowanie kursow">Pobieramy dzisiejsze przypisane kursy.</DriverMessage>}

      {!loading && errorMessage && (
        <section className="driver-trip-header">
          <div>
            <p className="eyebrow">Blad synchronizacji</p>
            <h2>{errorMessage}</h2>
          </div>
          <button className="secondary-button" onClick={loadTrips} type="button">
            <RefreshCw size={17} />
            Sprobuj ponownie
          </button>
        </section>
      )}

      {!loading && !errorMessage && !selectedTrip && (
        <DriverMessage title="Brak kursow">Na dzisiaj nie masz przypisanych aktywnych kursow.</DriverMessage>
      )}

      {!loading && !errorMessage && selectedTrip && (
        <section className="driver-grid" aria-label="Panel kierowcy">
          <aside className="driver-trips" aria-label="Dzisiejsze kursy">
            <div className="driver-panel-heading">
              <ClipboardList size={18} />
              <h2>Dzisiejsze kursy</h2>
            </div>

            {driverTrips.map((trip) => {
              const tripChecks = trip.passengers.filter((passenger) => passenger.checked).length;
              return (
                <button
                  className={trip.id === selectedTrip.id ? "driver-trip active" : "driver-trip"}
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                  type="button"
                >
                  <span className={`driver-status-dot ${trip.status}`} />
                  <span>
                    <strong>{trip.departure}</strong>
                    {trip.route}
                  </span>
                  <small>
                    {tripChecks}/{trip.passengers.length}
                  </small>
                </button>
              );
            })}
          </aside>

          <div className="driver-main">
            <section className="driver-trip-header">
              <div>
                <p className="eyebrow">{selectedTrip.reference}</p>
                <h2>{selectedTrip.route}</h2>
                <div className="driver-meta-row">
                  <span>
                    <Bus size={16} />
                    {selectedTrip.vehicle}
                  </span>
                  {selectedTrip.plate && <span>{selectedTrip.plate}</span>}
                  {selectedTrip.platform && <span>{selectedTrip.platform}</span>}
                </div>
              </div>
              <div className="driver-trip-clock">
                <Clock size={18} />
                <strong>{selectedTrip.departure}</strong>
                <span>{selectedTrip.arrival}</span>
              </div>
            </section>

            <section className="driver-metrics" aria-label="Podsumowanie kursu">
              <article>
                <UserCheck size={18} />
                <span>Odprawieni</span>
                <strong>
                  {checkedCount}/{passengerCount}
                </strong>
              </article>
              <article>
                <ShieldCheck size={18} />
                <span>Status</span>
                <strong>{statusLabels[status] || status}</strong>
              </article>
              <article>
                <MapPin size={18} />
                <span>Aktualny przystanek</span>
                <strong>{selectedTrip.stops[activeStop]?.title || "-"}</strong>
              </article>
            </section>

            <section className="driver-workspace">
              <div className="driver-board">
                <div className="driver-panel-heading">
                  <ScanLine size={18} />
                  <h2>Odprawa biletow</h2>
                </div>

                <form className="driver-scan" onSubmit={handleScan}>
                  <label>
                    <span>Kod biletu</span>
                    <input
                      autoComplete="off"
                      spellCheck={false}
                      value={scanCode}
                      onChange={(event) => setScanCode(event.target.value)}
                      placeholder="CB-..."
                    />
                  </label>
                  <button className="primary-button" disabled={Boolean(savingKey)} type="submit">
                    <QrCode size={18} />
                    Sprawdz
                  </button>
                </form>

                <div
                  aria-label={`Odprawa ${completion}%`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={completion}
                  className="driver-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${completion}%` }} />
                </div>

                <div className="driver-manifest">
                  {selectedTrip.passengers.length === 0 && <p>Brak pasazerow na tym kursie.</p>}
                  {selectedTrip.passengers.map((passenger) => {
                    const checked = checkedSet.has(passenger.id);
                    return (
                      <article className={checked ? "manifest-row checked" : "manifest-row"} key={passenger.id}>
                        <button
                          aria-label={checked ? `Cofnij odprawe ${passenger.name}` : `Odpraw ${passenger.name}`}
                          className="manifest-check"
                          disabled={Boolean(savingKey)}
                          onClick={() => setPassengerChecked(passenger, !checked)}
                          type="button"
                        >
                          {checked ? <CheckCircle2 size={20} /> : <UserX size={20} />}
                        </button>
                        <div>
                          <strong>{passenger.name}</strong>
                          <span>
                            {passenger.code} - miejsce {passenger.seat} - {passenger.stop}
                          </span>
                        </div>
                        <small>{passenger.luggage}</small>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="driver-controls">
                <div className="driver-panel-heading">
                  <Radio size={18} />
                  <h2>Kontrola kursu</h2>
                </div>

                <div className="driver-control-buttons">
                  <button
                    className={status === "boarding" ? "secondary-button active" : "secondary-button"}
                    disabled={statusActionDisabled("boarding")}
                    onClick={() => setTripStatus("boarding")}
                    type="button"
                  >
                    Odprawa
                  </button>
                  <button
                    className={status === "departed" ? "secondary-button active" : "secondary-button"}
                    disabled={statusActionDisabled("departed")}
                    onClick={() => setTripStatus("departed")}
                    type="button"
                  >
                    Wyjazd
                  </button>
                  <button
                    className={status === "delayed" ? "secondary-button active" : "secondary-button"}
                    disabled={statusActionDisabled("delayed")}
                    onClick={() => setTripStatus("delayed")}
                    type="button"
                  >
                    Opoznienie
                  </button>
                  <button
                    className={status === "arrived" ? "secondary-button active" : "secondary-button"}
                    disabled={statusActionDisabled("arrived")}
                    onClick={() => setTripStatus("arrived")}
                    type="button"
                  >
                    Przyjazd
                  </button>
                </div>

                <div className="driver-stop-list">
                  {selectedTrip.stops.map((stop, index) => (
                    <div
                      className={index === activeStop ? "driver-stop active" : "driver-stop"}
                      key={`${stop.title}-${index}`}
                    >
                      <strong>{stop.time}</strong>
                      <span>{stop.title}</span>
                      <small>
                        +{stop.board} / -{stop.drop}
                      </small>
                    </div>
                  ))}
                </div>

                <button
                  className="primary-button full"
                  disabled={activeStop === selectedTrip.stops.length - 1}
                  onClick={advanceStop}
                  type="button"
                >
                  <MapPin size={18} />
                  Nastepny przystanek
                </button>

                <div className="driver-incident">
                  <label>
                    <span>
                      <MessageSquare size={16} />
                      Notatka / incydent
                    </span>
                    <textarea
                      value={incident}
                      onChange={(event) => setIncident(event.target.value)}
                      placeholder="Np. korek, opoznienie, dodatkowy bagaz…"
                      rows={4}
                    />
                  </label>
                  <button
                    className="secondary-button full"
                    disabled={Boolean(savingKey)}
                    onClick={saveIncident}
                    type="button"
                  >
                    <AlertTriangle size={18} />
                    Zapisz notatke
                  </button>
                </div>
              </aside>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
