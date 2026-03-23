"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthCookie } from "@/lib/authCookie";
import { isAdminEmail } from "@/lib/access";
import { getStableAuthUser } from "@/lib/authSession";
import { DashboardSwitcher } from "@/app/components/DashboardSwitcher";
import { StickmanLoader } from "@/app/components/StickmanLoader";
import { getSchemaSetupMessage } from "@/lib/dbErrors";
import { supabase } from "@/lib/supabase";

type OwnerApplicationRow = {
    id: string;
    user_id: string;
    club_id: string;
    status: "pending" | "approved" | "rejected";
    phone: string | null;
    experience_level: string | null;
    preferred_run_days: string | null;
    preferred_run_time: string | null;
    proposed_location: string | null;
    instagram_handle: string | null;
    website_url: string | null;
    notes: string | null;
    created_at: string;
};

type ClubOption = {
    id: string;
    name: string;
    owner_id: string | null;
};

type UserRow = {
    id: string;
    email: string;
    name: string;
    role: "runner" | "club_owner";
};

export default function AdminDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [adminUserId, setAdminUserId] = useState("");
    const [applications, setApplications] = useState<OwnerApplicationRow[]>([]);
    const [clubs, setClubs] = useState<ClubOption[]>([]);
    const [usersById, setUsersById] = useState<Record<string, UserRow>>({});
    const [clubsById, setClubsById] = useState<Record<string, ClubOption>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const router = useRouter();

    const loadData = async (adminId: string) => {
        setError("");

        const { data: appRows, error: appError } = await supabase
            .from("club_owner_applications")
            .select("*")
            .order("created_at", { ascending: false });

        if (appError) {
            setError(getSchemaSetupMessage(appError.message) || appError.message);
            setLoading(false);
            return;
        }

        const { data: clubRows, error: clubError } = await supabase
            .from("clubs")
            .select("id, name, owner_id")
            .order("name", { ascending: true });

        if (clubError) {
            setError(getSchemaSetupMessage(clubError.message) || clubError.message);
            setLoading(false);
            return;
        }

        const { data: userRows, error: userError } = await supabase
            .from("users")
            .select("id, email, name, role");

        if (userError) {
            setError(getSchemaSetupMessage(userError.message) || userError.message);
            setLoading(false);
            return;
        }

        const normalizedApps = (appRows || []) as OwnerApplicationRow[];
        const normalizedClubs = (clubRows || []) as ClubOption[];
        const normalizedUsers = (userRows || []) as UserRow[];

        setApplications(normalizedApps);
        setClubs(normalizedClubs);
        setClubsById(Object.fromEntries(normalizedClubs.map((club) => [club.id, club])));
        setUsersById(Object.fromEntries(normalizedUsers.map((user) => [user.id, user])));
        setAdminUserId(adminId);
        setLoading(false);
    };

    useEffect(() => {
        const boot = async () => {
            const user = await getStableAuthUser();

            if (!user) {
                router.push("/auth");
                return;
            }

            if (!isAdminEmail(user.email)) {
                router.push("/dashboard/runner");
                return;
            }

            await loadData(user.id);
        };

        void boot();
    }, [router]);

    const handleDecision = async (applicationId: string, decision: "approved" | "rejected") => {
        const application = applications.find((item) => item.id === applicationId);
        if (!application || !adminUserId) return;

        setSavingId(applicationId);
        setError("");

        const { error: applicationUpdateError } = await supabase
            .from("club_owner_applications")
            .update({
                status: decision,
                reviewed_by: adminUserId,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", application.id);

        if (applicationUpdateError) {
            setError(applicationUpdateError.message);
            setSavingId(null);
            return;
        }

        if (decision === "approved") {
            const { error: clubAssignError } = await supabase
                .from("clubs")
                .update({ owner_id: application.user_id })
                .eq("id", application.club_id);

            if (clubAssignError) {
                setError(clubAssignError.message);
                setSavingId(null);
                return;
            }

            const { error: roleUpdateError } = await supabase
                .from("users")
                .update({ role: "club_owner" })
                .eq("id", application.user_id);

            if (roleUpdateError) {
                setError(roleUpdateError.message);
                setSavingId(null);
                return;
            }
        }

        await loadData(adminUserId);
        setSavingId(null);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        clearAuthCookie();
        router.push("/auth");
    };

    if (loading) {
        return <StickmanLoader label="Loading admin dashboard" />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="border-b border-black bg-black text-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                        <p className="text-sm text-white/75">Review club owner applications and assign clubs.</p>
                    </div>
                    <DashboardSwitcher isAdmin canAccessClubOwner onLogout={handleLogout} />
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

                <section className="rounded-lg border border-gray-200 bg-white p-6">
                    <h2 className="mb-4 text-xl font-bold">Owner Applications</h2>
                    {applications.length === 0 ? (
                        <p className="text-gray-600">No applications yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {applications.map((application) => {
                                const user = usersById[application.user_id];
                                const club = clubsById[application.club_id];
                                const clubAssigned = clubs.find((c) => c.id === application.club_id)?.owner_id;
                                return (
                                    <div key={application.id} className="rounded-lg border border-gray-200 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{club?.name || "Unknown Club"}</p>
                                                <p className="text-sm text-gray-600">Applicant: {user?.name || user?.email || application.user_id}</p>
                                                <p className="text-xs text-gray-500">Email: {user?.email || "Unknown"}</p>
                                                <p className="text-xs text-gray-500">Phone: {application.phone || "Not provided"}</p>
                                                <p className="text-xs text-gray-500">Experience: {application.experience_level || "Not provided"}</p>
                                                <p className="text-xs text-gray-500">Runs: {application.preferred_run_days || "-"} @ {application.preferred_run_time || "-"}</p>
                                                <p className="text-xs text-gray-500">Location: {application.proposed_location || "-"}</p>
                                                {application.notes && <p className="mt-1 text-xs text-gray-500">Notes: {application.notes}</p>}
                                                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Status: {application.status}</p>
                                                {clubAssigned && <p className="text-xs text-amber-700">This club already has an assigned owner.</p>}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDecision(application.id, "rejected")}
                                                    disabled={savingId === application.id || application.status !== "pending"}
                                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleDecision(application.id, "approved")}
                                                    disabled={savingId === application.id || application.status !== "pending" || Boolean(clubAssigned)}
                                                    className="rounded-lg bg-black px-3 py-2 text-sm text-white hover:bg-black/90 disabled:opacity-50"
                                                >
                                                    {savingId === application.id ? "Saving..." : "Approve"}
                                                </button>
                                            </div>
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
