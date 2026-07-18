import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Bell,
  Bus,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Gauge,
  Headphones,
  LocateFixed,
  MapPin,
  Menu,
  QrCode,
  Route,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  UsersRound,
  Wifi,
  X,
} from "lucide-react";
import "./styles.css";

const routes = [
  {
    id: "CBR-204",
    from: "Dallas",
    to: "Houston",
    depart: "07:10 AM",
    arrive: "11:25 AM",
    duration: "4h 15m",
    price: 34,
    bus: "Contbus Express",
    gate: "D4",
    seatsLeft: 9,
    rating: "4.8",
    features: ["WiFi", "Power", "Restroom"],
    stops: ["Corsicana", "Madisonville"],
  },
  {
    id: "CBR-118",
    from: "Austin",
    to: "San Antonio",
    depart: "09:45 AM",
    arrive: "11:20 AM",
    duration: "1h 35m",
    price: 18,
    bus: "Rapid Shuttle",
    gate: "A2",
    seatsLeft: 14,
    rating: "4.7",
    features: ["WiFi", "Bike rack"],
    stops: ["San Marcos"],
  },
  {
    id: "CBR-652",
    from: "Atlanta",
    to: "Charlotte",
    depart: "01:30 PM",
    arrive: "06:55 PM",
    duration: "5h 25m",
    price: 42,
    bus: "Nightline Coach",
    gate: "B7",
    seatsLeft: 6,
    rating: "4.9",
    features: ["WiFi", "Power", "Recliners"],
    stops: ["Greenville"],
  },
];

const seats = Array.from({ length: 32 }, (_, index) => {
  const reserved = [2, 5, 6, 12, 19, 25, 26, 31].includes(index + 1);
  return { id: index + 1, reserved };
});

const operations = [
  { label: "On-time departures", value: "94%", detail: "+3.2% today" },
  { label: "Active buses", value: "128", detail: "18 routes live" },
  { label: "Boarding issues", value: "7", detail: "2 need review" },
  { label: "Refund queue", value: "19", detail: "avg 11 min" },
];

function App() {
  const [activeTrip, setActiveTrip] = useState(routes[0]);
  const [selectedSeats, setSelectedSeats] = useState([8, 9]);
  const [mobileNav, setMobileNav] = useState(false);

  const total = useMemo(
    () => activeTrip.price * selectedSeats.length + 5.5,
    [activeTrip, selectedSeats.length],
  );

  const toggleSeat = (seat) => {
    if (seat.reserved) return;
    setSelectedSeats((current) =>
      current.includes(seat.id)
        ? current.filter((id) => id !== seat.id)
        : [...current, seat.id],
    );
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#search" aria-label="ContbusRedesign home">
          <span className="brand-mark">
            <Bus size={22} />
          </span>
          <span>ContbusRedesign</span>
        </a>
        <button
          className="icon-button menu-button"
          aria-label="Toggle navigation"
          onClick={() => setMobileNav((open) => !open)}
        >
          {mobileNav ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={mobileNav ? "nav open" : "nav"}>
          <a href="#booking">Book</a>
          <a href="#tickets">Tickets</a>
          <a href="#track">Track</a>
          <a href="#support">Support</a>
          <a href="#ops">Operations</a>
        </nav>
        <button className="account-button">
          <UserRound size={18} />
          Account
        </button>
      </header>

      <section className="hero" id="search">
        <div className="hero-media" aria-hidden="true">
          <div className="road">
            <span />
            <span />
            <span />
          </div>
          <div className="bus-illustration">
            <div className="bus-window" />
            <div className="bus-window" />
            <div className="bus-window" />
            <div className="bus-door" />
            <div className="wheel left" />
            <div className="wheel right" />
          </div>
        </div>
        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">Intercity travel platform</p>
            <h1>Book, board, and manage every Contbus trip in one place.</h1>
            <p>
              Search live routes, compare fares, select seats, save tickets,
              track buses, and manage trip changes through one responsive app.
            </p>
          </div>
          <BookingSearch />
        </div>
      </section>

      <section className="section route-strip" aria-label="Popular routes">
        {[
          ["New York", "Boston", "$24"],
          ["Phoenix", "Las Vegas", "$31"],
          ["Chicago", "Detroit", "$28"],
          ["Miami", "Orlando", "$22"],
        ].map(([from, to, price]) => (
          <button className="route-chip" key={`${from}-${to}`}>
            <MapPin size={16} />
            <span>
              {from} to {to}
            </span>
            <strong>{price}</strong>
          </button>
        ))}
      </section>

      <section className="section split" id="booking">
        <div>
          <p className="eyebrow">Choose a departure</p>
          <h2>Fast booking flow with clear fare details.</h2>
          <div className="trip-list">
            {routes.map((route) => (
              <button
                className={activeTrip.id === route.id ? "trip-card active" : "trip-card"}
                key={route.id}
                onClick={() => setActiveTrip(route)}
              >
                <div className="trip-time">
                  <strong>{route.depart}</strong>
                  <span>{route.from}</span>
                </div>
                <div className="trip-path">
                  <span />
                  <Route size={18} />
                  <span />
                </div>
                <div className="trip-time">
                  <strong>{route.arrive}</strong>
                  <span>{route.to}</span>
                </div>
                <div className="trip-meta">
                  <span>{route.duration}</span>
                  <span>{route.bus}</span>
                  <span>{route.seatsLeft} left</span>
                </div>
                <div className="trip-price">
                  <span>from</span>
                  <strong>${route.price}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="booking-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Seat selection</p>
              <h3>{activeTrip.id}</h3>
            </div>
            <span className="status">Gate {activeTrip.gate}</span>
          </div>
          <div className="seat-map">
            {seats.map((seat) => (
              <button
                key={seat.id}
                className={[
                  "seat",
                  seat.reserved ? "reserved" : "",
                  selectedSeats.includes(seat.id) ? "selected" : "",
                ].join(" ")}
                onClick={() => toggleSeat(seat)}
                aria-label={`Seat ${seat.id}`}
              >
                {seat.id}
              </button>
            ))}
          </div>
          <div className="legend">
            <span><i className="available" /> Available</span>
            <span><i className="selected" /> Selected</span>
            <span><i className="reserved" /> Reserved</span>
          </div>
          <div className="fare-box">
            <div>
              <span>Seats</span>
              <strong>{selectedSeats.join(", ") || "None"}</strong>
            </div>
            <div>
              <span>Fare</span>
              <strong>${activeTrip.price} x {selectedSeats.length}</strong>
            </div>
            <div>
              <span>Service fee</span>
              <strong>$5.50</strong>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>${total.toFixed(2)}</strong>
            </div>
          </div>
          <button className="primary-button">
            Continue to payment
            <ArrowRight size={18} />
          </button>
        </aside>
      </section>

      <section className="section workflow">
        {[
          [Search, "Search routes", "Live city pairs, flexible dates, passengers, and promo fares."],
          [Ticket, "Reserve seats", "Accessible seat map, baggage options, add-ons, and fare rules."],
          [CreditCard, "Pay securely", "Saved cards, wallets, split payments, refunds, and receipts."],
          [QrCode, "Board faster", "Mobile tickets, QR validation, gate alerts, and trip reminders."],
        ].map(([Icon, title, body]) => (
          <article className="feature-card" key={title}>
            <Icon size={22} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="section dashboard-grid">
        <TicketWallet />
        <TripTracker />
      </section>

      <section className="section account-support" id="support">
        <article>
          <p className="eyebrow">Account</p>
          <h2>Traveler profile, rewards, and saved preferences.</h2>
          <div className="account-list">
            {[
              ["Rewards balance", "1,840 points", ShieldCheck],
              ["Saved payment", "Visa ending 2048", CreditCard],
              ["Trip alerts", "SMS and email active", Bell],
              ["Support cases", "1 open conversation", Headphones],
            ].map(([label, value, Icon]) => (
              <div className="account-row" key={label}>
                <Icon size={20} />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="support-panel">
          <p className="eyebrow">Self service</p>
          <h3>Manage changes without calling support.</h3>
          <button>Change departure <ChevronRight size={18} /></button>
          <button>Cancel or refund <ChevronRight size={18} /></button>
          <button>Add baggage <ChevronRight size={18} /></button>
          <button>Contact live support <ChevronRight size={18} /></button>
        </article>
      </section>

      <section className="section ops" id="ops">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operations console</p>
            <h2>Tools for dispatch, boarding, and service recovery.</h2>
          </div>
          <button className="secondary-button">
            <Gauge size={18} />
            View dispatch
          </button>
        </div>
        <div className="ops-grid">
          {operations.map((item) => (
            <article className="metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
        <div className="ops-table" role="table" aria-label="Boarding monitor">
          <div role="row">
            <strong>Route</strong>
            <strong>Status</strong>
            <strong>Occupancy</strong>
            <strong>Action</strong>
          </div>
          {[
            ["CBR-204", "Boarding", "78%", "Scan queue"],
            ["CBR-118", "On time", "62%", "Assign gate"],
            ["CBR-652", "Delayed 12m", "91%", "Notify riders"],
          ].map((row) => (
            <div role="row" key={row[0]}>
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function BookingSearch() {
  return (
    <form className="search-card">
      <label>
        <span>From</span>
        <div>
          <MapPin size={18} />
          <input defaultValue="Dallas" />
        </div>
      </label>
      <label>
        <span>To</span>
        <div>
          <LocateFixed size={18} />
          <input defaultValue="Houston" />
        </div>
      </label>
      <label>
        <span>Date</span>
        <div>
          <CalendarDays size={18} />
          <input type="date" defaultValue="2026-08-02" />
        </div>
      </label>
      <label>
        <span>Passengers</span>
        <div>
          <UsersRound size={18} />
          <input type="number" min="1" defaultValue="2" />
        </div>
      </label>
      <button type="button" className="primary-button">
        Search trips
        <Search size={18} />
      </button>
    </form>
  );
}

function TicketWallet() {
  return (
    <article className="ticket-wallet" id="tickets">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ticket wallet</p>
          <h2>Upcoming trip</h2>
        </div>
        <span className="status confirmed">
          <Check size={14} />
          Confirmed
        </span>
      </div>
      <div className="ticket-body">
        <div>
          <span>Dallas</span>
          <strong>07:10 AM</strong>
        </div>
        <ArrowRight size={24} />
        <div>
          <span>Houston</span>
          <strong>11:25 AM</strong>
        </div>
      </div>
      <div className="qr-block">
        <QrCode size={78} />
        <div>
          <strong>Seat 8A, 8B</strong>
          <span>Board at Gate D4 by 06:55 AM</span>
        </div>
      </div>
      <div className="ticket-actions">
        <button>Download</button>
        <button>Share</button>
        <button>Refund rules</button>
      </div>
    </article>
  );
}

function TripTracker() {
  return (
    <article className="tracker" id="track">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Live tracking</p>
          <h2>Bus CBR-204</h2>
        </div>
        <span className="status">On schedule</span>
      </div>
      <div className="map">
        <div className="route-line" />
        <span className="pin start">DAL</span>
        <span className="pin current">
          <Bus size={18} />
        </span>
        <span className="pin end">HOU</span>
      </div>
      <div className="tracker-details">
        <div>
          <Clock3 size={18} />
          <span>Next stop</span>
          <strong>Corsicana in 34 min</strong>
        </div>
        <div>
          <Wifi size={18} />
          <span>Amenities</span>
          <strong>WiFi, power, restroom</strong>
        </div>
        <div>
          <CircleDollarSign size={18} />
          <span>Change fee</span>
          <strong>No fee before boarding</strong>
        </div>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
