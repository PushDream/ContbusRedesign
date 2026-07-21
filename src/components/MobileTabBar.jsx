import { Home, Navigation2, Phone, Ticket } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function MobileTabBar({ t }) {
  return (
    <nav className="mobile-tab-bar" aria-label={t.mobileNavLabel}>
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : undefined)}>
        <Home size={20} />
        <span>{t.navHome}</span>
      </NavLink>
      <NavLink to="/results" className={({ isActive }) => (isActive ? "active" : undefined)}>
        <Navigation2 size={20} />
        <span>{t.navSearch}</span>
      </NavLink>
      <NavLink to="/moje-bilety" className={({ isActive }) => (isActive ? "active" : undefined)}>
        <Ticket size={20} />
        <span>{t.navTickets}</span>
      </NavLink>
      <NavLink to="/kontakt" className={({ isActive }) => (isActive ? "active" : undefined)}>
        <Phone size={20} />
        <span>{t.nav[5]}</span>
      </NavLink>
    </nav>
  );
}
