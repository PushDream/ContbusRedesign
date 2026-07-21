import { useEffect, useState } from "react";
import { Search } from "lucide-react";

const STICKY_OFFSET = 118;

export default function StickySearchBar({ activeFare, passengers, t }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("home");
    if (!hero) return undefined;

    let ticking = false;
    const checkPosition = () => {
      ticking = false;
      setVisible(hero.getBoundingClientRect().bottom <= STICKY_OFFSET);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(checkPosition);
    };

    checkPosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <button
      aria-hidden={!visible}
      className={visible ? "sticky-search-bar visible" : "sticky-search-bar"}
      onClick={() => document.getElementById("home")?.scrollIntoView({ behavior: "smooth" })}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      <span className="sticky-search-route">
        {activeFare.from} → {activeFare.to}
      </span>
      <span className="sticky-search-meta">
        {t.todayLabel} · {passengers} {t.passengerUnit}
      </span>
      <span className="sticky-search-cta">
        <Search size={14} />
        {t.navSearch}
      </span>
    </button>
  );
}
