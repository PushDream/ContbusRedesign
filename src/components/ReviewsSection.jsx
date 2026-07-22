import { testimonials } from "../data/content.js";

export default function ReviewsSection({ t }) {
  return (
    <section className="section reviews-home" aria-label={t.reviews}>
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
    </section>
  );
}
