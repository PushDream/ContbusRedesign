import { CalendarClock, Gauge, History } from "lucide-react";
import { Link } from "react-router-dom";

const items = [
  { key: "dashboard", to: "/admin", icon: Gauge, labelKey: "navDashboard" },
  { key: "schedules", to: "/admin/schedules", icon: CalendarClock, labelKey: "navSchedules" },
  { key: "activity", to: "/admin/activity", icon: History, labelKey: "navActivity" },
];

export default function AdminNav({ active, text }) {
  return (
    <nav className="admin-nav" aria-label={text.operationsEyebrow}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            className={item.key === active ? "admin-nav-link active" : "admin-nav-link"}
            key={item.key}
            to={item.to}
          >
            <Icon size={16} />
            {text[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
