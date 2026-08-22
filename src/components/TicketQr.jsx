import { QRCodeSVG } from "qrcode.react";

export default function TicketQr({ className = "", size = 140, value }) {
  const qrValue = String(value || "").trim().toUpperCase();

  return (
    <QRCodeSVG
      bgColor="#ffffff"
      className={className}
      fgColor="#101827"
      level="M"
      marginSize={4}
      size={size}
      value={qrValue || "CB-"}
      role="img"
      aria-label="QR code for ticket"
    />
  );
}
