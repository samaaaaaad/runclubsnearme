"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearAuthCookie } from "@/lib/authCookie";
import type { Club, Run } from "@/lib/supabase";

export default function ClubDashboard() {
  const [user, setUser] = useState<any>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/auth");
        return;
      }

      setUser(authUser);

      // Get user's clubs
      const { data: userClubs } = await supabase
        .from("clubs")
        .select("*")
        .eq("owner_id", authUser.id);

      if (userClubs) {
        setClubs(userClubs);
        if (userClubs.length > 0) {
          setSelectedClub(userClubs[0]);
          // Get runs for first club
          const { data: clubRuns } = await supabase
            .from("runs")
            .select("*")
            .eq("club_id", userClubs[0].id);
          if (clubRuns) setRuns(clubRuns);
        }
      }

      setLoading(false);
    };

    getUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuthCookie();
    router.push("/auth");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Club Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {clubs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No Clubs Yet</h2>
            <p className="text-gray-600 mb-4">Create your first club to get started</p>
            <button className="px-6 py-2 rounded-lg bg-black text-white hover:bg-black/90">
              Create Club
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            {/* Sidebar - Clubs List */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-2">
                {clubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => setSelectedClub(club)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${selectedClub?.id === club.id
                      ? "bg-black text-white"
                      : "bg-white border border-gray-200 hover:bg-gray-50"
                      }`}
                  >
                    <p className="font-semibold">{club.name}</p>
                    <p className="text-xs opacity-70">{club.description?.slice(0, 30)}...</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {selectedClub && (
                <>
                  {/* Club Info */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h2 className="text-2xl font-bold mb-2">{selectedClub.name}</h2>
                    <p className="text-gray-600 mb-4">{selectedClub.description}</p>
                    <button className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                      Edit Club
                    </button>
                  </div>

                  {/* Runs Section */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold">Upcoming Runs</h3>
                      <button className="px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90">
                        + Create Run
                      </button>
                    </div>

                    {runs.length === 0 ? (
                      <p className="text-gray-600">No runs created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {runs.map((run) => (
                          <div key={run.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{run.date} @ {run.time}</p>
                                <p className="text-sm text-gray-600">
                                  {run.distance} • {run.pace_range} pace
                                </p>
                              </div>
                              <button className="text-sm text-blue-600 hover:underline">Edit</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Members Section */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="text-xl font-bold mb-4">Members</h3>
                    <p className="text-gray-600">Members list coming soon</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
