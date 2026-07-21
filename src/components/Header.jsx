import { Download, Languages, Menu, Moon, Sun, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { copy, logoUrl } from "../data/content.js";

export default function Header({
  language,
  setLanguage,
  mobileNav,
  setMobileNav,
  dark,
  setDark,
  canInstall,
  onInstall,
  t,
}) {
  const navLinks = [
    { to: "/", label: t.navHome, end: true },
    { to: "/results", label: t.nav[1] },
    { to: "/moje-bilety", label: t.quickNavMyTickets },
    { to: "/kontakt", label: t.nav[5] },
  ];

  return (
    <header className="topbar">
      <NavLink className="brand" to="/" aria-label="Contbus">
        <img src={logoUrl} alt="Contbus" />
      </NavLink>

      <button
        className="icon-button menu-button"
        aria-label={t.menuLabel}
        onClick={() => setMobileNav((open) => !open)}
        type="button"
      >
        {mobileNav ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav className={mobileNav ? "nav open" : "nav"}>
        {navLinks.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? "active" : undefined)}
            onClick={() => setMobileNav(false)}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="header-actions">
        {canInstall && (
          <button className="icon-button install-chip" onClick={onInstall} type="button">
            <Download size={16} />
            <span>{t.installButton}</span>
          </button>
        )}

        <button
          className="icon-button"
          aria-label={dark ? t.lightMode : t.darkMode}
          aria-pressed={dark}
          onClick={() => setDark((value) => !value)}
          type="button"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="language-switcher" aria-label={t.languageSwitcherLabel}>
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
      </div>
    </header>
  );
}
