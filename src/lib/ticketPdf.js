const BRAND = [0, 138, 61];
const LIME = [123, 191, 42];
const INK = [16, 24, 39];
const MUTED = [100, 116, 139];
const WHITE = [255, 255, 255];
const PAPER = [247, 250, 247];
const BORDER = [218, 226, 221];
const CARD = [255, 255, 255];
const SOFT_ON_DARK = [186, 214, 196];

const PAGE_W = 112;
const PAGE_H = 195;
const DEFAULT_LOGO_URL = "/contbus-logo.jpg";

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFontBase64(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

async function loadImageDataUrl(url) {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function truncateToWidth(doc, text, maxWidth) {
  let value = String(text);
  if (doc.getTextWidth(value) <= maxWidth) return value;
  while (value.length > 1 && doc.getTextWidth(`${value}...`) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

// jsPDF's built-in fonts only cover WinAnsi (no ą/ę/ł/ń/ó/ś/ź/ż, no Cyrillic at
// all), which mangles Polish and Ukrainian text. Noto Sans (OFL-licensed, subset
// to Latin+Cyrillic, ~96kb/weight) is embedded instead so every language renders
// correctly. Both the font files and jsPDF/qrcode are loaded on demand, not on
// page load, since only a fraction of visitors ever click "download".
export async function createTicketPdf(ticket, assets = {}) {
  const {
    bookingCode,
    from,
    to,
    date,
    time,
    arrival,
    passengerName,
    seats,
    passengers,
    price,
    payload,
    labels,
    logoUrl = DEFAULT_LOGO_URL,
  } = ticket;

  const [{ jsPDF }, { default: QRCode }, regularFont, boldFont, logoDataUrl] = await Promise.all([
    assets.jsPDF ? { jsPDF: assets.jsPDF } : import("jspdf"),
    assets.QRCode ? { default: assets.QRCode } : import("qrcode"),
    assets.regularFont || loadFontBase64("/fonts/NotoSans-Regular.ttf"),
    assets.boldFont || loadFontBase64("/fonts/NotoSans-Bold.ttf"),
    assets.logoDataUrl || loadImageDataUrl(logoUrl),
  ]);

  const qrDataUrl = await QRCode.toDataURL(payload, {
    margin: 2,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H] });
  doc.addFileToVFS("NotoSans-Regular.ttf", regularFont);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", boldFont);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

  const setFont = (weight, size, color) => {
    doc.setFont("NotoSans", weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const labelText = (label, x, y, opts = {}) => {
    setFont("normal", opts.size || 6.8, opts.color || MUTED);
    const value = opts.maxWidth
      ? truncateToWidth(doc, String(label).toUpperCase(), opts.maxWidth)
      : String(label).toUpperCase();
    doc.text(value, x, y, opts.text || {});
  };

  const valueText = (value, x, y, opts = {}) => {
    setFont("bold", opts.size || 10.4, opts.color || INK);
    const rawLines = doc.splitTextToSize(String(value), opts.maxWidth || 38);
    const lines = rawLines.slice(0, opts.maxLines || 2);
    if (rawLines.length > (opts.maxLines || 2)) {
      lines[lines.length - 1] = truncateToWidth(doc, lines[lines.length - 1], opts.maxWidth || 38);
    }
    doc.text(lines, x, y, opts.text || {});
  };

  const detail = (label, value, x, y, w) => {
    labelText(label, x, y, { maxWidth: w, size: 5.8 });
    valueText(value, x, y + 7.3, { maxWidth: w, maxLines: 2, size: 9.7 });
  };

  const drawFallbackLogo = () => {
    doc.setFillColor(...BRAND);
    doc.roundedRect(10, 9, 18, 14, 3, 3, "F");
    doc.setFillColor(...WHITE);
    doc.roundedRect(13, 13, 12, 5, 1.2, 1.2, "F");
    doc.circle(15.5, 20, 1.5, "F");
    doc.circle(22.5, 20, 1.5, "F");
    setFont("bold", 13, BRAND);
    doc.text("Contbus", 32, 19);
  };

  doc.setFillColor(...PAPER);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  doc.setFillColor(...CARD);
  doc.roundedRect(6, 6, PAGE_W - 12, 25, 5, 5, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 10, 11, 45, 9.8);
  } else {
    drawFallbackLogo();
  }

  labelText(labels.bookingCode, PAGE_W - 12, 15, {
    color: MUTED,
    text: { align: "right" },
  });
  setFont("bold", 12.6, INK);
  doc.text(bookingCode, PAGE_W - 12, 23, { align: "right" });

  doc.setFillColor(...BRAND);
  doc.roundedRect(6, 36, PAGE_W - 12, 56, 5, 5, "F");

  setFont("bold", 7.8, SOFT_ON_DARK);
  doc.text("E-TICKET", 13, 46);
  doc.text(String(date).toUpperCase(), PAGE_W - 13, 46, { align: "right" });

  labelText(labels.departure, 13, 57, { color: SOFT_ON_DARK });
  labelText(labels.arrival, PAGE_W - 13, 57, {
    color: SOFT_ON_DARK,
    text: { align: "right" },
  });

  setFont("bold", 26, WHITE);
  doc.text(time, 13, 73);
  doc.text(arrival, PAGE_W - 13, 73, { align: "right" });

  setFont("normal", 9.6, SOFT_ON_DARK);
  doc.text(doc.splitTextToSize(String(from), 35).slice(0, 2), 13, 83);
  doc.text(doc.splitTextToSize(String(to), 35).slice(0, 2), PAGE_W - 13, 83, { align: "right" });

  doc.setDrawColor(...SOFT_ON_DARK);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([1.3, 1.3], 0);
  doc.line(44, 67, 68, 67);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(...LIME);
  doc.circle(56, 67, 1.6, "F");

  doc.setFillColor(...CARD);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(6, 100, PAGE_W - 12, 82, 5, 5, "FD");

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, 107, 44, 43, 4, 4, "F");
  labelText(labels.passenger, 17, 117, { maxWidth: 34, size: 5.8 });
  valueText(passengerName, 17, 125, { maxWidth: 33, maxLines: 2, size: 10.2 });
  labelText(labels.price, 17, 139, { maxWidth: 34, size: 5.8 });
  valueText(price, 17, 146.5, { maxWidth: 33, maxLines: 1, size: 11.2, color: BRAND });

  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(61, 105, 39, 39, 4, 4, "FD");
  doc.addImage(qrDataUrl, "PNG", 64.5, 108.5, 32, 32);

  setFont("normal", 7.2, MUTED);
  doc.text(doc.splitTextToSize(labels.footer, 40).slice(0, 2), 61, 153);

  detail(labels.seats, seats || "-", 17, 162, 28);
  detail(labels.passengers, passengers, 49, 162, 22);
  detail(labels.bookingCode, bookingCode, 74, 162, 26);

  doc.setFillColor(...PAPER);
  doc.circle(0, 96, 4.2, "F");
  doc.circle(PAGE_W, 96, 4.2, "F");
  doc.setDrawColor(168, 182, 173);
  doc.setLineWidth(0.28);
  doc.setLineDashPattern([1.2, 1.6], 0);
  doc.line(9, 96, PAGE_W - 9, 96);
  doc.setLineDashPattern([], 0);

  return doc;
}

export async function downloadTicketPdf(ticket) {
  const doc = await createTicketPdf(ticket);

  doc.save(`bilet-${ticket.bookingCode}.pdf`);
}
