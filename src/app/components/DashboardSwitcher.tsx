"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DashboardSwitcherProps = {
    isAdmin: boolean;
    canAccessClubOwner: boolean;
    onLogout: () => void;
};

export function DashboardSwitcher({ isAdmin, canAccessClubOwner, onLogout }: DashboardSwitcherProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pathname = usePathname();

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
        };
    }, []);

    const itemClass = (href: string) => {
        const active = pathname === href;
        return `block rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
            }`;
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                aria-expanded={open}
                aria-label="Toggle dashboard menu"
            >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                Views
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
                    >
                        <div className="border-b border-gray-100 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500">Switch Workspace</p>
                        </div>
                        <div className="p-2">
                            <Link href="/dashboard/runner" onClick={() => setOpen(false)} className={itemClass("/dashboard/runner")}>
                                Runner View
                            </Link>
                            {canAccessClubOwner && (
                                <Link href="/dashboard/club" onClick={() => setOpen(false)} className={itemClass("/dashboard/club")}>
                                    Club Owner View
                                </Link>
                            )}
                            {isAdmin && (
                                <Link href="/dashboard/admin" onClick={() => setOpen(false)} className={itemClass("/dashboard/admin")}>
                                    Admin View
                                </Link>
                            )}
                            <Link href="/map" onClick={() => setOpen(false)} className={itemClass("/map")}>
                                Map
                            </Link>
                            <Link href="/discover" onClick={() => setOpen(false)} className={itemClass("/discover")}>
                                Discover Clubs
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    onLogout();
                                }}
                                className="mt-2 block w-full rounded-xl border border-gray-200 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                                Logout
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
