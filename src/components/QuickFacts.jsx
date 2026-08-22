import { BadgeCheck, Phone, Plane, Snowflake } from "lucide-react";

export default function QuickFacts({ t }) {
  return (
    <section className="quick-facts" aria-label={t.factsLabel}>
      <article>
        <BadgeCheck size={21} />
        <strong>{t.yearsBadge}</strong>
        <span>{t.routeCaption}</span>
      </article>
      <article>
        <Plane size={21} />
        <strong>{t.airportsBadge}</strong>
        <span>{t.airportsCaption}</span>
      </article>
      <article>
        <Snowflake size={21} />
        <strong>{t.airConLabel}</strong>
        <span>{t.airConCaption}</span>
      </article>
      <article>
        <Phone size={21} />
        <strong>607&nbsp;669&nbsp;080</strong>
        <span>09:00 - 17:00</span>
      </article>
    </section>
  );
}
