import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import MobileTabBar from "./components/MobileTabBar.jsx";

export default function Layout() {
  const { dark, setDark, language, setLanguage, t } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  const skipTarget = `${location.pathname}${location.search}#main-content`;

  return (
    <>
      <a className="skip-link" href={skipTarget}>
        {t.skipToContent}
      </a>
      <Header
        dark={dark}
        language={language}
        mobileNav={mobileNav}
        setDark={setDark}
        setLanguage={setLanguage}
        setMobileNav={setMobileNav}
        t={t}
      />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer t={t} />
      <MobileTabBar t={t} />
    </>
  );
}
