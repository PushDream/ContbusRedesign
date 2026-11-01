import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, TriangleAlert } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const MIN_PASSWORD_LENGTH = 8;

const copy = {
  pl: {
    eyebrow: "Twoje konto",
    title: "Ustaw nowe hasło",
    intro: "Działa w aplikacji Contbus, aplikacji kierowcy i na stronie.",
    password: "Nowe hasło",
    confirm: "Powtórz hasło",
    save: "Zapisz hasło",
    saving: "Zapisywanie...",
    checking: "Sprawdzamy link...",
    tooShort: `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`,
    mismatch: "Hasła nie są takie same.",
    saveFailed: "Nie udało się zapisać hasła. Spróbuj ponownie.",
    invalidTitle: "Link wygasł",
    invalidBody: "Ten link jest nieprawidłowy lub już go użyto. Poproś o nowy w aplikacji.",
    doneTitle: "Hasło zmienione",
    doneBody: "Możesz wrócić do aplikacji i zalogować się nowym hasłem.",
  },
  en: {
    eyebrow: "Your account",
    title: "Set a new password",
    intro: "It works in the Contbus app, the driver app and on the website.",
    password: "New password",
    confirm: "Repeat password",
    save: "Save password",
    saving: "Saving...",
    checking: "Checking your link...",
    tooShort: `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`,
    mismatch: "The passwords don't match.",
    saveFailed: "We couldn't save your password. Please try again.",
    invalidTitle: "This link has expired",
    invalidBody: "The link is invalid or has already been used. Request a new one in the app.",
    doneTitle: "Password changed",
    doneBody: "You can go back to the app and sign in with your new password.",
  },
  uk: {
    eyebrow: "Ваш акаунт",
    title: "Створіть новий пароль",
    intro: "Він діє в застосунку Contbus, застосунку водія та на сайті.",
    password: "Новий пароль",
    confirm: "Повторіть пароль",
    save: "Зберегти пароль",
    saving: "Збереження...",
    checking: "Перевіряємо посилання...",
    tooShort: `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів.`,
    mismatch: "Паролі не збігаються.",
    saveFailed: "Не вдалося зберегти пароль. Спробуйте ще раз.",
    invalidTitle: "Посилання застаріло",
    invalidBody: "Посилання недійсне або вже використане. Запитайте нове в застосунку.",
    doneTitle: "Пароль змінено",
    doneBody: "Поверніться до застосунку та увійдіть із новим паролем.",
  },
};

export default function ResetPasswordPage() {
  const { language } = useApp();
  const text = copy[language] || copy.pl;
  const [phase, setPhase] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // The Supabase client is set not to read sessions from the URL, so the recovery
  // tokens in the link are applied here and then removed from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!isSupabaseConfigured || params.get("type") !== "recovery" || !accessToken || !refreshToken) {
      queueMicrotask(() => setPhase("invalid"));
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => setPhase(sessionError ? "invalid" : "form"))
      .catch(() => setPhase("invalid"));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(text.tooShort);
      return;
    }
    if (password !== confirmation) {
      setError(text.mismatch);
      return;
    }

    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message || text.saveFailed);
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setPhase("done");
  };

  if (phase === "checking") {
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <span className="spinner large" aria-hidden="true" />
          <h1>{text.checking}</h1>
        </div>
      </div>
    );
  }

  if (phase === "invalid" || phase === "done") {
    const done = phase === "done";
    const Icon = done ? CheckCircle2 : TriangleAlert;
    return (
      <div className="admin-auth-page">
        <div className="admin-auth-card">
          <Icon size={24} />
          <h1>{done ? text.doneTitle : text.invalidTitle}</h1>
          <p>{done ? text.doneBody : text.invalidBody}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-auth-page">
      <form className="admin-auth-card" onSubmit={handleSubmit}>
        <KeyRound size={24} />
        <p className="eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
        <label>
          <span>{text.password}</span>
          <input
            autoComplete="new-password"
            autoFocus
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          <span>{text.confirm}</span>
          <input
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            type="password"
            value={confirmation}
          />
        </label>
        {error && <div className="admin-auth-error" aria-live="polite">{error}</div>}
        <button className="primary-button full" disabled={saving} type="submit">
          {saving ? text.saving : text.save}
        </button>
      </form>
    </div>
  );
}
