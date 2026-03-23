"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/authCookie";
import type { User } from "@supabase/supabase-js";

type AppRole = "runner" | "club_owner";

type UnassignedClubOption = {
  id: string;
  name: string;
  location: string | null;
};

type SupabaseLikeError = {
  message?: string;
  error_description?: string;
  msg?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const isSupabaseLikeError = (value: unknown): value is SupabaseLikeError => {
  return typeof value === "object" && value !== null;
};

const getFriendlyAuthError = (err: unknown): string => {
  const fallback = "Authentication failed. Please try again.";

  const message =
    err instanceof Error
      ? err.message
      : isSupabaseLikeError(err)
        ? err.message || err.error_description || err.msg || fallback
        : fallback;

  const details = isSupabaseLikeError(err) ? err.details || "" : "";
  const hint = isSupabaseLikeError(err) ? err.hint || "" : "";

  const normalized = message.toLowerCase();
  const normalizedDetails = details.toLowerCase();
  const normalizedHint = hint.toLowerCase();

  if (normalized.includes("provider is not enabled") || normalized.includes("unsupported provider")) {
    return "Google login is not enabled in Supabase yet. Enable Google in Authentication > Providers, then try again.";
  }

  if (
    normalized.includes("row-level security") ||
    normalizedDetails.includes("row-level security") ||
    normalizedHint.includes("row-level security")
  ) {
    return "Google auth succeeded, but profile sync to the users table was blocked by RLS policy. Add an INSERT/UPDATE policy for authenticated users on users.id = auth.uid().";
  }

  if (normalized.includes("invalid_grant") || normalized.includes("code verifier")) {
    return "OAuth callback state expired or mismatched. Start Google login again from the auth page and complete it in the same tab.";
  }

  if (normalized.includes("auth session missing")) {
    return "Session storage was unavailable in this browser context. Please retry in a normal browser tab (not sandboxed preview).";
  }

  if (normalized.includes("could not find the table 'public.users'")) {
    return "Auth succeeded, but your Supabase table public.users is missing. Run the SQL bootstrap script to create users and RLS policies.";
  }

  if (normalized.includes("could not find the table 'public.clubs'")) {
    return "Your Supabase clubs table is missing. Run supabase/bootstrap_users.sql in the SQL editor, then refresh.";
  }

  if (normalized.includes("could not find the table 'public.club_owner_applications'")) {
    return "Your owner applications table is missing. Re-run supabase/bootstrap_users.sql to create it and its policies.";
  }

  return message;
};

const isUsersTableMissingError = (error: SupabaseLikeError | null | undefined): boolean => {
  if (!error) return false;

  const message = (error.message || error.msg || "").toLowerCase();
  const details = (error.details || "").toLowerCase();

  return (
    message.includes("could not find the table 'public.users'") ||
    details.includes("could not find the table 'public.users'")
  );
};

const getFriendlyAuthErrorFromParams = (
  oauthError: string | null,
  oauthErrorDescription: string | null
): string | null => {
  if (!oauthError && !oauthErrorDescription) {
    return null;
  }

  const combined = `${oauthError ?? ""} ${oauthErrorDescription ?? ""}`.toLowerCase();

  if (combined.includes("redirect_uri_mismatch")) {
    return "Google OAuth redirect URI mismatch. Add your Supabase callback URL to Google Cloud OAuth redirect URIs.";
  }

  if (combined.includes("access_denied")) {
    return "Google sign-in was cancelled or denied. Please try again and allow access.";
  }

  return oauthErrorDescription || oauthError || "Google authentication failed.";
};

function AuthPageContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("runner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unassignedClubs, setUnassignedClubs] = useState<UnassignedClubOption[]>([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [clubPhone, setClubPhone] = useState("");
  const [clubExperience, setClubExperience] = useState("");
  const [clubRunDays, setClubRunDays] = useState("");
  const [clubRunTime, setClubRunTime] = useState("");
  const [clubLocation, setClubLocation] = useState("");
  const [clubInstagram, setClubInstagram] = useState("");
  const [clubWebsite, setClubWebsite] = useState("");
  const [clubNotes, setClubNotes] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectByRole = useCallback((
    resolvedRole: AppRole,
    session?: { access_token?: string; refresh_token?: string } | null
  ) => {
    const basePath = resolvedRole === "club_owner" ? "/dashboard/club" : "/dashboard/runner";

    if (session?.access_token && session?.refresh_token) {
      const params = new URLSearchParams();
      params.set("at", session.access_token);
      params.set("rt", session.refresh_token);
      router.push(`${basePath}?${params.toString()}`);
      return;
    }

    router.push(basePath);
  }, [router]);

  const normalizeRole = (value: string | null): AppRole | null => {
    if (value === "runner" || value === "club_owner") {
      return value;
    }

    return null;
  };

  const syncUserProfile = useCallback(async (user: User, preferredRole?: AppRole): Promise<AppRole> => {
    const metaRole = user.user_metadata?.role;
    const parsedMetaRole = typeof metaRole === "string" ? normalizeRole(metaRole) : null;
    const fallbackRole = preferredRole ?? parsedMetaRole ?? "runner";

    const { data: existingProfile, error: readError, status } = await supabase
      .from("users")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();

    if (isUsersTableMissingError(readError)) {
      return fallbackRole;
    }

    if (readError && status !== 406) {
      throw readError;
    }

    const existingRole = normalizeRole(existingProfile?.role ?? null);
    const resolvedRole = existingRole ?? fallbackRole;
    const metadataName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.user_name;

    const resolvedName =
      existingProfile?.name ||
      (typeof metadataName === "string" && metadataName.trim().length > 0
        ? metadataName.trim()
        : "Runner");

    const { error: upsertError } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        name: resolvedName,
        role: resolvedRole,
      },
      { onConflict: "id" }
    );

    if (isUsersTableMissingError(upsertError)) {
      return fallbackRole;
    }

    if (upsertError) {
      throw upsertError;
    }

    return resolvedRole;
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const mode = searchParams.get("mode");
    const requestedRole = normalizeRole(searchParams.get("role"));
    const oauthProvider = searchParams.get("oauth");
    const oauthError = searchParams.get("error");
    const oauthErrorDescription = searchParams.get("error_description");
    const oauthCode = searchParams.get("code");

    if (mode === "signup") {
      setIsLogin(false);
    }

    if (requestedRole) {
      setRole(requestedRole);
    }

    // Handle the OAuth return path and ensure users table is synced.
    const completeOAuthFlow = async () => {
      if (oauthProvider !== "google") {
        return;
      }

      const callbackError = getFriendlyAuthErrorFromParams(oauthError, oauthErrorDescription);
      if (callbackError) {
        if (!isCancelled) {
          setError(callbackError);
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        // In PKCE flows, exchange the returned auth code for a session.
        if (oauthCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(oauthCode);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("Google login did not complete. Please try again.");

        setAuthCookie();

        const resolvedRole = await syncUserProfile(user, requestedRole ?? "runner");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isCancelled) {
          redirectByRole(resolvedRole, session);
        }
      } catch (err: unknown) {
        const message = getFriendlyAuthError(err);

        if (!isCancelled) {
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void completeOAuthFlow();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, redirectByRole, syncUserProfile]);

  useEffect(() => {
    let isCancelled = false;

    const loadUnassignedClubs = async () => {
      if (isLogin || role !== "club_owner") {
        return;
      }

      const { data, error: clubsError } = await supabase
        .from("clubs")
        .select("id, name, location")
        .is("owner_id", null)
        .order("name", { ascending: true });

      if (isCancelled) {
        return;
      }

      if (clubsError) {
        setError(getFriendlyAuthError(clubsError));
        setUnassignedClubs([]);
        setSelectedClubId("");
        return;
      }

      const options = (data || []) as UnassignedClubOption[];
      setUnassignedClubs(options);

      if (options.length > 0) {
        setSelectedClubId((current) => current || options[0].id);
      }
    };

    void loadUnassignedClubs();

    return () => {
      isCancelled = true;
    };
  }, [isLogin, role]);

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);

    try {
      const redirectUrl = new URL("/auth", window.location.origin);
      redirectUrl.searchParams.set("oauth", "google");
      redirectUrl.searchParams.set("mode", isLogin ? "login" : "signup");
      redirectUrl.searchParams.set("role", isLogin ? "runner" : role);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(getFriendlyAuthError(err));
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;
        if (!data.user) throw new Error("No user returned from login.");

        if (data.session?.access_token && data.session?.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });

          if (sessionError) {
            throw sessionError;
          }
        }

        setAuthCookie();

        const resolvedRole = await syncUserProfile(data.user);
        redirectByRole(resolvedRole, data.session);
      } else {
        // Signup
        if (role === "club_owner") {
          if (!selectedClubId) {
            throw new Error("Please select the club you are applying to manage.");
          }
          if (!clubPhone.trim() || !clubExperience.trim() || !clubRunDays.trim() || !clubRunTime.trim() || !clubLocation.trim()) {
            throw new Error("Please complete all required club owner application fields.");
          }
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role: role === "club_owner" ? "runner" : role,
              requested_role: role,
            },
          },
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Unable to create account. Please try again.");

        // Supabase may require email confirmation before creating a session.
        if (!authData.session) {
          setError("Account created. Check your email to verify your account, then sign in.");
          setIsLogin(true);
          return;
        }

        if (role === "club_owner") {
          await syncUserProfile(authData.user, "runner");

          const { error: applicationError } = await supabase.from("club_owner_applications").insert({
            user_id: authData.user.id,
            club_id: selectedClubId,
            status: "pending",
            phone: clubPhone.trim(),
            experience_level: clubExperience.trim(),
            preferred_run_days: clubRunDays.trim(),
            preferred_run_time: clubRunTime.trim(),
            proposed_location: clubLocation.trim(),
            instagram_handle: clubInstagram.trim() || null,
            website_url: clubWebsite.trim() || null,
            notes: clubNotes.trim() || null,
          });

          if (applicationError) {
            throw applicationError;
          }

          setAuthCookie();
          const params = new URLSearchParams();
          params.set("ownerApplication", "pending");
          if (authData.session?.access_token && authData.session?.refresh_token) {
            params.set("at", authData.session.access_token);
            params.set("rt", authData.session.refresh_token);
          }
          router.push(`/dashboard/runner?${params.toString()}`);
          return;
        }

        const resolvedRole = await syncUserProfile(authData.user, role);

        setAuthCookie();
        redirectByRole(resolvedRole, authData.session);
      }
    } catch (err: unknown) {
      const message = getFriendlyAuthError(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white py-4">
      <div className="w-full max-w-md px-4 sm:px-5">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-semibold text-black/60 transition hover:text-black"
          >
            ← Back to home
          </Link>
        </div>

        <div className="mb-6">
          <div className="mb-6 grid grid-cols-2 items-stretch rounded-xl border border-black/10 bg-[#f7f7f7] p-1">
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsLogin(true);
              }}
              className={`flex h-10 items-center justify-center rounded-lg px-4 py-2 text-center text-sm font-semibold leading-none transition ${isLogin
                ? "bg-[#050505] text-white"
                : "text-black/60 hover:text-black"
                }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsLogin(false);
              }}
              className={`flex h-10 items-center justify-center rounded-lg px-4 py-2 text-center text-sm font-semibold leading-none transition ${!isLogin
                ? "bg-[#050505] text-white"
                : "text-black/60 hover:text-black"
                }`}
            >
              Sign Up
            </button>
          </div>

          <h1 className="mb-2 text-center text-4xl font-display">
            {isLogin ? "Welcome Back" : "Join Us"}
          </h1>
          <p className="mx-auto max-w-sm text-center text-black/60">
            {isLogin
              ? "One login, two dashboards based on your role"
              : "Create your account to get started"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-3">
          {/* Email */}
          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
              placeholder="you@example.com"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Name (Signup only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                placeholder="John Doe"
                required
              />
            </div>
          )}

          {/* Role (Signup only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold mb-2">I Am A...</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "runner" | "club_owner")}
                className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
              >
                <option value="runner">Runner (finding clubs)</option>
                <option value="club_owner">Club Owner (requires admin verification)</option>
              </select>
            </div>
          )}

          {!isLogin && role === "club_owner" && (
            <div className="space-y-3 rounded-lg border border-black/10 bg-[#fafafa] p-4">
              <p className="text-sm font-semibold text-black">Club Owner Application</p>

              <div>
                <label className="block text-sm font-semibold mb-2">Select Club (Unassigned)</label>
                <select
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                  required
                >
                  {unassignedClubs.length === 0 ? (
                    <option value="">No unassigned clubs available</option>
                  ) : (
                    unassignedClubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}{club.location ? ` - ${club.location}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Contact Phone</label>
                <input
                  type="text"
                  value={clubPhone}
                  onChange={(e) => setClubPhone(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                  placeholder="+61 ..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Coaching / Leadership Experience</label>
                <input
                  type="text"
                  value={clubExperience}
                  onChange={(e) => setClubExperience(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                  placeholder="e.g. 3 years leading weekly social runs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-2">Preferred Run Days</label>
                  <input
                    type="text"
                    value={clubRunDays}
                    onChange={(e) => setClubRunDays(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                    placeholder="Tue, Thu"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Preferred Run Time</label>
                  <input
                    type="text"
                    value={clubRunTime}
                    onChange={(e) => setClubRunTime(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                    placeholder="6:30 AM"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Proposed Meetup Location</label>
                <input
                  type="text"
                  value={clubLocation}
                  onChange={(e) => setClubLocation(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                  placeholder="Exact start point"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-2">Instagram (Optional)</label>
                  <input
                    type="text"
                    value={clubInstagram}
                    onChange={(e) => setClubInstagram(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                    placeholder="@clubhandle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Website (Optional)</label>
                  <input
                    type="url"
                    value={clubWebsite}
                    onChange={(e) => setClubWebsite(e.target.value)}
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Additional Notes (Optional)</label>
                <textarea
                  value={clubNotes}
                  onChange={(e) => setClubNotes(e.target.value)}
                  className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/40"
                  rows={3}
                  placeholder="Anything admins should know"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#050505] py-3 font-semibold text-white transition hover:bg-black/90 disabled:opacity-50"
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </button>

          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs uppercase tracking-[0.08em] text-black/40">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading || (!isLogin && role === "club_owner")}
            className="w-full rounded-lg border border-black/10 bg-white py-3 font-semibold text-[#050505] transition hover:bg-black/5 disabled:opacity-50"
          >
            {!isLogin && role === "club_owner"
              ? "Google Sign Up Disabled For Owner Applications"
              : isLogin
                ? "Continue with Google"
                : "Sign Up with Google"}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-3 text-center text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-semibold text-[#050505] hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white text-sm text-black/60">Loading auth...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
