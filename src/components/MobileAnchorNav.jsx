export default function MobileAnchorNav({ t }) {
  return (
    <nav className="mobile-anchor-nav" aria-label={t.quickNavLabel}>
      <a href="#routes">{t.navSearch}</a>
      <a href="#manage">{t.quickNavMyTickets}</a>
      <a href="#manage">{t.quickNavTrack}</a>
      <a href="#contact">{t.quickNavContact}</a>
    </nav>
  );
}
