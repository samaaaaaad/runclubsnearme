"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearAuthCookie } from "@/lib/authCookie";
import { isAdminEmail } from "@/lib/access";
import { getStableAuthUser } from "@/lib/authSession";
import { DashboardSwitcher } from "@/app/components/DashboardSwitcher";
import { StickmanLoader } from "@/app/components/StickmanLoader";
import { getSchemaSetupMessage } from "@/lib/dbErrors";
import type { Club, ClubEvent, Run } from "@/lib/supabase";

type ClubMember = {
  id: string;
  club_id: string;
  user_id: string;
  joined_at: string;
  name?: string;
  email?: string;
};

function ClubDashboardContent() {
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [eventJoinCount, setEventJoinCount] = useState<Record<string, number>>({});
  const [clubForm, setClubForm] = useState({
    name: "",
    description: "",
    location: "",
    schedule_day: "",
    schedule_time: "",
    lat: "",
    lng: "",
    image_url: "",
  });
  const [runForm, setRunForm] = useState({
    date: "",
    time: "",
    distance: "",
    pace_range: "",
    location: "",
    is_recurring_weekly: false,
  });
  const [eventForm, setEventForm] = useState({
    title: "",
    event_date: "",
    event_time: "",
    location: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLabel, setActionLabel] = useState("Saving changes");
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) || null,
    [clubs, selectedClubId]
  );

  const loadClubData = async (clubId: string) => {
    setError("");

    const { data: clubRuns, error: runError } = await supabase
      .from("runs")
      .select("*")
      .eq("club_id", clubId)
      .order("date", { ascending: true });

    if (runError) {
      setError(runError.message);
    } else {
      setRuns(clubRuns || []);
    }

    const { data: clubEvents, error: eventError } = await supabase
      .from("club_events")
      .select("*")
      .eq("club_id", clubId)
      .order("event_date", { ascending: true });

    if (eventError) {
      setEvents([]);
      return;
    }

    const normalizedEvents = clubEvents || [];
    setEvents(normalizedEvents);

    if (normalizedEvents.length === 0) {
      setEventJoinCount({});
      return;
    }

    const eventIds = normalizedEvents.map((event) => event.id);
    const { data: participants, error: participantsError } = await supabase
      .from("club_event_participants")
      .select("event_id")
      .in("event_id", eventIds);

    if (participantsError || !participants) {
      setEventJoinCount({});
    } else {
      const counts: Record<string, number> = {};
      participants.forEach((participant) => {
        counts[participant.event_id] = (counts[participant.event_id] || 0) + 1;
      });
      setEventJoinCount(counts);
    }

    const { data: memberRows, error: membersError } = await supabase
      .from("club_members")
      .select("id, club_id, user_id, joined_at")
      .eq("club_id", clubId)
      .order("joined_at", { ascending: false });

    if (membersError) {
      setMembers([]);
      return;
    }

    const baseMembers = (memberRows || []) as ClubMember[];
    if (baseMembers.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = baseMembers.map((member) => member.user_id);
    const { data: usersData } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds);

    const usersById = Object.fromEntries((usersData || []).map((user) => [user.id, user]));
    setMembers(
      baseMembers.map((member) => ({
        ...member,
        name: usersById[member.user_id]?.name,
        email: usersById[member.user_id]?.email,
      }))
    );
  };

  useEffect(() => {
    const getUser = async () => {
      setError("");

      const accessToken = searchParams.get("at");
      const refreshToken = searchParams.get("rt");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("at");
        nextParams.delete("rt");
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `/dashboard/club?${nextQuery}` : "/dashboard/club");
      }

      const authUser = await getStableAuthUser();

      if (!authUser) {
        router.push("/auth");
        return;
      }

      setUserId(authUser.id);
      const admin = isAdminEmail(authUser.email);
      setIsAdmin(admin);

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();

      if (!admin && profile?.role !== "club_owner") {
        router.replace("/dashboard/runner");
        return;
      }

      if (admin) {
        const { data: adminDemoClub } = await supabase
          .from("clubs")
          .select("id, owner_id")
          .eq("name", "Admin Demo Club")
          .maybeSingle();

        if (!adminDemoClub) {
          await supabase.from("clubs").insert({
            owner_id: authUser.id,
            name: "Admin Demo Club",
            description: "Demo club for admin multi-view access",
            location: "Sydney CBD",
          });
        } else if (adminDemoClub.owner_id !== authUser.id) {
          await supabase.from("clubs").update({ owner_id: authUser.id }).eq("id", adminDemoClub.id);
        }
      }

      // Get user's clubs
      const { data: userClubs, error: clubsError } = await supabase
        .from("clubs")
        .select("*")
        .eq("owner_id", authUser.id);

      if (clubsError) {
        setError(getSchemaSetupMessage(clubsError.message) || clubsError.message);
      }

      if (userClubs && userClubs.length > 0) {
        setClubs(userClubs);
        setSelectedClubId(userClubs[0].id);
        setClubForm({
          name: userClubs[0].name,
          description: userClubs[0].description || "",
          location: userClubs[0].location || "",
          schedule_day: userClubs[0].schedule_day || "",
          schedule_time: userClubs[0].schedule_time || "",
          lat: userClubs[0].lat?.toString() || "",
          lng: userClubs[0].lng?.toString() || "",
          image_url: userClubs[0].image_url || "",
        });
        await loadClubData(userClubs[0].id);
      } else {
        if (!admin) {
          router.push("/dashboard/runner?clubAccess=required");
          return;
        }
        setClubs([]);
        setSelectedClubId("");
        setRuns([]);
        setEvents([]);
      }

      setLoading(false);
    };

    getUser();
  }, [router, searchParams]);

  const handleSelectClub = async (clubId: string) => {
    setSelectedClubId(clubId);
    setError("");
    const club = clubs.find((item) => item.id === clubId);
    if (club) {
      setClubForm({
        name: club.name,
        description: club.description || "",
        location: club.location || "",
        schedule_day: club.schedule_day || "",
        schedule_time: club.schedule_time || "",
        lat: club.lat?.toString() || "",
        lng: club.lng?.toString() || "",
        image_url: club.image_url || "",
      });
    }
    await loadClubData(clubId);
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub) return;

    setError("");
    setActionLabel("Creating run");
    setActionLoading(true);

    try {
      const { error: createRunError } = await supabase.from("runs").insert({
        club_id: selectedClub.id,
        date: runForm.date,
        time: runForm.time,
        is_recurring_weekly: runForm.is_recurring_weekly,
        distance: runForm.distance || null,
        pace_range: runForm.pace_range || null,
        location: runForm.location || selectedClub.location || null,
      });

      if (createRunError) {
        setError(createRunError.message);
        return;
      }

      setRunForm({
        date: "",
        time: "",
        distance: "",
        pace_range: "",
        location: "",
        is_recurring_weekly: false,
      });
      await loadClubData(selectedClub.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!selectedClub) return;
    setError("");

    setActionLabel("Deleting run");
    setActionLoading(true);
    try {
      const { error: deleteRunError } = await supabase.from("runs").delete().eq("id", runId);
      if (deleteRunError) {
        setError(deleteRunError.message);
        return;
      }

      await loadClubData(selectedClub.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub || !userId) return;

    setError("");
    setActionLabel("Creating event");
    setActionLoading(true);

    try {
      const { error: createEventError } = await supabase.from("club_events").insert({
        club_id: selectedClub.id,
        title: eventForm.title,
        event_date: eventForm.event_date,
        event_time: eventForm.event_time,
        location: eventForm.location || selectedClub.location || null,
        description: eventForm.description || null,
        created_by: userId,
      });

      if (createEventError) {
        setError(createEventError.message);
        return;
      }

      setEventForm({ title: "", event_date: "", event_time: "", location: "", description: "" });
      await loadClubData(selectedClub.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedClub) return;
    setError("");

    setActionLabel("Deleting event");
    setActionLoading(true);
    try {
      const { error: deleteEventError } = await supabase.from("club_events").delete().eq("id", eventId);
      if (deleteEventError) {
        setError(deleteEventError.message);
        return;
      }

      await loadClubData(selectedClub.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateClubProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub) return;

    setError("");
    setActionLabel("Saving profile");
    setActionLoading(true);

    try {
      const { error: updateError } = await supabase
        .from("clubs")
        .update({
          name: clubForm.name.trim(),
          description: clubForm.description.trim() || null,
          location: clubForm.location.trim() || null,
          schedule_day: clubForm.schedule_day.trim() || null,
          schedule_time: clubForm.schedule_time.trim() || null,
          lat: clubForm.lat.trim() ? Number(clubForm.lat) : null,
          lng: clubForm.lng.trim() ? Number(clubForm.lng) : null,
          image_url: clubForm.image_url.trim() || null,
        })
        .eq("id", selectedClub.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      const updatedClubs = clubs.map((club) =>
        club.id === selectedClub.id
          ? {
            ...club,
            name: clubForm.name.trim(),
            description: clubForm.description.trim() || null,
            location: clubForm.location.trim() || null,
            schedule_day: clubForm.schedule_day.trim() || null,
            schedule_time: clubForm.schedule_time.trim() || null,
            lat: clubForm.lat.trim() ? Number(clubForm.lat) : null,
            lng: clubForm.lng.trim() ? Number(clubForm.lng) : null,
            image_url: clubForm.image_url.trim() || null,
          }
          : club
      );
      setClubs(updatedClubs);
      await loadClubData(selectedClub.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!selectedClub) return;
    setError("");

    setActionLabel("Removing member");
    setActionLoading(true);
    try {
      const { error: removeError } = await supabase
        .from("club_members")
        .delete()
        .eq("id", membershipId)
        .eq("club_id", selectedClub.id);

      if (removeError) {
        setError(removeError.message);
        return;
      }

      await loadClubData(selectedClub.id);
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuthCookie();
    router.push("/auth");
  };

  if (loading) {
    return <StickmanLoader label="Loading club dashboard" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {actionLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black shadow-2xl">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">{actionLabel}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-black bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Club Dashboard</h1>
          <DashboardSwitcher isAdmin={isAdmin} canAccessClubOwner={true} onLogout={handleLogout} />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {clubs.length === 0 ? (
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No approved clubs linked to your account yet</h2>
            <p className="text-gray-600">
              Your club owner account may still be pending admin verification. Once approved, your assigned clubs will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            {/* Sidebar - Clubs List */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-2">
                {clubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => handleSelectClub(club.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${selectedClubId === club.id
                      ? "bg-black text-white"
                      : "bg-white border border-gray-200 hover:bg-gray-50"
                      }`}
                  >
                    <p className="font-semibold">{club.name}</p>
                    <p className="text-xs opacity-70">{club.description || "Manage your community runs and events"}</p>
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
                    <h2 className="text-2xl font-bold mb-4">Club Profile</h2>
                    <form onSubmit={handleUpdateClubProfile} className="grid grid-cols-1 gap-3">
                      <div className="mb-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                        <img
                          src={clubForm.image_url || "/club-placeholder.svg"}
                          alt="Club profile preview"
                          className="h-44 w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.src = "/club-placeholder.svg";
                          }}
                        />
                      </div>
                      <input
                        type="text"
                        value={clubForm.name}
                        onChange={(event) => setClubForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                        required
                      />
                      <input
                        type="url"
                        value={clubForm.image_url}
                        onChange={(event) => setClubForm((prev) => ({ ...prev, image_url: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                        placeholder="Profile image URL (https://...)"
                      />
                      <input
                        type="text"
                        value={clubForm.location}
                        onChange={(event) => setClubForm((prev) => ({ ...prev, location: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                        placeholder="Club location"
                      />
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input
                          type="text"
                          value={clubForm.schedule_day}
                          onChange={(event) => setClubForm((prev) => ({ ...prev, schedule_day: event.target.value }))}
                          className="rounded-lg border border-gray-200 px-3 py-2"
                          placeholder="Schedule day (e.g. Tue, Thu)"
                        />
                        <input
                          type="text"
                          value={clubForm.schedule_time}
                          onChange={(event) => setClubForm((prev) => ({ ...prev, schedule_time: event.target.value }))}
                          className="rounded-lg border border-gray-200 px-3 py-2"
                          placeholder="Schedule time (e.g. 6:30 AM)"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input
                          type="number"
                          step="any"
                          value={clubForm.lat}
                          onChange={(event) => setClubForm((prev) => ({ ...prev, lat: event.target.value }))}
                          className="rounded-lg border border-gray-200 px-3 py-2"
                          placeholder="Latitude"
                        />
                        <input
                          type="number"
                          step="any"
                          value={clubForm.lng}
                          onChange={(event) => setClubForm((prev) => ({ ...prev, lng: event.target.value }))}
                          className="rounded-lg border border-gray-200 px-3 py-2"
                          placeholder="Longitude"
                        />
                      </div>
                      <textarea
                        value={clubForm.description}
                        onChange={(event) => setClubForm((prev) => ({ ...prev, description: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                        rows={3}
                        placeholder="Club description"
                      />
                      <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90">
                        Save Profile
                      </button>
                    </form>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 bg-white p-5">
                      <p className="text-sm text-gray-500">Total Runs</p>
                      <p className="mt-2 text-2xl font-bold">{runs.length}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-5">
                      <p className="text-sm text-gray-500">Total Events</p>
                      <p className="mt-2 text-2xl font-bold">{events.length}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-5">
                      <p className="text-sm text-gray-500">Members</p>
                      <p className="mt-2 text-2xl font-bold">{members.length}</p>
                    </div>
                  </div>

                  {/* Runs Section */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 text-xl font-bold">Run Settings</h3>

                    <form onSubmit={handleCreateRun} className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        type="date"
                        value={runForm.date}
                        onChange={(event) => setRunForm((prev) => ({ ...prev, date: event.target.value }))}
                        required
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="time"
                        value={runForm.time}
                        onChange={(event) => setRunForm((prev) => ({ ...prev, time: event.target.value }))}
                        required
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Distance (optional)"
                        value={runForm.distance}
                        onChange={(event) => setRunForm((prev) => ({ ...prev, distance: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Pace range (optional)"
                        value={runForm.pace_range}
                        onChange={(event) => setRunForm((prev) => ({ ...prev, pace_range: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={runForm.location}
                        onChange={(event) => setRunForm((prev) => ({ ...prev, location: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 md:col-span-2"
                      />
                      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2">
                        <input
                          type="checkbox"
                          checked={runForm.is_recurring_weekly}
                          onChange={(event) =>
                            setRunForm((prev) => ({ ...prev, is_recurring_weekly: event.target.checked }))
                          }
                          className="h-4 w-4"
                        />
                        Set as recurring weekly run (same day and time every week)
                      </label>
                      <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 md:col-span-2">
                        Create Run
                      </button>
                    </form>

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
                                  {(run.distance || "Any distance")} • {(run.pace_range || "Any pace")}
                                </p>
                                {run.is_recurring_weekly && (
                                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Weekly recurring</p>
                                )}
                                {run.location && <p className="text-sm text-gray-500">{run.location}</p>}
                              </div>
                              <button
                                onClick={() => handleDeleteRun(run.id)}
                                className="text-sm text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Events Section */}
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 text-xl font-bold">Club Events</h3>

                    <form onSubmit={handleCreateEvent} className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Event title"
                        value={eventForm.title}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                        required
                        className="rounded-lg border border-gray-200 px-3 py-2 md:col-span-2"
                      />
                      <input
                        type="date"
                        value={eventForm.event_date}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, event_date: event.target.value }))}
                        required
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="time"
                        value={eventForm.event_time}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, event_time: event.target.value }))}
                        required
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={eventForm.location}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, location: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 md:col-span-2"
                      />
                      <textarea
                        placeholder="Description"
                        value={eventForm.description}
                        onChange={(event) => setEventForm((prev) => ({ ...prev, description: event.target.value }))}
                        className="rounded-lg border border-gray-200 px-3 py-2 md:col-span-2"
                      />
                      <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 md:col-span-2">
                        Create Event
                      </button>
                    </form>

                    {events.length === 0 ? (
                      <p className="text-gray-600">No events created yet</p>
                    ) : (
                      <div className="space-y-2">
                        {events.map((event) => (
                          <div key={event.id} className="rounded-lg border border-gray-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{event.title}</p>
                                <p className="text-sm text-gray-600">{event.event_date} @ {event.event_time}</p>
                                <p className="text-sm text-gray-500">{event.location || "Location TBD"}</p>
                                <p className="mt-2 text-xs text-gray-500">
                                  {eventJoinCount[event.id] || 0} runner(s) joined
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="text-sm text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <h3 className="mb-4 text-xl font-bold">Members</h3>
                    {members.length === 0 ? (
                      <p className="text-gray-600">No members joined this club yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                            <div>
                              <p className="font-semibold text-sm">{member.name || "Runner"}</p>
                              <p className="text-xs text-gray-500">{member.email || member.user_id}</p>
                              <p className="text-xs text-gray-500">Joined: {new Date(member.joined_at).toLocaleDateString()}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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

export default function ClubDashboard() {
  return (
    <Suspense fallback={<StickmanLoader label="Loading club dashboard" />}>
      <ClubDashboardContent />
    </Suspense>
  );
}
