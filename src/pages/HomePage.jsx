import { useState } from "react";
import { Link } from "react-router-dom";
import { Ticket, Download } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import BookingSearch from "../components/BookingSearch.jsx";
import QuickFacts from "../components/QuickFacts.jsx";
import TrustBand from "../components/TrustBand.jsx";
import ReviewsSection from "../components/ReviewsSection.jsx";
import FAQSection from "../components/FAQSection.jsx";

export default function HomePage() {
  const { t, language } = useApp();
  const [passengers, setPassengers] = useState(1);

  return (
    <>
      <section className="hero" id="home">
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-overlay" />
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">{t.heroKicker}</p>
            <h1>{t.heroTitle}</h1>
            <p>{t.heroLead}</p>
            <div className="hero-actions">
              <Link className="primary-button" to="/results">
                <Ticket size={18} />
                {t.buy}
              </Link>
              <Link className="secondary-button invert" to="/moje-bilety">
                <Download size={18} />
                {t.download}
              </Link>
            </div>
          </div>

          <BookingSearch passengers={passengers} setPassengers={setPassengers} />
        </div>
      </section>

      <QuickFacts t={t} />
      <TrustBand t={t} />
      <ReviewsSection t={t} />
      <FAQSection language={language} t={t} />
    </>
  );
}
