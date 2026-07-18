import React from "react";
import { Download, Languages, Menu, Moon, Sun, X } from "lucide-react";
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
  return (
    <header className="topbar">
      <a className="brand" href="#home" aria-label="Contbus">
        <img src={logoUrl} alt="Contbus" />
      </a>

      <button
        className="icon-button menu-button"
        aria-label={t.menuLabel}
        onClick={() => setMobileNav((open) => !open)}
        type="button"
      >
        {mobileNav ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav className={mobileNav ? "nav open" : "nav"}>
        <a href="#tickets" onClick={() => setMobileNav(false)}>
          {t.nav[0]}
        </a>
        <a href="#routes" onClick={() => setMobileNav(false)}>
          {t.nav[1]}
        </a>
        <a href="#manage" onClick={() => setMobileNav(false)}>
          {t.nav[2]}
        </a>
        <a href="#stops" onClick={() => setMobileNav(false)}>
          {t.nav[3]}
        </a>
        <a href="#passenger" onClick={() => setMobileNav(false)}>
          {t.nav[4]}
        </a>
        <a href="#contact" onClick={() => setMobileNav(false)}>
          {t.nav[5]}
        </a>
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
