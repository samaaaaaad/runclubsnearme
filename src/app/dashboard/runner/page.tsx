"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearAuthCookie } from "@/lib/authCookie";
import { isAdminEmail } from "@/lib/access";
import { getStableAuthUser } from "@/lib/authSession";
import { DashboardSwitcher } from "@/app/components/DashboardSwitcher";
import { StickmanLoader } from "@/app/components/StickmanLoader";
import { getSchemaSetupMessage } from "@/lib/dbErrors";
import { supabase } from "@/lib/supabase";
import type { Club, ClubEvent, Run } from "@/lib/supabase";

type RunnerProfile = {
    name: string;
    role: "runner" | "club_owner";
};

type UpcomingRun = Run & {
    club_name?: string;
};

type UpcomingEvent = ClubEvent & {
    club_name?: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function RunnerDashboardContent() {
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [profile, setProfile] = useState<RunnerProfile | null>(null);
    const [joinedClubs, setJoinedClubs] = useState<Club[]>([]);
    const [upcomingRuns, setUpcomingRuns] = useState<UpcomingRun[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
    const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
    const [eventActionId, setEventActionId] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const loadDashboard = async () => {
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
                router.replace(nextQuery ? `/dashboard/runner?${nextQuery}` : "/dashboard/runner");
            }

            const user = await getStableAuthUser();

            if (!user) {
                router.push("/auth");
                return;
            }

            setUserId(user.id);
            setUserEmail(user.email || "");
            const admin = isAdminEmail(user.email);

            const fallbackName =
                user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Runner";

            const { data: userProfile, error: profileError } = await supabase
                .from("users")
                .select("name, role")
                .eq("id", user.id)
                .maybeSingle();

            if (!profileError && userProfile) {
                setProfile(userProfile);
                if (userProfile.role === "club_owner" && !admin) {
                    router.replace("/dashboard/club");
                    return;
                }
            } else {
                setProfile({ name: fallbackName, role: "runner" });
            }

            const { data: memberships, error: membershipError } = await supabase
                .from("club_members")
                .select("club_id")
                .eq("user_id", user.id);

            if (membershipError) {
                setError(getSchemaSetupMessage(membershipError.message) || membershipError.message);
                setLoading(false);
                return;
            }

            const clubIds = (memberships || []).map((membership) => membership.club_id);

            if (clubIds.length === 0) {
                setJoinedClubs([]);
                setUpcomingRuns([]);
                setLoading(false);
                return;
            }

            const { data: clubsData, error: clubsError } = await supabase
                .from("clubs")
                .select("*")
                .in("id", clubIds);

            if (clubsError) {
                setError(getSchemaSetupMessage(clubsError.message) || clubsError.message);
                setLoading(false);
                return;
            }

            const normalizedClubs = clubsData || [];
            setJoinedClubs(normalizedClubs);

            const { data: runsData, error: runsError } = await supabase
                .from("runs")
                .select("*")
                .in("club_id", clubIds)
                .order("date", { ascending: true })
                .limit(10);

            if (runsError) {
                setError(getSchemaSetupMessage(runsError.message) || runsError.message);
                setLoading(false);
                return;
            }

            const clubsById = Object.fromEntries(normalizedClubs.map((club) => [club.id, club]));
            const enrichedRuns = (runsData || []).map((run) => ({
                ...run,
                club_name: clubsById[run.club_id]?.name,
            }));

            setUpcomingRuns(enrichedRuns);

            const today = new Date().toISOString().slice(0, 10);
            const { data: eventsData } = await supabase
                .from("club_events")
                .select("*")
                .in("club_id", clubIds)
                .gte("event_date", today)
                .order("event_date", { ascending: true })
                .limit(12);

            const normalizedEvents = (eventsData || []).map((event) => ({
                ...event,
                club_name: clubsById[event.club_id]?.name,
            }));
            setUpcomingEvents(normalizedEvents);

            if (normalizedEvents.length > 0) {
                const eventIds = normalizedEvents.map((event) => event.id);
                const { data: memberships } = await supabase
                    .from("club_event_participants")
                    .select("event_id")
                    .eq("user_id", user.id)
                    .in("event_id", eventIds);

                setJoinedEventIds((memberships || []).map((item) => item.event_id));
            } else {
                setJoinedEventIds([]);
            }

            setLoading(false);
        };

        loadDashboard();
    }, [router, searchParams]);

    const nextRun = useMemo(() => upcomingRuns[0] || null, [upcomingRuns]);
    const isAdmin = useMemo(() => isAdminEmail(userEmail), [userEmail]);
    const runDates = useMemo(() => new Set(upcomingRuns.map((run) => run.date)), [upcomingRuns]);
    const eventDates = useMemo(() => new Set(upcomingEvents.map((event) => event.event_date)), [upcomingEvents]);
    const runClubNamesByDate = useMemo(() => {
        const map = new Map<string, string[]>();

        for (const run of upcomingRuns) {
            const existing = map.get(run.date) || [];
            const clubName = run.club_name || "Club";
            if (!existing.includes(clubName)) {
                existing.push(clubName);
                map.set(run.date, existing);
            }
        }

        return map;
    }, [upcomingRuns]);

    const calendarCells = useMemo(() => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const start = new Date(year, month, 1);
        const offset = start.getDay();
        const startCell = new Date(year, month, 1 - offset);
        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(startCell);
            date.setDate(startCell.getDate() + index);
            return date;
        });
    }, [calendarMonth]);

    const handleToggleEvent = async (eventId: string, alreadyJoined: boolean) => {
        if (!userId) return;

        setError("");
        setEventActionId(eventId);

        if (alreadyJoined) {
            const { error: leaveError } = await supabase
                .from("club_event_participants")
                .delete()
                .eq("event_id", eventId)
                .eq("user_id", userId);

            if (leaveError) {
                setError(leaveError.message);
            } else {
                setJoinedEventIds((prev) => prev.filter((id) => id !== eventId));
            }
        } else {
            const { error: joinError } = await supabase.from("club_event_participants").insert({
                event_id: eventId,
                user_id: userId,
            });

            if (joinError) {
                if (joinError.code !== "23505") {
                    setError(joinError.message);
                }
            } else {
                setJoinedEventIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
            }
        }

        setEventActionId(null);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        clearAuthCookie();
        router.push("/auth");
    };

    if (loading) {
        return <StickmanLoader label="Loading dashboard" />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="border-b border-black bg-black text-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-2xl font-bold">Runner Dashboard</h1>
                        <p className="text-sm text-white/75">Welcome back{profile?.name ? `, ${profile.name}` : ""}.</p>
                    </div>
                    <DashboardSwitcher
                        isAdmin={isAdmin}
                        canAccessClubOwner={Boolean(profile?.role === "club_owner" || isAdmin)}
                        onLogout={handleLogout}
                    />
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

                {searchParams.get("ownerApplication") === "pending" && (
                    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                        Your club owner application has been submitted and is awaiting admin approval.
                    </div>
                )}

                {searchParams.get("clubAccess") === "required" && (
                    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                        Club Owner dashboard requires a club association. Apply as a club owner and wait for admin approval.
                    </div>
                )}

                <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <p className="text-sm text-gray-500">Joined Clubs</p>
                        <p className="mt-2 text-3xl font-bold">{joinedClubs.length}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <p className="text-sm text-gray-500">Upcoming Runs</p>
                        <p className="mt-2 text-3xl font-bold">{upcomingRuns.length}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <p className="text-sm text-gray-500">Next Run</p>
                        <p className="mt-2 text-lg font-semibold">
                            {nextRun ? `${nextRun.date} ${nextRun.time}` : "No runs scheduled"}
                        </p>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">My Clubs</h2>
                            <Link href="/discover" className="text-sm font-semibold text-blue-600 hover:underline">
                                Join More
                            </Link>
                        </div>
                        {joinedClubs.length === 0 ? (
                            <p className="text-gray-600">You have not joined any clubs yet. Explore and join to personalize your dashboard.</p>
                        ) : (
                            <div className="space-y-3">
                                {joinedClubs.map((club) => (
                                    <div key={club.id} className="min-h-[96px] rounded-lg border border-gray-200 p-4">
                                        <p className="font-semibold">{club.name}</p>
                                        <p className="text-sm text-gray-600">{club.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                        <h2 className="mb-4 text-xl font-bold">Upcoming Runs</h2>
                        {upcomingRuns.length === 0 ? (
                            <p className="text-gray-600">No upcoming runs from your joined clubs yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingRuns.map((run) => (
                                    <div key={run.id} className="min-h-[96px] rounded-lg border border-gray-200 p-4">
                                        <p className="font-semibold">{run.club_name || "Club"}</p>
                                        <div className="mt-1 flex items-center justify-between gap-3 text-sm text-gray-600">
                                            <p className="truncate">
                                                {run.date} @ {run.time}
                                                {run.distance ? ` • ${run.distance}` : ""}
                                                {run.pace_range ? ` • ${run.pace_range}` : ""}
                                            </p>
                                            <p className="shrink-0 text-right text-gray-500">{run.location || "TBD"}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold">Run Calendar</h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                                }
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                            >
                                Prev
                            </button>
                            <p className="min-w-32 text-center text-sm font-semibold">
                                {calendarMonth.toLocaleString("en-AU", { month: "long", year: "numeric" })}
                            </p>
                            <button
                                type="button"
                                onClick={() =>
                                    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                                }
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {WEEKDAY_LABELS.map((label) => (
                            <div key={label} className="py-1">
                                {label}
                            </div>
                        ))}
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-2">
                        {calendarCells.map((date) => {
                            const dateKey = toLocalDateKey(date);
                            const inMonth = date.getMonth() === calendarMonth.getMonth();
                            const hasRun = runDates.has(dateKey);
                            const hasEvent = eventDates.has(dateKey);
                            const runClubNames = runClubNamesByDate.get(dateKey) || [];
                            const runTooltip = runClubNames.length > 0 ? `Runs: ${runClubNames.join(", ")}` : "Run";
                            return (
                                <div
                                    key={dateKey}
                                    className={`rounded-xl border px-3 py-2 text-center text-sm transition-colors duration-100 ${inMonth
                                        ? "border-gray-200 bg-white"
                                        : "border-gray-100 bg-gray-50 text-gray-400"
                                        } ${inMonth ? "hover:border-black hover:bg-black hover:text-white" : ""}`}
                                >
                                    <p className="tabular-nums font-normal">{date.getDate()}</p>
                                    <div className="mt-1 flex h-3 items-center justify-center gap-1">
                                        {hasRun && (
                                            <span
                                                className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                                                aria-label={runTooltip}
                                                title={runTooltip}
                                            />
                                        )}
                                        {hasEvent && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="Event" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-start gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
                            <span>Run</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                            <span>Event</span>
                        </div>
                    </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-6">
                    <h2 className="mb-4 text-xl font-bold">Club Events</h2>
                    {upcomingEvents.length === 0 ? (
                        <p className="text-gray-600">No events scheduled by your clubs yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map((event) => {
                                const joined = joinedEventIds.includes(event.id);
                                return (
                                    <div key={event.id} className="rounded-lg border border-gray-200 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{event.title}</p>
                                                <p className="text-sm text-gray-600">{event.club_name || "Club"}</p>
                                                <p className="text-sm text-gray-600">{event.event_date} @ {event.event_time}</p>
                                                <p className="mt-1 text-sm text-gray-500">{event.location || "Location TBD"}</p>
                                            </div>
                                            <button
                                                onClick={() => handleToggleEvent(event.id, joined)}
                                                disabled={eventActionId === event.id}
                                                className={`rounded-lg px-4 py-2 text-sm font-semibold ${joined
                                                    ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                                    : "bg-black text-white hover:bg-black/90"
                                                    } disabled:opacity-50`}
                                            >
                                                {eventActionId === event.id ? "Saving..." : joined ? "Leave" : "Join"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default function RunnerDashboardPage() {
    return (
        <Suspense fallback={<StickmanLoader label="Loading runner dashboard" />}>
            <RunnerDashboardContent />
        </Suspense>
    );
}
