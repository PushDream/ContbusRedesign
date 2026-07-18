# Contbus Redesign

Polish-first Contbus website & installable web-app redesign, built with React and Vite.

## Features

- Polish, English, and Ukrainian language switcher
- Light/dark mode with saved preference
- Real Contbus route framing: Lublin, Warszawa Marriott, Lotnisko Chopina, Lotnisko Modlin
- One-way / round-trip search with origin-destination swap and sort (time/price/duration)
- Full 7-step ticket wizard: route → departure → **interactive seat map** → passenger details → **extras** (luggage, insurance, priority boarding) → payment with **promo codes** → **real scannable QR ticket**
- **Manage booking**: self-service lookup by code + email, cancel or resend a ticket
- **Live trip tracker**: gated behind a found booking (not public) — simulated real-time bus position, ETA and next stop
- Trust/social-proof band and FAQ accordion
- Passenger-first stop guide with an interactive map
- Installable as a PWA (manifest + service worker, offline app shell, "Add to Home Screen")
- Mobile app-style bottom tab bar, toast notifications, skip link and focus-visible states
- Fallback link to the existing `bilety.contbus.pl` portal for comparison during the pitch
- Fully responsive, accessible layout for desktop and mobile

## Project structure

```
src/
  data/content.js        route, stop, FAQ and translation data
  lib/                    ToastProvider, dark-mode hook
  components/             one component per section/feature
  App.jsx                 page composition
public/
  manifest.webmanifest, sw.js, icon.svg   PWA assets
```

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
