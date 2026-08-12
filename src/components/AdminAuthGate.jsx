import { AlertTriangle, Lock, LogOut } from "lucide-react";

export default function AdminAuthGate({
  authChecking,
  profileChecking,
  session,
  staff,
  authError,
  credentials,
  setCredentials,
  signingIn,
  handleSignIn,
  handleSignOut,
  text,
  title,
  children,
}) {
  if (authChecking || profileChecking) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <span className="spinner large" aria-hidden="true" />
          <h1>{text.checkingAccessTitle}</h1>
          <p>{text.checkingAccessBody}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-auth-page">
        <form className="admin-auth-card" onSubmit={handleSignIn}>
          <Lock size={24} />
          <p className="eyebrow">{text.operationsEyebrow}</p>
          <h1>{title}</h1>
          <p>{text.loginIntro}</p>
          <label>
            <span>{text.email}</span>
            <input
              autoComplete="email"
              type="email"
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            <span>{text.password}</span>
            <input
              autoComplete="current-password"
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            />
          </label>
          {authError && <div className="admin-auth-error">{authError}</div>}
          <button className="primary-button full" disabled={signingIn} type="submit">
            {signingIn ? text.signingIn : text.signIn}
          </button>
        </form>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <AlertTriangle size={24} />
          <p className="eyebrow">{text.noAccessEyebrow}</p>
          <h1>{text.noAccessTitle}</h1>
          <p>{text.noAccessBody}</p>
          {authError && <div className="admin-auth-error">{authError}</div>}
          <button className="secondary-button full" onClick={handleSignOut} type="button">
            <LogOut size={17} />
            {text.logout}
          </button>
        </div>
      </div>
    );
  }

  return children();
}
