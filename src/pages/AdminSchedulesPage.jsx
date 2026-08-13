import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bus, CalendarClock, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import {
  createDeparture,
  deleteDeparture,
  fetchScheduleData,
  fetchTripAssignments,
  generateContbusTrips,
  updateDeparture,
  updateFarePrice,
  updateStop,
  updateTripAssignment,
} from "../lib/schedules.js";
import { useAdminAccess } from "../lib/useAdminAccess.js";
import { adminCopy } from "../lib/adminCopy.js";
import { useApp } from "../context/AppContext.jsx";
import { useToast } from "../lib/ToastProvider.jsx";
import AdminNav from "../components/AdminNav.jsx";
import AdminAuthGate from "../components/AdminAuthGate.jsx";

const DIRECTIONS = [
  { value: "lublin_warszawa", labelKey: "directionLublinWarszawa" },
  { value: "warszawa_lublin", labelKey: "directionWarszawaLublin" },
];

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function emptyDepartureForm(direction) {
  return { time: "", direction, days: [...ALL_DAYS], tripType: "regular", notes: "" };
}

function timeText(value) {
  return String(value || "").slice(0, 5);
}

function formatDays(days, text) {
  if (!days || days.length === ALL_DAYS.length) return text.dayShort.join(" · ");
  return days
    .slice()
    .sort((left, right) => left - right)
    .map((day) => text.dayShort[day - 1])
    .join(" · ");
}

function daysUntil(dateOnly) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateOnly}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayDateOnly() {
  return dateOnly(new Date());
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateOnly(date);
}

function DaysPicker({ value, onToggle, text, disabled }) {
  return (
    <div className="admin-days-grid">
      {text.dayShort.map((label, index) => {
        const day = index + 1;
        const active = value.includes(day);
        return (
          <button
            className={active ? "admin-day-chip active" : "admin-day-chip"}
            disabled={disabled}
            key={day}
            onClick={() => onToggle(day)}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminSchedulesPage() {
  const { language } = useApp();
  const text = adminCopy[language] || adminCopy.pl;
  const notify = useToast();
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

  const [activeTab, setActiveTab] = useState("departures");
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [editingFareId, setEditingFareId] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => emptyDepartureForm("lublin_warszawa"));
  const [generateStart, setGenerateStart] = useState(() => todayDateOnly());
  const [generateEnd, setGenerateEnd] = useState(() => addDays(todayDateOnly(), 60));
  const [generating, setGenerating] = useState(false);

  const [tripFilterStart, setTripFilterStart] = useState(() => todayDateOnly());
  const [tripFilterEnd, setTripFilterEnd] = useState(() => addDays(todayDateOnly(), 30));
  const [tripAssignments, setTripAssignments] = useState({ trips: [], drivers: [], vehicles: [] });
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState("");
  const [savingTripId, setSavingTripId] = useState("");

  const reload = useCallback(async () => {
    const data = await fetchScheduleData();
    setSchedule(data);
  }, []);

  const reloadTrips = useCallback(async () => {
    if (!tripFilterStart || !tripFilterEnd || tripFilterStart > tripFilterEnd) return;
    setTripsLoading(true);
    try {
      const data = await fetchTripAssignments(tripFilterStart, tripFilterEnd);
      setTripAssignments(data);
      setTripsError("");
    } catch (error) {
      setTripsError(error.message || text.tripsLoadFailed);
    } finally {
      setTripsLoading(false);
    }
  }, [tripFilterStart, tripFilterEnd, text.tripsLoadFailed]);

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

    fetchScheduleData()
      .then((data) => {
        if (active) {
          setSchedule(data);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message || text.scheduleLoadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [staff, text.scheduleLoadFailed]);

  useEffect(() => {
    let active = true;

    if (!staff) {
      queueMicrotask(() => {
        if (active) setTripsLoading(false);
      });
      return () => {
        active = false;
      };
    }

    fetchTripAssignments(tripFilterStart, tripFilterEnd)
      .then((data) => {
        if (active) {
          setTripAssignments(data);
          setTripsError("");
        }
      })
      .catch((error) => {
        if (active) setTripsError(error.message || text.tripsLoadFailed);
      })
      .finally(() => {
        if (active) setTripsLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, text.tripsLoadFailed]);

  const stops = useMemo(() => schedule?.stops || [], [schedule]);
  const routes = useMemo(() => schedule?.routes || [], [schedule]);
  const departures = useMemo(() => schedule?.departures || [], [schedule]);
  const fares = useMemo(() => schedule?.fares || [], [schedule]);
  const primaryRouteId = routes[0]?.id || "";

  const departuresByDirection = useMemo(() => {
    const grouped = { lublin_warszawa: [], warszawa_lublin: [] };
    departures
      .slice()
      .sort((left, right) => timeText(left.departure_time).localeCompare(timeText(right.departure_time)))
      .forEach((departure) => {
        if (grouped[departure.direction]) grouped[departure.direction].push(departure);
      });
    return grouped;
  }, [departures]);

  const fareByPair = useMemo(() => {
    const map = {};
    fares.forEach((fare) => {
      map[`${fare.origin_stop_id}:${fare.destination_stop_id}`] = fare;
    });
    return map;
  }, [fares]);

  const permitWarnings = useMemo(() => {
    return routes
      .filter((route) => route.valid_until)
      .map((route) => {
        const days = daysUntil(route.valid_until);
        if (days > 60) return null;
        const formattedDate = new Date(`${route.valid_until}T00:00:00`).toLocaleDateString(text.locale);
        const template = days < 0 ? text.permitWarningExpired : text.permitWarningExpiringSoon;
        return {
          routeId: route.id,
          message: template.replace("{route}", route.name).replace("{date}", formattedDate),
        };
      })
      .filter(Boolean);
  }, [routes, text]);

  const trips = tripAssignments.trips;
  const tripDrivers = tripAssignments.drivers;
  const tripVehicles = tripAssignments.vehicles;

  const patchDepartureInSchedule = useCallback((departureId, values) => {
    setSchedule((current) => {
      if (!current) return current;
      return {
        ...current,
        departures: current.departures.map((departure) =>
          departure.id === departureId ? { ...departure, ...values } : departure,
        ),
      };
    });
  }, []);

  const saveTripAssignment = async (tripId, values) => {
    setSavingTripId(tripId);
    try {
      await updateTripAssignment(tripId, values);
      await reloadTrips();
      notify(text.tripAssignSaved, "success");
    } catch (error) {
      notify(error.message || text.tripAssignFailed, "error");
    } finally {
      setSavingTripId("");
    }
  };

  const runAction = async (key, action, successMessage, failureMessage) => {
    setSavingKey(key);
    try {
      await action();
      await reload();
      if (successMessage) notify(successMessage, "success");
    } catch (error) {
      notify(error.message || failureMessage, "error");
    } finally {
      setSavingKey("");
    }
  };

  const toggleDepartureActive = async (departure) => {
    const key = `departure-${departure.id}`;
    const nextActive = !departure.is_active;
    setSavingKey(key);
    patchDepartureInSchedule(departure.id, { is_active: nextActive });
    try {
      const savedDeparture = await updateDeparture(departure.id, { isActive: nextActive });
      patchDepartureInSchedule(departure.id, savedDeparture);
      notify(text.departureSaved, "success");
    } catch (error) {
      patchDepartureInSchedule(departure.id, { is_active: departure.is_active });
      notify(error.message || text.scheduleLoadFailed, "error");
      setSavingKey("");
      return;
    }

    try {
      await reload();
      await reloadTrips();
    } catch (error) {
      notify(error.message || text.scheduleLoadFailed, "error");
    } finally {
      setSavingKey("");
    }
  };

  const saveStopField = (stopId, values) =>
    runAction(`stop-${stopId}`, () => updateStop(stopId, values), text.stopSaved, text.stopSaveFailed);

  const saveFare = (fareId, rawValue) => {
    setEditingFareId("");
    const price = Number(rawValue);
    if (!Number.isFinite(price) || price < 0) return;
    return runAction(`fare-${fareId}`, () => updateFarePrice(fareId, price), text.fareSaved, text.fareSaveFailed);
  };

  const openAddModal = (direction) => {
    setForm(emptyDepartureForm(direction));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (creating) return;
    setModalOpen(false);
  };

  const toggleFormDay = (day) => {
    setForm((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((value) => value !== day) : [...current.days, day].sort(),
    }));
  };

  const handleCreateDeparture = async (event) => {
    event.preventDefault();
    if (!primaryRouteId || !form.time || !form.days.length) return;
    setCreating(true);
    try {
      await createDeparture({
        routeId: primaryRouteId,
        departureTime: form.time,
        direction: form.direction,
        daysOfWeek: form.days,
        tripType: form.tripType,
        notes: form.notes,
        isActive: true,
      });
      await reload();
      notify(text.departureCreated, "success");
      setModalOpen(false);
    } catch (error) {
      notify(error.message || text.scheduleLoadFailed, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateTrips = async () => {
    if (!isAdmin || !generateStart || !generateEnd || generateStart > generateEnd) return;
    setGenerating(true);
    try {
      const count = await generateContbusTrips(generateStart, generateEnd);
      notify(count > 0 ? text.generateSuccess.replace("{count}", count) : text.generateNoNew, "success");
    } catch (error) {
      notify(error.message || text.generateFailed, "error");
    } finally {
      setGenerating(false);
    }
  };

  const confirmDeleteDeparture = async () => {
    if (!pendingDelete) return;
    await runAction(
      `departure-delete-${pendingDelete.id}`,
      () => deleteDeparture(pendingDelete.id),
      text.departureDeleted,
      text.scheduleLoadFailed,
    );
    setPendingDelete(null);
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
      title={text.schedulesTitle}
    >
      {() => (
      <div className="admin-page">
        <section className="admin-hero">
          <div>
            <p className="eyebrow">{text.schedulesEyebrow}</p>
            <h1>{text.schedulesTitle}</h1>
            <p>{text.schedulesHeroBody}</p>
          </div>

          <div className="admin-toolbar">
            <span className="admin-user-chip">{profile?.full_name || session?.user?.email}</span>
            <button className="secondary-button" disabled={loading} onClick={reload} type="button">
              <RefreshCw size={17} />
              {text.refresh}
            </button>
            <button className="secondary-button" onClick={handleSignOut} type="button">
              {text.logout}
            </button>
          </div>
        </section>

        <AdminNav active="schedules" text={text} />

        {!isAdmin && (
          <div className="admin-alert">
            <AlertTriangle size={18} />
            <span>{text.adminOnlyHint}</span>
          </div>
        )}

        {permitWarnings.map((warning) => (
          <div className="admin-alert" key={warning.routeId}>
            <AlertTriangle size={18} />
            <span>{warning.message}</span>
          </div>
        ))}

        {errorMessage && (
          <div className="admin-alert danger">
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="admin-tabs">
          {[
            ["departures", text.tabDepartures],
            ["stops", text.tabStops],
            ["fares", text.tabFares],
            ["trips", text.tabTrips],
          ].map(([value, label]) => (
            <button
              className={activeTab === value ? "active" : ""}
              key={value}
              onClick={() => setActiveTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <p className="admin-empty loading-row">
            <span className="spinner" aria-hidden="true" />
            {text.loadingTrips}
          </p>
        )}

        {!loading && activeTab === "departures" && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.dispatcherOps}</p>
                <h2>{text.tabDepartures}</h2>
              </div>
              <CalendarClock size={18} />
            </div>

            <div className="admin-generate-panel">
              <div className="admin-generate-header">
                <Sparkles size={16} />
                <div>
                  <h3>{text.generateTrips}</h3>
                  <p>{text.generateHint}</p>
                </div>
              </div>
              <div className="admin-generate-fields">
                <label>
                  <span>{text.generateStartDate}</span>
                  <input
                    disabled={!isAdmin || generating}
                    onChange={(event) => setGenerateStart(event.target.value)}
                    type="date"
                    value={generateStart}
                  />
                </label>
                <label>
                  <span>{text.generateEndDate}</span>
                  <input
                    disabled={!isAdmin || generating}
                    onChange={(event) => setGenerateEnd(event.target.value)}
                    type="date"
                    value={generateEnd}
                  />
                </label>
                <button
                  className="primary-button admin-generate-button"
                  disabled={!isAdmin || generating || !generateStart || !generateEnd || generateStart > generateEnd}
                  onClick={handleGenerateTrips}
                  title={!isAdmin ? text.adminOnlyHint : undefined}
                  type="button"
                >
                  {generating ? text.generating : text.generateButton}
                </button>
              </div>
            </div>

            {DIRECTIONS.map((direction) => (
              <div className="admin-departures-group" key={direction.value}>
                <div className="admin-departures-group-header">
                  <h3>{text[direction.labelKey]}</h3>
                  <button
                    className="admin-add-button"
                    disabled={!isAdmin}
                    onClick={() => openAddModal(direction.value)}
                    title={!isAdmin ? text.adminOnlyHint : text.addDeparture}
                    type="button"
                  >
                    <Plus size={16} />
                    {text.addDeparture}
                  </button>
                </div>

                <div className="admin-departures-table">
                  <div className="admin-departures-row header">
                    <span>{text.departureTime}</span>
                    <span>{text.daysOfWeek}</span>
                    <span>{text.tripType}</span>
                    <span>{text.isActive}</span>
                    <span />
                  </div>
                  {departuresByDirection[direction.value].length === 0 && (
                    <p className="admin-empty">{text.noDepartures}</p>
                  )}
                  {departuresByDirection[direction.value].map((departure) => (
                    <div className="admin-departures-row" key={departure.id}>
                      <strong>{timeText(departure.departure_time)}</strong>
                      <span>{formatDays(departure.days_of_week, text)}</span>
                      <span>{departure.trip_type === "express" ? text.tripTypeExpress : text.tripTypeRegular}</span>
                      <label className="admin-toggle">
                        <input
                          checked={departure.is_active}
                          disabled={!isAdmin || savingKey === `departure-${departure.id}`}
                          onChange={() => toggleDepartureActive(departure)}
                          type="checkbox"
                        />
                        <span />
                      </label>
                      <div className="admin-departure-actions">
                        <button
                          className="admin-icon-button danger"
                          disabled={!isAdmin}
                          onClick={() => setPendingDelete(departure)}
                          title={!isAdmin ? text.adminOnlyHint : text.deleteDeparture}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && activeTab === "stops" && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.routes}</p>
                <h2>{text.tabStops}</h2>
              </div>
            </div>
            <div className="admin-stops-list">
              {stops.map((stop) => (
                <article className="admin-stop-row" key={stop.id}>
                  <span className="admin-stop-order">{stop.stop_order}</span>
                  <div className="admin-stop-fields">
                    <label>
                      <span>{text.stopName}</span>
                      <input
                        defaultValue={stop.name}
                        disabled={!isAdmin || savingKey === `stop-${stop.id}`}
                        key={`${stop.id}-name-${stop.name}`}
                        onBlur={(event) => {
                          if (event.target.value !== stop.name) saveStopField(stop.id, { name: event.target.value });
                        }}
                        type="text"
                      />
                    </label>
                    <label>
                      <span>{text.stopAddress}</span>
                      <input
                        defaultValue={stop.address || ""}
                        disabled={!isAdmin || savingKey === `stop-${stop.id}`}
                        key={`${stop.id}-address-${stop.address}`}
                        onBlur={(event) => {
                          if (event.target.value !== (stop.address || ""))
                            saveStopField(stop.id, { address: event.target.value });
                        }}
                        type="text"
                      />
                    </label>
                  </div>
                  <span className="admin-stop-city">{stop.city}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {!loading && activeTab === "fares" && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.sales}</p>
                <h2>{text.tabFares}</h2>
              </div>
            </div>
            <div className="admin-fares-grid-wrap">
              <table className="admin-fares-grid">
                <thead>
                  <tr>
                    <th>{text.fareOrigin}</th>
                    {stops.map((stop) => (
                      <th key={stop.id}>{stop.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stops.map((origin) => (
                    <tr key={origin.id}>
                      <th>{origin.name}</th>
                      {stops.map((destination) => {
                        if (origin.id === destination.id) {
                          return (
                            <td className="muted" key={destination.id}>
                              {text.noFare}
                            </td>
                          );
                        }
                        const fare = fareByPair[`${origin.id}:${destination.id}`];
                        if (!fare) {
                          return (
                            <td className="muted" key={destination.id}>
                              {text.noFare}
                            </td>
                          );
                        }
                        const editing = editingFareId === fare.id;
                        return (
                          <td key={destination.id}>
                            {editing ? (
                              <input
                                autoFocus
                                defaultValue={fare.price_pln}
                                disabled={savingKey === `fare-${fare.id}`}
                                min="0"
                                onBlur={(event) => saveFare(fare.id, event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") event.currentTarget.blur();
                                  if (event.key === "Escape") setEditingFareId("");
                                }}
                                step="1"
                                type="number"
                              />
                            ) : (
                              <button
                                className="admin-fare-cell"
                                disabled={!isAdmin}
                                onClick={() => setEditingFareId(fare.id)}
                                type="button"
                              >
                                {Number(fare.price_pln)} {text.currency}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "trips" && (
          <section className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">{text.dispatcherOps}</p>
                <h2>{text.tabTrips}</h2>
              </div>
              <Bus size={18} />
            </div>

            <div className="admin-generate-fields admin-trips-filter">
              <label>
                <span>{text.dateFrom}</span>
                <input
                  disabled={tripsLoading}
                  onChange={(event) => setTripFilterStart(event.target.value)}
                  type="date"
                  value={tripFilterStart}
                />
              </label>
              <label>
                <span>{text.dateTo}</span>
                <input
                  disabled={tripsLoading}
                  onChange={(event) => setTripFilterEnd(event.target.value)}
                  type="date"
                  value={tripFilterEnd}
                />
              </label>
              <button
                className="secondary-button"
                disabled={tripsLoading || !tripFilterStart || !tripFilterEnd || tripFilterStart > tripFilterEnd}
                onClick={reloadTrips}
                type="button"
              >
                <RefreshCw size={16} />
                {text.refresh}
              </button>
            </div>

            {tripsError && (
              <div className="admin-alert danger">
                <AlertTriangle size={18} />
                <span>{tripsError}</span>
              </div>
            )}

            {tripsLoading ? (
              <p className="admin-empty loading-row">
                <span className="spinner" aria-hidden="true" />
                {text.loadingTrips}
              </p>
            ) : (
              <div className="admin-trips-table">
                <div className="admin-trips-row header">
                  <span>{text.tripDate}</span>
                  <span>{text.tripTime}</span>
                  <span>{text.tripRoute}</span>
                  <span>{text.driver}</span>
                  <span>{text.vehicle}</span>
                  <span>{text.status}</span>
                </div>
                {trips.length === 0 && <p className="admin-empty">{text.noTrips}</p>}
                {trips.map((trip) => (
                  <div className="admin-trips-row" key={trip.id}>
                    <span>{new Date(`${trip.departure_date}T00:00:00`).toLocaleDateString(text.locale)}</span>
                    <strong>{timeText(trip.departure_time)}</strong>
                    <span>{trip.route?.code || "-"}</span>
                    <select
                      disabled={!isAdmin || savingTripId === trip.id}
                      onChange={(event) => saveTripAssignment(trip.id, { driverId: event.target.value })}
                      value={trip.driver_id || ""}
                    >
                      <option value="">{text.assignPending}</option>
                      {tripDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.full_name || driver.id}
                        </option>
                      ))}
                    </select>
                    <select
                      disabled={!isAdmin || savingTripId === trip.id}
                      onChange={(event) => saveTripAssignment(trip.id, { vehicleId: event.target.value })}
                      value={trip.vehicle_id || ""}
                    >
                      <option value="">{text.assignPending}</option>
                      {tripVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.label} · {vehicle.plate_number}
                        </option>
                      ))}
                    </select>
                    <span className={`admin-status ${trip.status}`}>
                      {text.statusLabels[trip.status] || trip.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {modalOpen && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>{text.addDeparture}</h3>
                <button className="admin-icon-button" onClick={closeModal} type="button">
                  <X size={18} />
                </button>
              </div>
              <form className="admin-modal-body" onSubmit={handleCreateDeparture}>
                <label>
                  <span>{text.departureTime}</span>
                  <input
                    autoFocus
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    required
                    type="time"
                    value={form.time}
                  />
                </label>
                <label>
                  <span>{text.direction}</span>
                  <select
                    onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}
                    value={form.direction}
                  >
                    {DIRECTIONS.map((direction) => (
                      <option key={direction.value} value={direction.value}>
                        {text[direction.labelKey]}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <span>{text.daysOfWeek}</span>
                  <DaysPicker onToggle={toggleFormDay} text={text} value={form.days} />
                </div>
                <label>
                  <span>{text.tripType}</span>
                  <select
                    onChange={(event) => setForm((current) => ({ ...current, tripType: event.target.value }))}
                    value={form.tripType}
                  >
                    <option value="regular">{text.tripTypeRegular}</option>
                    <option value="express">{text.tripTypeExpress}</option>
                  </select>
                </label>
                <label>
                  <span>{text.notes}</span>
                  <input
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder={text.notesPlaceholder}
                    type="text"
                    value={form.notes}
                  />
                </label>
                <div className="admin-modal-footer">
                  <button className="secondary-button" onClick={closeModal} type="button">
                    {text.cancel}
                  </button>
                  <button className="primary-button" disabled={creating || !form.time || !form.days.length} type="submit">
                    {text.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {pendingDelete && (
          <div className="admin-modal-overlay" onClick={() => setPendingDelete(null)}>
            <div className="admin-modal small" onClick={(event) => event.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>{text.confirmDeleteDepartureTitle}</h3>
                <button className="admin-icon-button" onClick={() => setPendingDelete(null)} type="button">
                  <X size={18} />
                </button>
              </div>
              <div className="admin-modal-body">
                <p>{text.confirmDeleteDepartureBody}</p>
                <div className="admin-modal-footer">
                  <button className="secondary-button" onClick={() => setPendingDelete(null)} type="button">
                    {text.cancel}
                  </button>
                  <button className="primary-button danger" onClick={confirmDeleteDeparture} type="button">
                    {text.confirm}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </AdminAuthGate>
  );
}
