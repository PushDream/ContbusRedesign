import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { logoUrl } from "../data/content.js";

const LANGUAGE_OPTIONS = [
  { key: "pl", flag: "🇵🇱", label: "Polski" },
  { key: "en", flag: "🇬🇧", label: "English" },
];

export default function Header({
  language,
  setLanguage,
  mobileNav,
  setMobileNav,
  dark,
  setDark,
  t,
}) {
  const navLinks = [
    { to: "/", label: t.navHome, end: true },
    { to: "/results", label: t.nav[1] },
    { to: "/moje-bilety", label: t.quickNavMyTickets },
    { to: "/konto", label: t.customerAccountNav },
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
        <button
          className="icon-button"
          aria-label={dark ? t.lightMode : t.darkMode}
          aria-pressed={dark}
          onClick={() => setDark((value) => !value)}
          type="button"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="language-switcher">
          <Languages size={16} />
          <select
            aria-label={t.languageSwitcherLabel}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGE_OPTIONS.map(({ key, flag, label }) => (
              <option key={key} value={key}>
                {flag} {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
