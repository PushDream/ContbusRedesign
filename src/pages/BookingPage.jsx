import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  Download,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  Ticket,
} from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../lib/ToastProvider.jsx";
import { createBookingRecord, requestTicketPdf, resolveDeparture } from "../lib/database.js";
import {
  buildSeatMap,
  estimateArrival,
  fares,
  getPlatform,
  hashString,
  logoUrl,
} from "../data/content.js";
import SeatMap from "../components/SeatMap.jsx";
import TicketQr from "../components/TicketQr.jsx";
import { warsawToday } from "../lib/warsawTime.js";

function genBookingCode(seed) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rng = Math.abs(seed) || 1;
  let code = "CB-";
  for (let i = 0; i < 6; i++) {
    rng = (rng * 16807) % 2147483647;
    code += chars[rng % chars.length];
  }
  return code;
}

function autoAssignSeats(fareId, chosen, needed) {
  if (chosen.length >= needed) return chosen.slice(0, needed);
  const seats = buildSeatMap(fareId, 0);
  const filler = seats
    .filter((s) => !s.taken && !chosen.includes(s.id))
    .sort((a, b) => Number(a.premium) - Number(b.premium))
    .slice(0, needed - chosen.length)
    .map((s) => s.id);
  return [...chosen, ...filler];
}

export default function BookingPage() {
  const { t, language } = useApp();
  const { profile, session } = useAuth();
  const notify = useToast();
  const [searchParams] = useSearchParams();

  const PAYMENT_METHODS = [
    { id: "blik", label: "BLIK", Icon: Smartphone },
    { id: "card", label: t.paymentCard, Icon: Ticket },
    { id: "transfer", label: t.paymentTransfer, Icon: Mail },
  ];

  const EXTRAS = [
    { id: "luggage", label: t.extraLuggage, price: 12, Icon: Briefcase },
    { id: "insurance", label: t.extraInsurance, price: 8, Icon: ShieldCheck },
  ];

  const from = searchParams.get("from") || "Lublin";
  const to = searchParams.get("to") || "Warszawa Marriott";
  const date = searchParams.get("date") || warsawToday();
  const departure = searchParams.get("departure") || "08:15";
  const passengers = Number(searchParams.get("passengers") || 1);
  const fareId = searchParams.get("fareId") || "lublin-warszawa";
  const tripId = searchParams.get("tripId") || "";

  const fare = fares.find((f) => f.id === fareId) || fares[0];
  const routePrice = Number(searchParams.get("price")) || fare.price;
  const arrival = searchParams.get("arrival") || estimateArrival(departure);
  const platform = searchParams.get("platform") || getPlatform(from, to, departure);

  const bookingCode = useMemo(
    () => genBookingCode(hashString(`${fareId}-${departure}-${date}`)),
    [fareId, departure, date],
  );

  const [step, setStep] = useState(1);

  // Step 1 — passenger details
  const [buyer, setBuyer] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let active = true;
    if (!session) return undefined;

    queueMicrotask(() => {
      if (!active) return;
      setBuyer((current) => {
        if (current.email || current.firstName || current.lastName || current.phone) return current;
        const fullName = profile?.full_name || session.user.user_metadata?.full_name || "";
        const [firstName = "", ...lastNameParts] = fullName.trim().split(/\s+/).filter(Boolean);
        return {
          email: session.user.email || "",
          firstName,
          lastName: lastNameParts.join(" "),
          phone: profile?.phone || session.user.user_metadata?.phone || "",
        };
      });
    });

    return () => {
      active = false;
    };
  }, [profile, session]);

  // Step 2 — seats + extras
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [seatMapOpen, setSeatMapOpen] = useState(false);
  const [extras, setExtras] = useState({ luggage: false, insurance: false });

  // Step 3 — payment
  const [paymentMethod, setPaymentMethod] = useState("blik");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [databaseBooking, setDatabaseBooking] = useState(null);

  const effectiveSeats = useMemo(
    () => autoAssignSeats(fare.id, selectedSeats, passengers),
    [fare.id, selectedSeats, passengers],
  );

  const extrasTotal = EXTRAS.reduce((sum, e) => sum + (extras[e.id] ? e.price : 0), 0);
  const baseTotal = routePrice * passengers;
  const fee = 0;
  const total = baseTotal + extrasTotal + fee;
  const displayBookingCode = databaseBooking?.booking_reference || bookingCode;
  const ticketCode = databaseBooking?.ticket_codes?.[0] || databaseBooking?.ticket_code || displayBookingCode;

  const updateBuyer = (field, value) => setBuyer((b) => ({ ...b, [field]: value }));

  const validateStep1 = () => {
    const e = {};
    if (!buyer.firstName.trim()) e.firstName = t.errorFirstNameRequired;
    if (!buyer.lastName.trim()) e.lastName = t.errorLastNameRequired;
    if (!/\S+@\S+\.\S+/.test(buyer.email)) e.email = t.errorInvalidEmail;
    if (!buyer.phone.trim()) e.phone = t.errorPhoneRequired;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleStep1Next = () => {
    if (validateStep1()) setStep(2);
  };

  const toggleSeat = (seat) => {
    setSelectedSeats((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      if (current.length >= passengers) {
        notify(t.toastSeatMax, "info");
        return current;
      }
      return [...current, seat.id];
    });
  };

  const confirmPayment = async () => {
    setSubmitting(true);
    try {
      const selectedDeparture =
        tripId ||
        (await resolveDeparture({ from, to, date, departureTime: departure }))?.tripId;

      const booking = await createBookingRecord({
        tripId: selectedDeparture,
        buyer,
        passengerCount: passengers,
        seatNumbers: effectiveSeats,
        extras,
        paymentMethod,
      });

      setDatabaseBooking(booking);
      setStep(4);
      notify(t.toastBookingReady, "success");
    } catch (error) {
      notify(error.message || t.bookingSaveFailed, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const ticketPayload = ticketCode;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const cachedUrl = databaseBooking?.ticket_pdf_url || databaseBooking?.ticketPdfUrl;
      const url =
        cachedUrl ||
        (await requestTicketPdf({
          bookingId: databaseBooking?.booking_id || databaseBooking?.id,
          lang: language,
        }));
      if (!cachedUrl) {
        setDatabaseBooking((current) => (current ? { ...current, ticket_pdf_url: url } : current));
      }
      window.open(url, "_blank", "noopener,noreferrer");
      notify(t.toastPdfReady, "success");
    } catch (error) {
      notify(error.message || t.bookingSaveFailed, "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const STEPS = [
    { n: 1, label: t.stepLabelPassenger },
    { n: 2, label: t.seatsAndExtras },
    { n: 3, label: t.stepLabelPayment },
  ];

  return (
    <div className="page-wrapper booking-page">
      <div className="booking-header">
        <Link to="/results" className="back-link">
          <ArrowLeft size={16} />
          {t.backToResults}
        </Link>
        <div className="booking-route-summary">
          <span>
            {from} <ArrowRight size={14} /> {to}
          </span>
          <span>
            {departure} → {arrival} · {date}
          </span>
        </div>
      </div>

      {step < 4 && (
        <div className="progress-stepper">
          {STEPS.map(({ n, label }, idx) => (
            <Fragment key={n}>
              <div
                className={`progress-stepper-step ${step === n ? "is-active" : ""} ${step > n ? "is-done" : ""}`}
              >
                <div className="progress-stepper-circle">{step > n ? <Check size={16} /> : n}</div>
                <span className="progress-stepper-label">{label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`progress-stepper-line ${step > n ? "is-done" : ""}`} />
              )}
            </Fragment>
          ))}
        </div>
      )}

      <div className="booking-layout">
        <div className="booking-main">
          {/* Step 1 — Passenger details */}
          {step === 1 && (
            <div className="booking-step-content">
              <h2>{t.passengerDetailsHeading}</h2>
              <div className="booking-form-grid">
                <label className={errors.firstName ? "has-error" : ""}>
                  <span>{t.firstName}</span>
                  <input
                    autoComplete="given-name"
                    value={buyer.firstName}
                    onChange={(e) => updateBuyer("firstName", e.target.value)}
                    placeholder="Jan"
                  />
                  {errors.firstName && <em className="field-error">{errors.firstName}</em>}
                </label>
                <label className={errors.lastName ? "has-error" : ""}>
                  <span>{t.lastName}</span>
                  <input
                    autoComplete="family-name"
                    value={buyer.lastName}
                    onChange={(e) => updateBuyer("lastName", e.target.value)}
                    placeholder="Kowalski"
                  />
                  {errors.lastName && <em className="field-error">{errors.lastName}</em>}
                </label>
                <label className={errors.email ? "has-error" : ""}>
                  <span>{t.fieldTicketEmail}</span>
                  <input
                    autoComplete="email"
                    type="email"
                    value={buyer.email}
                    onChange={(e) => updateBuyer("email", e.target.value)}
                    placeholder="jan.kowalski@email.com"
                  />
                  {errors.email && <em className="field-error">{errors.email}</em>}
                </label>
                <label className={errors.phone ? "has-error" : ""}>
                  <span>{t.fieldPhone}</span>
                  <input
                    autoComplete="tel"
                    type="tel"
                    value={buyer.phone}
                    onChange={(e) => updateBuyer("phone", e.target.value)}
                    placeholder="+48 600 000 000"
                  />
                  {errors.phone && <em className="field-error">{errors.phone}</em>}
                </label>
              </div>
              <div className="booking-step-nav">
                <button className="primary-button" type="button" onClick={handleStep1Next}>
                  {t.nextSeatsExtras}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Seats + extras */}
          {step === 2 && (
            <div className="booking-step-content">
              <h2>{t.seatsAndExtras}</h2>

              <div className="accordion">
                <button
                  aria-expanded={seatMapOpen}
                  className="accordion-toggle"
                  onClick={() => setSeatMapOpen((o) => !o)}
                  type="button"
                >
                  <span>
                    {t.chooseSeat} <em>({t.optionalTag})</em>
                  </span>
                  <ChevronDown size={18} />
                </button>
                {seatMapOpen && (
                  <div className="accordion-body">
                    <SeatMap
                      departureIndex={0}
                      fareId={fare.id}
                      maxSeats={passengers}
                      onToggle={toggleSeat}
                      selected={selectedSeats}
                      t={t}
                    />
                    <p className="muted accordion-hint">
                      {t.seatsSelected}: {selectedSeats.length ? selectedSeats.join(", ") : "—"} (
                      {selectedSeats.length}/{passengers})
                    </p>
                  </div>
                )}
              </div>

              <div className="extras-section">
                <h3>{t.extrasTitle}</h3>
                <div className="extras-grid">
                  {EXTRAS.map(({ id, label, price, Icon }) => (
                    <button
                      className={extras[id] ? "extra-card active" : "extra-card"}
                      key={id}
                      onClick={() => setExtras((e) => ({ ...e, [id]: !e[id] }))}
                      type="button"
                    >
                      <Icon size={22} />
                      <span>{label}</span>
                      <strong>+{price} zł</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="booking-step-nav">
                <button className="secondary-button" type="button" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} />
                  {t.back}
                </button>
                <button className="primary-button" type="button" onClick={() => setStep(3)}>
                  {t.nextPayment}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && (
            <div className="booking-step-content">
              <h2>{t.paymentMethodHeading}</h2>

              <div className="payment-methods">
                {PAYMENT_METHODS.map(({ id, label, Icon }) => (
                  <button
                    className={paymentMethod === id ? "payment-card active" : "payment-card"}
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id)}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="booking-price-breakdown">
                <div>
                  <span>
                    {t.ticketLabel} {from} → {to}
                  </span>
                  <strong>
                    {routePrice} zł × {passengers}
                  </strong>
                </div>
                {extras.luggage && (
                  <div>
                    <span>{t.extraLuggage}</span>
                    <strong>+12 zł</strong>
                  </div>
                )}
                {extras.insurance && (
                  <div>
                    <span>{t.extraInsurance}</span>
                    <strong>+8 zł</strong>
                  </div>
                )}
                {fee > 0 && (
                  <div>
                    <span>{t.service}</span>
                    <strong>{fee} zł</strong>
                  </div>
                )}
                <div className="total">
                  <span>{t.total}</span>
                  <strong>{total} zł</strong>
                </div>
              </div>

              <div className="secure-box">
                <ShieldCheck size={18} />
                <span>{t.prototypeNotice}</span>
              </div>

              <div className="booking-step-nav">
                <button className="secondary-button" type="button" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} />
                  {t.back}
                </button>
                <button className="primary-button" disabled={submitting} type="button" onClick={confirmPayment}>
                  {submitting ? t.saving : `${t.buy} · ${total} zł`}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Success */}
          {step === 4 && (
            <div className="booking-step-content ticket-confirmation">
              <div className="success-mark">
                <Check size={32} />
              </div>
              <h2>{t.ticketReadyTitle}</h2>
              <p>
                {t.ticketConfirmationText
                  .replace("{code}", displayBookingCode)
                  .replace("{email}", buyer.email)
                  .replace("{seats}", effectiveSeats.join(", ") || "-")}
              </p>

              <div className="qr-real">
                <TicketQr value={ticketPayload} size={150} />
              </div>

              {platform && (
                <div className="ticket-platform-row">
                  <span>{t.platformDepartureLabel}</span>
                  <strong>{platform}</strong>
                </div>
              )}

              <div className="confirmation-actions">
                <button
                  className="secondary-button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  type="button"
                >
                  <Download size={18} />
                  {t.downloadPdf}
                </button>
                <Link className="secondary-button" to="/moje-bilety">
                  <Ticket size={18} />
                  {t.quickNavMyTickets}
                </Link>
                <Link className="primary-button" to="/">
                  <ArrowLeft size={18} />
                  {t.backToHome}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        {step < 4 && (
          <aside className="booking-sidebar">
            <div className="mobile-ticket">
              <div className="mobile-ticket-top">
                <img src={logoUrl} alt="Contbus" width={118} height={21} />
                <span>{displayBookingCode}</span>
              </div>
              <div className="mobile-ticket-route">
                <div>
                  <small>{from}</small>
                  <strong>{departure}</strong>
                </div>
                <ArrowRight size={20} />
                <div>
                  <small>{to}</small>
                  <strong>{arrival}</strong>
                </div>
              </div>
              <div className="qr-ticket">
                <TicketQr value={ticketPayload} size={72} />
                <span>
                  {passengers} {t.passengerUnit} / {routePrice} zł
                </span>
              </div>
            </div>

            <div className="fare-box">
              <div>
                <span>{t.fareRouteLabel}</span>
                <strong>
                  {from} – {to}
                </strong>
              </div>
              <div>
                <span>{t.departureShort}</span>
                <strong>
                  {departure} → {arrival}
                </strong>
              </div>
              <div>
                <span>{t.date}</span>
                <strong>{date}</strong>
              </div>
              <div>
                <span>{t.ticketLabel}</span>
                <strong>
                  {routePrice} zł × {passengers}
                </strong>
              </div>
              {extrasTotal > 0 && (
                <div>
                  <span>{t.addonsShort}</span>
                  <strong>+{extrasTotal} zł</strong>
                </div>
              )}
              {fee > 0 && (
                <div>
                  <span>{t.service}</span>
                  <strong>{fee} zł</strong>
                </div>
              )}
              <div className="total">
                <span>{t.total}</span>
                <strong>{total} zł</strong>
              </div>
            </div>

            <div className="booking-passenger-preview">
              <Phone size={14} />
              <span>
                {buyer.firstName
                  ? `${buyer.firstName} ${buyer.lastName}`.trim()
                  : t.completePassengerDetails}
              </span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
