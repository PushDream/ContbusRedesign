import { Clock3, Mail, MapPin, Phone, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { testimonials } from "../data/content.js";

export default function ContactPage() {
  const { t } = useApp();

  return (
    <div className="page-wrapper contact-page">
      <div className="page-heading">
        <p className="eyebrow">Contbus</p>
        <h1>{t.nav[5]}</h1>
        <p className="page-lead">Jesteśmy do dyspozycji od poniedziałku do niedzieli.</p>
      </div>

      <div className="contact-page-layout">
        <div className="contact-cards">
          <div className="contact-info-card">
            <div className="contact-info-icon">
              <Phone size={22} />
            </div>
            <div>
              <strong>Infolinia</strong>
              <a href="tel:+48607669080" className="contact-big-value">
                +48 607 66 90 80
              </a>
              <div className="contact-row">
                <Clock3 size={15} />
                <span>{t.hours}</span>
              </div>
            </div>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon">
              <Mail size={22} />
            </div>
            <div>
              <strong>E-mail</strong>
              <a href="mailto:administrator@contbus.pl" className="contact-big-value">
                administrator@contbus.pl
              </a>
            </div>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon">
              <MapPin size={22} />
            </div>
            <div>
              <strong>Biuro</strong>
              <p className="contact-big-value" style={{ margin: 0 }}>
                Contbus Olszak Sp. J.
              </p>
              <span>ul. Bazylianówka 48D, Lublin</span>
            </div>
          </div>
        </div>

        <div className="contact-actions-panel">
          <a className="primary-button" href="tel:+48607669080">
            <Phone size={18} />
            Zadzwoń teraz
          </a>
          <a className="secondary-button" href="mailto:administrator@contbus.pl">
            <Mail size={18} />
            Wyślij e-mail
          </a>
          <Link className="secondary-button" to="/results">
            <Ticket size={18} />
            {t.buy}
          </Link>
        </div>

        <div className="reviews-section">
          <h2>{t.reviews}</h2>
          <div className="reviews">
            {testimonials.map((item) => (
              <article className="review-card" key={item.name}>
                <div className="stars">★★★★★</div>
                <p>{item.body}</p>
                <strong>{item.name}</strong>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
