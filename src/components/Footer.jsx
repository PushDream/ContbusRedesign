import React from "react";

export default function Footer({ t }) {
  return (
    <footer className="footer">
      <span>Contbus Olszak Sp. J. - Lublin, ul. Bazylianówka 48D</span>
      <span>{t.footer}</span>
    </footer>
  );
}
