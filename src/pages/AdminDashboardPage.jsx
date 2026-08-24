import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  ClipboardList,
  Download,
  Gauge,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Ticket,
  UserCog,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  fetchAdminOperations,
  fetchDispatcherOverview,
  updateAdminBookingStatus,
  updateAdminProfileRole,
  updateAdminTrip,
} from "../lib/database.js";
import { useAdminAccess } from "../lib/useAdminAccess.js";
import { useAdminRealtime } from "../lib/useAdminRealtime.js";
import { adminCopy } from "../lib/adminCopy.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../lib/ToastProvider.jsx";
import AdminNav from "../components/AdminNav.jsx";
import AdminAuthGate from "../components/AdminAuthGate.jsx";
import { warsawToday } from "../lib/warsawTime.js";

function timeText(value) {
  return String(value || "").slice(0, 5);
}

function money(value, text = adminCopy.pl) {
  return `${Number(value || 0).toLocaleString(text.locale)} ${text.currency}`;
}

function occupancy(passengers, capacity) {
  if (!capacity) return 0;
  return Math.min(100, Math.round((Number(passengers || 0) / Number(capacity)) * 100));
}

function readinessTone(value) {
  if (value >= 90) return "good";
  if (value >= 65) return "ok";
  return "poor";
}

function toPercent(value, total) {
  if (!total) return 100;
  return Math.round((Number(value || 0) / Number(total || 0)) * 100);
}

function dateTimeMs(date, time) {
  const normalizedTime = timeText(time) || "00:00";
  const value = new Date(`${date}T${normalizedTime}:00`).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function formatDateTime(value, text) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(text.locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function fallbackLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function incidentTitle(incident, text) {
  return (
    incident.title ||
    incident.type ||
    text.incidentSeverityLabels?.[incident.severity] ||
    fallbackLabel(incident.severity) ||
    text.activeIncidents
  );
}

function incidentDetail(incident) {
  return incident.description || incident.notes || incident.note || incident.status || "-";
}

function downloadCsv(filename, rows) {
  const body = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="admin-metric">
      <div className="admin-metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function ReadinessCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`admin-readiness-card ${tone}`}>
      <div>
        <Icon size={18} />
        <span>{label}</span>
      </div>
      <strong>{value}%</strong>
      <div className="admin-readiness-track">
        <span style={{ width: `${value}%` }} />
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const { language } = useApp();
  const text = adminCopy[language] || adminCopy.pl;
  const statusLabels = text.statusLabels;
  const bookingStatusLabels = text.bookingStatusLabels;
  const roleLabels = text.roleLabels;
  const notify = useToast();
  const [date, setDate] = useState(warsawToday());
  const [overview, setOverview] = useState(null);
  const [operations, setOperations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const {
    authChecking,
    profileChecking,
    session,
    profile,
    authError,
    credentials,
    setCredentials,
    signingIn,
    handleSignIn,
    handleSignOut,
    staff,
    isAdmin,
  } = useAdminAccess({
    missingMessage: text.supabaseMissing,
    permissionsFailedMessage: text.permissionsFailed,
    loginFailedMessage: text.loginFailed,
  });
  const [selectedTripId, setSelectedTripId] = useState("");
  const [bookingQuery, setBookingQuery] = useState("");
  const [manifestFilter, setManifestFilter] = useState("all");
  const [savingKey, setSavingKey] = useState("");
  const [tripListQuery, setTripListQuery] = useState("");
  const [tripListStatus, setTripListStatus] = useState("all");
  const [tripListPage, setTripListPage] = useState(1);
  const [tripListSort, setTripListSort] = useState("time");
  const [selectedTripIds, setSelectedTripIds] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!staff) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextOverview, nextOperations] = await Promise.all([
        fetchDispatcherOverview(date),
        fetchAdminOperations(date),
      ]);
      setOverview(nextOverview);
      setOperations(nextOperations);
      setSelectedTripId((current) => {
        if (current && nextOperations.trips.some((trip) => trip.id === current)) return current;
        return nextOperations.trips[0]?.id || "";
      });
    } catch (error) {
      setOverview(null);
      setOperations(null);
      setErrorMessage(error.message || text.dashboardLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [date, staff, text.dashboardLoadFailed]);

  useEffect(() => {
    let active = true;

    if (!staff) {
      queueMicrotask(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) setLoading(true);
    });

    Promise.all([fetchDispatcherOverview(date), fetchAdminOperations(date)])
      .then(([nextOverview, nextOperations]) => {
        if (!active) return;
        setOverview(nextOverview);
        setOperations(nextOperations);
        setSelectedTripId((current) => {
          if (current && nextOperations.trips.some((trip) => trip.id === current)) return current;
          return nextOperations.trips[0]?.id || "";
        });
      })
      .catch((error) => {
        if (!active) return;
        setOverview(null);
        setOperations(null);
        setErrorMessage(error.message || text.dashboardLoadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [date, staff, text.dashboardLoadFailed]);

  const summary = overview?.summary || {};
  const trips = useMemo(() => overview?.trips || [], [overview]);
  const routes = useMemo(() => overview?.routes || [], [overview]);
  const recentBookings = useMemo(() => overview?.recent_bookings || [], [overview]);
  const operationalTrips = useMemo(() => operations?.trips || [], [operations]);
  const operationalBookings = useMemo(() => operations?.bookings || [], [operations]);
  const vehicles = useMemo(() => operations?.vehicles || [], [operations]);
  const drivers = useMemo(() => operations?.drivers || [], [operations]);
  const profiles = useMemo(() => operations?.profiles || [], [operations]);
  const selectedTrip = operationalTrips.find((trip) => trip.id === selectedTripId) || operationalTrips[0] || null;
  const filteredOperationalTrips = useMemo(() => {
    const query = tripListQuery.trim().toLowerCase();
    const matched = operationalTrips.filter((trip) => {
      const matchesStatus = tripListStatus === "all" || trip.status === tripListStatus;
      const matchesQuery = !query || [trip.departure_time, trip.arrival_time, trip.origin_name, trip.destination_name, trip.route_code, trip.platform, trip.vehicle?.label, trip.driver?.full_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });

    const byTime = (left, right) => timeText(left.departure_time).localeCompare(timeText(right.departure_time));
    const comparators = {
      time: byTime,
      // Fullest trips first: that is the order a dispatcher triages in.
      occupancy: (left, right) =>
        occupancy(right.passenger_count, right.capacity) - occupancy(left.passenger_count, left.capacity) ||
        byTime(left, right),
      route: (left, right) =>
        String(left.route_label || "").localeCompare(String(right.route_label || "")) || byTime(left, right),
      status: (left, right) =>
        String(left.status || "").localeCompare(String(right.status || "")) || byTime(left, right),
    };

    return matched.slice().sort(comparators[tripListSort] || byTime);
  }, [operationalTrips, tripListQuery, tripListSort, tripListStatus]);
  const tripListPageSize = 10;
  const tripListPageCount = Math.max(1, Math.ceil(filteredOperationalTrips.length / tripListPageSize));
  const visibleOperationalTrips = filteredOperationalTrips.slice((tripListPage - 1) * tripListPageSize, tripListPage * tripListPageSize);

  const selectedTripBookings = useMemo(
    () => operationalBookings.filter((booking) => booking.trip_id === selectedTrip?.id),
    [operationalBookings, selectedTrip?.id],
  );
  const visibleSelectedTripBookings = useMemo(() => {
    if (manifestFilter === "checked") {
      return selectedTripBookings.filter(
        (booking) => booking.passengers.length > 0 && booking.checked_in_count >= booking.passengers.length,
      );
    }
    if (manifestFilter === "unchecked") {
      return selectedTripBookings.filter((booking) => booking.checked_in_count < booking.passengers.length);
    }
    return selectedTripBookings;
  }, [manifestFilter, selectedTripBookings]);
  const filteredBookings = useMemo(() => {
    const query = bookingQuery.trim().toLowerCase();
    if (!query) return operationalBookings.slice(0, 12);
    return operationalBookings.filter((booking) =>
      [
        booking.booking_reference,
        booking.buyer_name,
        booking.buyer_email,
        booking.route_label,
        ...booking.passengers.map((passenger) => passenger.ticket_code),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [bookingQuery, operationalBookings]);

  const reloadOperations = useCallback(async () => {
    const [nextOverview, nextOperations] = await Promise.all([
      fetchDispatcherOverview(date),
      fetchAdminOperations(date),
    ]);
    setOverview(nextOverview);
    setOperations(nextOperations);
  }, [date]);

  // Refresh silently on database pushes: no spinner, so a dispatcher reading the
  // manifest is not interrupted by a flash of skeletons every time a passenger
  // checks in. A failed refresh leaves the previous data on screen.
  const handleRealtimeChange = useCallback(() => {
    reloadOperations().catch(() => {});
  }, [reloadOperations]);

  const { status: realtimeStatus, lastEventAt } = useAdminRealtime({
    enabled: staff,
    onChange: handleRealtimeChange,
  });

  const saveTripField = async (tripId, values, successMessage) => {
    const key = `trip-${tripId}`;
    setSavingKey(key);
    try {
      await updateAdminTrip(tripId, values);
      await reloadOperations();
      notify(successMessage, "success");
    } catch (error) {
      notify(error.message || text.tripSaveFailed, "error");
    } finally {
      setSavingKey("");
    }
  };

  const toggleTripSelection = (tripId) => {
    setSelectedTripIds((current) =>
      current.includes(tripId) ? current.filter((id) => id !== tripId) : [...current, tripId],
    );
  };

  // Assign one vehicle or driver across every selected trip. Each trip is a
  // separate RPC, so a partial failure is reported with a count rather than
  // silently leaving some trips unassigned.
  const applyBulkAssignment = async (values) => {
    if (!selectedTripIds.length || bulkSaving) return;
    setBulkSaving(true);
    const results = await Promise.allSettled(
      selectedTripIds.map((tripId) => updateAdminTrip(tripId, values)),
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    const applied = results.length - failed;

    try {
      await reloadOperations();
    } catch {
      // The write already landed; a failed refetch should not read as a failure.
    }

    if (applied) notify(text.bulkApplied.replace("{count}", applied), "success");
    if (failed) notify(text.bulkFailed.replace("{count}", failed), "error");
    if (!failed) setSelectedTripIds([]);
    setBulkSaving(false);
  };

  const saveBookingStatus = async (bookingId, status) => {
    const key = `booking-${bookingId}`;
    setSavingKey(key);
    try {
      await updateAdminBookingStatus(bookingId, status);
      await reloadOperations();
      notify(text.bookingStatusSaved, "success");
    } catch (error) {
      notify(error.message || text.bookingSaveFailed, "error");
    } finally {
      setSavingKey("");
    }
  };

  const saveProfileRole = async (profileId, role) => {
    const key = `profile-${profileId}`;
    setSavingKey(key);
    try {
      await updateAdminProfileRole(profileId, role);
      await reloadOperations();
      notify(text.profileRoleSaved, "success");
    } catch (error) {
      notify(error.message || text.roleSaveFailed, "error");
    } finally {
      setSavingKey("");
    }
  };

  const busiestTrip = useMemo(
    () =>
      trips
        .slice()
        .sort((left, right) => Number(right.passenger_count || 0) - Number(left.passenger_count || 0))[0],
    [trips],
  );

  const operationalHealth = useMemo(() => {
    const activeTrips = operationalTrips.filter((trip) => trip.status !== "cancelled");
    const totalTrips = activeTrips.length;
    const checkedInPassengers = operationalBookings.reduce(
      (sum, booking) => sum + Number(booking.checked_in_count || 0),
      0,
    );
    const bookedPassengers = activeTrips.reduce((sum, trip) => sum + Number(trip.passenger_count || 0), 0);
    const delayedTrips = activeTrips.filter((trip) => trip.status === "delayed");
    const missingVehicles = activeTrips.filter((trip) => !trip.vehicle_id);
    const missingDrivers = activeTrips.filter((trip) => !trip.driver_id);
    const missingPlatforms = activeTrips.filter((trip) => !trip.platform);
    const highOccupancyTrips = activeTrips.filter((trip) => occupancy(trip.passenger_count, trip.capacity) >= 85);
    const activeIncidents = activeTrips.flatMap((trip) => trip.incidents || []);

    return {
      activeIncidents,
      bookedPassengers,
      checkedInPassengers,
      checkInRate: toPercent(checkedInPassengers, bookedPassengers),
      delayedTrips,
      driverRate: toPercent(totalTrips - missingDrivers.length, totalTrips),
      fleetRate: toPercent(totalTrips - missingVehicles.length, totalTrips),
      highOccupancyTrips,
      missingDrivers,
      missingPlatforms,
      missingVehicles,
      platformRate: toPercent(totalTrips - missingPlatforms.length, totalTrips),
      totalTrips,
    };
  }, [operationalBookings, operationalTrips]);

  const attentionItems = useMemo(() => {
    const items = [
      {
        count: operationalHealth.delayedTrips.length,
        icon: Clock3,
        label: text.delayedTrips,
        tone: "danger",
        trips: operationalHealth.delayedTrips,
      },
      {
        count: operationalHealth.missingDrivers.length,
        icon: UserCheck,
        label: text.missingDrivers,
        tone: "warning",
        trips: operationalHealth.missingDrivers,
      },
      {
        count: operationalHealth.missingVehicles.length,
        icon: Wrench,
        label: text.missingVehicles,
        tone: "warning",
        trips: operationalHealth.missingVehicles,
      },
      {
        count: operationalHealth.missingPlatforms.length,
        icon: MapPin,
        label: text.missingPlatforms,
        tone: "info",
        trips: operationalHealth.missingPlatforms,
      },
      {
        count: operationalHealth.highOccupancyTrips.length,
        icon: Gauge,
        label: text.highOccupancy,
        tone: "info",
        trips: operationalHealth.highOccupancyTrips,
      },
      {
        count: operationalHealth.activeIncidents.length,
        icon: ShieldAlert,
        label: text.activeIncidents,
        tone: "danger",
        trips: operationalTrips.filter((trip) => trip.incidents?.length),
      },
    ];
    return items.filter((item) => item.count > 0);
  }, [operationalHealth, operationalTrips, text]);

  const timelineItems = useMemo(() => {
    const tripItems = operationalTrips.slice(0, 12).map((trip) => ({
      id: `trip-${trip.id}`,
      at: dateTimeMs(trip.departure_date || date, trip.departure_time),
      icon: Bus,
      label: text.timelineTrip,
      title: trip.route_label,
      detail: `${timeText(trip.departure_time)} · ${statusLabels[trip.status] || trip.status}`,
      tripId: trip.id,
      tone: trip.status,
    }));
    const bookingItems = operationalBookings.slice(0, 8).map((booking) => ({
      id: `booking-${booking.id}`,
      at: new Date(booking.created_at || 0).getTime() || dateTimeMs(date, booking.departure_time),
      icon: Ticket,
      label: text.timelineBooking,
      title: booking.booking_reference,
      detail: `${booking.route_label} · ${booking.passenger_count || booking.passengers.length} ${text.passengersShort}`,
      tripId: booking.trip_id,
      tone: booking.status,
    }));
    const incidentItems = operationalHealth.activeIncidents.slice(0, 8).map((incident) => ({
      id: `incident-${incident.id}`,
      at: new Date(incident.created_at || 0).getTime() || Date.now(),
      icon: ShieldAlert,
      label: text.timelineIncident,
      title: incidentTitle(incident, text),
      detail: incidentDetail(incident),
      tripId: incident.trip_id,
      tone: "danger",
    }));
    const eventItems = (operations?.events || []).slice(0, 8).map((event) => ({
      id: `event-${event.id}`,
      at: new Date(event.created_at || 0).getTime() || Date.now(),
      icon: Activity,
      label: text.timelineEvent,
      title: event.event_type || event.type || text.timelineEvent,
      detail: event.message || event.description || event.status || "-",
      tripId: event.trip_id,
      tone: "info",
    }));

    return [...incidentItems, eventItems, bookingItems, tripItems]
      .flat()
      .filter((item) => item.at)
      .sort((left, right) => left.at - right.at)
      .slice(0, 14);
  }, [
    date,
    operationalBookings,
    operationalHealth.activeIncidents,
    operationalTrips,
    operations?.events,
    statusLabels,
    text,
  ]);

  const exportSelectedManifest = () => {
    if (!selectedTrip) return;
    const rows = [
      ["route", "departure", "booking_reference", "buyer", "email", "seat", "ticket_code", "checked_in"],
      ...selectedTripBookings.flatMap((booking) =>
        booking.passengers.map((passenger) => [
          selectedTrip.route_label,
          `${selectedTrip.departure_date} ${selectedTrip.departure_time}`,
          booking.booking_reference,
          booking.buyer_name,
          booking.buyer_email,
          passenger.seat_number,
          passenger.ticket_code,
          passenger.checked_in_at ? "yes" : "no",
        ]),
      ),
    ];
    downloadCsv(`contbus-manifest-${selectedTrip.route_code}-${selectedTrip.departure_date}.csv`, rows);
    notify(text.manifestExported, "success");
  };

  const exportDayReport = () => {
    const rows = [
      ["time", "route", "status", "platform", "vehicle", "driver", "passengers", "capacity", "bookings", "revenue"],
      ...operationalTrips.map((trip) => [
        trip.departure_time,
        trip.route_label,
        statusLabels[trip.status] || trip.status,
        trip.platform || "",
        trip.vehicle?.label || "",
        trip.driver?.full_name || "",
        trip.passenger_count || 0,
        trip.capacity || 0,
        trip.booking_count || 0,
        trip.revenue_total || 0,
      ]),
    ];
    downloadCsv(`contbus-operacje-${date}.csv`, rows);
    notify(text.dayExported, "success");
  };

  return (
    <AdminAuthGate
      authChecking={authChecking}
      profileChecking={profileChecking}
      session={session}
      staff={staff}
      authError={authError}
      credentials={credentials}
      setCredentials={setCredentials}
      signingIn={signingIn}
      handleSignIn={handleSignIn}
      handleSignOut={handleSignOut}
      text={text}
      title={text.dashboardTitle}
    >
      {() => (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">{text.operationsEyebrow}</p>
          <h1>{text.dashboardTitle}</h1>
          <p>{text.heroBody}</p>
        </div>

        <div className="admin-toolbar">
          <span
            className={realtimeStatus === "live" ? "admin-live-chip on" : "admin-live-chip off"}
            title={realtimeStatus === "live" ? undefined : text.liveOffHint}
          >
            <span aria-hidden="true" className="admin-live-dot" />
            {realtimeStatus === "live" ? text.liveOn : text.liveOff}
            {lastEventAt ? ` · ${text.lastUpdate} ${formatDateTime(lastEventAt, text)}` : ""}
          </span>
          <span className="admin-user-chip">{profile.full_name || session.user.email}</span>
          <label>
            <CalendarDays size={17} />
            <input
              aria-label="Date"
              type="date"
              value={date}
              onChange={(event) => {
                setLoading(true);
                setErrorMessage("");
                setDate(event.target.value);
                setTripListPage(1);
              }}
            />
          </label>
          <button className="secondary-button" disabled={loading} onClick={loadDashboard} type="button">
            <RefreshCw size={17} />
            {text.refresh}
          </button>
          <button className="secondary-button" disabled={loading || !operationalTrips.length} onClick={exportDayReport} type="button">
            <Download size={17} />
            {text.exportDay}
          </button>
          <button className="secondary-button" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            {text.logout}
          </button>
        </div>
      </section>

      <AdminNav active="dashboard" text={text} />

      {overview?.isAggregateFallback && (
        <div className="admin-alert">
          <AlertTriangle size={18} />
          <span>{text.aggregateWarning}</span>
        </div>
      )}

      {errorMessage && (
        <div className="admin-alert danger">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <section className="admin-metrics-grid">
        <MetricCard icon={Bus} label={text.trips} value={summary.trips || 0} hint={date} />
        <MetricCard icon={Ticket} label={text.bookings} value={summary.bookings || 0} hint={text.notCancelled} />
        <MetricCard icon={Users} label={text.passengers} value={summary.passengers || 0} hint={text.selectedDay} />
        <MetricCard icon={CircleDollarSign} label={text.sales} value={money(summary.revenue, text)} hint={text.paidDemo} />
        <MetricCard icon={Route} label={text.activeRoutes} value={summary.routes || routes.length} />
        <MetricCard icon={ClipboardList} label={text.vehicles} value={summary.vehicles || 0} hint={text.staffAuthHint} />
      </section>

      <section className="admin-command-grid">
        <div className="admin-panel admin-command-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.commandCenter}</p>
              <h2>{text.attentionQueue}</h2>
            </div>
            <Bell size={18} />
          </div>
          <p className="admin-command-lead">{text.commandCenterLead}</p>
          <div className="admin-attention-list">
            {attentionItems.length === 0 && (
              <div className="admin-attention-empty">
                <CheckCircle2 size={20} />
                <span>{text.noAttentionItems}</span>
              </div>
            )}
            {attentionItems.map((item) => {
              const Icon = item.icon;
              const targetTrip = item.trips[0];
              return (
                <article className={`admin-attention-item ${item.tone}`} key={item.label}>
                  <div className="admin-attention-icon">
                    <Icon size={18} />
                  </div>
                  <div>
                    <strong>{item.count}</strong>
                    <span>{item.label}</span>
                  </div>
                  {targetTrip && (
                    <button onClick={() => setSelectedTripId(targetTrip.id)} type="button">
                      {text.fixNow}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <div className="admin-panel admin-readiness-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.readiness}</p>
              <h2>
                {operationalHealth.checkInRate >= 90
                  ? text.readinessGood
                  : operationalHealth.checkInRate >= 65
                    ? text.readinessOk
                    : text.readinessPoor}
              </h2>
            </div>
            <Gauge size={18} />
          </div>
          <div className="admin-readiness-grid">
            <ReadinessCard
              icon={Ticket}
              label={text.checkInProgress}
              tone={readinessTone(operationalHealth.checkInRate)}
              value={operationalHealth.checkInRate}
            />
            <ReadinessCard
              icon={Bus}
              label={text.fleetAssigned}
              tone={readinessTone(operationalHealth.fleetRate)}
              value={operationalHealth.fleetRate}
            />
            <ReadinessCard
              icon={UserCheck}
              label={text.driversAssigned}
              tone={readinessTone(operationalHealth.driverRate)}
              value={operationalHealth.driverRate}
            />
            <ReadinessCard
              icon={MapPin}
              label={text.platformReady}
              tone={readinessTone(operationalHealth.platformRate)}
              value={operationalHealth.platformRate}
            />
          </div>
        </div>
      </section>

      <section className="admin-ops-grid" aria-label={text.dispatcherOps}>
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.operations}</p>
              <h2>{text.tripControl}</h2>
            </div>
            <Bus size={18} />
          </div>

          {selectedTrip ? (
            <div className="admin-control-stack">
              <div className="admin-selected-trip">
                <div>
                  <strong>{selectedTrip.route_label}</strong>
                  <span>
                    {selectedTrip.departure_time} - {selectedTrip.arrival_time} · {selectedTrip.route_code}
                  </span>
                </div>
                <span className={`admin-status ${selectedTrip.status}`}>
                  {statusLabels[selectedTrip.status] || selectedTrip.status}
                </span>
              </div>

              <div className="admin-control-grid">
                <label>
                  <span>{text.status}</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.status}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { status: event.target.value }, text.tripStatusSaved)
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{text.vehicle}</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.vehicle_id || ""}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { vehicle_id: event.target.value }, text.vehicleAssigned)
                    }
                  >
                    <option value="">{text.assignPending}</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} · {vehicle.plate_number}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{text.driver}</span>
                  <select
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    value={selectedTrip.driver_id || ""}
                    onChange={(event) =>
                      saveTripField(selectedTrip.id, { driver_id: event.target.value }, text.driverAssigned)
                    }
                  >
                    <option value="">{text.assignPending}</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name || driver.phone || driver.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{text.platform}</span>
                  <input
                    defaultValue={selectedTrip.platform || ""}
                    disabled={savingKey === `trip-${selectedTrip.id}`}
                    onBlur={(event) =>
                      saveTripField(selectedTrip.id, { platform: event.target.value }, text.platformSaved)
                    }
                    placeholder={text.platformPlaceholder}
                  />
                </label>
              </div>

              <div className="admin-trip-detail-grid">
                <div>
                  <span>{text.bookings}</span>
                  <strong>{selectedTrip.booking_count || 0}</strong>
                </div>
                <div>
                  <span>{text.passengers}</span>
                  <strong>
                    {selectedTrip.passenger_count || 0}/{selectedTrip.capacity}
                  </strong>
                </div>
                <div>
                  <span>{text.revenue}</span>
                  <strong>{money(selectedTrip.revenue_total, text)}</strong>
                </div>
                <div>
                  <span>{text.incidents}</span>
                  <strong>{selectedTrip.incidents.length}</strong>
                </div>
              </div>

              <div className="admin-manifest-preview">
                <div className="admin-manifest-toolbar">
                  <div>
                    <h3>{text.tripManifest}</h3>
                    <span>
                      {selectedTrip.booking_count || 0} {text.reservationsShort} ·{" "}
                      {selectedTrip.passenger_count || 0}/{selectedTrip.capacity} {text.passengersShort}
                    </span>
                  </div>
                  <div className="admin-segmented">
                    {[
                      ["all", text.allPassengers],
                      ["unchecked", text.uncheckedPassengers],
                      ["checked", text.checkedPassengers],
                    ].map(([value, label]) => (
                      <button
                        className={manifestFilter === value ? "active" : ""}
                        key={value}
                        onClick={() => setManifestFilter(value)}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    aria-label={text.exportManifest || "Download"}
                    className="admin-icon-button"
                    disabled={!selectedTripBookings.length}
                    onClick={exportSelectedManifest}
                    title={text.exportManifest}
                    type="button"
                  >
                    <Download size={17} />
                  </button>
                </div>
                {visibleSelectedTripBookings.length === 0 && <p className="admin-empty">{text.noBookingsOnTrip}</p>}
                {visibleSelectedTripBookings.map((booking) => (
                  <article className="admin-manifest-booking" key={booking.id}>
                    <div>
                      <strong>{booking.booking_reference}</strong>
                      <span>
                        {booking.buyer_name} · {booking.checked_in_count}/{booking.passengers.length} {text.checkedIn}
                      </span>
                    </div>
                    <select
                      disabled={savingKey === `booking-${booking.id}`}
                      value={booking.status}
                      onChange={(event) => saveBookingStatus(booking.id, event.target.value)}
                    >
                      {Object.entries(bookingStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <div className="admin-booking-mini-grid">
                      <span>
                        <UserCheck size={13} />
                        {booking.checked_in_count}/{booking.passengers.length}
                      </span>
                      <span>
                        <CircleDollarSign size={13} />
                        {money(booking.total_amount, text)}
                      </span>
                      <span>
                        <Ticket size={13} />
                        {booking.payment?.provider || text.payment}
                      </span>
                    </div>
                    <div className="admin-passenger-tags">
                      {booking.passengers.map((passenger) => (
                        <span key={passenger.id}>
                          {passenger.seat_number} · {passenger.ticket_code}
                          {passenger.checked_in_at ? " · OK" : ""}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="admin-empty">{text.chooseTrip}</p>
          )}
        </div>

        <aside className="admin-panel compact">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.bookings}</p>
              <h2>{text.search}</h2>
            </div>
            <Search size={18} />
          </div>
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={bookingQuery}
              onChange={(event) => setBookingQuery(event.target.value)}
              placeholder={text.searchPlaceholder}
            />
          </label>
          <div className="admin-booking-list operational">
            {filteredBookings.length === 0 && <p className="admin-empty">{text.noMatchingBookings}</p>}
            {filteredBookings.map((booking) => (
              <article className="admin-booking-card" key={booking.id}>
                <div>
                  <strong>{booking.booking_reference}</strong>
                  <span>{booking.route_label}</span>
                  <span>
                    {booking.buyer_name} · {booking.buyer_email}
                  </span>
                </div>
                <div className="admin-booking-card-footer">
                  <span className={`admin-status ${booking.status}`}>{bookingStatusLabels[booking.status]}</span>
                  <strong>{money(booking.total_amount, text)}</strong>
                </div>
              </article>
            ))}
          </div>
        </aside>

        {isAdmin && (
          <aside className="admin-panel compact">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.access}</p>
                <h2>{text.userRoles}</h2>
              </div>
              <UserCog size={18} />
            </div>
            <div className="admin-user-list">
              {profiles.map((userProfile) => (
                <article className="admin-user-row" key={userProfile.id}>
                  <div>
                    <strong>{userProfile.full_name || text.unnamed}</strong>
                    <span>{userProfile.phone || userProfile.id.slice(0, 8)}</span>
                  </div>
                  <select
                    disabled={savingKey === `profile-${userProfile.id}`}
                    value={userProfile.role}
                    onChange={(event) => saveProfileRole(userProfile.id, event.target.value)}
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          </aside>
        )}
      </section>

      <section className="admin-panel admin-timeline-panel">
        <div className="admin-panel-header">
          <div>
            <p className="eyebrow">{text.today}</p>
            <h2>{text.liveTimeline}</h2>
          </div>
          <Activity size={18} />
        </div>
        <div className="admin-timeline">
          {timelineItems.length === 0 && <p className="admin-empty">{text.noTimeline}</p>}
          {timelineItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`admin-timeline-item ${item.tone || ""}`}
                key={item.id}
                onClick={() => item.tripId && setSelectedTripId(item.tripId)}
                type="button"
              >
                <span className="admin-timeline-time">{formatDateTime(item.at, text)}</span>
                <span className="admin-timeline-icon">
                  <Icon size={16} />
                </span>
                <span className="admin-timeline-copy">
                  <strong>{item.title}</strong>
                  <small>
                    {item.label} · {item.detail}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-layout">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">{text.today}</p>
              <h2>{text.operationalTrips}</h2>
            </div>
            {busiestTrip && (
              <span className="admin-chip">
                {text.busiest} {timeText(busiestTrip.departure_time)}
              </span>
            )}
          </div>

          <div className="admin-trip-list">
            <div className="admin-list-toolbar admin-dashboard-trip-toolbar">
              <label className="admin-search-field">
                <span className="sr-only">{text.filterTripsLabel}</span>
                <input onChange={(event) => { setTripListQuery(event.target.value); setTripListPage(1); }} placeholder={text.tripSearchPlaceholder} type="search" value={tripListQuery} />
              </label>
              <label>
                <span className="sr-only">{text.tripStatusLabel}</span>
                <select onChange={(event) => { setTripListStatus(event.target.value); setTripListPage(1); }} value={tripListStatus}>
                  <option value="all">{text.allStatuses}</option>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">{text.sortBy}</span>
                <select onChange={(event) => { setTripListSort(event.target.value); setTripListPage(1); }} value={tripListSort}>
                  <option value="time">{text.sortBy}: {text.sortTime}</option>
                  <option value="occupancy">{text.sortBy}: {text.sortOccupancy}</option>
                  <option value="route">{text.sortBy}: {text.sortRoute}</option>
                  <option value="status">{text.sortBy}: {text.sortStatus}</option>
                </select>
              </label>
              <button
                className="admin-link-button"
                disabled={!visibleOperationalTrips.length}
                onClick={() => setSelectedTripIds(visibleOperationalTrips.map((trip) => trip.id))}
                type="button"
              >
                {text.selectAllVisible}
              </button>
            </div>

            {selectedTripIds.length > 0 && (
              <div className="admin-bulk-bar" role="group" aria-label={text.bulkAssign}>
                <strong>
                  {selectedTripIds.length} {text.selectedCount}
                </strong>
                <label>
                  <span className="sr-only">{text.bulkVehicle}</span>
                  <select
                    disabled={bulkSaving}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value) applyBulkAssignment({ vehicle_id: value });
                      event.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="">{text.bulkVehicle}</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">{text.bulkDriver}</span>
                  <select
                    disabled={bulkSaving}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value) applyBulkAssignment({ driver_id: value });
                      event.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="">{text.bulkDriver}</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.full_name || text.unnamed}</option>
                    ))}
                  </select>
                </label>
                {bulkSaving && <span className="admin-bulk-status">{text.bulkWorking}</span>}
                <button className="admin-link-button" onClick={() => setSelectedTripIds([])} type="button">
                  {text.clearSelection}
                </button>
              </div>
            )}
            {loading && (
              <div aria-label={text.loadingTrips} className="admin-table-skeleton" role="status">
                {[1, 2, 3, 4].map((item) => <span className="skeleton-block row" key={item} />)}
              </div>
            )}
            {!loading && filteredOperationalTrips.length === 0 && <p className="admin-empty">{text.noTripsForDate}</p>}

            {visibleOperationalTrips.map((trip) => {
              const load = occupancy(trip.passenger_count, trip.capacity);
              return (
                <article
                  className={trip.id === selectedTrip?.id ? "admin-trip-row selected" : "admin-trip-row"}
                  key={trip.id}
                  onClick={() => setSelectedTripId(trip.id)}
                >
                  <label
                    className="admin-trip-select"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="sr-only">
                      {text.selectTrip}: {timeText(trip.departure_time)} {trip.route_label}
                    </span>
                    <input
                      checked={selectedTripIds.includes(trip.id)}
                      onChange={() => toggleTripSelection(trip.id)}
                      type="checkbox"
                    />
                  </label>

                  <div className="admin-trip-time">
                    <strong>{timeText(trip.departure_time)}</strong>
                    <span>{timeText(trip.arrival_time)}</span>
                  </div>

                  <div className="admin-trip-main">
                    <div className="admin-trip-title">
                      <strong>
                        {trip.origin_name} → {trip.destination_name}
                      </strong>
                      <span className={`admin-status ${trip.status}`}>{statusLabels[trip.status] || trip.status}</span>
                    </div>
                    <div className="admin-trip-meta">
                      <span>{trip.route_code}</span>
                      <span>{trip.platform || text.noPlatform}</span>
                      <span>{trip.vehicle?.label || text.vehicleUnassigned}</span>
                      {trip.driver?.phone ? (
                        <a
                          className="admin-driver-call"
                          href={`tel:${trip.driver.phone}`}
                          onClick={(event) => event.stopPropagation()}
                          title={`${text.callDriver}: ${trip.driver.phone}`}
                        >
                          <Phone size={13} aria-hidden="true" />
                          {trip.driver.full_name || text.driverUnassigned}
                        </a>
                      ) : (
                        <span>{trip.driver?.full_name || text.driverUnassigned}</span>
                      )}
                    </div>
                    <div className="admin-progress">
                      <span style={{ width: `${load}%` }} />
                    </div>
                  </div>

                  <div className="admin-trip-numbers">
                    <strong>
                      {trip.passenger_count || 0}/{trip.capacity}
                    </strong>
                    <span>{trip.booking_count || 0} {text.reservationsShort}</span>
                    <span>{money(trip.revenue_total, text)}</span>
                  </div>
                </article>
              );
            })}
            {filteredOperationalTrips.length > tripListPageSize && (
              <div className="admin-pagination">
                <button disabled={tripListPage === 1} onClick={() => setTripListPage((page) => page - 1)} type="button">{text.prevPage}</button>
                <span>{text.pageOf.replace("{page}", tripListPage).replace("{count}", tripListPageCount)}</span>
                <button disabled={tripListPage === tripListPageCount} onClick={() => setTripListPage((page) => page + 1)} type="button">{text.nextPage}</button>
              </div>
            )}
          </div>
        </div>

        <aside className="admin-side">
          <div className="admin-panel compact">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.routes}</p>
                <h2>{text.salesByRoute}</h2>
              </div>
            </div>
            <div className="admin-route-list">
              {routes.map((route) => (
                <div className="admin-route-row" key={route.id}>
                  <div>
                    <strong>{route.code}</strong>
                    <span>
                      {route.origin_name} → {route.destination_name}
                    </span>
                  </div>
                  <div>
                    <strong>{route.trips_today || 0}</strong>
                    <span>{text.routeTrips}</span>
                  </div>
                  <div>
                    <strong>{money(route.revenue_today, text)}</strong>
                    <span>{route.bookings_today || 0} {text.reservationsShort}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel compact">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.sales}</p>
                <h2>{text.recentBookings}</h2>
              </div>
              <Activity size={18} />
            </div>
            <div className="admin-booking-list">
              {recentBookings.length === 0 && <p className="admin-empty">{text.noVisibleBookings}</p>}
              {recentBookings.map((booking) => (
                <div className="admin-booking-row" key={booking.id}>
                  <div>
                    <strong>{booking.booking_reference}</strong>
                    <span>
                      {booking.origin_name} → {booking.destination_name}
                    </span>
                  </div>
                  <div>
                    <strong>{money(booking.total_amount, text)}</strong>
                    <span>{booking.passenger_count} {text.passengersShort}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
      )}
    </AdminAuthGate>
  );
}
