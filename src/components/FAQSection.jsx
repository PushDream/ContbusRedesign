import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqItems } from "../data/content.js";

export default function FAQSection({ language, t }) {
  const [openIndex, setOpenIndex] = useState(0);
  const items = faqItems[language];

  return (
    <section className="section faq-section" id="faq">
      <div className="section-heading narrow">
        <div>
          <h2>{t.faqTitle}</h2>
          <p>{t.faqLead}</p>
        </div>
      </div>
      <div className="faq-list">
        {items.map((item, index) => {
          const open = openIndex === index;
          return (
            <div className={open ? "faq-item open" : "faq-item"} key={item.q}>
              <button
                aria-expanded={open}
                className="faq-question"
                onClick={() => setOpenIndex(open ? -1 : index)}
                type="button"
              >
                <span>{item.q}</span>
                <ChevronDown size={18} />
              </button>
              {open && <p className="faq-answer">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
