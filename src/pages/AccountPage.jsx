import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, LogOut, Mail, Phone, RefreshCw, Ticket, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchCustomerBookings } from "../lib/database.js";
import { useToast } from "../lib/ToastProvider.jsx";

const initialCredentials = {
  email: "",
  fullName: "",
  password: "",
  phone: "",
};

const statusLabels = {
  paid: "Opłacona",
  pending: "Oczekuje",
  cancelled: "Anulowana",
  refunded: "Zwrócona",
};

function money(value, currency = "PLN") {
  return `${Number(value || 0).toLocaleString("pl-PL")} ${currency === "PLN" ? "zł" : currency}`;
}

function prettyDate(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3 2.34C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function AccountPage() {
  const notify = useToast();
  const { configured, loadingAuth, profile, session, signIn, signInWithGoogle, signOut, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [credentials, setCredentials] = useState(initialCredentials);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState("");
  const [loadingBookings, setLoadingBookings] = useState(false);

  const displayName = useMemo(
    () => profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email || "Klient",
    [profile, session],
  );

  const updateField = (field, value) => {
    setCredentials((current) => ({ ...current, [field]: value }));
  };

  const loadBookings = useCallback(async () => {
    if (!session) return;
    setLoadingBookings(true);
    setBookingsError("");
    try {
      setBookings(await fetchCustomerBookings());
    } catch (error) {
      setBookings([]);
      setBookingsError(error.message || "Nie udało się pobrać rezerwacji.");
    } finally {
      setLoadingBookings(false);
    }
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session) {
      queueMicrotask(() => {
        if (active) setBookings([]);
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) setLoadingBookings(true);
    });
    fetchCustomerBookings()
      .then((nextBookings) => {
        if (active) setBookings(nextBookings);
      })
      .catch((error) => {
        if (!active) return;
        setBookings([]);
        setBookingsError(error.message || "Nie udało się pobrać rezerwacji.");
      })
      .finally(() => {
        if (active) setLoadingBookings(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!configured) {
      setAuthError("Supabase is not configured for this deployment.");
      return;
    }

    setSubmitting(true);
    setAuthError("");
    setAuthMessage("");

    const payload = {
      email: credentials.email.trim(),
      fullName: credentials.fullName.trim(),
      password: credentials.password,
      phone: credentials.phone.trim(),
    };

    const { data, error } =
      mode === "signup" ? await signUp(payload) : await signIn({ email: payload.email, password: payload.password });

    if (error) {
      setAuthError(error.message || "Nie udało się zalogować.");
    } else if (mode === "signup" && !data?.session) {
      setAuthMessage("Konto utworzone. Sprawdź e-mail, aby potwierdzić logowanie.");
    } else {
      notify(mode === "signup" ? "Konto klienta utworzone" : "Zalogowano", "success");
      setCredentials(initialCredentials);
    }

    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    notify("Wylogowano", "info");
  };

  const handleGoogleSignIn = async () => {
    setSocialSubmitting(true);
    setAuthError("");
    const { error } = await signInWithGoogle();
    if (error) {
      setAuthError(error.message || "Nie udało się zalogować przez Google.");
      setSocialSubmitting(false);
    }
  };

  if (!configured) {
    return (
      <div className="account-page">
        <section className="account-auth-card">
          <UserRound size={24} />
          <h1>Konto klienta</h1>
          <p>
            Logowanie wymaga ustawienia zmiennych Supabase w tej instalacji. Strona nadal działa w trybie
            demonstracyjnym bez kont.
          </p>
        </section>
      </div>
    );
  }

  if (loadingAuth) {
    return (
      <div className="account-page">
        <section className="account-auth-card">
          <span className="spinner large" aria-hidden="true" />
          <h1>Sprawdzanie sesji</h1>
          <p>Ładowanie konta klienta.</p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="account-page account-auth-layout">
        <section className="account-auth-card">
          <UserRound size={24} />
          <p className="eyebrow">Contbus konto</p>
          <h1>{mode === "signup" ? "Utwórz konto klienta" : "Zaloguj się"}</h1>
          <p>Po zalogowaniu bilety kupione na tym koncie będą widoczne w jednym miejscu.</p>

          <button
            className="account-google-button"
            disabled={socialSubmitting}
            onClick={handleGoogleSignIn}
            type="button"
          >
            <GoogleIcon />
            {socialSubmitting ? "Łączenie z Google..." : "Kontynuuj przez Google"}
          </button>

          <div className="account-divider">
            <span>albo</span>
          </div>

          <div className="account-tabs" role="tablist" aria-label="Tryb konta">
            <button
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                setAuthError("");
                setAuthMessage("");
              }}
              type="button"
            >
              Logowanie
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setAuthError("");
                setAuthMessage("");
              }}
              type="button"
            >
              Rejestracja
            </button>
          </div>

          <form className="account-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <label>
                  <span>Imię i nazwisko</span>
                  <input
                    autoComplete="name"
                    minLength={2}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    required
                    type="text"
                    value={credentials.fullName}
                  />
                </label>
                <label>
                  <span>Telefon</span>
                  <input
                    autoComplete="tel"
                    onChange={(event) => updateField("phone", event.target.value)}
                    required
                    type="tel"
                    value={credentials.phone}
                  />
                </label>
              </>
            )}
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                onChange={(event) => updateField("email", event.target.value)}
                required
                type="email"
                value={credentials.email}
              />
            </label>
            <label>
              <span>Hasło</span>
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                onChange={(event) => updateField("password", event.target.value)}
                required
                type="password"
                value={credentials.password}
              />
            </label>
            {authError && <div className="account-error">{authError}</div>}
            {authMessage && <div className="account-success">{authMessage}</div>}
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Proszę czekać..." : mode === "signup" ? "Utwórz konto" : "Zaloguj się"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="account-page">
      <section className="account-hero">
        <div>
          <p className="eyebrow">Konto klienta</p>
          <h1>{displayName}</h1>
          <p>Zarządzaj rezerwacjami kupionymi po zalogowaniu.</p>
        </div>
        <button className="secondary-button" onClick={handleSignOut} type="button">
          <LogOut size={18} />
          Wyloguj
        </button>
      </section>

      <div className="account-layout">
        <section className="account-panel">
          <div className="account-panel-header">
            <div>
              <p className="eyebrow">Dane</p>
              <h2>Profil</h2>
            </div>
          </div>
          <div className="account-profile-grid">
            <div>
              <Mail size={18} />
              <span>Email</span>
              <strong>{session.user.email}</strong>
            </div>
            <div>
              <Phone size={18} />
              <span>Telefon</span>
              <strong>{profile?.phone || session.user.user_metadata?.phone || "-"}</strong>
            </div>
          </div>
        </section>

        <section className="account-panel">
          <div className="account-panel-header">
            <div>
              <p className="eyebrow">Bilety</p>
              <h2>Moje rezerwacje</h2>
            </div>
            <button className="icon-button" onClick={loadBookings} type="button" aria-label="Odśwież rezerwacje">
              <RefreshCw size={18} />
            </button>
          </div>

          {bookingsError && <div className="account-error inline">{bookingsError}</div>}
          {loadingBookings && (
            <p className="account-empty loading-row">
              <span className="spinner" aria-hidden="true" />
              Ładowanie rezerwacji...
            </p>
          )}
          {!loadingBookings && !bookings.length && !bookingsError && (
            <div className="account-empty">
              <Ticket size={22} />
              <strong>Nie masz jeszcze rezerwacji na tym koncie.</strong>
              <Link className="primary-button" to="/results">
                Kup bilet
              </Link>
            </div>
          )}
          {!loadingBookings && bookings.length > 0 && (
            <div className="account-booking-list">
              {bookings.map((booking) => (
                <article className="account-booking-row" key={booking.id}>
                  <div className="account-booking-main">
                    <span className={`account-status ${booking.status}`}>{statusLabels[booking.status] || booking.status}</span>
                    <strong>{booking.route}</strong>
                    <small>
                      <CalendarDays size={14} />
                      {prettyDate(booking.departureDate)} · {booking.departureTime} - {booking.arrivalTime}
                    </small>
                  </div>
                  <div className="account-booking-meta">
                    <span>{booking.reference}</span>
                    <strong>{money(booking.totalAmount, booking.currency)}</strong>
                    <small>
                      {booking.passengerCount} os. · miejsca {booking.seatNumbers.join(", ") || "-"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
