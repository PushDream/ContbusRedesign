import React from "react";
import { Clock3, Mail, Phone, Ticket } from "lucide-react";
import { testimonials } from "../data/content.js";

export default function ReviewsContact({ t }) {
  return (
    <section className="section reviews-contact" id="contact">
      <div>
        <p className="eyebrow">{t.reviews}</p>
        <div className="reviews">
          {testimonials.map((item) => (
            <article className="review-card" key={item.name}>
              <div className="stars">★★★★★</div>
              <p>{item.body}</p>
              <strong>{item.name}</strong>
            </article>
          ))}
        </div>
      </div>

      <aside className="contact-card">
        <p className="eyebrow">{t.hotline}</p>
        <h2>+48 607 66 90 80</h2>
        <div className="contact-row">
          <Clock3 size={19} />
          <span>{t.hours}</span>
        </div>
        <div className="contact-row">
          <Mail size={19} />
          <span>{t.email}</span>
        </div>
        <div className="contact-actions">
          <a className="primary-button" href="tel:+48607669080">
            <Phone size={18} />
            {t.callButton}
          </a>
          <a className="secondary-button" href="#tickets">
            <Ticket size={18} />
            {t.buy}
          </a>
        </div>
      </aside>
    </section>
  );
}
