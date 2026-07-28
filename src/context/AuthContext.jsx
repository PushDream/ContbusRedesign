import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

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

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
