import { useState } from "react";
import { Download, Mail, Search, TicketX, TriangleAlert } from "lucide-react";
import { findFareForPair, logoUrl } from "../data/content.js";
import { useToast } from "../lib/ToastProvider.jsx";
import { cancelPublicBooking, lookupPublicBooking } from "../lib/database.js";
import { downloadTicketPdf } from "../lib/ticketPdf.js";
import LiveTracker from "./LiveTracker.jsx";

function routeParts(route) {
  const [from = "-", to = "-"] = String(route || "").split(" - ");
  return { from, to };
}

export default function ManageBooking({ t }) {
  const notify = useToast();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState(null);
  const [searched, setSearched] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);

  const findBooking = async (event) => {
    event.preventDefault();
    const validFormat = /^CB-[A-Za-z0-9-]{5,}$/i.test(code.trim());
    const validEmail = /\S+@\S+\.\S+/.test(email.trim());
    setSearched(true);
    if (!validFormat || !validEmail) {
      setBooking(null);
      return;
    }
    setLoading(true);
    try {
      setBooking(await lookupPublicBooking({ code: code.trim().toUpperCase(), email: email.trim() }));
    } catch (error) {
      setBooking(null);
      notify(error.message || t.manageNotFound, "error");
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async () => {
    try {
      const result = await cancelPublicBooking({ code: booking.reference, email: booking.buyerEmail || email });
      if (!result) {
        notify(t.manageNotFound, "error");
        return;
      }
      setBooking((current) => ({ ...current, status: result.booking_status }));
      notify(t.toastCancelled, "info");
    } catch (error) {
      notify(error.message || t.manageNotFound, "error");
    }
  };

  const resend = () => {
    notify(t.toastResent, "success");
  };

  const handleDownloadPdf = async () => {
    const route = routeParts(booking.route);
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf({
        bookingCode: booking.reference,
        from: route.from,
        to: route.to,
        date: booking.departureDate,
        time: booking.departureTime,
        arrival: booking.arrivalTime,
        passengerName: booking.buyerName,
        seats: booking.seatNumbers.join(", ") || "-",
        passengers: booking.passengerCount,
        price: `${booking.totalAmount} ${booking.currency === "PLN" ? "zł" : booking.currency}`,
        payload: booking.ticketCodes[0] || booking.reference,
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

  const route = booking ? routeParts(booking.route) : { from: "-", to: "-" };
  const trackedFare = findFareForPair(route.from, route.to);

  return (
    <section className="section manage-section" id="manage">
      <div className="section-heading narrow">
        <div>
          <p className="eyebrow">{t.manageTitle}</p>
          <h2>{t.manageLead}</h2>
        </div>
      </div>

      <div className="manage-layout">
        <form className="manage-form" onSubmit={findBooking}>
          <label>
            <span>{t.manageCode}</span>
            <input
              autoComplete="off"
              onChange={(event) => setCode(event.target.value)}
              placeholder="CB-LUB-4827"
              value={code}
            />
          </label>
          <label>
            <span>{t.manageEmail}</span>
            <input
              autoComplete="email"
              spellCheck={false}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jan.kowalski@email.com"
              type="email"
              value={email}
            />
          </label>
          <button className="primary-button full" disabled={loading} type="submit">
            <Search size={18} />
            {loading ? t.searching : t.manageFind}
          </button>
        </form>

        {searched && !loading && !booking && (
          <div className="secure-box manage-empty" aria-live="polite">
            <TriangleAlert size={20} />
            <span>{t.manageNotFound}</span>
          </div>
        )}

        {booking && (
          <article className="manage-result">
            <div className="manage-result-top">
              <div>
                <p className="eyebrow">{t.manageFound}</p>
                <h3>
                  {route.from} - {route.to}
                </h3>
                <span>{booking.reference}</span>
              </div>
              <span
                className={
                  booking.status !== "cancelled"
                    ? "status"
                    : "status status-cancelled"
                }
              >
                {booking.status !== "cancelled" ? t.manageStatusActive : t.manageStatusCancelled}
              </span>
            </div>
            <div className="fare-box">
              <div>
                <span>{t.departureTimeLabel}</span>
                <strong>{booking.departureTime}</strong>
              </div>
              <div>
                <span>{t.manageEmail}</span>
                <strong>{booking.buyerEmail}</strong>
              </div>
            </div>
            {booking.status === "cancelled" ? (
              <div className="secure-box manage-empty">
                <TicketX size={18} />
                <span>{t.manageCancelled}</span>
              </div>
            ) : (
              <div className="manage-actions">
                <button className="secondary-button" onClick={resend} type="button">
                  <Mail size={16} />
                  {t.manageResend}
                </button>
                <button
                  className="secondary-button"
                  disabled={downloadingPdf}
                  onClick={handleDownloadPdf}
                  type="button"
                >
                  <Download size={16} />
                  {t.downloadPdf}
                </button>
                <button className="danger-button" onClick={cancelBooking} type="button">
                  <TicketX size={16} />
                  {t.manageCancel}
                </button>
              </div>
            )}
          </article>
        )}
      </div>

      {booking?.status !== "cancelled" && trackedFare && <LiveTracker activeFare={trackedFare} t={t} />}
    </section>
  );
}
