import { useEffect, useMemo, useState } from "react";
import { Download, Ticket } from "lucide-react";
import { copy, fares } from "./data/content.js";
import { useDarkMode } from "./lib/useDarkMode.js";
import { useToast } from "./lib/ToastProvider.jsx";

import Header from "./components/Header.jsx";
import BookingSearch from "./components/BookingSearch.jsx";
import QuickFacts from "./components/QuickFacts.jsx";
import TrustBand from "./components/TrustBand.jsx";
import RoutesSection from "./components/RoutesSection.jsx";
import TicketSystem from "./components/TicketSystem.jsx";
import StopsSection from "./components/StopsSection.jsx";
import ServiceBand from "./components/ServiceBand.jsx";
import ManageBooking from "./components/ManageBooking.jsx";
import FAQSection from "./components/FAQSection.jsx";
import ReviewsContact from "./components/ReviewsContact.jsx";
import Footer from "./components/Footer.jsx";
import MobileTabBar from "./components/MobileTabBar.jsx";

export default function App() {
  const [language, setLanguage] = useState("pl");
  const [activeFare, setActiveFare] = useState(fares[0]);
  const [passengers, setPassengers] = useState(1);
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const notify = useToast();
  const t = useMemo(() => copy[language], [language]);

  useEffect(() => {
    const handlePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      notify(t.installDone, "success");
    }
    setInstallPrompt(null);
  };

  return (
    <main>
      <a className="skip-link" href="#home">
        {t.skipToContent}
      </a>

      <Header
        canInstall={Boolean(installPrompt) && !installed}
        dark={dark}
        language={language}
        mobileNav={mobileNav}
        onInstall={handleInstall}
        setDark={setDark}
        setLanguage={setLanguage}
        setMobileNav={setMobileNav}
        t={t}
      />

      <section className="hero" id="home">
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-overlay" />
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">{t.heroKicker}</p>
            <h1>{t.heroTitle}</h1>
            <p>{t.heroLead}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#tickets">
                <Ticket size={18} />
                {t.buy}
              </a>
              {installPrompt && !installed ? (
                <button className="secondary-button invert" onClick={handleInstall} type="button">
                  <Download size={18} />
                  {t.installButton}
                </button>
              ) : (
                <a className="secondary-button invert" href="#manage">
                  <Download size={18} />
                  {t.download}
                </a>
              )}
            </div>
          </div>

          <BookingSearch
            passengers={passengers}
            setActiveFare={setActiveFare}
            setPassengers={setPassengers}
            t={t}
          />
        </div>
      </section>

      <QuickFacts t={t} />
      <TrustBand t={t} />

      <RoutesSection
        activeFare={activeFare}
        passengers={passengers}
        setActiveFare={setActiveFare}
        t={t}
      />

      <TicketSystem
        activeFare={activeFare}
        passengers={passengers}
        setActiveFare={setActiveFare}
        setPassengers={setPassengers}
        t={t}
      />

      <StopsSection t={t} />

      <ServiceBand t={t} />

      <ManageBooking t={t} />

      <FAQSection language={language} t={t} />

      <ReviewsContact t={t} />

      <Footer t={t} />

      <MobileTabBar t={t} />
    </main>
  );
}
