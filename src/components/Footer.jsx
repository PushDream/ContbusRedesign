export default function Footer({ t }) {
  return (
    <footer className="footer">
      <div className="footer-main">
        <span>Contbus Olszak Sp. J. - Lublin, ul. Bazylianówka 48D</span>
        <span>{t.footer}</span>
      </div>
      <div className="footer-credit">
        <span>Powered by</span>
        <a href="https://modularpath.dev" rel="noreferrer" target="_blank">
          <img alt="Modularpath" className="footer-credit-logo" src="/modularpath-logo.png" />
        </a>
      </div>
    </footer>
  );
}
