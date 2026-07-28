import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bus,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Lock,
  LogOut,
  RefreshCw,
  Route,
  Search,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import {
  fetchAdminOperations,
  fetchDispatcherOverview,
  updateAdminBookingStatus,
  updateAdminProfileRole,
  updateAdminTrip,
} from "../lib/database.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { useToast } from "../lib/ToastProvider.jsx";

const statusLabels = {
  scheduled: "Planowany",
  boarding: "Wsiadanie",
  departed: "W drodze",
  delayed: "Opóźniony",
  arrived: "Zakończony",
  cancelled: "Anulowany",
};

const bookingStatusLabels = {
  pending: "Oczekuje",
  paid: "Opłacona",
  cancelled: "Anulowana",
  refunded: "Zwrócona",
};

const roleLabels = {
  customer: "Klient",
  driver: "Kierowca",
  dispatcher: "Dyspozytor",
  admin: "Admin",
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

function isStaffProfile(profile) {
  return profile?.role === "dispatcher" || profile?.role === "admin";
}

export default function AdminDashboardPage() {
  const notify = useToast();
  const [date, setDate] = useState(getTodayDate());
  const [overview, setOverview] = useState(null);
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
  const [profileChecking, setProfileChecking] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState("");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signingIn, setSigningIn] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [bookingQuery, setBookingQuery] = useState("");
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      queueMicrotask(() => {
        if (!active) return;
        setAuthError("Supabase is not configured for this deployment.");
        setAuthChecking(false);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setOverview(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      queueMicrotask(() => {
        if (!active) return;
        setProfile(null);
        setProfileChecking(false);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    if (!session) {
      queueMicrotask(() => {
        if (!active) return;
        setProfile(null);
        setProfileChecking(false);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) setProfileChecking(true);
    });
    supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        setProfile(error ? null : data);
        setAuthError(error ? "Nie udało się sprawdzić uprawnień konta." : "");
      })
      .finally(() => {
        if (active) setProfileChecking(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const staff = isStaffProfile(profile);

  const loadDashboard = useCallback(async () => {
    if (!staff) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextOverview, nextOperations] = await Promise.all([
        fetchDispatcherOverview(date),
        fetchAdminOperations(date),
      ]);
      setOverview(nextOverview);
      setOperations(nextOperations);
      setSelectedTripId((current) => {
        if (current && nextOperations.trips.some((trip) => trip.id === current)) return current;
        return nextOperations.trips[0]?.id || "";
      });
    } catch (error) {
      setOverview(null);
      setOperations(null);
      setErrorMessage(error.message || "Nie udało się pobrać danych dyspozytora.");
    } finally {
      setLoading(false);
    }
  }, [date, staff]);

  useEffect(() => {
    let active = true;

    if (!staff) {
      queueMicrotask(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    Promise.all([fetchDispatcherOverview(date), fetchAdminOperations(date)])
      .then(([nextOverview, nextOperations]) => {
        if (!active) return;
        setOverview(nextOverview);
        setOperations(nextOperations);
        setSelectedTripId((current) => {
          if (current && nextOperations.trips.some((trip) => trip.id === current)) return current;
          return nextOperations.trips[0]?.id || "";
        });
      })
      .catch((error) => {
        if (!active) return;
        setOverview(null);
        setOperations(null);
        setErrorMessage(error.message || "Nie udało się pobrać danych dyspozytora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, staff]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured for this deployment.");
      return;
    }
    setSigningIn(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      setAuthError(error.message || "Nie udało się zalogować.");
    }
    setSigningIn(false);
  };

  const handleSignOut = () => {
    if (!isSupabaseConfigured) return;
    supabase.auth.signOut();
  };

  const summary = overview?.summary || {};
  const trips = useMemo(() => overview?.trips || [], [overview]);
  const routes = useMemo(() => overview?.routes || [], [overview]);
  const recentBookings = useMemo(() => overview?.recent_bookings || [], [overview]);
  const operationalTrips = useMemo(() => operations?.trips || [], [operations]);
  const operationalBookings = useMemo(() => operations?.bookings || [], [operations]);
  const vehicles = useMemo(() => operations?.vehicles || [], [operations]);
  const drivers = useMemo(() => operations?.drivers || [], [operations]);
  const profiles = useMemo(() => operations?.profiles || [], [operations]);
  const selectedTrip = operationalTrips.find((trip) => trip.id === selectedTripId) || operationalTrips[0] || null;
  const selectedTripBookings = useMemo(
    () => operationalBookings.filter((booking) => booking.trip_id === selectedTrip?.id),
    [operationalBookings, selectedTrip?.id],
  );
  const filteredBookings = useMemo(() => {
    const query = bookingQuery.trim().toLowerCase();
    if (!query) return operationalBookings.slice(0, 12);
    return operationalBookings.filter((booking) =>
      [
        booking.booking_reference,
        booking.buyer_name,
        booking.buyer_email,
        booking.route_label,
        ...booking.passengers.map((passenger) => passenger.ticket_code),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [bookingQuery, operationalBookings]);

  const reloadOperations = useCallback(async () => {
    const [nextOverview, nextOperations] = await Promise.all([
      fetchDispatcherOverview(date),
      fetchAdminOperations(date),
    ]);
    setOverview(nextOverview);
    setOperations(nextOperations);
  }, [date]);

  const saveTripField = async (tripId, values, successMessage) => {
    const key = `trip-${tripId}`;
    setSavingKey(key);
    try {
      await updateAdminTrip(tripId, values);
      await reloadOperations();
      notify(successMessage, "success");
    } catch (error) {
      notify(error.message || "Nie udało się zapisać kursu.", "error");
    } finally {
      setSavingKey("");
    }
  };

  const saveBookingStatus = async (bookingId, status) => {
    const key = `booking-${bookingId}`;
    setSavingKey(key);
    try {
      await updateAdminBookingStatus(bookingId, status);
      await reloadOperations();
      notify("Status rezerwacji zapisany.", "success");
    } catch (error) {
      notify(error.message || "Nie udało się zapisać rezerwacji.", "error");
    } finally {
      setSavingKey("");
    }
  };

  const saveProfileRole = async (profileId, role) => {
    const key = `profile-${profileId}`;
    setSavingKey(key);
    try {
      await updateAdminProfileRole(profileId, role);
      await reloadOperations();
      notify("Rola użytkownika zapisana.", "success");
    } catch (error) {
      notify(error.message || "Nie udało się zapisać roli.", "error");
    } finally {
      setSavingKey("");
    }
  };

  const busiestTrip = useMemo(
    () =>
      trips
        .slice()
        .sort((left, right) => Number(right.passenger_count || 0) - Number(left.passenger_count || 0))[0],
    [trips],
  );

  if (authChecking || profileChecking) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <Lock size={24} />
          <h1>Sprawdzanie dostępu</h1>
          <p>Ładowanie sesji dyspozytora.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-auth-page">
        <form className="admin-auth-card" onSubmit={handleSignIn}>
          <Lock size={24} />
          <p className="eyebrow">Contbus Operacje</p>
          <h1>Panel dyspozytora</h1>
          <p>Zaloguj się kontem z rolą dispatcher albo admin.</p>
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
          <h1>To konto nie jest dyspozytorem</h1>
          <p>Poproś administratora Supabase o ustawienie roli profilu na dispatcher albo admin.</p>
          {authError && <div className="admin-auth-error">{authError}</div>}
          <button className="secondary-button full" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            Wyloguj
          </button>
        </div>
      </div>
    );
  }

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
          <span className="admin-user-chip">{profile.full_name || session.user.email}</span>
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
          <button className="secondary-button" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            Wyloguj
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

      <section className="admin-ops-grid" aria-label="Operacje dyspozytora">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Operacje</p>
              <h2>Sterowanie kursem</h2>
            </div>
            <Bus size={18} />
          </div>

          {selectedTrip ? (
            <div className="admin-control-stack">
              <div className="admin-selected-trip">
                <div>
                  <strong>{selectedTrip.route_label}</strong>
                  <span>
                    {selectedTrip.departure_time} - {selectedTrip.arrival_time} · {selectedTrip.route_code}
                  </span>
                </div>
                <span className={`admin-status ${selectedTrip.status}`}>
                  {statusLabels[selectedTrip.status] || selectedTrip.status}
                </span>
              </div>

              <div className="admin-control-grid">
                <label>
                  <span>Status</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.status}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { status: event.target.value }, "Status kursu zapisany.")
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Pojazd</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.vehicle_id || ""}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { vehicle_id: event.target.value }, "Pojazd przypisany.")
                    }
                  >
                    <option value="">Do przypisania</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} · {vehicle.plate_number}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Kierowca</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.driver_id || ""}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { driver_id: event.target.value }, "Kierowca przypisany.")
                    }
                  >
                    <option value="">Do przypisania</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name || driver.phone || driver.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Peron</span>
                  <input
                    defaultValue={selectedTrip.platform || ""}
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    onBlur={(event) =>
                      saveTripField(selectedTrip.id, { platform: event.target.value }, "Peron zapisany.")
                    }
                    placeholder="np. Peron 3"
                  />
                </label>
              </div>

              <div className="admin-trip-detail-grid">
                <div>
                  <span>Rezerwacje</span>
                  <strong>{selectedTrip.booking_count || 0}</strong>
                </div>
                <div>
                  <span>Pasażerowie</span>
                  <strong>
                    {selectedTrip.passenger_count || 0}/{selectedTrip.capacity}
                  </strong>
                </div>
                <div>
                  <span>Przychód</span>
                  <strong>{money(selectedTrip.revenue_total)}</strong>
                </div>
                <div>
                  <span>Incydenty</span>
                  <strong>{selectedTrip.incidents.length}</strong>
                </div>
              </div>

              <div className="admin-manifest-preview">
                <h3>Manifest kursu</h3>
                {selectedTripBookings.length === 0 && <p className="admin-empty">Brak rezerwacji na tym kursie.</p>}
                {selectedTripBookings.map((booking) => (
                  <article className="admin-manifest-booking" key={booking.id}>
                    <div>
                      <strong>{booking.booking_reference}</strong>
                      <span>
                        {booking.buyer_name} · {booking.checked_in_count}/{booking.passengers.length} odprawionych
                      </span>
                    </div>
                    <select
                      disabled={savingKey === `booking-${booking.id}`}
                      value={booking.status}
                      onChange={(event) => saveBookingStatus(booking.id, event.target.value)}
                    >
                      {Object.entries(bookingStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <div className="admin-passenger-tags">
                      {booking.passengers.map((passenger) => (
                        <span key={passenger.id}>
                          {passenger.seat_number} · {passenger.ticket_code}
                          {passenger.checked_in_at ? " · OK" : ""}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="admin-empty">Wybierz kurs z listy operacyjnej.</p>
          )}
        </div>

        <aside className="admin-panel compact">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Rezerwacje</p>
              <h2>Wyszukiwarka</h2>
            </div>
            <Search size={18} />
          </div>
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={bookingQuery}
              onChange={(event) => setBookingQuery(event.target.value)}
              placeholder="Kod, email, nazwisko..."
            />
          </label>
          <div className="admin-booking-list operational">
            {filteredBookings.length === 0 && <p className="admin-empty">Brak pasujących rezerwacji.</p>}
            {filteredBookings.map((booking) => (
              <article className="admin-booking-card" key={booking.id}>
                <div>
                  <strong>{booking.booking_reference}</strong>
                  <span>{booking.route_label}</span>
                  <span>
                    {booking.buyer_name} · {booking.buyer_email}
                  </span>
                </div>
                <div className="admin-booking-card-footer">
                  <span className={`admin-status ${booking.status}`}>{bookingStatusLabels[booking.status]}</span>
                  <strong>{money(booking.total_amount)}</strong>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <aside className="admin-panel compact">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">Dostęp</p>
              <h2>Role użytkowników</h2>
            </div>
            <UserCog size={18} />
          </div>
          <div className="admin-user-list">
            {profiles.map((userProfile) => (
              <article className="admin-user-row" key={userProfile.id}>
                <div>
                  <strong>{userProfile.full_name || "Bez nazwy"}</strong>
                  <span>{userProfile.phone || userProfile.id.slice(0, 8)}</span>
                </div>
                <select
                  disabled={savingKey === `profile-${userProfile.id}`}
                  value={userProfile.role}
                  onChange={(event) => saveProfileRole(userProfile.id, event.target.value)}
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        </aside>
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

            {operationalTrips.map((trip) => {
              const load = occupancy(trip.passenger_count, trip.capacity);
              return (
                <article
                  className={trip.id === selectedTrip?.id ? "admin-trip-row selected" : "admin-trip-row"}
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                >
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
                      <span>{trip.vehicle?.label || "Pojazd do przypisania"}</span>
                      <span>{trip.driver?.full_name || "Kierowca do przypisania"}</span>
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
