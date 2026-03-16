"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearAuthCookie } from "@/lib/authCookie";
import type { Club } from "@/lib/supabase";

export default function Discover() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [user, setUser] = useState<any>(null);
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

      // Get all clubs
      const { data: allClubs } = await supabase.from("clubs").select("*");
      if (allClubs) setClubs(allClubs);

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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-black/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Discover Clubs</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <div key={club.id} className="rounded-lg border border-black/10 bg-white p-6 shadow-sm hover:shadow-md transition">
              <h2 className="text-xl font-bold mb-2">{club.name}</h2>
              <p className="text-gray-600 mb-4">{club.description}</p>
              <button className="w-full px-4 py-2 rounded-lg bg-black text-white hover:bg-black/90">
                Join Club
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
