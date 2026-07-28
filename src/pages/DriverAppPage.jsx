import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  MessageSquare,
  QrCode,
  Radio,
  ScanLine,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { useToast } from "../lib/ToastProvider.jsx";

const driverTrips = [
  {
    id: "CB-0640-WAW",
    route: "Lublin - Warszawa Marriott",
    vehicle: "Mercedes Sprinter 22",
    plate: "LU 8429C",
    driver: "Marek Nowak",
    departure: "06:40",
    arrival: "09:15",
    platform: "Peron 3",
    stops: [
      { title: "Lublin, Dworcowa 2", time: "06:40", board: 14, drop: 0 },
      { title: "Lublin, Al. Tysiaclecia", time: "06:48", board: 4, drop: 0 },
      { title: "Warszawa Marriott", time: "09:15", board: 0, drop: 18 },
    ],
    passengers: [
      { id: "p1", code: "CB-3ZZTLH", name: "Jan Kowalski", seat: "2A", stop: "Dworcowa 2", luggage: "1 bagaz" },
      { id: "p2", code: "CB-7LQ8PP", name: "Anna Zielinska", seat: "2B", stop: "Dworcowa 2", luggage: "2 bagaze" },
      { id: "p3", code: "CB-2HKS90", name: "Piotr Malec", seat: "4C", stop: "Al. Tysiaclecia", luggage: "bez bagazu" },
      { id: "p4", code: "CB-91AD2K", name: "Oksana Shevchenko", seat: "7D", stop: "Dworcowa 2", luggage: "1 bagaz" },
      { id: "p5", code: "CB-1MM8TR", name: "Karolina Wrona", seat: "9A", stop: "Al. Tysiaclecia", luggage: "1 bagaz" },
    ],
  },
  {
    id: "CB-0815-CHP",
    route: "Lublin - Lotnisko Chopina",
    vehicle: "Iveco Daily 19",
    plate: "LU 3108K",
    driver: "Marek Nowak",
    departure: "08:15",
    arrival: "11:10",
    platform: "Peron 5",
    stops: [
      { title: "Lublin, Dworcowa 2", time: "08:15", board: 9, drop: 0 },
      { title: "Lublin, Al. Tysiaclecia", time: "08:23", board: 3, drop: 0 },
      { title: "Lotnisko Chopina, stanowisko 6", time: "11:10", board: 0, drop: 12 },
    ],
    passengers: [
      { id: "p6", code: "CB-AIR712", name: "Tomasz Sarafin", seat: "1A", stop: "Dworcowa 2", luggage: "2 bagaze" },
      { id: "p7", code: "CB-AIR144", name: "Marta Rybak", seat: "1B", stop: "Dworcowa 2", luggage: "1 bagaz" },
      { id: "p8", code: "CB-AIR520", name: "Oleksii Bondar", seat: "3C", stop: "Al. Tysiaclecia", luggage: "2 bagaze" },
      { id: "p9", code: "CB-AIR831", name: "Ewa Mazur", seat: "5D", stop: "Dworcowa 2", luggage: "1 bagaz" },
    ],
  },
  {
    id: "CB-1130-MOD",
    route: "Lublin - Lotnisko Modlin",
    vehicle: "Mercedes Sprinter 22",
    plate: "LU 7742S",
    driver: "Marek Nowak",
    departure: "11:30",
    arrival: "15:05",
    platform: null,
    stops: [
      { title: "Lublin, Dworcowa 2", time: "11:30", board: 11, drop: 0 },
      { title: "Warszawa Marriott", time: "14:05", board: 2, drop: 5 },
      { title: "Lotnisko Modlin", time: "15:05", board: 0, drop: 8 },
    ],
    passengers: [
      { id: "p10", code: "CB-MOD102", name: "Michal Sowa", seat: "2C", stop: "Dworcowa 2", luggage: "1 bagaz" },
      { id: "p11", code: "CB-MOD615", name: "Julia Kaminska", seat: "3A", stop: "Dworcowa 2", luggage: "2 bagaze" },
      { id: "p12", code: "CB-MOD771", name: "Robert Wilk", seat: "6D", stop: "Warszawa Marriott", luggage: "bez bagazu" },
    ],
  },
];

const statusLabels = {
  preparing: "Przygotowanie",
  boarding: "Odprawa",
  departed: "W trasie",
  delayed: "Opozniony",
  arrived: "Zakonczony",
};

export default function DriverAppPage() {
  const notify = useToast();
  const [selectedTripId, setSelectedTripId] = useState(driverTrips[0].id);
  const [checkedByTrip, setCheckedByTrip] = useState({});
  const [statusByTrip, setStatusByTrip] = useState({
    [driverTrips[0].id]: "boarding",
    [driverTrips[1].id]: "preparing",
    [driverTrips[2].id]: "preparing",
  });
  const [stopByTrip, setStopByTrip] = useState({});
  const [scanCode, setScanCode] = useState("CB-3ZZTLH");
  const [incident, setIncident] = useState("");

  const selectedTrip = driverTrips.find((trip) => trip.id === selectedTripId) || driverTrips[0];
  const checkedIds = useMemo(
    () => checkedByTrip[selectedTrip.id] || [],
    [checkedByTrip, selectedTrip.id],
  );
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const activeStop = stopByTrip[selectedTrip.id] || 0;
  const status = statusByTrip[selectedTrip.id] || "preparing";
  const checkedCount = checkedIds.length;
  const passengerCount = selectedTrip.passengers.length;
  const completion = Math.round((checkedCount / passengerCount) * 100);

  const setTripStatus = (nextStatus) => {
    setStatusByTrip((current) => ({ ...current, [selectedTrip.id]: nextStatus }));
  };

  const togglePassenger = (passengerId) => {
    setCheckedByTrip((current) => {
      const currentIds = current[selectedTrip.id] || [];
      const nextIds = currentIds.includes(passengerId)
        ? currentIds.filter((id) => id !== passengerId)
        : [...currentIds, passengerId];
      return { ...current, [selectedTrip.id]: nextIds };
    });
  };

  const handleScan = (event) => {
    event.preventDefault();
    const normalized = scanCode.trim().toUpperCase();
    const match = selectedTrip.passengers.find((passenger) => passenger.code === normalized);

    if (!match) {
      notify("Nie znaleziono biletu na tym kursie.", "error");
      return;
    }

    if (!checkedSet.has(match.id)) {
      togglePassenger(match.id);
    }
    notify(`${match.name} odprawiony.`, "success");
  };

  const advanceStop = () => {
    setStopByTrip((current) => ({
      ...current,
      [selectedTrip.id]: Math.min(activeStop + 1, selectedTrip.stops.length - 1),
    }));
  };

  const saveIncident = () => {
    if (!incident.trim()) {
      notify("Dodaj krotka notatke przed zapisaniem.", "info");
      return;
    }
    notify("Notatka operacyjna zapisana lokalnie.", "success");
    setIncident("");
  };

  return (
    <div className="driver-shell">
      <section className="driver-hero">
        <div>
          <p className="eyebrow">Contbus Operations</p>
          <h1>Aplikacja kierowcy</h1>
          <p>
            Jedno miejsce do odprawy pasazerow, kontroli trasy i raportowania statusu kursu.
          </p>
        </div>

        <div className="driver-status-panel" aria-label="Status pracy">
          <div>
            <span>Dzisiaj</span>
            <strong>3 kursy</strong>
          </div>
          <div>
            <span>Kierowca</span>
            <strong>{selectedTrip.driver}</strong>
          </div>
          <div>
            <span>Synchronizacja</span>
            <strong>Online</strong>
          </div>
        </div>
      </section>

      <section className="driver-grid" aria-label="Panel kierowcy">
        <aside className="driver-trips" aria-label="Dzisiejsze kursy">
          <div className="driver-panel-heading">
            <ClipboardList size={18} />
            <h2>Dzisiejsze kursy</h2>
          </div>

          {driverTrips.map((trip) => {
            const tripStatus = statusByTrip[trip.id] || "preparing";
            const tripChecks = checkedByTrip[trip.id]?.length || 0;
            return (
              <button
                className={trip.id === selectedTrip.id ? "driver-trip active" : "driver-trip"}
                key={trip.id}
                onClick={() => setSelectedTripId(trip.id)}
                type="button"
              >
                <span className={`driver-status-dot ${tripStatus}`} />
                <span>
                  <strong>{trip.departure}</strong>
                  {trip.route}
                </span>
                <small>
                  {tripChecks}/{trip.passengers.length}
                </small>
              </button>
            );
          })}
        </aside>

        <div className="driver-main">
          <section className="driver-trip-header">
            <div>
              <p className="eyebrow">{selectedTrip.id}</p>
              <h2>{selectedTrip.route}</h2>
              <div className="driver-meta-row">
                <span>
                  <Bus size={16} />
                  {selectedTrip.vehicle}
                </span>
                <span>{selectedTrip.plate}</span>
                {selectedTrip.platform && <span>{selectedTrip.platform}</span>}
              </div>
            </div>
            <div className="driver-trip-clock">
              <Clock size={18} />
              <strong>{selectedTrip.departure}</strong>
              <span>{selectedTrip.arrival}</span>
            </div>
          </section>

          <section className="driver-metrics" aria-label="Podsumowanie kursu">
            <article>
              <UserCheck size={18} />
              <span>Odprawieni</span>
              <strong>
                {checkedCount}/{passengerCount}
              </strong>
            </article>
            <article>
              <ShieldCheck size={18} />
              <span>Status</span>
              <strong>{statusLabels[status]}</strong>
            </article>
            <article>
              <MapPin size={18} />
              <span>Aktualny przystanek</span>
              <strong>{selectedTrip.stops[activeStop].title}</strong>
            </article>
          </section>

          <section className="driver-workspace">
            <div className="driver-board">
              <div className="driver-panel-heading">
                <ScanLine size={18} />
                <h2>Odprawa biletow</h2>
              </div>

              <form className="driver-scan" onSubmit={handleScan}>
                <label>
                  <span>Kod biletu</span>
                  <input
                    value={scanCode}
                    onChange={(event) => setScanCode(event.target.value)}
                    placeholder="CB-..."
                  />
                </label>
                <button className="primary-button" type="submit">
                  <QrCode size={18} />
                  Sprawdz
                </button>
              </form>

              <div className="driver-progress" aria-label={`Odprawa ${completion}%`}>
                <span style={{ width: `${completion}%` }} />
              </div>

              <div className="driver-manifest">
                {selectedTrip.passengers.map((passenger) => {
                  const checked = checkedSet.has(passenger.id);
                  return (
                    <article className={checked ? "manifest-row checked" : "manifest-row"} key={passenger.id}>
                      <button
                        aria-label={checked ? `Cofnij odprawe ${passenger.name}` : `Odpraw ${passenger.name}`}
                        className="manifest-check"
                        onClick={() => togglePassenger(passenger.id)}
                        type="button"
                      >
                        {checked ? <CheckCircle2 size={20} /> : <UserX size={20} />}
                      </button>
                      <div>
                        <strong>{passenger.name}</strong>
                        <span>
                          {passenger.code} - miejsce {passenger.seat} - {passenger.stop}
                        </span>
                      </div>
                      <small>{passenger.luggage}</small>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="driver-controls">
              <div className="driver-panel-heading">
                <Radio size={18} />
                <h2>Kontrola kursu</h2>
              </div>

              <div className="driver-control-buttons">
                <button className="secondary-button" onClick={() => setTripStatus("boarding")} type="button">
                  Odprawa
                </button>
                <button className="secondary-button" onClick={() => setTripStatus("departed")} type="button">
                  Wyjazd
                </button>
                <button className="secondary-button" onClick={() => setTripStatus("delayed")} type="button">
                  Opoznienie
                </button>
                <button className="secondary-button" onClick={() => setTripStatus("arrived")} type="button">
                  Przyjazd
                </button>
              </div>

              <div className="driver-stop-list">
                {selectedTrip.stops.map((stop, index) => (
                  <div className={index === activeStop ? "driver-stop active" : "driver-stop"} key={stop.title}>
                    <strong>{stop.time}</strong>
                    <span>{stop.title}</span>
                    <small>
                      +{stop.board} / -{stop.drop}
                    </small>
                  </div>
                ))}
              </div>

              <button
                className="primary-button full"
                disabled={activeStop === selectedTrip.stops.length - 1}
                onClick={advanceStop}
                type="button"
              >
                <MapPin size={18} />
                Nastepny przystanek
              </button>

              <div className="driver-incident">
                <label>
                  <span>
                    <MessageSquare size={16} />
                    Notatka / incydent
                  </span>
                  <textarea
                    value={incident}
                    onChange={(event) => setIncident(event.target.value)}
                    placeholder="Np. korek, opoznienie, dodatkowy bagaz..."
                    rows={4}
                  />
                </label>
                <button className="secondary-button full" onClick={saveIncident} type="button">
                  <AlertTriangle size={18} />
                  Zapisz notatke
                </button>
              </div>
            </aside>
          </section>
        </div>
      </section>
    </div>
  );
}
