import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Bus,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Languages,
  Mail,
  MapPinned,
  Menu,
  Navigation,
  Phone,
  Plane,
  QrCode,
  Route,
  Search,
  ShieldCheck,
  Smartphone,
  Ticket,
  TimerReset,
  Wifi,
  X,
} from "lucide-react";
import "./styles.css";

const ticketUrl = "https://bilety.contbus.pl/KupBilet.aspx";
const regulationsUrl = "https://bilety.contbus.pl/Regulamin.aspx";
const logoUrl =
  "https://www.contbus.pl/wp-content/uploads/2022/07/contbus-1024x183-768x137-1.jpg";

const fares = [
  {
    id: "lublin-warszawa",
    from: "Lublin",
    to: "Warszawa Marriott",
    price: 50,
    duration: "2h 35m",
    note: "bezpośrednio",
    stops: ["Dworcowa 2", "Al. Tysiąclecia", "Chałubińskiego"],
  },
  {
    id: "lublin-chopin",
    from: "Lublin",
    to: "Lotnisko Chopina",
    price: 60,
    duration: "2h 55m",
    note: "terminal autokarowy",
    stops: ["Dworcowa 2", "Al. Tysiąclecia", "Chopin stanowisko 6"],
  },
  {
    id: "lublin-modlin",
    from: "Lublin",
    to: "Lotnisko Modlin",
    price: 70,
    duration: "3h 35m",
    note: "pod terminalem",
    stops: ["Dworcowa 2", "Warszawa", "Modlin terminal"],
  },
  {
    id: "chopin-modlin",
    from: "Lotnisko Chopina",
    to: "Lotnisko Modlin",
    price: 50,
    duration: "55m",
    note: "transfer lotniskowy",
    stops: ["Chopin", "Warszawa Marriott", "Modlin"],
  },
];

const stops = [
  {
    id: "lublin",
    type: "city",
    title: "Lublin, Dworzec Autobusowy",
    meta: "ul. Dworcowa 2, stanowisko 1",
    detail:
      "Przystanek początkowy dla kursów Contbus w kierunku Warszawy, Lotniska Chopina i Lotniska Modlin.",
  },
  {
    id: "tysiaclecia",
    type: "city",
    title: "Lublin, Al. Tysiąclecia",
    meta: "Muzeum Narodowe - Zamek 04",
    detail:
      "Wygodny punkt odbioru pasażerów przy centrum miasta, widoczny w oficjalnym cenniku przewoźnika.",
  },
  {
    id: "warszawa",
    type: "city",
    title: "Warszawa Marriott",
    meta: "ul. T. Chałubińskiego / Nowogrodzka",
    detail:
      "Przystanek w ścisłym centrum Warszawy, około 300 metrów od Warszawy Centralnej.",
  },
  {
    id: "chopin",
    type: "airport",
    title: "Lotnisko Chopina",
    meta: "terminal autokarowy, stanowisko 6",
    detail:
      "Po wyjściu z hali przylotów pasażerowie kierują się w prawo; busy stoją około 200 metrów od terminala.",
  },
  {
    id: "modlin",
    type: "airport",
    title: "Lotnisko Modlin",
    meta: "bezpośrednio przed terminalem",
    detail:
      "Najprostszy odbiór i wysiadka dla podróży lotniczych z/do Nowego Dworu Mazowieckiego.",
  },
];

const testimonials = [
  {
    name: "Katarzyna Wawer",
    body: "Wszystko było na czas, przesiadki były bezproblemowe, a kierowcy kompetentni i kulturalni.",
  },
  {
    name: "Tomasz Sarafin",
    body: "Zwykle trafiam na komfortowy autobus, a kierowcy są profesjonalni.",
  },
  {
    name: "Bożena Sawicka",
    body: "Busy są nowe, przestronne i czyste. Często korzystam i jestem bardzo zadowolona.",
  },
];

const departureTimes = ["06:40", "08:15", "11:30", "14:10", "16:45", "19:20"];

const paymentMethods = [
  "BLIK",
  "Karta płatnicza",
  "Przelew online",
  "Google Pay",
];

const copy = {
  pl: {
    code: "PL",
    label: "Polski",
    nav: ["Kup bilet", "Trasy", "Przystanki", "Dla pasażera", "Kontakt"],
    heroKicker: "Lublin - Warszawa - Lotniska",
    heroTitle: "Contbus",
    heroLead:
      "Nowoczesna strona dla przewoźnika, który od ponad 15 lat obsługuje pasażerów na trasie Lublin - Warszawa oraz połączenia na Lotnisko Chopina i Lotnisko Modlin.",
    buy: "Kup bilet",
    download: "Pobierz bilet",
    searchTitle: "Znajdź przejazd",
    from: "Skąd",
    to: "Dokąd",
    date: "Data podróży",
    passengers: "Pasażerowie",
    search: "Sprawdź kursy",
    popular: "Najczęściej wybierane połączenia",
    choose: "Wybierz połączenie",
    chooseLead:
      "Widok może później podłączyć prawdziwy rozkład i dostępność miejsc z systemu biletowego Contbus.",
    seatsLeft: "wolnych miejsc",
    selected: "Wybrany kurs",
    fare: "Cena bazowa",
    service: "Opłata online",
    total: "Razem",
    continue: "Przejdź do zakupu",
    stops: "Przystanki",
    stopsLead:
      "Najważniejsze punkty odprawy pokazane w prostym, mobilnym układzie z instrukcjami dojścia.",
    passenger: "Dla pasażera",
    passengerLead:
      "Szybkie akcje, które powinny być widoczne bez szukania w menu.",
    hotline: "Infolinia",
    hours: "Poniedziałek - Niedziela, 09:00 - 17:00",
    email: "administrator@contbus.pl",
    comfort: "Komfort podróży",
    comfortLead:
      "Klimatyzowane wnętrza, rozkładane fotele, trzypunktowe pasy, Wi-Fi, monitoring oraz systemy ABS i ASR.",
    rental: "Wynajem busów",
    rentalLead:
      "Poza kursami rejsowymi Contbus oferuje przewozy krajowe dla firm, instytucji i klientów indywidualnych.",
    reviews: "Opinie pasażerów",
    footer: "Koncepcja redesignu przygotowana do prezentacji właścicielom Contbus.",
    ticketSystem: "Nowy system biletowy",
    ticketSystemLead:
      "Klikalny prototyp zakupu biletu: wybór daty i trasy, kursu, danych pasażera, płatności oraz gotowy bilet QR.",
  },
  en: {
    code: "EN",
    label: "English",
    nav: ["Buy ticket", "Routes", "Stops", "Passenger", "Contact"],
    heroKicker: "Lublin - Warsaw - Airports",
    heroTitle: "Contbus",
    heroLead:
      "A modern website concept for a carrier serving Lublin - Warsaw and Chopin/Modlin airport routes for more than 15 years.",
    buy: "Buy ticket",
    download: "Download ticket",
    searchTitle: "Find a trip",
    from: "From",
    to: "To",
    date: "Travel date",
    passengers: "Passengers",
    search: "Search trips",
    popular: "Most popular connections",
    choose: "Choose a connection",
    chooseLead:
      "This view can later connect to the real Contbus booking system schedule and seat availability.",
    seatsLeft: "seats left",
    selected: "Selected trip",
    fare: "Base fare",
    service: "Online fee",
    total: "Total",
    continue: "Continue to purchase",
    stops: "Stops",
    stopsLead:
      "Key boarding points presented in a clear mobile layout with arrival instructions.",
    passenger: "Passenger help",
    passengerLead: "Fast actions passengers should reach without searching menus.",
    hotline: "Hotline",
    hours: "Monday - Sunday, 09:00 - 17:00",
    email: "administrator@contbus.pl",
    comfort: "Travel comfort",
    comfortLead:
      "Air-conditioned interiors, reclining seats, three-point belts, Wi-Fi, monitoring, ABS and ASR systems.",
    rental: "Private bus hire",
    rentalLead:
      "Alongside scheduled services, Contbus offers domestic transport for companies, institutions and individuals.",
    reviews: "Passenger reviews",
    footer: "Redesign concept prepared for a pitch to Contbus owners.",
    ticketSystem: "New ticket system",
    ticketSystemLead:
      "A clickable purchase prototype: date, route, departure, passenger details, payment and a QR ticket.",
  },
  ua: {
    code: "UA",
    label: "Українська",
    nav: ["Купити квиток", "Маршрути", "Зупинки", "Пасажиру", "Контакт"],
    heroKicker: "Люблін - Варшава - Аеропорти",
    heroTitle: "Contbus",
    heroLead:
      "Сучасна концепція сайту для перевізника, який понад 15 років обслуговує маршрут Люблін - Варшава та рейси до аеропортів Шопена і Модлін.",
    buy: "Купити квиток",
    download: "Завантажити квиток",
    searchTitle: "Знайти поїздку",
    from: "Звідки",
    to: "Куди",
    date: "Дата подорожі",
    passengers: "Пасажири",
    search: "Перевірити рейси",
    popular: "Популярні сполучення",
    choose: "Оберіть рейс",
    chooseLead:
      "Пізніше цей екран можна підключити до реального розкладу та наявності місць Contbus.",
    seatsLeft: "місць доступно",
    selected: "Обраний рейс",
    fare: "Базова ціна",
    service: "Онлайн збір",
    total: "Разом",
    continue: "Перейти до купівлі",
    stops: "Зупинки",
    stopsLead:
      "Головні пункти посадки у зрозумілому мобільному форматі з інструкціями.",
    passenger: "Для пасажира",
    passengerLead: "Швидкі дії, які мають бути доступні без пошуку в меню.",
    hotline: "Інфолінія",
    hours: "Понеділок - Неділя, 09:00 - 17:00",
    email: "administrator@contbus.pl",
    comfort: "Комфорт подорожі",
    comfortLead:
      "Кондиціонер, розкладні сидіння, триточкові ремені, Wi-Fi, моніторинг, системи ABS та ASR.",
    rental: "Оренда автобусів",
    rentalLead:
      "Окрім регулярних рейсів, Contbus пропонує внутрішні перевезення для компаній, установ та приватних клієнтів.",
    reviews: "Відгуки пасажирів",
    footer: "Концепція редизайну для презентації власникам Contbus.",
    ticketSystem: "Нова система квитків",
    ticketSystemLead:
      "Клікабельний прототип купівлі: дата, маршрут, рейс, дані пасажира, оплата і QR-квиток.",
  },
};

function App() {
  const [language, setLanguage] = useState("pl");
  const [activeFare, setActiveFare] = useState(fares[0]);
  const [activeStop, setActiveStop] = useState(stops[0]);
  const [passengers, setPassengers] = useState(1);
  const [mobileNav, setMobileNav] = useState(false);
  const t = copy[language];

  const total = useMemo(
    () => activeFare.price * passengers + 2,
    [activeFare.price, passengers],
  );

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Contbus">
          <img src={logoUrl} alt="Contbus" />
        </a>

        <button
          className="icon-button menu-button"
          aria-label="Menu"
          onClick={() => setMobileNav((open) => !open)}
        >
          {mobileNav ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav className={mobileNav ? "nav open" : "nav"}>
          <a href="#tickets">{t.nav[0]}</a>
          <a href="#routes">{t.nav[1]}</a>
          <a href="#stops">{t.nav[2]}</a>
          <a href="#passenger">{t.nav[3]}</a>
          <a href="#contact">{t.nav[4]}</a>
        </nav>

        <div className="language-switcher" aria-label="Language switcher">
          <Languages size={16} />
          {Object.keys(copy).map((key) => (
            <button
              className={language === key ? "active" : ""}
              key={key}
              type="button"
              onClick={() => setLanguage(key)}
            >
              {copy[key].code}
            </button>
          ))}
        </div>
      </header>

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
              <a className="secondary-button invert" href="#tickets">
                <Download size={18} />
                {t.download}
              </a>
            </div>
          </div>

          <BookingSearch
            passengers={passengers}
            setPassengers={setPassengers}
            setActiveFare={setActiveFare}
            t={t}
          />
        </div>
      </section>

      <section className="quick-facts" aria-label="Contbus facts">
        <article>
          <BadgeCheck size={21} />
          <strong>15+ lat</strong>
          <span>Lublin - Warszawa</span>
        </article>
        <article>
          <Plane size={21} />
          <strong>2 lotniska</strong>
          <span>Chopin i Modlin</span>
        </article>
        <article>
          <Wifi size={21} />
          <strong>Wi-Fi</strong>
          <span>komfortowe busy</span>
        </article>
        <article>
          <Phone size={21} />
          <strong>607 669 080</strong>
          <span>09:00 - 17:00</span>
        </article>
      </section>

      <section className="section routes-section" id="routes">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.popular}</p>
            <h2>{t.choose}</h2>
            <p>{t.chooseLead}</p>
          </div>
          <a className="secondary-button" href={regulationsUrl}>
            <ShieldCheck size={18} />
            Regulamin i cennik
          </a>
        </div>

        <div className="routes-layout">
          <div className="fare-list">
            {fares.map((fare, index) => (
              <button
                className={activeFare.id === fare.id ? "fare-card active" : "fare-card"}
                key={fare.id}
                type="button"
                onClick={() => setActiveFare(fare)}
              >
                <span className="time-pill">{["06:40", "08:15", "11:30", "15:20"][index]}</span>
                <div>
                  <strong>{fare.from}</strong>
                  <Route size={18} />
                  <strong>{fare.to}</strong>
                </div>
                <p>{fare.stops.join(" / ")}</p>
                <footer>
                  <span>{fare.duration} - {fare.note}</span>
                  <strong>{fare.price} zł</strong>
                </footer>
              </button>
            ))}
          </div>

          <aside className="booking-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{t.selected}</p>
                <h3>{activeFare.from} - {activeFare.to}</h3>
              </div>
              <span className="status">
                <Check size={14} />
                {8 + passengers} {t.seatsLeft}
              </span>
            </div>

            <div className="ticket-preview">
              <div>
                <span>{activeFare.from}</span>
                <strong>06:40</strong>
              </div>
              <ArrowRight size={22} />
              <div>
                <span>{activeFare.to}</span>
                <strong>09:15</strong>
              </div>
            </div>

            <div className="fare-box">
              <div>
                <span>{t.passengers}</span>
                <strong>{passengers}</strong>
              </div>
              <div>
                <span>{t.fare}</span>
                <strong>{activeFare.price} zł x {passengers}</strong>
              </div>
              <div>
                <span>{t.service}</span>
                <strong>2 zł</strong>
              </div>
              <div className="total">
                <span>{t.total}</span>
                <strong>{total} zł</strong>
              </div>
            </div>

            <a className="primary-button full" href="#tickets">
              {t.continue}
              <ArrowRight size={18} />
            </a>
          </aside>
        </div>
      </section>

      <TicketSystem
        activeFare={activeFare}
        passengers={passengers}
        setActiveFare={setActiveFare}
        setPassengers={setPassengers}
        t={t}
      />

      <section className="section stops-section" id="stops">
        <div className="section-heading narrow">
          <div>
            <p className="eyebrow">{t.stops}</p>
            <h2>{t.stopsLead}</h2>
          </div>
        </div>
        <div className="stops-layout">
          <div className="stop-map" aria-hidden="true">
            {stops.map((stop, index) => (
              <button
                className={[
                  "map-stop",
                  stop.type,
                  activeStop.id === stop.id ? "active" : "",
                ].join(" ")}
                key={stop.id}
                style={{ "--x": `${12 + index * 19}%`, "--y": `${64 - (index % 3) * 20}%` }}
                type="button"
                onClick={() => setActiveStop(stop)}
                aria-label={stop.title}
              >
                {stop.type === "airport" ? <Plane size={17} /> : <Bus size={17} />}
              </button>
            ))}
            <div className="map-road" />
          </div>
          <div className="stop-list">
            {stops.map((stop) => (
              <button
                className={activeStop.id === stop.id ? "stop-card active" : "stop-card"}
                key={stop.id}
                type="button"
                onClick={() => setActiveStop(stop)}
              >
                <MapPinned size={19} />
                <span>
                  <strong>{stop.title}</strong>
                  <small>{stop.meta}</small>
                </span>
              </button>
            ))}
          </div>
          <article className="stop-detail">
            <p className="eyebrow">{activeStop.type === "airport" ? "Airport" : "City"}</p>
            <h3>{activeStop.title}</h3>
            <strong>{activeStop.meta}</strong>
            <p>{activeStop.detail}</p>
            <a href="#tickets">
              {t.buy}
              <ChevronRight size={18} />
            </a>
          </article>
        </div>
      </section>

      <section className="service-band" id="passenger">
        <div className="service-inner">
          <article>
            <BriefcaseBusiness size={24} />
            <h2>{t.rental}</h2>
            <p>{t.rentalLead}</p>
          </article>
          <article>
            <ShieldCheck size={24} />
            <h2>{t.comfort}</h2>
            <p>{t.comfortLead}</p>
          </article>
          <article className="ticket-card">
            <QrCode size={84} />
            <div>
              <p className="eyebrow">{t.passenger}</p>
              <h3>{t.passengerLead}</h3>
              <div className="ticket-links">
                <a href="#tickets">{t.download}</a>
                <a href={regulationsUrl}>Regulamin</a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section reviews-contact" id="contact">
        <div>
          <p className="eyebrow">{t.reviews}</p>
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

        <aside className="contact-card">
          <p className="eyebrow">{t.hotline}</p>
          <h2>+48 607 66 90 80</h2>
          <div className="contact-row">
            <Clock3 size={19} />
            <span>{t.hours}</span>
          </div>
          <div className="contact-row">
            <Mail size={19} />
            <span>{t.email}</span>
          </div>
          <div className="contact-actions">
            <a className="primary-button" href="tel:+48607669080">
              <Phone size={18} />
              Zadzwoń
            </a>
            <a className="secondary-button" href="#tickets">
              <Ticket size={18} />
              {t.buy}
            </a>
          </div>
        </aside>
      </section>

      <footer className="footer">
        <span>Contbus Olszak Sp. J. - Lublin, ul. Bazylianówka 48D</span>
        <span>{t.footer}</span>
      </footer>
    </main>
  );
}

function TicketSystem({ activeFare, passengers, setActiveFare, setPassengers, t }) {
  const [step, setStep] = useState(1);
  const [selectedDeparture, setSelectedDeparture] = useState(0);
  const [buyer, setBuyer] = useState({
    name: "Jan Kowalski",
    email: "jan.kowalski@email.com",
    phone: "+48 600 000 000",
  });
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [downloadEmail, setDownloadEmail] = useState("");
  const bookingCode = "CB-" + activeFare.id.slice(0, 3).toUpperCase() + "-4827";
  const fee = 2;
  const total = activeFare.price * passengers + fee;
  const selectedTime = departureTimes[selectedDeparture];
  const arrivalHour = `${String((Number(selectedTime.slice(0, 2)) + 2) % 24).padStart(2, "0")}:${selectedTime.slice(3)}`;

  const updateBuyer = (field, value) => {
    setBuyer((current) => ({ ...current, [field]: value }));
  };

  return (
    <section className="ticket-system" id="tickets">
      <div className="ticket-system-inner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.ticketSystem}</p>
            <h2>{t.ticketSystemLead}</h2>
          </div>
          <a className="secondary-button" href={ticketUrl}>
            Stary system
            <ChevronRight size={18} />
          </a>
        </div>

        <div className="ticket-app">
          <aside className="ticket-sidebar">
            {[
              ["1", "Trasa"],
              ["2", "Kurs"],
              ["3", "Pasażer"],
              ["4", "Płatność"],
              ["5", "Bilet"],
            ].map(([number, label]) => (
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
              <p>
                Jeśli wiadomość z biletem nie dotrze, pasażer może pobrać bilet
                po adresie e-mail użytym przy zakupie.
              </p>
            </div>
          </aside>

          <div className="ticket-workspace">
            {step === 1 && (
              <div className="ticket-step">
                <div className="form-grid">
                  <label>
                    <span>Data podróży</span>
                    <input type="date" defaultValue="2026-07-18" />
                  </label>
                  <label>
                    <span>Trasa przejazdu</span>
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
                    <span>Liczba pasażerów</span>
                    <div className="stepper">
                      <button
                        type="button"
                        onClick={() => setPassengers((value) => Math.max(1, value - 1))}
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
                <button className="primary-button" type="button" onClick={() => setStep(2)}>
                  Pokaż kursy
                  <Search size={18} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="ticket-step">
                <div className="departure-grid">
                  {departureTimes.map((time, index) => (
                    <button
                      className={selectedDeparture === index ? "departure-card active" : "departure-card"}
                      key={time}
                      type="button"
                      onClick={() => setSelectedDeparture(index)}
                    >
                      <span>{time}</span>
                      <strong>{activeFare.from} - {activeFare.to}</strong>
                      <small>{14 - index} wolnych miejsc</small>
                    </button>
                  ))}
                </div>
                <button className="primary-button" type="button" onClick={() => setStep(3)}>
                  Wybierz ten kurs
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="ticket-step">
                <div className="form-grid">
                  <label>
                    <span>Imię i nazwisko</span>
                    <input
                      value={buyer.name}
                      onChange={(event) => updateBuyer("name", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>E-mail do biletu</span>
                    <input
                      type="email"
                      value={buyer.email}
                      onChange={(event) => updateBuyer("email", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Telefon</span>
                    <input
                      value={buyer.phone}
                      onChange={(event) => updateBuyer("phone", event.target.value)}
                    />
                  </label>
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" defaultChecked />
                  Akceptuję regulamin przewozu i warunki zakupu biletu online.
                </label>
                <button className="primary-button" type="button" onClick={() => setStep(4)}>
                  Przejdź do płatności
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="ticket-step">
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
                <div className="secure-box">
                  <ShieldCheck size={20} />
                  <span>To jest prototyp. Wersja produkcyjna podłączy operatora płatności i faktury.</span>
                </div>
                <button className="primary-button" type="button" onClick={() => setStep(5)}>
                  Zapłać {total} zł
                  <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step === 5 && (
              <div className="ticket-step ticket-confirmation">
                <div className="success-mark">
                  <Check size={28} />
                </div>
                <h3>Bilet gotowy</h3>
                <p>
                  Kod rezerwacji {bookingCode} został przypisany do adresu {buyer.email}.
                </p>
                <div className="download-panel">
                  <label>
                    <span>Pobierz ponownie po e-mailu</span>
                    <input
                      type="email"
                      placeholder="adres użyty przy zakupie"
                      value={downloadEmail}
                      onChange={(event) => setDownloadEmail(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button" type="button">
                    <Download size={18} />
                    Pobierz bilet
                  </button>
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
                <QrCode size={96} />
                <span>{passengers} pasażer / {activeFare.price} zł</span>
              </div>
            </div>
            <div className="fare-box">
              <div>
                <span>Trasa</span>
                <strong>{activeFare.from} - {activeFare.to}</strong>
              </div>
              <div>
                <span>Bilety</span>
                <strong>{activeFare.price} zł x {passengers}</strong>
              </div>
              <div>
                <span>Opłata online</span>
                <strong>{fee} zł</strong>
              </div>
              <div className="total">
                <span>Razem</span>
                <strong>{total} zł</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function CreditCardIcon({ method }) {
  if (method === "BLIK") return <Smartphone size={19} />;
  if (method === "Google Pay") return <Phone size={19} />;
  return <Ticket size={19} />;
}

function BookingSearch({ passengers, setPassengers, setActiveFare, t }) {
  const [from, setFrom] = useState("Lublin");
  const [to, setTo] = useState("Warszawa Marriott");

  const matchRoute = () => {
    const match = fares.find(
      (fare) =>
        fare.from.toLowerCase().includes(from.toLowerCase()) &&
        fare.to.toLowerCase().includes(to.toLowerCase()),
    );
    if (match) setActiveFare(match);
  };

  return (
    <form className="search-card" onSubmit={(event) => event.preventDefault()}>
      <div className="search-card-header">
        <Navigation size={20} />
        <h2>{t.searchTitle}</h2>
      </div>
      <label>
        <span>{t.from}</span>
        <select value={from} onChange={(event) => setFrom(event.target.value)}>
          <option>Lublin</option>
          <option>Lotnisko Chopina</option>
          <option>Warszawa Marriott</option>
          <option>Lotnisko Modlin</option>
        </select>
      </label>
      <label>
        <span>{t.to}</span>
        <select value={to} onChange={(event) => setTo(event.target.value)}>
          <option>Warszawa Marriott</option>
          <option>Lotnisko Chopina</option>
          <option>Lotnisko Modlin</option>
          <option>Lublin</option>
        </select>
      </label>
      <label>
        <span>{t.date}</span>
        <div className="input-shell">
          <CalendarDays size={18} />
          <input type="date" defaultValue="2026-07-18" />
        </div>
      </label>
      <label>
        <span>{t.passengers}</span>
        <div className="stepper">
          <button
            type="button"
            onClick={() => setPassengers((value) => Math.max(1, value - 1))}
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
      <button className="primary-button full" type="button" onClick={matchRoute}>
        <Search size={18} />
        {t.search}
      </button>
      <a className="inline-link" href="#tickets">
        <TimerReset size={16} />
        {t.download}
      </a>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
