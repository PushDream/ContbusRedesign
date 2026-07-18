import { useState } from "react";
import { Download, Mail, Search, TicketX, TriangleAlert } from "lucide-react";
import { estimateArrival, fares, hashString, logoUrl } from "../data/content.js";
import { useToast } from "../lib/ToastProvider.jsx";
import { downloadTicketPdf } from "../lib/ticketPdf.js";
import LiveTracker from "./LiveTracker.jsx";

const routes = [
  ["Lublin", "Warszawa Marriott"],
  ["Lublin", "Lotnisko Chopina"],
  ["Lublin", "Lotnisko Modlin"],
];

export default function ManageBooking({ t }) {
  const notify = useToast();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState(null);
  const [searched, setSearched] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const findBooking = (event) => {
    event.preventDefault();
    const validFormat = /^CB-[A-Za-z]{3}-\d{4}$/.test(code.trim());
    const validEmail = /\S+@\S+\.\S+/.test(email.trim());
    setSearched(true);
    if (!validFormat || !validEmail) {
      setBooking(null);
      return;
    }
    const seed = hashString(code.trim().toUpperCase());
    const route = routes[seed % routes.length];
    setBooking({
      code: code.trim().toUpperCase(),
      email: email.trim(),
      from: route[0],
      to: route[1],
      time: ["06:40", "08:15", "11:30", "14:10"][seed % 4],
      status: "active",
    });
  };

  const cancelBooking = () => {
    setBooking((current) => ({ ...current, status: "cancelled" }));
    notify(t.toastCancelled, "info");
  };

  const resend = () => {
    notify(t.toastResent, "success");
  };

  const handleDownloadPdf = async () => {
    const fare = fares.find((item) => item.from === booking.from && item.to === booking.to);
    setDownloadingPdf(true);
    try {
      await downloadTicketPdf({
        bookingCode: booking.code,
        from: booking.from,
        to: booking.to,
        date: "18.07.2026",
        time: booking.time,
        arrival: estimateArrival(booking.time),
        passengerName: booking.email,
        seats: "-",
        passengers: 1,
        price: fare ? `${fare.price} zł` : "-",
        payload: JSON.stringify({
          code: booking.code,
          route: `${booking.from} -> ${booking.to}`,
          time: booking.time,
          email: booking.email,
        }),
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

  const trackedFare =
    booking &&
    booking.status === "active" &&
    fares.find((fare) => fare.from === booking.from && fare.to === booking.to);

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
              onChange={(event) => setCode(event.target.value)}
              placeholder="CB-LUB-4827"
              value={code}
            />
          </label>
          <label>
            <span>{t.manageEmail}</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jan.kowalski@email.com"
              type="email"
              value={email}
            />
          </label>
          <button className="primary-button full" type="submit">
            <Search size={18} />
            {t.manageFind}
          </button>
        </form>

        {searched && !booking && (
          <div className="secure-box manage-empty">
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
                  {booking.from} - {booking.to}
                </h3>
                <span>{booking.code}</span>
              </div>
              <span
                className={
                  booking.status === "active"
                    ? "status"
                    : "status status-cancelled"
                }
              >
                {booking.status === "active" ? t.manageStatusActive : t.manageStatusCancelled}
              </span>
            </div>
            <div className="fare-box">
              <div>
                <span>{t.departureTimeLabel}</span>
                <strong>{booking.time}</strong>
              </div>
              <div>
                <span>{t.manageEmail}</span>
                <strong>{booking.email}</strong>
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

      {trackedFare && <LiveTracker activeFare={trackedFare} t={t} />}
    </section>
  );
}
