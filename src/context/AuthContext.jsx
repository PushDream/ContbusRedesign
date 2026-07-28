import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getSupabaseStorageKey() {
  return `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
}

function buildSessionFromHash(hashParams) {
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  if (!accessToken || !refreshToken || !payload?.sub) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Number(hashParams.get("expires_at") || payload.exp || 0),
    expires_in: Number(hashParams.get("expires_in") || 3600),
    provider_token: hashParams.get("provider_token") || null,
    token_type: hashParams.get("token_type") || "bearer",
    user: {
      id: payload.sub,
      aud: payload.aud,
      role: payload.role,
      email: payload.email,
      phone: payload.phone || "",
      app_metadata: payload.app_metadata || {},
      user_metadata: payload.user_metadata || {},
    },
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      queueMicrotask(() => {
        if (!active) return;
        setLoadingAuth(false);
      });
      return () => {
        active = false;
      };
    }

    async function loadSession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;
        if (data.session) {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          setSession(data.session);
          setLoadingAuth(false);
          return;
        }
        if (error) {
          console.error("Supabase OAuth session error", error.message);
          const fallbackSession = buildSessionFromHash(hashParams);
          if (fallbackSession) {
            window.localStorage.setItem(getSupabaseStorageKey(), JSON.stringify(fallbackSession));
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
            setSession(fallbackSession);
            setLoadingAuth(false);
            return;
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setLoadingAuth(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession && _event !== "SIGNED_OUT" && _event !== "USER_DELETED") return;
      setSession(nextSession);
      setProfile(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!session || !isSupabaseConfigured) {
      queueMicrotask(() => {
        if (active) setProfile(null);
      });
      return () => {
        active = false;
      };
    }

    supabase
      .from("profiles")
      .select("role, full_name, phone")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (active) setProfile(data || null);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loadingAuth,
      profile,
      session,
      signIn: (credentials) => supabase.auth.signInWithPassword(credentials),
      signInWithGoogle: () =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/konto`,
            queryParams: {
              prompt: "select_account",
            },
          },
        }),
      signOut: () => supabase.auth.signOut(),
      signUp: async ({ email, fullName, password, phone }) => {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
            },
          },
        });

        if (!result.error && result.data?.session && result.data?.user) {
          await supabase.from("profiles").upsert({
            id: result.data.user.id,
            full_name: fullName,
            phone,
          });
        }

        return result;
      },
    }),
    [loadingAuth, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
