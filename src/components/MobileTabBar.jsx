import React from "react";
import { Home, Navigation2, Ticket, UserRound } from "lucide-react";

export default function MobileTabBar({ t }) {
  return (
    <nav className="mobile-tab-bar" aria-label={t.mobileNavLabel}>
      <a href="#home">
        <Home size={20} />
        <span>{t.navHome}</span>
      </a>
      <a href="#routes">
        <Navigation2 size={20} />
        <span>{t.navSearch}</span>
      </a>
      <a href="#tickets">
        <Ticket size={20} />
        <span>{t.navTickets}</span>
      </a>
      <a href="#manage">
        <UserRound size={20} />
        <span>{t.navAccount}</span>
      </a>
    </nav>
  );
}
