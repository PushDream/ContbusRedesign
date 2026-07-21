import { useState } from "react";
import { Download, Mail, Search, Ticket, TicketX, TriangleAlert } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../lib/ToastProvider.jsx";
import { estimateArrival, fares, hashString, logoUrl } from "../data/content.js";
import { downloadTicketPdf } from "../lib/ticketPdf.js";

const DEMO_CODE = "CB-3ZZTLH";

const routes = [
  ["Lublin", "Warszawa Marriott"],
  ["Lublin", "Lotnisko Chopina"],
  ["Lublin", "Lotnisko Modlin"],
];

function buildDemoTicket(code) {
  const seed = hashString(code.trim().toUpperCase());
  const route = routes[seed % routes.length];
  const times = ["06:40", "08:15", "11:30", "14:10"];
  return {
    code: code.trim().toUpperCase(),
    from: route[0],
    to: route[1],
    time: times[seed % times.length],
    date: "2026-07-21",
    seat: `${(seed % 10) + 2}${["A", "B", "C", "D"][seed % 4]}`,
    passenger: "Jan Kowalski",
    status: "active",
  };
}

export default function MyTicketsPage() {
  const { t } = useApp();
  const notify = useToast();
  const [input, setInput] = useState("");
  const [ticket, setTicket] = useState(null);
  const [searched, setSearched] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleSearch = (event) => {
    event.preventDefault();
    setSearched(true);
    setCancelled(false);
    const val = input.trim().toUpperCase();
    if (val.startsWith("CB-") && val.length >= 5) {
      setTicket(buildDemoTicket(val));
    } else {
      setTicket(null);
    }
  };

  const handleCancel = () => {
    setCancelled(true);
    notify(t.toastCancelled, "info");
  };

  const handleResend = () => {
    notify(t.toastResent, "success");
  };

  const handleDownloadPdf = async () => {
    if (!ticket) return;
    const fare = fares.find((f) => f.from === ticket.from && f.to === ticket.to);
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf({
        bookingCode: ticket.code,
        from: ticket.from,
        to: ticket.to,
        date: ticket.date,
        time: ticket.time,
        arrival: estimateArrival(ticket.time),
        passengerName: ticket.passenger,
        seats: ticket.seat,
        passengers: 1,
        price: fare ? `${fare.price} zł` : "-",
        payload: JSON.stringify({ code: ticket.code, route: `${ticket.from} → ${ticket.to}`, time: ticket.time }),
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

  const arrival = ticket ? estimateArrival(ticket.time) : null;

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
              placeholder={`np. ${DEMO_CODE}`}
            />
          </label>
          <button className="primary-button full" type="submit">
            <Search size={18} />
            Sprawdź
          </button>
          <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            Wypróbuj przykładowy kod: <strong>{DEMO_CODE}</strong>
          </p>
        </form>

        {searched && !ticket && (
          <div className="secure-box manage-empty">
            <TriangleAlert size={20} />
            <span>{t.manageNotFound}</span>
          </div>
        )}

        {ticket && (
          <article className="ticket-card">
            <div className="ticket-card-header">
              <img src={logoUrl} alt="Contbus" className="ticket-card-logo" />
              <span className={cancelled ? "status status-cancelled" : "status"}>
                {cancelled ? t.manageStatusCancelled : t.manageStatusActive}
              </span>
            </div>

            <div className="ticket-card-route">
              <div className="ticket-card-stop">
                <strong>{ticket.time}</strong>
                <span>{ticket.from}</span>
              </div>
              <div className="ticket-card-arrow">
                <ArrowRight size={20} />
                <small>
                  {fares.find((f) => f.from === ticket.from && f.to === ticket.to)?.duration || ""}
                </small>
              </div>
              <div className="ticket-card-stop">
                <strong>{arrival}</strong>
                <span>{ticket.to}</span>
              </div>
            </div>

            <div className="ticket-card-details">
              <div>
                <span>{t.date}</span>
                <strong>{ticket.date}</strong>
              </div>
              <div>
                <span>Miejsce</span>
                <strong>{ticket.seat}</strong>
              </div>
              <div>
                <span>Pasażer</span>
                <strong>{ticket.passenger}</strong>
              </div>
              <div>
                <span>Kod</span>
                <strong>{ticket.code}</strong>
              </div>
            </div>

            <div className="ticket-card-qr">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(ticket.code)}`}
                alt="QR bilet"
                width={100}
                height={100}
                style={{ borderRadius: 8 }}
              />
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
