import { useState } from "react";
import { Download, Mail, Search, TicketX, TriangleAlert } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../lib/ToastProvider.jsx";
import { logoUrl } from "../data/content.js";
import TicketQr from "../components/TicketQr.jsx";
import { cancelPublicBooking, lookupPublicBooking } from "../lib/database.js";
import { downloadTicketPdf } from "../lib/ticketPdf.js";

function routeParts(route) {
  const [from = "-", to = "-"] = String(route || "").split(" - ");
  return { from, to };
}

export default function MyTicketsPage() {
  const { t } = useApp();
  const notify = useToast();
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState(null);
  const [searched, setSearched] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearched(true);
    setLoading(true);
    try {
      const found = await lookupPublicBooking({
        code: input.trim().toUpperCase(),
        email: email.trim(),
      });
      setTicket(found);
    } catch (error) {
      setTicket(null);
      notify(error.message || t.manageNotFound, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!ticket) return;
    try {
      const result = await cancelPublicBooking({
        code: ticket.reference,
        email: ticket.buyerEmail || email,
      });
      if (!result) {
        notify(t.manageNotFound, "error");
        return;
      }
      setTicket((current) => ({ ...current, status: result.booking_status }));
      notify(t.toastCancelled, "info");
    } catch (error) {
      notify(error.message || t.manageNotFound, "error");
    }
  };

  const handleResend = () => {
    notify(t.toastResent, "success");
  };

  const handleDownloadPdf = async () => {
    if (!ticket) return;
    const { from, to } = routeParts(ticket.route);
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf({
        bookingCode: ticket.reference,
        from,
        to,
        date: ticket.departureDate,
        time: ticket.departureTime,
        arrival: ticket.arrivalTime,
        passengerName: ticket.buyerName,
        seats: ticket.seatNumbers.join(", ") || "-",
        passengers: ticket.passengerCount,
        price: `${ticket.totalAmount} ${ticket.currency === "PLN" ? "zł" : ticket.currency}`,
        payload: ticket.ticketCodes[0] || ticket.reference,
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

  const route = ticket ? routeParts(ticket.route) : { from: "-", to: "-" };
  const cancelled = ticket?.status === "cancelled";

  return (
    <div className="page-wrapper my-tickets-page">
      <div className="page-heading">
        <p className="eyebrow">Contbus</p>
        <h1>{t.quickNavMyTickets}</h1>
        <p className="page-lead">{t.manageLead}</p>
      </div>

      <div className="my-tickets-layout">
        <form className="manage-form" onSubmit={handleSearch}>
          <label>
            <span>{t.manageCode}</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="np. CB-ABC123"
              required
              spellCheck={false}
            />
          </label>
          <label>
            <span>{t.manageEmail}</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan.kowalski@email.com"
              required
              type="email"
              autoComplete="email"
              spellCheck={false}
            />
          </label>
          <button className="primary-button full" disabled={loading} type="submit">
            <Search size={18} />
            {loading ? t.searching : t.manageFind}
          </button>
        </form>

        {searched && !loading && !ticket && (
          <div className="secure-box manage-empty" aria-live="polite">
            <TriangleAlert size={20} />
            <span>{t.manageNotFound}</span>
          </div>
        )}

        {ticket && (
          <article className="ticket-card">
            <div className="ticket-card-header">
              <img src={logoUrl} alt="Contbus" className="ticket-card-logo" width={157} height={28} />
              <span className={cancelled ? "status status-cancelled" : "status"}>
                {cancelled ? t.manageStatusCancelled : t.manageStatusActive}
              </span>
            </div>

            <div className="ticket-card-route">
              <div className="ticket-card-stop">
                <strong>{ticket.departureTime}</strong>
                <span>{route.from}</span>
              </div>
              <div className="ticket-card-arrow">
                <ArrowRight size={20} />
                <small>
                  {ticket.passengerCount} {t.personsShort}
                </small>
              </div>
              <div className="ticket-card-stop">
                <strong>{ticket.arrivalTime}</strong>
                <span>{route.to}</span>
              </div>
            </div>

            <div className="ticket-card-details">
              <div>
                <span>{t.date}</span>
                <strong>{ticket.departureDate}</strong>
              </div>
              <div>
                <span>{t.seatLabel}</span>
                <strong>{ticket.seatNumbers.join(", ") || "-"}</strong>
              </div>
              <div>
                <span>{t.stepLabelPassenger}</span>
                <strong>{ticket.buyerName}</strong>
              </div>
              <div>
                <span>{t.manageCode}</span>
                <strong>{ticket.reference}</strong>
              </div>
              {ticket.platform && (
                <div>
                  <span>{t.platformShort}</span>
                  <strong>{ticket.platform}</strong>
                </div>
              )}
            </div>

            <div className="ticket-card-qr">
              <TicketQr value={ticket.ticketCodes[0] || ticket.reference} size={140} />
            </div>

            {cancelled ? (
              <div className="secure-box manage-empty">
                <TicketX size={18} />
                <span>{t.manageCancelled}</span>
              </div>
            ) : (
              <div className="manage-actions">
                <button className="secondary-button" onClick={handleResend} type="button">
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
                <button className="danger-button" onClick={handleCancel} type="button">
                  <TicketX size={16} />
                  {t.manageCancel}
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
