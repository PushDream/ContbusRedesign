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
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../lib/ToastProvider.jsx";

const adminCopy = {
  pl: {
    locale: "pl-PL",
    currency: "zł",
    supabaseMissing: "Supabase nie jest skonfigurowany dla tego wdrożenia.",
    permissionsFailed: "Nie udało się sprawdzić uprawnień konta.",
    dashboardLoadFailed: "Nie udało się pobrać danych dyspozytora.",
    loginFailed: "Nie udało się zalogować.",
    tripSaveFailed: "Nie udało się zapisać kursu.",
    bookingSaveFailed: "Nie udało się zapisać rezerwacji.",
    roleSaveFailed: "Nie udało się zapisać roli.",
    bookingStatusSaved: "Status rezerwacji zapisany.",
    profileRoleSaved: "Rola użytkownika zapisana.",
    checkingAccessTitle: "Sprawdzanie dostępu",
    checkingAccessBody: "Ładowanie sesji dyspozytora.",
    operationsEyebrow: "Contbus Operacje",
    dashboardTitle: "Panel dyspozytora",
    loginIntro: "Zaloguj się kontem z rolą dispatcher albo admin.",
    email: "Email",
    password: "Hasło",
    signingIn: "Logowanie...",
    signIn: "Zaloguj",
    noAccessEyebrow: "Brak dostępu",
    noAccessTitle: "To konto nie jest dyspozytorem",
    noAccessBody: "Poproś administratora Supabase o ustawienie roli profilu na dispatcher albo admin.",
    logout: "Wyloguj",
    heroBody:
      "Dzisiejsze kursy, obłożenie i sprzedaż z tej samej bazy, której używa strona, aplikacja klienta i aplikacja kierowcy.",
    refresh: "Odśwież",
    aggregateWarning: "Widok sprzedaży czeka na aktywację agregatów dyspozytora w Supabase.",
    trips: "Kursy",
    bookings: "Rezerwacje",
    passengers: "Pasażerowie",
    sales: "Sprzedaż",
    activeRoutes: "Aktywne trasy",
    vehicles: "Pojazdy",
    notCancelled: "bez anulowanych",
    selectedDay: "na wybrany dzień",
    paidDemo: "demo płatności",
    staffAuthHint: "po włączeniu dostępu personelu",
    operations: "Operacje",
    tripControl: "Sterowanie kursem",
    dispatcherOps: "Operacje dyspozytora",
    status: "Status",
    vehicle: "Pojazd",
    driver: "Kierowca",
    platform: "Peron",
    assignPending: "Do przypisania",
    platformPlaceholder: "np. Peron 3",
    tripStatusSaved: "Status kursu zapisany.",
    vehicleAssigned: "Pojazd przypisany.",
    driverAssigned: "Kierowca przypisany.",
    platformSaved: "Peron zapisany.",
    revenue: "Przychód",
    incidents: "Incydenty",
    tripManifest: "Manifest kursu",
    noBookingsOnTrip: "Brak rezerwacji na tym kursie.",
    chooseTrip: "Wybierz kurs z listy operacyjnej.",
    search: "Wyszukiwarka",
    searchPlaceholder: "Kod, email, nazwisko...",
    noMatchingBookings: "Brak pasujących rezerwacji.",
    access: "Dostęp",
    userRoles: "Role użytkowników",
    unnamed: "Bez nazwy",
    today: "Dzisiaj",
    operationalTrips: "Kursy operacyjne",
    busiest: "Największe obłożenie:",
    loadingTrips: "Ładowanie kursów...",
    noTripsForDate: "Brak kursów dla tej daty.",
    noPlatform: "Bez peronu",
    vehicleUnassigned: "Pojazd do przypisania",
    driverUnassigned: "Kierowca do przypisania",
    reservationsShort: "rez.",
    routes: "Trasy",
    salesByRoute: "Sprzedaż wg tras",
    routeTrips: "kursy",
    recentBookings: "Ostatnie rezerwacje",
    noVisibleBookings: "Brak widocznych rezerwacji.",
    passengersShort: "pas.",
    checkedIn: "odprawionych",
    statusLabels: {
      scheduled: "Planowany",
      boarding: "Wsiadanie",
      departed: "W drodze",
      delayed: "Opóźniony",
      arrived: "Zakończony",
      cancelled: "Anulowany",
    },
    bookingStatusLabels: {
      pending: "Oczekuje",
      paid: "Opłacona",
      cancelled: "Anulowana",
      refunded: "Zwrócona",
    },
    roleLabels: {
      customer: "Klient",
      driver: "Kierowca",
      dispatcher: "Dyspozytor",
      admin: "Admin",
    },
  },
  en: {
    locale: "en-US",
    currency: "PLN",
    supabaseMissing: "Supabase is not configured for this deployment.",
    permissionsFailed: "Could not check account permissions.",
    dashboardLoadFailed: "Could not load dispatcher data.",
    loginFailed: "Could not sign in.",
    tripSaveFailed: "Could not save the trip.",
    bookingSaveFailed: "Could not save the booking.",
    roleSaveFailed: "Could not save the role.",
    bookingStatusSaved: "Booking status saved.",
    profileRoleSaved: "User role saved.",
    checkingAccessTitle: "Checking access",
    checkingAccessBody: "Loading dispatcher session.",
    operationsEyebrow: "Contbus Operations",
    dashboardTitle: "Dispatcher panel",
    loginIntro: "Sign in with an account that has the dispatcher or admin role.",
    email: "Email",
    password: "Password",
    signingIn: "Signing in...",
    signIn: "Sign in",
    noAccessEyebrow: "No access",
    noAccessTitle: "This account is not a dispatcher",
    noAccessBody: "Ask the Supabase administrator to set the profile role to dispatcher or admin.",
    logout: "Sign out",
    heroBody:
      "Today's trips, occupancy, and sales from the same database used by the website, customer app, and driver app.",
    refresh: "Refresh",
    aggregateWarning: "The sales view is waiting for dispatcher aggregates to be activated in Supabase.",
    trips: "Trips",
    bookings: "Bookings",
    passengers: "Passengers",
    sales: "Sales",
    activeRoutes: "Active routes",
    vehicles: "Vehicles",
    notCancelled: "excluding cancelled",
    selectedDay: "for selected day",
    paidDemo: "paid demo",
    staffAuthHint: "after staff auth is active",
    operations: "Operations",
    tripControl: "Trip control",
    dispatcherOps: "Dispatcher operations",
    status: "Status",
    vehicle: "Vehicle",
    driver: "Driver",
    platform: "Platform",
    assignPending: "Unassigned",
    platformPlaceholder: "e.g. Platform 3",
    tripStatusSaved: "Trip status saved.",
    vehicleAssigned: "Vehicle assigned.",
    driverAssigned: "Driver assigned.",
    platformSaved: "Platform saved.",
    revenue: "Revenue",
    incidents: "Incidents",
    tripManifest: "Trip manifest",
    noBookingsOnTrip: "No bookings on this trip.",
    chooseTrip: "Choose a trip from the operations list.",
    search: "Search",
    searchPlaceholder: "Code, email, surname...",
    noMatchingBookings: "No matching bookings.",
    access: "Access",
    userRoles: "User roles",
    unnamed: "Unnamed",
    today: "Today",
    operationalTrips: "Operational trips",
    busiest: "Highest occupancy:",
    loadingTrips: "Loading trips...",
    noTripsForDate: "No trips for this date.",
    noPlatform: "No platform",
    vehicleUnassigned: "Vehicle unassigned",
    driverUnassigned: "Driver unassigned",
    reservationsShort: "res.",
    routes: "Routes",
    salesByRoute: "Sales by route",
    routeTrips: "trips",
    recentBookings: "Recent bookings",
    noVisibleBookings: "No visible bookings.",
    passengersShort: "pax",
    checkedIn: "checked in",
    statusLabels: {
      scheduled: "Scheduled",
      boarding: "Boarding",
      departed: "En route",
      delayed: "Delayed",
      arrived: "Completed",
      cancelled: "Cancelled",
    },
    bookingStatusLabels: {
      pending: "Pending",
      paid: "Paid",
      cancelled: "Cancelled",
      refunded: "Refunded",
    },
    roleLabels: {
      customer: "Customer",
      driver: "Driver",
      dispatcher: "Dispatcher",
      admin: "Admin",
    },
  },
};

adminCopy.ua = adminCopy.pl;

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

function money(value, text = adminCopy.pl) {
  return `${Number(value || 0).toLocaleString(text.locale)} ${text.currency}`;
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
  const { language } = useApp();
  const text = adminCopy[language] || adminCopy.pl;
  const statusLabels = text.statusLabels;
  const bookingStatusLabels = text.bookingStatusLabels;
  const roleLabels = text.roleLabels;
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
        setAuthError(text.supabaseMissing);
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
  }, [text.supabaseMissing]);

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
        setAuthError(error ? text.permissionsFailed : "");
      })
      .finally(() => {
        if (active) setProfileChecking(false);
      });

    return () => {
      active = false;
    };
  }, [session, text.permissionsFailed]);

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
      setErrorMessage(error.message || text.dashboardLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [date, staff, text.dashboardLoadFailed]);

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
        setErrorMessage(error.message || text.dashboardLoadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, staff, text.dashboardLoadFailed]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setAuthError(text.supabaseMissing);
      return;
    }
    setSigningIn(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      setAuthError(error.message || text.loginFailed);
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
      notify(error.message || text.tripSaveFailed, "error");
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
      notify(text.bookingStatusSaved, "success");
    } catch (error) {
      notify(error.message || text.bookingSaveFailed, "error");
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
      notify(text.profileRoleSaved, "success");
    } catch (error) {
      notify(error.message || text.roleSaveFailed, "error");
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
          <span className="spinner large" aria-hidden="true" />
          <h1>{text.checkingAccessTitle}</h1>
          <p>{text.checkingAccessBody}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-auth-page">
        <form className="admin-auth-card" onSubmit={handleSignIn}>
          <Lock size={24} />
          <p className="eyebrow">{text.operationsEyebrow}</p>
          <h1>{text.dashboardTitle}</h1>
          <p>{text.loginIntro}</p>
          <label>
            <span>{text.email}</span>
            <input
              autoComplete="email"
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            <span>{text.password}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          {authError && <div className="admin-auth-error">{authError}</div>}
          <button className="primary-button full" disabled={signingIn} type="submit">
            {signingIn ? text.signingIn : text.signIn}
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
          <p className="eyebrow">{text.noAccessEyebrow}</p>
          <h1>{text.noAccessTitle}</h1>
          <p>{text.noAccessBody}</p>
          {authError && <div className="admin-auth-error">{authError}</div>}
          <button className="secondary-button full" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            {text.logout}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">{text.operationsEyebrow}</p>
          <h1>{text.dashboardTitle}</h1>
          <p>{text.heroBody}</p>
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
            {text.refresh}
          </button>
          <button className="secondary-button" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            {text.logout}
          </button>
        </div>
      </section>

      {overview?.isAggregateFallback && (
        <div className="admin-alert">
          <AlertTriangle size={18} />
          <span>{text.aggregateWarning}</span>
        </div>
      )}

      {errorMessage && (
        <div className="admin-alert danger">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="admin-metrics-grid">
        <MetricCard icon={Bus} label={text.trips} value={summary.trips || 0} hint={date} />
        <MetricCard icon={Ticket} label={text.bookings} value={summary.bookings || 0} hint={text.notCancelled} />
        <MetricCard icon={Users} label={text.passengers} value={summary.passengers || 0} hint={text.selectedDay} />
        <MetricCard icon={CircleDollarSign} label={text.sales} value={money(summary.revenue, text)} hint={text.paidDemo} />
        <MetricCard icon={Route} label={text.activeRoutes} value={summary.routes || routes.length} />
        <MetricCard icon={ClipboardList} label={text.vehicles} value={summary.vehicles || 0} hint={text.staffAuthHint} />
      </section>

      <section className="admin-ops-grid" aria-label={text.dispatcherOps}>
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.operations}</p>
              <h2>{text.tripControl}</h2>
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
                  <span>{text.status}</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.status}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { status: event.target.value }, text.tripStatusSaved)
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
                  <span>{text.vehicle}</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.vehicle_id || ""}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { vehicle_id: event.target.value }, text.vehicleAssigned)
                    }
                  >
                    <option value="">{text.assignPending}</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} · {vehicle.plate_number}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{text.driver}</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.driver_id || ""}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { driver_id: event.target.value }, text.driverAssigned)
                    }
                  >
                    <option value="">{text.assignPending}</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name || driver.phone || driver.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{text.platform}</span>
                  <input
                    defaultValue={selectedTrip.platform || ""}
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    onBlur={(event) =>
                      saveTripField(selectedTrip.id, { platform: event.target.value }, text.platformSaved)
                    }
                    placeholder={text.platformPlaceholder}
                  />
                </label>
              </div>

              <div className="admin-trip-detail-grid">
                <div>
                  <span>{text.bookings}</span>
                  <strong>{selectedTrip.booking_count || 0}</strong>
                </div>
                <div>
                  <span>{text.passengers}</span>
                  <strong>
                    {selectedTrip.passenger_count || 0}/{selectedTrip.capacity}
                  </strong>
                </div>
                <div>
                  <span>{text.revenue}</span>
                  <strong>{money(selectedTrip.revenue_total, text)}</strong>
                </div>
                <div>
                  <span>{text.incidents}</span>
                  <strong>{selectedTrip.incidents.length}</strong>
                </div>
              </div>

              <div className="admin-manifest-preview">
                <h3>{text.tripManifest}</h3>
                {selectedTripBookings.length === 0 && <p className="admin-empty">{text.noBookingsOnTrip}</p>}
                {selectedTripBookings.map((booking) => (
                  <article className="admin-manifest-booking" key={booking.id}>
                    <div>
                      <strong>{booking.booking_reference}</strong>
                      <span>
                        {booking.buyer_name} · {booking.checked_in_count}/{booking.passengers.length} {text.checkedIn}
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
            <p className="admin-empty">{text.chooseTrip}</p>
          )}
        </div>

        <aside className="admin-panel compact">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.bookings}</p>
              <h2>{text.search}</h2>
            </div>
            <Search size={18} />
          </div>
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={bookingQuery}
              onChange={(event) => setBookingQuery(event.target.value)}
              placeholder={text.searchPlaceholder}
            />
          </label>
          <div className="admin-booking-list operational">
            {filteredBookings.length === 0 && <p className="admin-empty">{text.noMatchingBookings}</p>}
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
                  <strong>{money(booking.total_amount, text)}</strong>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <aside className="admin-panel compact">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.access}</p>
              <h2>{text.userRoles}</h2>
            </div>
            <UserCog size={18} />
          </div>
          <div className="admin-user-list">
            {profiles.map((userProfile) => (
              <article className="admin-user-row" key={userProfile.id}>
                <div>
                  <strong>{userProfile.full_name || text.unnamed}</strong>
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
              <p className="eyebrow">{text.today}</p>
              <h2>{text.operationalTrips}</h2>
            </div>
            {busiestTrip && (
              <span className="admin-chip">
                {text.busiest} {timeText(busiestTrip.departure_time)}
              </span>
            )}
          </div>

          <div className="admin-trip-list">
            {loading && (
              <p className="admin-empty loading-row">
                <span className="spinner" aria-hidden="true" />
                {text.loadingTrips}
              </p>
            )}
            {!loading && trips.length === 0 && <p className="admin-empty">{text.noTripsForDate}</p>}

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
                      <span>{trip.platform || text.noPlatform}</span>
                      <span>{trip.vehicle?.label || text.vehicleUnassigned}</span>
                      <span>{trip.driver?.full_name || text.driverUnassigned}</span>
                    </div>
                    <div className="admin-progress">
                      <span style={{ width: `${load}%` }} />
                    </div>
                  </div>

                  <div className="admin-trip-numbers">
                    <strong>
                      {trip.passenger_count || 0}/{trip.capacity}
                    </strong>
                    <span>{trip.booking_count || 0} {text.reservationsShort}</span>
                    <span>{money(trip.revenue_total, text)}</span>
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
                <p className="eyebrow">{text.routes}</p>
                <h2>{text.salesByRoute}</h2>
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
                    <span>{text.routeTrips}</span>
                  </div>
                  <div>
                    <strong>{money(route.revenue_today, text)}</strong>
                    <span>{route.bookings_today || 0} {text.reservationsShort}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel compact">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.sales}</p>
                <h2>{text.recentBookings}</h2>
              </div>
              <Activity size={18} />
            </div>
            <div className="admin-booking-list">
              {recentBookings.length === 0 && <p className="admin-empty">{text.noVisibleBookings}</p>}
              {recentBookings.map((booking) => (
                <div className="admin-booking-row" key={booking.id}>
                  <div>
                    <strong>{booking.booking_reference}</strong>
                    <span>
                      {booking.origin_name} → {booking.destination_name}
                    </span>
                  </div>
                  <div>
                    <strong>{money(booking.total_amount, text)}</strong>
                    <span>{booking.passenger_count} {text.passengersShort}</span>
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
