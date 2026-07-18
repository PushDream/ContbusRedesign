import { BriefcaseBusiness, QrCode, ShieldCheck } from "lucide-react";
import { regulationsUrl } from "../data/content.js";

export default function ServiceBand({ t }) {
  return (
    <section className="service-band" id="passenger">
      <div className="service-inner">
        <article>
          <BriefcaseBusiness size={24} />
          <h2>{t.rental}</h2>
          <p>{t.rentalLead}</p>
        </article>
        <article>
          <ShieldCheck size={24} />
          <h2>{t.comfort}</h2>
          <p>{t.comfortLead}</p>
        </article>
        <article className="ticket-card">
          <QrCode size={84} />
          <div>
            <p className="eyebrow">{t.passenger}</p>
            <h3>{t.passengerLead}</h3>
            <div className="ticket-links">
              <a href="#manage">{t.manageTitle}</a>
              <a href={regulationsUrl}>{t.regulationsShort}</a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
