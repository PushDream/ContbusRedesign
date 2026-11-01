export default function AdminTabs({ tabs, active, onChange, label }) {
  const handleKeyDown = (event) => {
    const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!offset) return;

    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.value === active);
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    onChange(next.value);
    document.getElementById(`admin-tab-${next.value}`)?.focus();
  };

  return (
    <div aria-label={label} className="admin-tabs" onKeyDown={handleKeyDown} role="tablist">
      {tabs.map(({ value, label: tabLabel, icon: Icon, count, tone }) => (
        <button
          aria-selected={active === value}
          className={active === value ? "active" : ""}
          id={`admin-tab-${value}`}
          key={value}
          onClick={() => onChange(value)}
          role="tab"
          tabIndex={active === value ? 0 : -1}
          type="button"
        >
          {Icon && <Icon size={16} />}
          {tabLabel}
          {count > 0 && <span className={tone ? `admin-tab-count ${tone}` : "admin-tab-count"}>{count}</span>}
        </button>
      ))}
    </div>
  );
}
