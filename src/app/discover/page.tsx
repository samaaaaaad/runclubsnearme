"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearAuthCookie } from "@/lib/authCookie";
import { isAdminEmail } from "@/lib/access";
import { getStableAuthUser } from "@/lib/authSession";
import { DashboardSwitcher } from "@/app/components/DashboardSwitcher";
import { StickmanLoader } from "@/app/components/StickmanLoader";
import type { Club } from "@/lib/supabase";

const DAY_TITLE = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const simplifyScheduleDayLabel = (value?: string | null): string => {
  if (!value) return "Schedule TBC";

  const normalized = value.toLowerCase();
  if (normalized.includes("daily") || normalized.includes("everyday")) return "Daily";
  if (normalized.includes("weekday")) return "Weekdays";
  if (normalized.includes("weekend")) return "Weekends";

  const matchedDays = DAY_TITLE.filter((day) => {
    const lower = day.toLowerCase();
    return normalized.includes(lower) || normalized.includes(lower.slice(0, 3));
  });

  if (matchedDays.length > 0) {
    return matchedDays.map((day) => `${day}s`).join(", ");
  }

  return value;
};

export default function Discover() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [joinedClubIds, setJoinedClubIds] = useState<string[]>([]);
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canAccessClubOwner, setCanAccessClubOwner] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const filteredClubs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return clubs;
    }

    return clubs.filter((club) => {
      const name = club.name?.toLowerCase() || "";
      const description = club.description?.toLowerCase() || "";
      const location = club.location?.toLowerCase() || "";
      return name.includes(query) || description.includes(query) || location.includes(query);
    });
  }, [clubs, searchTerm]);

  useEffect(() => {
    const getUser = async () => {
      setError("");

      const authUser = await getStableAuthUser();

      if (!authUser) {
        router.push("/auth");
        return;
      }

      const admin = isAdminEmail(authUser.email);
      setIsAdmin(admin);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();
      setCanAccessClubOwner(admin || profile?.role === "club_owner");

      // Get all clubs
      const { data: allClubs } = await supabase.from("clubs").select("*");
      if (allClubs) setClubs(allClubs);

      // Get joined clubs (if table exists).
      const { data: memberships, error: membershipError } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", authUser.id);

      if (!membershipError && memberships) {
        setJoinedClubIds(memberships.map((m) => m.club_id));
      }

      setLoading(false);
    };

    getUser();
  }, [router]);

  const handleJoinClub = async (clubId: string) => {
    setJoiningClubId(clubId);
    setError("");

    try {
      const authUser = await getStableAuthUser();

      if (!authUser) {
        router.push("/auth");
        return;
      }

      const { error: joinError } = await supabase.from("club_members").insert({
        club_id: clubId,
        user_id: authUser.id,
      });

      if (joinError) {
        if (joinError.message.toLowerCase().includes("duplicate") || joinError.code === "23505") {
          setJoinedClubIds((prev) => (prev.includes(clubId) ? prev : [...prev, clubId]));
          return;
        }
        throw joinError;
      }

      setJoinedClubIds((prev) => (prev.includes(clubId) ? prev : [...prev, clubId]));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to join this club right now.";
      setError(message);
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuthCookie();
    router.push("/auth");
  };

  if (loading) {
    return <StickmanLoader label="Loading clubs" />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-black bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Club Directory</h1>
          <DashboardSwitcher
            isAdmin={isAdmin}
            canAccessClubOwner={canAccessClubOwner}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <form
          className="mb-6"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="flex w-full items-center overflow-hidden rounded-full border border-black/15 bg-white shadow-sm">
            <input
              id="club-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search clubs by name, area, or description"
              className="w-full bg-transparent px-6 py-4 text-base outline-none"
            />
            <button
              type="submit"
              aria-label="Search clubs"
              className="mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black text-white transition hover:bg-black/90"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredClubs.map((club) => (
            <div
              key={club.id}
              className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-black/5 blur-2xl" />
              <div className="relative flex-1">
                <div className="mb-4 overflow-hidden rounded-xl border border-black/10 bg-gray-100">
                  <img
                    src={club.image_url || "/club-placeholder.svg"}
                    alt={`${club.name} image`}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = "/club-placeholder.svg";
                    }}
                  />
                </div>
                <h2 className="mb-1 text-lg font-bold">{club.name}</h2>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/45">
                  {simplifyScheduleDayLabel(club.schedule_day)} {club.schedule_time ? `· ${club.schedule_time}` : ""}
                </p>
                <p className="mb-4 text-sm text-gray-600">{club.description || "No details available yet."}</p>
                <p className="mb-4 text-sm text-black/60">{club.location || "Location to be announced"}</p>
              </div>
              <button
                onClick={() => handleJoinClub(club.id)}
                disabled={joiningClubId === club.id || joinedClubIds.includes(club.id)}
                className="relative w-full rounded-xl bg-black px-4 py-2 font-semibold text-white transition hover:bg-black/90 disabled:opacity-50"
              >
                {joinedClubIds.includes(club.id)
                  ? "Joined"
                  : joiningClubId === club.id
                    ? "Joining..."
                    : "Join Club"}
              </button>
            </div>
          ))}
        </div>

        {filteredClubs.length === 0 && (
          <div className="mt-6 rounded-lg border border-black/10 bg-gray-50 p-5 text-sm text-black/60">
            No clubs match your search. Try a different keyword.
          </div>
        )}
      </div>
    </div>
  );
}
