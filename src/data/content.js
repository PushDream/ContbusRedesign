export const ticketUrl = "https://bilety.contbus.pl/KupBilet.aspx";
export const regulationsUrl = "https://bilety.contbus.pl/Regulamin.aspx";
export const remoteLogoUrl =
  "https://www.contbus.pl/wp-content/uploads/2022/07/contbus-1024x183-768x137-1.jpg";
export const logoUrl = "/contbus-logo.jpg";

export const fares = [
  {
    id: "lublin-warszawa",
    from: "Lublin",
    to: "Warszawa Marriott",
    price: 50,
    duration: "2h 35m",
    durationMinutes: 155,
    note: "bezpośrednio",
    stops: ["Dworcowa 2", "Al. Tysiąclecia", "Chałubińskiego"],
  },
  {
    id: "lublin-chopin",
    from: "Lublin",
    to: "Lotnisko Chopina",
    price: 60,
    duration: "2h 55m",
    durationMinutes: 175,
    note: "terminal autokarowy",
    stops: ["Dworcowa 2", "Al. Tysiąclecia", "Chopin stanowisko 6"],
  },
  {
    id: "lublin-modlin",
    from: "Lublin",
    to: "Lotnisko Modlin",
    price: 70,
    duration: "3h 35m",
    durationMinutes: 215,
    note: "pod terminalem",
    stops: ["Dworcowa 2", "Warszawa", "Modlin terminal"],
  },
  {
    id: "chopin-modlin",
    from: "Lotnisko Chopina",
    to: "Lotnisko Modlin",
    price: 50,
    duration: "55m",
    durationMinutes: 55,
    note: "transfer lotniskowy",
    stops: ["Chopin", "Warszawa Marriott", "Modlin"],
  },
];

export const stops = [
  {
    id: "lublin",
    type: "city",
    title: "Lublin, Dworzec Autobusowy",
    meta: "ul. Dworcowa 2, stanowisko 1",
    detail:
      "Przystanek początkowy dla kursów Contbus w kierunku Warszawy, Lotniska Chopina i Lotniska Modlin.",
    lat: 51.2367,
    lng: 22.5735,
  },
  {
    id: "tysiaclecia",
    type: "city",
    title: "Lublin, Al. Tysiąclecia",
    meta: "Muzeum Narodowe - Zamek 04",
    detail:
      "Wygodny punkt odbioru pasażerów przy centrum miasta, widoczny w oficjalnym cenniku przewoźnika.",
    lat: 51.2495,
    lng: 22.5681,
  },
  {
    id: "warszawa",
    type: "city",
    title: "Warszawa Marriott",
    meta: "ul. T. Chałubińskiego / Nowogrodzka",
    detail:
      "Przystanek w ścisłym centrum Warszawy, około 300 metrów od Warszawy Centralnej.",
    lat: 52.2286,
    lng: 21.008,
  },
  {
    id: "chopin",
    type: "airport",
    title: "Lotnisko Chopina",
    meta: "terminal autokarowy, stanowisko 6",
    detail:
      "Po wyjściu z hali przylotów pasażerowie kierują się w prawo; busy stoją około 200 metrów od terminala.",
    lat: 52.1672,
    lng: 20.9679,
  },
  {
    id: "modlin",
    type: "airport",
    title: "Lotnisko Modlin",
    meta: "bezpośrednio przed terminalem",
    detail:
      "Najprostszy odbiór i wysiadka dla podróży lotniczych z/do Nowego Dworu Mazowieckiego.",
    lat: 52.4511,
    lng: 20.6518,
  },
];

// Slices the master stop list (already ordered Lublin -> Modlin) down to the
// segment a given fare actually covers, matched by stop title.
export function getRouteStopsForFare(fare) {
  const matches = (label) =>
    stops.filter((stop) => stop.title === label || stop.title.startsWith(label));
  const startCandidates = matches(fare.from);
  const endCandidates = matches(fare.to);
  const startIndex = stops.indexOf(startCandidates[0]);
  const endIndex = stops.indexOf(endCandidates[endCandidates.length - 1]);
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  return stops.slice(from, to + 1);
}

export const testimonials = [
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

export const departureTimes = ["06:40", "08:15", "11:30", "14:10", "16:45", "19:20"];

export const paymentMethods = ["BLIK", "Karta płatnicza", "Przelew online", "Google Pay"];

export const extrasList = [
  { id: "luggage", price: 10 },
  { id: "insurance", price: 5 },
  { id: "priority", price: 3 },
];

export const promoCodes = {
  WELCOME10: 0.1,
  CONTBUS15: 0.15,
  STUDENT20: 0.2,
};

// Seeded pseudo-random so seat availability stays stable per fare/departure
export function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return function next() {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export function estimateArrival(departure) {
  const hour = (Number(departure.slice(0, 2)) + 2) % 24;
  return `${String(hour).padStart(2, "0")}:${departure.slice(3)}`;
}

export const SEAT_ROWS = 11;
export const SEAT_LAYOUT = ["A", "B", null, "C", "D"];

export function buildSeatMap(fareId, departureIndex) {
  const rng = seededRandom(hashString(`${fareId}-${departureIndex}`));
  const seats = [];
  for (let row = 1; row <= SEAT_ROWS; row += 1) {
    SEAT_LAYOUT.forEach((col) => {
      if (!col) return;
      const id = `${row}${col}`;
      const taken = rng() < 0.32;
      const premium = row === 1;
      seats.push({ id, row, col, taken, premium });
    });
  }
  return seats;
}

export const faqItems = {
  pl: [
    {
      q: "Jak wygląda odprawa na przystanku?",
      a: "Wystarczy pojawić się na przystanku 10 minut przed odjazdem i mieć bilet (papierowy, PDF lub QR na telefonie) gotowy do okazania kierowcy.",
    },
    {
      q: "Czy mogę zmienić lub anulować bilet?",
      a: "Tak, w sekcji \"Zarządzaj rezerwacją\" możesz wyszukać bilet po kodzie i adresie e-mail, a następnie go anulować lub poprosić o ponowną wysyłkę.",
    },
    {
      q: "Ile bagażu mogę zabrać?",
      a: "W cenie biletu jedna sztuka bagażu podręcznego. Dodatkową walizkę możesz dokupić jako dodatek podczas rezerwacji.",
    },
    {
      q: "Czy w busie jest klimatyzacja?",
      a: "Tak, wszystkie kursy Contbus obsługiwane są klimatyzowanymi pojazdami z rozkładanymi fotelami i trzypunktowymi pasami.",
    },
    {
      q: "Co jeśli nie dostanę biletu na e-mail?",
      a: "Skorzystaj z formularza pobierania biletu na końcu procesu zakupu lub w sekcji \"Zarządzaj rezerwacją\", podając adres e-mail użyty przy zakupie.",
    },
  ],
  en: [
    {
      q: "How does boarding work at the stop?",
      a: "Arrive at the stop 10 minutes before departure with your ticket ready to show the driver - paper, PDF or the QR code on your phone.",
    },
    {
      q: "Can I change or cancel my ticket?",
      a: "Yes, use \"Manage booking\" to look your ticket up by code and email, then cancel it or request it be resent.",
    },
    {
      q: "How much luggage can I bring?",
      a: "One carry-on bag is included in the fare. You can add an extra suitcase as a paid add-on during booking.",
    },
    {
      q: "Is there air conditioning on board?",
      a: "Yes, every Contbus departure runs on an air-conditioned vehicle with reclining seats and three-point belts.",
    },
    {
      q: "What if I don't receive my ticket by email?",
      a: "Use the ticket download form at the end of checkout, or the \"Manage booking\" section, with the email address used at purchase.",
    },
  ],
  ua: [
    {
      q: "Як відбувається посадка на зупинці?",
      a: "Прийдіть на зупинку за 10 хвилин до відправлення з квитком напоготові - паперовим, PDF або QR-кодом на телефоні.",
    },
    {
      q: "Чи можу я змінити або скасувати квиток?",
      a: "Так, у розділі \"Керування бронюванням\" знайдіть квиток за кодом і email, а потім скасуйте його або запросіть повторну відправку.",
    },
    {
      q: "Скільки багажу можна взяти?",
      a: "Одна ручна поклажа включена у вартість квитка. Додаткову валізу можна додати як платну опцію під час бронювання.",
    },
    {
      q: "Чи є у автобусі кондиціонер?",
      a: "Так, усі рейси Contbus обслуговуються автобусами з кондиціонером, розкладними сидіннями та триточковими ременями.",
    },
    {
      q: "Що робити, якщо квиток не прийшов на email?",
      a: "Скористайтесь формою завантаження квитка наприкінці оформлення або розділом \"Керування бронюванням\", вказавши email покупки.",
    },
  ],
};

export const copy = {
  pl: {
    code: "PL",
    label: "Polski",
    nav: ["Kup bilet", "Trasy", "Śledź kurs", "Przystanki", "Dla pasażera", "Kontakt"],
    heroKicker: "Lublin - Warszawa - Lotniska",
    heroTitle: "Contbus",
    heroLead:
      "Nowoczesna strona dla przewoźnika, który od ponad 15 lat obsługuje pasażerów na trasie Lublin - Warszawa oraz połączenia na Lotnisko Chopina i Lotnisko Modlin.",
    buy: "Kup bilet",
    download: "Pobierz bilet",
    searchTitle: "Znajdź przejazd",
    oneWay: "W jedną stronę",
    roundTrip: "W obie strony",
    from: "Skąd",
    to: "Dokąd",
    date: "Data podróży",
    returnDate: "Data powrotu",
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
    sortBy: "Sortuj",
    sortPrice: "Cena",
    sortTime: "Godzina",
    sortDuration: "Czas trwania",
    stops: "Przystanki",
    stopsLead:
      "Najważniejsze punkty odprawy pokazane w prostym, mobilnym układzie z instrukcjami dojścia.",
    passenger: "Dla pasażera",
    passengerLead: "Szybkie akcje, które powinny być widoczne bez szukania w menu.",
    hotline: "Infolinia",
    hours: "Poniedziałek - Niedziela, 09:00 - 17:00",
    email: "administrator@contbus.pl",
    comfort: "Komfort podróży",
    comfortLead:
      "Klimatyzowane wnętrza, rozkładane fotele, trzypunktowe pasy, monitoring oraz systemy ABS i ASR.",
    rental: "Wynajem busów",
    rentalLead:
      "Poza kursami rejsowymi Contbus oferuje przewozy krajowe dla firm, instytucji i klientów indywidualnych.",
    reviews: "Opinie pasażerów",
    footer: "Koncepcja redesignu przygotowana do prezentacji właścicielom Contbus.",
    ticketSystem: "Nowy system biletowy",
    ticketSystemLead:
      "Klikalny prototyp zakupu biletu: wybór daty i trasy, kursu, miejsca, dodatków, płatności oraz gotowy bilet QR.",
    stepRoute: "Trasa i kurs",
    stepPassenger: "Pasażer i płatność",
    stepTicket: "Bilet",
    optionalTag: "opcjonalnie",
    chooseSeat: "Wybierz miejsce",
    seatsSelected: "Wybrane miejsca",
    seatAvailable: "Wolne",
    seatTaken: "Zajęte",
    seatPremium: "Premium (+5 zł)",
    seatPicked: "Wybrane",
    driver: "Kierowca",
    extrasTitle: "Dodatki do podróży",
    extrasLead: "Dostosuj przejazd do swoich potrzeb - dodatki doliczymy do sumy.",
    extraLuggage: "Dodatkowa walizka",
    extraInsurance: "Ubezpieczenie podróży",
    extraPriority: "Priorytetowe wejście",
    promoTitle: "Kod rabatowy",
    promoPlaceholder: "np. WELCOME10",
    promoApply: "Zastosuj",
    promoApplied: "zastosowany",
    promoInvalid: "Nieprawidłowy kod rabatowy",
    discount: "Rabat",
    manageTitle: "Zarządzaj rezerwacją",
    manageLead: "Znajdź swój bilet po kodzie rezerwacji i adresie e-mail, aby go pobrać lub anulować.",
    manageCode: "Kod rezerwacji",
    manageEmail: "Adres e-mail",
    manageFind: "Znajdź bilet",
    manageNotFound: "Nie znaleziono rezerwacji o podanych danych.",
    manageFound: "Znaleziono rezerwację",
    manageStatusActive: "Potwierdzona",
    manageStatusCancelled: "Anulowana",
    manageCancel: "Anuluj bilet",
    manageResend: "Wyślij ponownie na e-mail",
    manageResent: "Bilet wysłany ponownie",
    manageCancelled: "Rezerwacja została anulowana.",
    trackerTitle: "Śledź swój kurs",
    trackerLead: "Podgląd na żywo pozycji autobusu na wybranej trasie.",
    trackerStatusBoarding: "Odprawa pasażerów",
    trackerStatusRoute: "W trasie",
    trackerStatusArrived: "Na miejscu",
    trackerEta: "Przyjazd za",
    trackerNext: "Następny przystanek",
    installTitle: "Zainstaluj aplikację Contbus",
    installLead:
      "Dodaj Contbus do ekranu głównego, aby kupować bilety i śledzić kursy jak w natywnej aplikacji, nawet offline.",
    installButton: "Zainstaluj",
    installDone: "Aplikacja zainstalowana",
    faqTitle: "Najczęstsze pytania",
    faqLead: "Odpowiedzi na pytania, które najczęściej zadają pasażerowie Contbus.",
    trustOnTime: "punktualności kursów",
    trustPassengers: "pasażerów rocznie",
    darkMode: "Tryb ciemny",
    lightMode: "Tryb jasny",
    navHome: "Start",
    navSearch: "Szukaj",
    navTickets: "Bilety",
    navAccount: "Rezerwacja",
    toastPromoApplied: "Kod rabatowy zastosowany",
    toastPromoInvalid: "Nieprawidłowy kod rabatowy",
    toastSeatMax: "Wybrano maksymalną liczbę miejsc dla tej rezerwacji",
    toastBookingReady: "Bilet gotowy do pobrania",
    toastCancelled: "Rezerwacja anulowana",
    toastResent: "Bilet wysłany ponownie na e-mail",
    skipToContent: "Przejdź do treści",
    airConLabel: "Klimatyzacja",
    airConCaption: "w każdym busie",
    yearsBadge: "15+ lat",
    routeCaption: "Lublin - Warszawa",
    airportsBadge: "2 lotniska",
    airportsCaption: "Chopin i Modlin",
    trustRouteCaption: "na trasie Lublin - Warszawa",
    regulationsLink: "Regulamin i cennik",
    regulationsShort: "Regulamin",
    oldSystemLink: "Stary system",
    callButton: "Zadzwoń",
    departureTimeLabel: "Godzina odjazdu",
    fieldRoute: "Trasa przejazdu",
    stepDepartureHeading: "Godziny odjazdu",
    fieldName: "Imię i nazwisko",
    fieldTicketEmail: "E-mail do biletu",
    fieldPhone: "Telefon",
    termsAgree: "Akceptuję regulamin przewozu i warunki zakupu biletu online.",
    portalNote:
      "Jeśli wiadomość z biletem nie dotrze, pasażer może pobrać bilet po adresie e-mail użytym przy zakupie.",
    prototypeNotice:
      "To jest prototyp. Wersja produkcyjna podłączy operatora płatności i faktury.",
    payButton: "Zapłać",
    ticketReadyTitle: "Bilet gotowy",
    ticketConfirmationText:
      "Kod rezerwacji {code} został przypisany do adresu {email}. Miejsca: {seats}.",
    resendEmailLabel: "Pobierz ponownie po e-mailu",
    resendPlaceholder: "adres użyty przy zakupie",
    fareRouteLabel: "Trasa",
    premiumSeatsLabel: "Miejsca premium",
    stopTypeAirport: "Lotnisko",
    stopTypeCity: "Miasto",
    menuLabel: "Menu",
    languageSwitcherLabel: "Przełącznik języka",
    tripTypeLabel: "Typ podróży",
    swapLabel: "Zamień miejsca wyjazdu i przyjazdu",
    mobileNavLabel: "Szybka nawigacja",
    factsLabel: "Informacje o Contbus",
    trustLabel: "Wskaźniki zaufania",
    passengerUnit: "pasażer",
    pdfFooter: "Okaż ten kod QR kierowcy przy wejściu do autobusu.",
    toastPdfReady: "Bilet PDF pobrany",
    downloadPdf: "Pobierz PDF",
    addToWallet: "Dodaj do Wallet",
    departureShort: "Odjazd",
    arrivalShort: "Przyjazd",
    walletNotice:
      "Zapis w Apple/Google Wallet wymaga podpisu po stronie serwera przewoźnika - niedostępne w tym prototypie.",
    routeMapTitle: "Mapa trasy",
    routeMapLead: "Zobacz przystanki i kurs autobusu na żywo na rzeczywistej mapie.",
    routeMapNextDeparture: "Najbliższy odjazd",
  },
  en: {
    code: "EN",
    label: "English",
    nav: ["Buy ticket", "Routes", "Track trip", "Stops", "Passenger", "Contact"],
    heroKicker: "Lublin - Warsaw - Airports",
    heroTitle: "Contbus",
    heroLead:
      "A modern website concept for a carrier serving Lublin - Warsaw and Chopin/Modlin airport routes for more than 15 years.",
    buy: "Buy ticket",
    download: "Download ticket",
    searchTitle: "Find a trip",
    oneWay: "One way",
    roundTrip: "Round trip",
    from: "From",
    to: "To",
    date: "Travel date",
    returnDate: "Return date",
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
    sortBy: "Sort by",
    sortPrice: "Price",
    sortTime: "Departure",
    sortDuration: "Duration",
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
      "Air-conditioned interiors, reclining seats, three-point belts, monitoring, ABS and ASR systems.",
    rental: "Private bus hire",
    rentalLead:
      "Alongside scheduled services, Contbus offers domestic transport for companies, institutions and individuals.",
    reviews: "Passenger reviews",
    footer: "Redesign concept prepared for a pitch to Contbus owners.",
    ticketSystem: "New ticket system",
    ticketSystemLead:
      "A clickable purchase prototype: date, route, departure, seat, add-ons, payment and a QR ticket.",
    stepRoute: "Route & departure",
    stepPassenger: "Passenger & payment",
    stepTicket: "Ticket",
    optionalTag: "optional",
    chooseSeat: "Choose your seat",
    seatsSelected: "Selected seats",
    seatAvailable: "Available",
    seatTaken: "Taken",
    seatPremium: "Premium (+5 zł)",
    seatPicked: "Selected",
    driver: "Driver",
    extrasTitle: "Trip add-ons",
    extrasLead: "Tailor the trip to your needs - add-ons are added to the total.",
    extraLuggage: "Extra suitcase",
    extraInsurance: "Travel insurance",
    extraPriority: "Priority boarding",
    promoTitle: "Promo code",
    promoPlaceholder: "e.g. WELCOME10",
    promoApply: "Apply",
    promoApplied: "applied",
    promoInvalid: "Invalid promo code",
    discount: "Discount",
    manageTitle: "Manage booking",
    manageLead: "Find your ticket by booking code and email to download or cancel it.",
    manageCode: "Booking code",
    manageEmail: "Email address",
    manageFind: "Find ticket",
    manageNotFound: "No booking found with these details.",
    manageFound: "Booking found",
    manageStatusActive: "Confirmed",
    manageStatusCancelled: "Cancelled",
    manageCancel: "Cancel ticket",
    manageResend: "Resend to email",
    manageResent: "Ticket resent",
    manageCancelled: "Booking has been cancelled.",
    trackerTitle: "Track your trip",
    trackerLead: "A live view of the bus position on the selected route.",
    trackerStatusBoarding: "Boarding passengers",
    trackerStatusRoute: "On route",
    trackerStatusArrived: "Arrived",
    trackerEta: "Arriving in",
    trackerNext: "Next stop",
    installTitle: "Install the Contbus app",
    installLead:
      "Add Contbus to your home screen to buy tickets and track trips like a native app, even offline.",
    installButton: "Install",
    installDone: "App installed",
    faqTitle: "Frequently asked questions",
    faqLead: "Answers to what Contbus passengers ask most often.",
    trustOnTime: "on-time departures",
    trustPassengers: "passengers a year",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    navHome: "Home",
    navSearch: "Search",
    navTickets: "Tickets",
    navAccount: "Booking",
    toastPromoApplied: "Promo code applied",
    toastPromoInvalid: "Invalid promo code",
    toastSeatMax: "You've selected the maximum seats for this booking",
    toastBookingReady: "Ticket ready to download",
    toastCancelled: "Booking cancelled",
    toastResent: "Ticket resent to your email",
    skipToContent: "Skip to content",
    airConLabel: "Air conditioning",
    airConCaption: "in every vehicle",
    yearsBadge: "15+ years",
    routeCaption: "Lublin - Warsaw",
    airportsBadge: "2 airports",
    airportsCaption: "Chopin & Modlin",
    trustRouteCaption: "on the Lublin - Warsaw route",
    regulationsLink: "Terms & price list",
    regulationsShort: "Terms",
    oldSystemLink: "Old system",
    callButton: "Call",
    departureTimeLabel: "Departure time",
    fieldRoute: "Selected route",
    stepDepartureHeading: "Departure times",
    fieldName: "Full name",
    fieldTicketEmail: "Ticket email",
    fieldPhone: "Phone",
    termsAgree: "I accept the carriage terms and the online ticket purchase conditions.",
    portalNote:
      "If the ticket email doesn't arrive, the passenger can download it using the email address used at purchase.",
    prototypeNotice:
      "This is a prototype. The production version will connect a real payment provider and invoicing.",
    payButton: "Pay",
    ticketReadyTitle: "Your ticket is ready",
    ticketConfirmationText: "Booking code {code} has been assigned to {email}. Seats: {seats}.",
    resendEmailLabel: "Resend to your email",
    resendPlaceholder: "the email used at purchase",
    fareRouteLabel: "Route",
    premiumSeatsLabel: "Premium seats",
    stopTypeAirport: "Airport",
    stopTypeCity: "City",
    menuLabel: "Menu",
    languageSwitcherLabel: "Language switcher",
    tripTypeLabel: "Trip type",
    swapLabel: "Swap origin and destination",
    mobileNavLabel: "Mobile quick navigation",
    factsLabel: "Contbus facts",
    trustLabel: "Trust indicators",
    passengerUnit: "passenger",
    pdfFooter: "Show this QR code to the driver when boarding.",
    toastPdfReady: "PDF ticket downloaded",
    downloadPdf: "Download PDF",
    addToWallet: "Add to Wallet",
    departureShort: "Departure",
    arrivalShort: "Arrival",
    walletNotice:
      "Apple/Google Wallet needs the carrier's server to sign the pass - not available in this prototype.",
    routeMapTitle: "Route map",
    routeMapLead: "See the stops and the live bus position on a real map.",
    routeMapNextDeparture: "Next departure",
  },
  ua: {
    code: "UA",
    label: "Українська",
    nav: ["Купити квиток", "Маршрути", "Стеження", "Зупинки", "Пасажирам", "Контакт"],
    heroKicker: "Люблін - Варшава - Аеропорти",
    heroTitle: "Contbus",
    heroLead:
      "Сучасна концепція сайту для перевізника, який понад 15 років обслуговує маршрут Люблін - Варшава та рейси до аеропортів Шопена і Модлін.",
    buy: "Купити квиток",
    download: "Завантажити квиток",
    searchTitle: "Знайти поїздку",
    oneWay: "В один бік",
    roundTrip: "Туди і назад",
    from: "Звідки",
    to: "Куди",
    date: "Дата подорожі",
    returnDate: "Дата повернення",
    passengers: "Пасажири",
    search: "Перевірити рейси",
    popular: "Популярні сполучення",
    choose: "Оберіть рейс",
    chooseLead:
      "Пізніше цей екран можна підключити до реального розкладу та наявності місць Contbus.",
    seatsLeft: "місць доступно",
    selected: "Обраний рейс",
    fare: "Базова ціна",
    service: "Онлайн-збір",
    total: "Разом",
    continue: "Перейти до купівлі",
    sortBy: "Сортувати",
    sortPrice: "Ціна",
    sortTime: "Час відправлення",
    sortDuration: "Тривалість",
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
      "Кондиціонер, розкладні сидіння, триточкові ремені, моніторинг, системи ABS та ASR.",
    rental: "Оренда автобусів",
    rentalLead:
      "Окрім регулярних рейсів, Contbus пропонує внутрішні перевезення для компаній, установ та приватних клієнтів.",
    reviews: "Відгуки пасажирів",
    footer: "Концепція редизайну для презентації власникам Contbus.",
    ticketSystem: "Нова система квитків",
    ticketSystemLead:
      "Клікабельний прототип купівлі: дата, маршрут, рейс, місце, додатки, оплата і QR-квиток.",
    stepRoute: "Маршрут і рейс",
    stepPassenger: "Пасажир і оплата",
    stepTicket: "Квиток",
    optionalTag: "опційно",
    chooseSeat: "Оберіть місце",
    seatsSelected: "Обрані місця",
    seatAvailable: "Вільно",
    seatTaken: "Зайнято",
    seatPremium: "Преміум (+5 zł)",
    seatPicked: "Обрано",
    driver: "Водій",
    extrasTitle: "Додатки до поїздки",
    extrasLead: "Налаштуйте поїздку під себе - додатки додаються до суми.",
    extraLuggage: "Додаткова валіза",
    extraInsurance: "Страхування подорожі",
    extraPriority: "Пріоритетна посадка",
    promoTitle: "Промокод",
    promoPlaceholder: "напр. WELCOME10",
    promoApply: "Застосувати",
    promoApplied: "застосовано",
    promoInvalid: "Недійсний промокод",
    discount: "Знижка",
    manageTitle: "Керування бронюванням",
    manageLead: "Знайдіть квиток за кодом бронювання та email, щоб завантажити або скасувати його.",
    manageCode: "Код бронювання",
    manageEmail: "Email-адреса",
    manageFind: "Знайти квиток",
    manageNotFound: "Бронювання з такими даними не знайдено.",
    manageFound: "Бронювання знайдено",
    manageStatusActive: "Підтверджено",
    manageStatusCancelled: "Скасовано",
    manageCancel: "Скасувати квиток",
    manageResend: "Надіслати повторно на email",
    manageResent: "Квиток надіслано повторно",
    manageCancelled: "Бронювання скасовано.",
    trackerTitle: "Стеження за рейсом",
    trackerLead: "Перегляд позиції автобуса на обраному маршруті в реальному часі.",
    trackerStatusBoarding: "Посадка пасажирів",
    trackerStatusRoute: "В дорозі",
    trackerStatusArrived: "Прибув",
    trackerEta: "Прибуття через",
    trackerNext: "Наступна зупинка",
    installTitle: "Встановіть застосунок Contbus",
    installLead:
      "Додайте Contbus на головний екран, щоб купувати квитки та стежити за рейсами як у нативному застосунку, навіть офлайн.",
    installButton: "Встановити",
    installDone: "Застосунок встановлено",
    faqTitle: "Часті запитання",
    faqLead: "Відповіді на запитання, які найчастіше ставлять пасажири Contbus.",
    trustOnTime: "рейсів вчасно",
    trustPassengers: "пасажирів на рік",
    darkMode: "Темна тема",
    lightMode: "Світла тема",
    navHome: "Головна",
    navSearch: "Пошук",
    navTickets: "Квитки",
    navAccount: "Бронювання",
    toastPromoApplied: "Промокод застосовано",
    toastPromoInvalid: "Недійсний промокод",
    toastSeatMax: "Обрано максимум місць для цього бронювання",
    toastBookingReady: "Квиток готовий до завантаження",
    toastCancelled: "Бронювання скасовано",
    toastResent: "Квиток повторно надіслано на email",
    skipToContent: "Перейти до вмісту",
    airConLabel: "Кондиціонер",
    airConCaption: "у кожному автобусі",
    yearsBadge: "15+ років",
    routeCaption: "Люблін - Варшава",
    airportsBadge: "2 аеропорти",
    airportsCaption: "Шопена і Модлін",
    trustRouteCaption: "на маршруті Люблін - Варшава",
    regulationsLink: "Правила та тарифи",
    regulationsShort: "Правила",
    oldSystemLink: "Стара система",
    callButton: "Подзвонити",
    departureTimeLabel: "Час відправлення",
    fieldRoute: "Обраний маршрут",
    stepDepartureHeading: "Час відправлення рейсів",
    fieldName: "Ім'я та прізвище",
    fieldTicketEmail: "Email для квитка",
    fieldPhone: "Телефон",
    termsAgree: "Я приймаю умови перевезення та умови купівлі квитка онлайн.",
    portalNote:
      "Якщо лист із квитком не прийде, пасажир може завантажити квиток за адресою email, вказаною при купівлі.",
    prototypeNotice:
      "Це прототип. Робоча версія підключить справжнього платіжного оператора та рахунки.",
    payButton: "Сплатити",
    ticketReadyTitle: "Квиток готовий",
    ticketConfirmationText: "Код бронювання {code} закріплено за адресою {email}. Місця: {seats}.",
    resendEmailLabel: "Отримати повторно на email",
    resendPlaceholder: "email, вказаний при купівлі",
    fareRouteLabel: "Маршрут",
    premiumSeatsLabel: "Преміум місця",
    stopTypeAirport: "Аеропорт",
    stopTypeCity: "Місто",
    menuLabel: "Меню",
    languageSwitcherLabel: "Перемикач мови",
    tripTypeLabel: "Тип поїздки",
    swapLabel: "Поміняти місцями пункти відправлення і прибуття",
    mobileNavLabel: "Швидка навігація",
    factsLabel: "Інформація про Contbus",
    trustLabel: "Показники довіри",
    passengerUnit: "пасажир",
    pdfFooter: "Покажіть цей QR-код водію під час посадки.",
    toastPdfReady: "PDF-квиток завантажено",
    downloadPdf: "Завантажити PDF",
    addToWallet: "Додати до Wallet",
    departureShort: "Відправлення",
    arrivalShort: "Прибуття",
    walletNotice:
      "Apple/Google Wallet потребує підпису на сервері перевізника - недоступно в цьому прототипі.",
    routeMapTitle: "Карта маршруту",
    routeMapLead: "Перегляньте зупинки та позицію автобуса на реальній мапі в реальному часі.",
    routeMapNextDeparture: "Найближче відправлення",
  },
};
