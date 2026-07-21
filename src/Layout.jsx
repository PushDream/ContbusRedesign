import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import { useToast } from "./lib/ToastProvider.jsx";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import MobileTabBar from "./components/MobileTabBar.jsx";

export default function Layout() {
  const { dark, setDark, language, setLanguage, t } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const notify = useToast();

  useEffect(() => {
    const handlePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") notify(t.installDone, "success");
    setInstallPrompt(null);
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t.skipToContent}
      </a>
      <Header
        canInstall={Boolean(installPrompt) && !installed}
        dark={dark}
        language={language}
        mobileNav={mobileNav}
        onInstall={handleInstall}
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
