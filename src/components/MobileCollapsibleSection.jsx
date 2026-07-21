import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function MobileCollapsibleSection({ children, t }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mobile-collapsible">
      <button
        aria-expanded={expanded}
        className="mobile-collapsible-toggle"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        {expanded ? t.showLessLabel : t.learnMoreLabel}
        <ChevronDown size={16} />
      </button>
      <div className={expanded ? "mobile-collapsible-body expanded" : "mobile-collapsible-body"}>
        {children}
      </div>
    </div>
  );
}
