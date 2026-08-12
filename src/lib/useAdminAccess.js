import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabase.js";

function isStaffProfile(profile) {
  return profile?.role === "dispatcher" || profile?.role === "admin";
}

export function useAdminAccess({ missingMessage, permissionsFailedMessage, loginFailedMessage }) {
  const [authChecking, setAuthChecking] = useState(true);
  const [profileChecking, setProfileChecking] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState("");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      queueMicrotask(() => {
        if (!active) return;
        setAuthError(missingMessage);
        setAuthChecking(false);
      });
      return () => {
        active = false;
      };
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthChecking(false);
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
  }, [missingMessage]);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured || !session) {
      queueMicrotask(() => {
        if (!active) return;
        setProfile(null);
        setProfileChecking(false);
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      if (active) setProfileChecking(true);
    });
    supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        setProfile(error ? null : data);
        setAuthError(error ? permissionsFailedMessage : "");
      })
      .finally(() => {
        if (active) setProfileChecking(false);
      });

    return () => {
      active = false;
    };
  }, [session, permissionsFailedMessage]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setAuthError(missingMessage);
      return;
    }
    setSigningIn(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      setAuthError(error.message || loginFailedMessage);
    }
    setSigningIn(false);
  };

  const handleSignOut = () => {
    if (!isSupabaseConfigured) return;
    supabase.auth.signOut();
  };

  const staff = isStaffProfile(profile);
  const isAdmin = profile?.role === "admin";

  return useMemo(
    () => ({
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authChecking, profileChecking, session, profile, authError, credentials, signingIn, staff, isAdmin],
  );
}
