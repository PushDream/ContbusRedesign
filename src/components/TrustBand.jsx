import React from "react";
import { Clock3, ShieldCheck, Users } from "lucide-react";

export default function TrustBand({ t }) {
  return (
    <section className="trust-band" aria-label={t.trustLabel}>
      <article>
        <Clock3 size={20} />
        <strong>97%</strong>
        <span>{t.trustOnTime}</span>
      </article>
      <article>
        <Users size={20} />
        <strong>120 000+</strong>
        <span>{t.trustPassengers}</span>
      </article>
      <article>
        <ShieldCheck size={20} />
        <strong>{t.yearsBadge}</strong>
        <span>{t.trustRouteCaption}</span>
      </article>
    </section>
  );
}
