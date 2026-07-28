import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bus,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Lock,
  LogOut,
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
import { fetchDriverTrips, setDriverPassengerCheckIn, updateDriverTripStatus } from "../lib/database.js";
import { useToast } from "../lib/ToastProvider.jsx";

const statusLabels = {
  scheduled: "Planowany",
  preparing: "Przygotowanie",
  boarding: "Odprawa",
  departed: "W trasie",
  delayed: "Opozniony",
  arrived: "Zakonczony",
};

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDriverProfile(profile) {
  return profile?.role === "driver" || profile?.role === "dispatcher" || profile?.role === "admin";
}

function normalizeScanCode(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return trimmed.toUpperCase();

  try {
    return String(JSON.parse(trimmed).code || "").trim().toUpperCase();
  } catch {
    return trimmed.toUpperCase();
  }
}

export default function DriverAppPage() {
  const notify = useToast();
  const { configured, loadingAuth, profile, session, signIn, signOut } = useAuth();
  const [date, setDate] = useState(getTodayDate());
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [driverError, setDriverError] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [stopByTrip, setStopByTrip] = useState({});
  const [scanCode, setScanCode] = useState("");
  const [incident, setIncident] = useState("");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const staff = isDriverProfile(profile);

  const loadTrips = useCallback(async () => {
    if (!configured || !staff) return;
    setLoadingTrips(true);
    setDriverError("");
    try {
      const nextTrips = await fetchDriverTrips(date);
      setTrips(nextTrips);
      setSelectedTripId((current) => {
        if (current && nextTrips.some((trip) => trip.id === current)) return current;
        return nextTrips[0]?.id || "";
      });
      setScanCode((current) => current || nextTrips[0]?.passengers[0]?.code || "");
    } catch (error) {
      setTrips([]);
      setDriverError(error.message || "Nie udało się pobrać danych aplikacji kierowcy.");
    } finally {
      setLoadingTrips(false);
    }
  }, [configured, date, staff]);

  useEffect(() => {
    let active = true;

    if (!staff) {
      queueMicrotask(() => {
        if (!active) return;
        setTrips([]);
        setLoadingTrips(false);
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) loadTrips();
    });

    return () => {
      active = false;
    };
  }, [loadTrips, staff]);

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) || trips[0] || null;
  const checkedCount = selectedTrip?.passengers.filter((passenger) => passenger.checkedIn).length || 0;
  const passengerCount = selectedTrip?.passengers.length || 0;
  const completion = passengerCount ? Math.round((checkedCount / passengerCount) * 100) : 0;
  const activeStop = selectedTrip ? stopByTrip[selectedTrip.id] || 0 : 0;
  const status = selectedTrip?.status || "scheduled";

  const updateTripInState = (tripId, updater) => {
    setTrips((currentTrips) =>
      currentTrips.map((trip) => (trip.id === tripId ? updater(trip) : trip)),
    );
  };

  const setTripStatus = async (nextStatus) => {
    if (!selectedTrip) return;
    const previousStatus = selectedTrip.status;
    updateTripInState(selectedTrip.id, (trip) => ({ ...trip, status: nextStatus }));
    try {
      await updateDriverTripStatus(selectedTrip.id, nextStatus);
      notify(`Status kursu: ${statusLabels[nextStatus] || nextStatus}.`, "success");
    } catch (error) {
      updateTripInState(selectedTrip.id, (trip) => ({ ...trip, status: previousStatus }));
      notify(error.message || "Nie udało się zapisać statusu kursu.", "error");
    }
  };

  const togglePassenger = async (passengerId) => {
    if (!selectedTrip) return;
    const passenger = selectedTrip.passengers.find((item) => item.id === passengerId);
    if (!passenger) return;
    const nextChecked = !passenger.checkedIn;
    updateTripInState(selectedTrip.id, (trip) => ({
      ...trip,
      passengers: trip.passengers.map((item) =>
        item.id === passengerId ? { ...item, checkedIn: nextChecked } : item,
      ),
    }));

    try {
      await setDriverPassengerCheckIn(passengerId, nextChecked);
      notify(
        nextChecked ? `${passenger.name} odprawiony.` : `Cofnięto odprawę: ${passenger.name}.`,
        nextChecked ? "success" : "info",
      );
    } catch (error) {
      updateTripInState(selectedTrip.id, (trip) => ({
        ...trip,
        passengers: trip.passengers.map((item) =>
          item.id === passengerId ? { ...item, checkedIn: passenger.checkedIn } : item,
        ),
      }));
      notify(error.message || "Nie udało się zapisać odprawy biletu.", "error");
    }
  };

  const handleScan = (event) => {
    event.preventDefault();
    if (!selectedTrip) return;
    const normalized = normalizeScanCode(scanCode);
    const match = selectedTrip.passengers.find((passenger) => passenger.code === normalized);

    if (!match) {
      notify("Nie znaleziono biletu na tym kursie.", "error");
      return;
    }

    if (match.checkedIn) {
      notify(`${match.name} był już odprawiony.`, "info");
      return;
    }

    togglePassenger(match.id);
  };

  const advanceStop = () => {
    if (!selectedTrip) return;
    setStopByTrip((current) => ({
      ...current,
      [selectedTrip.id]: Math.min(activeStop + 1, selectedTrip.stops.length - 1),
    }));
  };

  const saveIncident = () => {
    if (!incident.trim()) {
      notify("Dodaj krotka notatke przed zapisaniem.", "info");
      return;
    }
    notify("Notatka operacyjna zapisana lokalnie.", "success");
    setIncident("");
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!configured) {
      setAuthError("Supabase is not configured for this deployment.");
      return;
    }
    setSigningIn(true);
    setAuthError("");
    const { error } = await signIn(credentials);
    if (error) {
      setAuthError(error.message || "Nie udało się zalogować.");
    }
    setSigningIn(false);
  };

  if (!configured) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <AlertTriangle size={24} />
          <h1>Brak konfiguracji Supabase</h1>
          <p>Aplikacja kierowcy wymaga połączenia z bazą rezerwacji.</p>
        </div>
      </div>
    );
  }

  if (loadingAuth) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <Lock size={24} />
          <h1>Sprawdzanie dostępu</h1>
          <p>Ładowanie sesji kierowcy.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-auth-page">
        <form className="admin-auth-card" onSubmit={handleSignIn}>
          <Lock size={24} />
          <p className="eyebrow">Contbus Operations</p>
          <h1>Aplikacja kierowcy</h1>
          <p>Zaloguj się kontem z rolą driver, dispatcher albo admin.</p>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            <span>Hasło</span>
            <input
              autoComplete="current-password"
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          {authError && <div className="admin-auth-error">{authError}</div>}
          <button className="primary-button full" disabled={signingIn} type="submit">
            {signingIn ? "Logowanie..." : "Zaloguj"}
          </button>
        </form>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <AlertTriangle size={24} />
          <p className="eyebrow">Brak dostępu</p>
          <h1>To konto nie jest przypisane do operacji</h1>
          <p>Poproś administratora Supabase o ustawienie roli profilu na driver, dispatcher albo admin.</p>
          <button className="secondary-button full" onClick={signOut} type="button">
            <LogOut size={17} />
            Wyloguj
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-shell">
      <section className="driver-hero">
        <div>
          <p className="eyebrow">Contbus Operations</p>
          <h1>Aplikacja kierowcy</h1>
          <p>
            Realna odprawa pasażerów z tej samej bazy Supabase, której używa strona,
            konto klienta i panel dyspozytora.
          </p>
        </div>

        <div className="driver-status-panel" aria-label="Status pracy">
          <div>
            <span>Data</span>
            <strong>{date}</strong>
          </div>
          <div>
            <span>Kierowca</span>
            <strong>{profile?.full_name || session.user.email}</strong>
          </div>
          <div>
            <span>Synchronizacja</span>
            <strong>{loadingTrips ? "Odświeżanie" : "Online"}</strong>
          </div>
        </div>
      </section>

      <section className="driver-date-toolbar" aria-label="Filtry aplikacji kierowcy">
        <label>
          <CalendarDays size={17} />
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDriverError("");
              setLoadingTrips(true);
              setDate(event.target.value);
            }}
          />
        </label>
        <button className="secondary-button" disabled={loadingTrips} onClick={loadTrips} type="button">
          <RefreshCw size={17} />
          Odśwież
        </button>
        <button className="secondary-button" onClick={signOut} type="button">
          <LogOut size={17} />
          Wyloguj
        </button>
      </section>

      {driverError && (
        <div className="admin-alert danger">
          <AlertTriangle size={18} />
          <span>{driverError}</span>
        </div>
      )}

      <section className="driver-grid" aria-label="Panel kierowcy">
        <aside className="driver-trips" aria-label="Dzisiejsze kursy">
          <div className="driver-panel-heading">
            <ClipboardList size={18} />
            <h2>Kursy</h2>
          </div>

          {loadingTrips && <p className="driver-empty">Ładowanie kursów...</p>}
          {!loadingTrips && trips.length === 0 && <p className="driver-empty">Brak kursów dla tej daty.</p>}

          {trips.map((trip) => (
            <button
              className={trip.id === selectedTrip?.id ? "driver-trip active" : "driver-trip"}
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
                {trip.passengers.filter((passenger) => passenger.checkedIn).length}/{trip.passengers.length}
              </small>
            </button>
          ))}
        </aside>

        {selectedTrip ? (
          <div className="driver-main">
            <section className="driver-trip-header">
              <div>
                <p className="eyebrow">{selectedTrip.routeCode}</p>
                <h2>{selectedTrip.route}</h2>
                <div className="driver-meta-row">
                  <span>
                    <Bus size={16} />
                    {selectedTrip.vehicle}
                  </span>
                  <span>{selectedTrip.plate}</span>
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
                    <span>Kod biletu albo wynik skanu QR</span>
                    <input
                      value={scanCode}
                      onChange={(event) => setScanCode(event.target.value)}
                      placeholder="CB-..."
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    <QrCode size={18} />
                    Sprawdz
                  </button>
                </form>

                <div className="driver-progress" aria-label={`Odprawa ${completion}%`}>
                  <span style={{ width: `${completion}%` }} />
                </div>

                <div className="driver-manifest">
                  {selectedTrip.passengers.length === 0 && (
                    <p className="driver-empty">Brak pasażerów przypisanych do tego kursu.</p>
                  )}
                  {selectedTrip.passengers.map((passenger) => (
                    <article className={passenger.checkedIn ? "manifest-row checked" : "manifest-row"} key={passenger.id}>
                      <button
                        aria-label={passenger.checkedIn ? `Cofnij odprawe ${passenger.name}` : `Odpraw ${passenger.name}`}
                        className="manifest-check"
                        onClick={() => togglePassenger(passenger.id)}
                        type="button"
                      >
                        {passenger.checkedIn ? <CheckCircle2 size={20} /> : <UserX size={20} />}
                      </button>
                      <div>
                        <strong>{passenger.name}</strong>
                        <span>
                          {passenger.code} - miejsce {passenger.seat} - {passenger.stop}
                        </span>
                      </div>
                      <small>{passenger.luggage}</small>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="driver-controls">
                <div className="driver-panel-heading">
                  <Radio size={18} />
                  <h2>Kontrola kursu</h2>
                </div>

                <div className="driver-control-buttons">
                  <button className="secondary-button" onClick={() => setTripStatus("boarding")} type="button">
                    Odprawa
                  </button>
                  <button className="secondary-button" onClick={() => setTripStatus("departed")} type="button">
                    Wyjazd
                  </button>
                  <button className="secondary-button" onClick={() => setTripStatus("delayed")} type="button">
                    Opoznienie
                  </button>
                  <button className="secondary-button" onClick={() => setTripStatus("arrived")} type="button">
                    Przyjazd
                  </button>
                </div>

                <div className="driver-stop-list">
                  {selectedTrip.stops.map((stop, index) => (
                    <div className={index === activeStop ? "driver-stop active" : "driver-stop"} key={`${stop.title}-${stop.time}`}>
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
                      placeholder="Np. korek, opoznienie, dodatkowy bagaz..."
                      rows={4}
                    />
                  </label>
                  <button className="secondary-button full" onClick={saveIncident} type="button">
                    <AlertTriangle size={18} />
                    Zapisz notatke
                  </button>
                </div>
              </aside>
            </section>
          </div>
        ) : (
          <div className="driver-board">
            <div className="driver-panel-heading">
              <ClipboardList size={18} />
              <h2>Manifest</h2>
            </div>
            <p className="driver-empty">Wybierz kurs, aby zobaczyć listę pasażerów.</p>
          </div>
        )}
      </section>
    </div>
  );
}
