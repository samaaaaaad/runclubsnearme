"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/authCookie";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"runner" | "club_owner">("runner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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

        setAuthCookie();

        // Redirect based on role
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user?.id)
          .single();

        if (userData?.role === "club_owner") {
          router.push("/dashboard/club");
        } else {
          router.push("/discover");
        }
      } else {
        // Signup
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Unable to create account. Please try again.");

        // Create user profile
        const { error: profileError } = await supabase.from("users").insert({
          id: authData.user?.id,
          email,
          name,
          role,
        });

        if (profileError) throw profileError;

        // Supabase may require email confirmation before creating a session.
        if (!authData.session) {
          setError("Account created. Check your email to verify your account, then sign in.");
          setIsLogin(true);
          return;
        }

        setAuthCookie();

        // Redirect based on role
        if (role === "club_owner") {
          router.push("/dashboard/club");
        } else {
          router.push("/discover");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-display mb-2">
            {isLogin ? "Welcome Back" : "Join Us"}
          </h1>
          <p className="text-black/60">
            {isLogin
              ? "Sign in to your account"
              : "Create your account to get started"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
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
                <option value="club_owner">Club Owner (managing runs)</option>
              </select>
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
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center text-sm">
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
