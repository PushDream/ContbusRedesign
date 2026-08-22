import { useEffect, useRef } from "react";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { logoUrl } from "../data/content.js";
import { useAuth } from "../context/AuthContext.jsx";

const LANGUAGE_OPTIONS = [
  { key: "pl", flag: "🇵🇱", label: "Polski" },
  { key: "en", flag: "🇬🇧", label: "English" },
  { key: "ua", flag: "🇺🇦", label: "Українська" },
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
  const { profile } = useAuth();
  const headerRef = useRef(null);

  useEffect(() => {
    if (!mobileNav) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMobileNav(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [mobileNav, setMobileNav]);

  const navLinks = [
    { to: "/", label: t.navHome, end: true },
    { to: "/results", label: t.nav[1] },
    { to: "/moje-bilety", label: t.quickNavMyTickets },
    { to: "/konto", label: t.customerAccountNav },
    ...(["driver", "dispatcher", "admin"].includes(profile?.role)
      ? [{ to: "/driver", label: language === "pl" ? "Kierowca" : language === "ua" ? "Водій" : "Driver" }]
      : []),
    { to: "/kontakt", label: t.nav[5] },
  ];

  return (
    <header className="topbar" ref={headerRef}>
      <NavLink className="brand" to="/" aria-label="Contbus">
        <img src={logoUrl} alt="Contbus" width={166} height={30} />
      </NavLink>

      <button
        className="icon-button menu-button"
        aria-label={t.menuLabel}
        aria-expanded={mobileNav}
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
