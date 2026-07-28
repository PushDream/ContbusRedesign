import { useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  Ticket,
  Wallet,
  Zap,
} from "lucide-react";
import {
  buildSeatMap,
  departureTimes,
  estimateArrival,
  extrasList,
  fares,
  logoUrl,
  paymentMethods,
  promoCodes,
  ticketUrl,
} from "../data/content.js";
import SeatMap from "./SeatMap.jsx";
import TicketQr from "./TicketQr.jsx";
import { useToast } from "../lib/ToastProvider.jsx";
import { downloadTicketPdf } from "../lib/ticketPdf.js";

const extraIcons = { luggage: Briefcase, insurance: ShieldCheck, priority: Zap };

function CreditCardIcon({ method }) {
  if (method === "BLIK") return <Smartphone size={19} />;
  if (method === "Google Pay") return <Phone size={19} />;
  return <Ticket size={19} />;
}

// Fills any seats the passenger didn't pick themselves, preferring
// non-premium rows so skipping the seat map never adds a surprise charge.
function autoAssignSeats(fareId, departureIndex, chosen, needed) {
  if (chosen.length >= needed) return chosen.slice(0, needed);
  const seats = buildSeatMap(fareId, departureIndex);
  const filler = seats
    .filter((seat) => !seat.taken && !chosen.includes(seat.id))
    .sort((a, b) => Number(a.premium) - Number(b.premium))
    .slice(0, needed - chosen.length)
    .map((seat) => seat.id);
  return [...chosen, ...filler];
}

export default function TicketSystem({ activeFare, passengers, setActiveFare, setPassengers, t }) {
  const notify = useToast();
  const [step, setStep] = useState(1);
  const [selectedDeparture, setSelectedDeparture] = useState(0);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [seatMapOpen, setSeatMapOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [buyer, setBuyer] = useState({
    name: "Jan Kowalski",
    email: "jan.kowalski@email.com",
    phone: "+48 600 000 000",
  });
  const [extras, setExtras] = useState({ luggage: false, insurance: false, priority: false });
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [downloadEmail, setDownloadEmail] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const bookingCode = "CB-" + activeFare.id.slice(0, 3).toUpperCase() + "-4827";
  const fee = 2;

  const effectiveSeats = useMemo(
    () => autoAssignSeats(activeFare.id, selectedDeparture, selectedSeats, passengers),
    [activeFare.id, selectedDeparture, selectedSeats, passengers],
  );
  const premiumSeats = effectiveSeats.filter((id) => id.startsWith("1")).length;
  const seatSurcharge = premiumSeats * 5;
  const extrasTotal = extrasList.reduce(
    (sum, extra) => sum + (extras[extra.id] ? extra.price : 0),
    0,
  );
  const subtotal = activeFare.price * passengers + seatSurcharge + extrasTotal;
  const discount = appliedPromo ? Math.round(subtotal * appliedPromo.rate) : 0;
  const total = subtotal - discount + fee;
  const selectedTime = departureTimes[selectedDeparture];
  const arrivalHour = estimateArrival(selectedTime);

  const ticketPayload = bookingCode;

  const updateBuyer = (field, value) => {
    setBuyer((current) => ({ ...current, [field]: value }));
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

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (promoCodes[code]) {
      setAppliedPromo({ code, rate: promoCodes[code] });
      notify(t.toastPromoApplied, "success");
    } else {
      setAppliedPromo(null);
      notify(t.toastPromoInvalid, "error");
    }
  };

  const confirmPayment = () => {
    setStep(3);
    notify(t.toastBookingReady, "success");
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf({
        bookingCode,
        from: activeFare.from,
        to: activeFare.to,
        date: "18.07.2026",
        time: selectedTime,
        arrival: arrivalHour,
        passengerName: buyer.name,
        seats: effectiveSeats.join(", "),
        passengers,
        price: `${total} zł`,
        payload: ticketPayload,
        logoUrl,
        labels: {
          bookingCode: t.manageCode,
          departure: t.departureShort,
          arrival: t.arrivalShort,
          date: t.date,
          passenger: t.fieldName,
          passengers: t.passengers,
          seats: t.seatsSelected,
          price: t.total,
          footer: t.pdfFooter,
        },
      });
      notify(t.toastPdfReady, "success");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const steps = [
    ["1", t.stepRoute],
    ["2", t.stepPassenger],
    ["3", t.stepTicket],
  ];

  return (
    <section className="ticket-system" id="tickets">
      <div className="ticket-system-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.ticketSystem}</p>
            <h2>{t.ticketSystemLead}</h2>
          </div>
          <a className="secondary-button" href={ticketUrl}>
            {t.oldSystemLink}
            <ChevronRight size={18} />
          </a>
        </div>

        <div className="ticket-app">
          <aside className="ticket-sidebar">
            {steps.map(([number, label]) => (
              <button
                className={step === Number(number) ? "step-tab active" : "step-tab"}
                key={number}
                type="button"
                onClick={() => setStep(Number(number))}
              >
                <span>{number}</span>
                {label}
              </button>
            ))}
            <div className="portal-note">
              <Mail size={18} />
              <p>{t.portalNote}</p>
            </div>
          </aside>

          <div className="ticket-workspace">
            {step === 1 && (
              <div className="ticket-step">
                <div className="form-grid">
                  <label>
                    <span>{t.date}</span>
                    <input type="date" defaultValue="2026-07-18" />
                  </label>
                  <label>
                    <span>{t.fieldRoute}</span>
                    <select
                      value={activeFare.id}
                      onChange={(event) =>
                        setActiveFare(fares.find((fare) => fare.id === event.target.value))
                      }
                    >
                      {fares.map((fare) => (
                        <option key={fare.id} value={fare.id}>
                          {fare.from} - {fare.to}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{t.passengers}</span>
                    <div className="stepper">
                      <button
                        type="button"
                        onClick={() => {
                          setPassengers((value) => Math.max(1, value - 1));
                          setSelectedSeats((current) => current.slice(0, Math.max(1, passengers - 1)));
                        }}
                      >
                        -
                      </button>
                      <strong>{passengers}</strong>
                      <button
                        type="button"
                        onClick={() => setPassengers((value) => Math.min(8, value + 1))}
                      >
                        +
                      </button>
                    </div>
                  </label>
                </div>

                <h3>{t.stepDepartureHeading}</h3>
                <div className="departure-grid">
                  {departureTimes.map((time, index) => (
                    <button
                      className={
                        selectedDeparture === index ? "departure-card active" : "departure-card"
                      }
                      key={time}
                      type="button"
                      onClick={() => {
                        setSelectedDeparture(index);
                        setSelectedSeats([]);
                      }}
                    >
                      <span>{time}</span>
                      <strong>
                        {activeFare.from} - {activeFare.to}
                      </strong>
                      <small>
                        {14 - index} {t.seatsLeft}
                      </small>
                    </button>
                  ))}
                </div>

                <button className="primary-button" type="button" onClick={() => setStep(2)}>
                  {t.continue}
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="ticket-step">
                <div className="form-grid">
                  <label>
                    <span>{t.fieldName}</span>
                    <input
                      value={buyer.name}
                      onChange={(event) => updateBuyer("name", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t.fieldTicketEmail}</span>
                    <input
                      type="email"
                      value={buyer.email}
                      onChange={(event) => updateBuyer("email", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{t.fieldPhone}</span>
                    <input
                      value={buyer.phone}
                      onChange={(event) => updateBuyer("phone", event.target.value)}
                    />
                  </label>
                </div>

                <div className="accordion">
                  <button
                    aria-expanded={seatMapOpen}
                    className="accordion-toggle"
                    onClick={() => setSeatMapOpen((open) => !open)}
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
                        departureIndex={selectedDeparture}
                        fareId={activeFare.id}
                        maxSeats={passengers}
                        onToggle={toggleSeat}
                        selected={selectedSeats}
                        t={t}
                      />
                      <p className="muted accordion-hint">
                        {t.seatsSelected}: {selectedSeats.length ? selectedSeats.join(", ") : "-"} (
                        {selectedSeats.length}/{passengers})
                      </p>
                    </div>
                  )}
                </div>

                <div className="accordion">
                  <button
                    aria-expanded={extrasOpen}
                    className="accordion-toggle"
                    onClick={() => setExtrasOpen((open) => !open)}
                    type="button"
                  >
                    <span>
                      {t.extrasTitle} <em>({t.optionalTag})</em>
                    </span>
                    <ChevronDown size={18} />
                  </button>
                  {extrasOpen && (
                    <div className="accordion-body">
                      <div className="extras-grid">
                        {extrasList.map((extra) => {
                          const Icon = extraIcons[extra.id];
                          const label =
                            extra.id === "luggage"
                              ? t.extraLuggage
                              : extra.id === "insurance"
                                ? t.extraInsurance
                                : t.extraPriority;
                          return (
                            <button
                              className={extras[extra.id] ? "extra-card active" : "extra-card"}
                              key={extra.id}
                              onClick={() =>
                                setExtras((current) => ({
                                  ...current,
                                  [extra.id]: !current[extra.id],
                                }))
                              }
                              type="button"
                            >
                              <Icon size={22} />
                              <span>{label}</span>
                              <strong>+{extra.price} zł</strong>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <label className="checkbox-row">
                  <input type="checkbox" defaultChecked />
                  {t.termsAgree}
                </label>

                <div className="payment-methods">
                  {paymentMethods.map((method) => (
                    <button
                      className={paymentMethod === method ? "payment-card active" : "payment-card"}
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                    >
                      <CreditCardIcon method={method} />
                      {method}
                    </button>
                  ))}
                </div>

                <div className="promo-row">
                  <label>
                    <span>{t.promoTitle}</span>
                    <input
                      onChange={(event) => setPromoInput(event.target.value)}
                      placeholder={t.promoPlaceholder}
                      value={promoInput}
                    />
                  </label>
                  <button className="secondary-button" onClick={applyPromo} type="button">
                    {t.promoApply}
                  </button>
                </div>
                {appliedPromo && (
                  <div className="secure-box promo-active">
                    <Check size={18} />
                    <span>
                      {appliedPromo.code} {t.promoApplied} (-{Math.round(appliedPromo.rate * 100)}%)
                    </span>
                  </div>
                )}

                <div className="secure-box">
                  <ShieldCheck size={20} />
                  <span>{t.prototypeNotice}</span>
                </div>
                <button className="primary-button" type="button" onClick={confirmPayment}>
                  {t.payButton} {total} zł
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="ticket-step ticket-confirmation">
                <div className="success-mark">
                  <Check size={28} />
                </div>
                <h3>{t.ticketReadyTitle}</h3>
                <p>
                  {t.ticketConfirmationText
                    .replace("{code}", bookingCode)
                    .replace("{email}", buyer.email)
                    .replace("{seats}", effectiveSeats.join(", ") || "-")}
                </p>
                <div className="qr-real">
                  <TicketQr value={ticketPayload} size={140} />
                </div>
                <div className="download-panel">
                  <label>
                    <span>{t.resendEmailLabel}</span>
                    <input
                      type="email"
                      placeholder={t.resendPlaceholder}
                      value={downloadEmail}
                      onChange={(event) => setDownloadEmail(event.target.value)}
                    />
                  </label>
                  <button
                    className="secondary-button"
                    disabled={downloadingPdf}
                    onClick={handleDownloadPdf}
                    type="button"
                  >
                    <Download size={18} />
                    {t.downloadPdf}
                  </button>
                </div>

                <div className="wallet-row">
                  <button className="secondary-button" disabled type="button">
                    <Wallet size={18} />
                    {t.addToWallet}
                  </button>
                  <p className="muted wallet-hint">{t.walletNotice}</p>
                </div>
              </div>
            )}
          </div>

          <aside className="ticket-summary">
            <div className="mobile-ticket">
              <div className="mobile-ticket-top">
                <img src={logoUrl} alt="Contbus" />
                <span>{bookingCode}</span>
              </div>
              <div className="mobile-ticket-route">
                <div>
                  <small>{activeFare.from}</small>
                  <strong>{selectedTime}</strong>
                </div>
                <ArrowRight size={22} />
                <div>
                  <small>{activeFare.to}</small>
                  <strong>{arrivalHour}</strong>
                </div>
              </div>
              <div className="qr-ticket">
                <TicketQr value={ticketPayload} size={72} />
                <span>
                  {passengers} {t.passengerUnit} / {activeFare.price} zł
                </span>
              </div>
            </div>
            <div className="fare-box">
              <div>
                <span>{t.fareRouteLabel}</span>
                <strong>
                  {activeFare.from} - {activeFare.to}
                </strong>
              </div>
              <div>
                <span>{t.navTickets}</span>
                <strong>
                  {activeFare.price} zł x {passengers}
                </strong>
              </div>
              {seatSurcharge > 0 && (
                <div>
                  <span>{t.premiumSeatsLabel}</span>
                  <strong>+{seatSurcharge} zł</strong>
                </div>
              )}
              {extrasTotal > 0 && (
                <div>
                  <span>{t.extrasTitle}</span>
                  <strong>+{extrasTotal} zł</strong>
                </div>
              )}
              {discount > 0 && (
                <div>
                  <span>{t.discount}</span>
                  <strong>-{discount} zł</strong>
                </div>
              )}
              <div>
                <span>{t.service}</span>
                <strong>{fee} zł</strong>
              </div>
              <div className="total">
                <span>{t.total}</span>
                <strong>{total} zł</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
