import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AUDIT_ENTITIES, fetchAuditLog } from "../lib/audit.js";
import { useAdminAccess } from "../lib/useAdminAccess.js";
import { adminCopy } from "../lib/adminCopy.js";
import { useApp } from "../context/AppContext.jsx";
import AdminNav from "../components/AdminNav.jsx";
import AdminAuthGate from "../components/AdminAuthGate.jsx";

const PAGE_SIZE = 25;
const DATE_LOCALES = { pl: "pl-PL", en: "en-GB", uk: "uk-UA" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  const label = String(value);
  return UUID_PATTERN.test(label) ? label.slice(0, 8) : label;
}

function changeLines(entry) {
  return Object.entries(entry.changes || {}).map(([field, change]) => {
    if (entry.action === "update") {
      return { field, value: `${formatValue(change?.from)} → ${formatValue(change?.to)}` };
    }
    return { field, value: formatValue(change) };
  });
}

export default function AdminActivityPage() {
  const { language } = useApp();
  const text = adminCopy[language] || adminCopy.pl;
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

  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(1);
  const [log, setLog] = useState({ entries: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setLog(await fetchAuditLog({ page, pageSize: PAGE_SIZE, entity }));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message || text.activityLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, entity, text.activityLoadFailed]);

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [isAdmin, reload]);

  const pageCount = Math.max(1, Math.ceil(log.total / PAGE_SIZE));
  const formatTime = (value) =>
    new Date(value).toLocaleString(DATE_LOCALES[language] || DATE_LOCALES.pl, {
      timeZone: "Europe/Warsaw",
      dateStyle: "short",
      timeStyle: "medium",
    });

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
      title={text.activityTitle}
    >
      {() => (
        <div className="admin-page">
          <section className="admin-hero">
            <div>
              <p className="eyebrow">{text.activityEyebrow}</p>
              <h1>{text.activityTitle}</h1>
              <p>{text.activityHeroBody}</p>
            </div>

            <div className="admin-toolbar">
              <span className="admin-user-chip">{profile?.full_name || session?.user?.email}</span>
              <button className="secondary-button" disabled={loading || !isAdmin} onClick={reload} type="button">
                <RefreshCw size={17} />
                {text.refresh}
              </button>
              <button className="secondary-button" onClick={handleSignOut} type="button">
                {text.logout}
              </button>
            </div>
          </section>

          <AdminNav active="activity" text={text} />

          {!isAdmin && (
            <div className="admin-alert">
              <AlertTriangle size={18} />
              <span>{text.activityAdminOnly}</span>
            </div>
          )}

          {errorMessage && (
            <div className="admin-alert danger">
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {isAdmin && (
            <section className="admin-panel admin-activity-panel">
              <div className="admin-activity-filters">
                <label>
                  <span>{text.activityFilter}</span>
                  <select
                    onChange={(event) => {
                      setEntity(event.target.value);
                      setPage(1);
                    }}
                    value={entity}
                  >
                    <option value="all">{text.activityAll}</option>
                    {AUDIT_ENTITIES.map((value) => (
                      <option key={value} value={value}>
                        {text.activityEntities[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <span>{text.activityCount.replace("{count}", log.total)}</span>
              </div>

              {loading && log.entries.length === 0 && (
                <div role="status" aria-label={text.activityTitle}>
                  {[1, 2, 3, 4].map((item) => <span className="skeleton-block row" key={item} />)}
                </div>
              )}

              {!loading && log.entries.length === 0 && !errorMessage && (
                <div className="admin-empty">{text.activityEmpty}</div>
              )}

              <ol className="admin-activity-list">
                {log.entries.map((entry) => (
                  <li key={entry.id}>
                    <div className="admin-activity-head">
                      <strong>
                        {text.activityEntities[entry.entity] || entry.entity}
                        {" · "}
                        {text.activityActions[entry.action]}
                      </strong>
                      <time dateTime={entry.occurred_at}>{formatTime(entry.occurred_at)}</time>
                    </div>
                    <p>
                      {entry.actor_id
                        ? `${entry.actor?.full_name || formatValue(entry.actor_id)} (${entry.actor_role})`
                        : text.activitySystem}
                    </p>
                    <ul>
                      {changeLines(entry).map(({ field, value }) => (
                        <li key={field}>
                          <span>{text.activityFields[field] || field.replaceAll("_", " ")}:</span> {value}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>

              {pageCount > 1 && (
                <div className="admin-pagination">
                  <button disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">
                    {text.activityPrevious}
                  </button>
                  <span>{text.activityPage.replace("{page}", page).replace("{total}", pageCount)}</span>
                  <button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} type="button">
                    {text.activityNext}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </AdminAuthGate>
  );
}
