"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { motion } from "framer-motion";
import { Calendar, LocateFixed, MapPin, ShieldAlert, X } from "lucide-react";
import { sydneyRunClubs } from "@/data/runClubs";

type Club = (typeof sydneyRunClubs)[number];

const DEFAULT_CENTER: [number, number] = [151.2093, -33.8688];

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const parseRunDays = (dayString: string): number[] => {
    const normalized = dayString.toLowerCase();

    if (normalized.includes("daily") || normalized.includes("everyday")) {
        return [0, 1, 2, 3, 4, 5, 6];
    }

    if (normalized.includes("weekday")) {
        return [1, 2, 3, 4, 5];
    }

    if (normalized.includes("weekend")) {
        return [0, 6];
    }

    const parts = normalized
        .replace(/\band\b/g, ",")
        .replace(/\//g, ",")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

    const found = new Set<number>();
    for (const part of parts) {
        const match = DAYS.findIndex((d) => part.startsWith(d.slice(0, 3)) || part.startsWith(d));
        if (match >= 0) found.add(match);
    }

    return [...found];
};

const parseRunTime = (timeString: string): { hours: number; minutes: number } => {
    const text = timeString.trim().toUpperCase();
    const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/);
    if (!match) {
        return { hours: 0, minutes: 0 };
    }

    let hours = Number(match[1]);
    const minutes = Number(match[2] || "0");
    const meridiem = match[3];

    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    return { hours, minutes };
};

const getNextRunTime = (dayString: string, timeString: string, now: Date = new Date()): Date => {
    const runDays = parseRunDays(dayString);
    const { hours, minutes } = parseRunTime(timeString);

    if (runDays.length === 0) {
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }

    let best: Date | null = null;
    for (const day of runDays) {
        const candidate = new Date(now);
        const diff = (day - now.getDay() + 7) % 7;
        candidate.setDate(now.getDate() + diff);
        candidate.setHours(hours, minutes, 0, 0);

        if (candidate <= now) {
            candidate.setDate(candidate.getDate() + 7);
        }

        if (!best || candidate.getTime() < best.getTime()) {
            best = candidate;
        }
    }

    return best || new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
};

export default function MapPage() {
    const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"run-clubs" | "upcoming-runs">("run-clubs");
    const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied">("pending");
    const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [visibleClubIds, setVisibleClubIds] = useState<Set<string>>(new Set());
    const [selectedRoute, setSelectedRoute] = useState<Array<[number, number]> | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

    const clubs = useMemo(() => [...sydneyRunClubs].sort((a, b) => a.name.localeCompare(b.name)), []);
    const displayedClubs = useMemo(() => {
        const now = new Date();
        // Filter clubs that are visible on the map if in run-clubs tab
        const clubsToDisplay = activeTab === "run-clubs" && visibleClubIds.size > 0
            ? clubs.filter(c => visibleClubIds.has(c.id))
            : clubs;

        if (activeTab === "upcoming-runs") {
            return [...clubs].sort((a, b) => getNextRunTime(a.day, a.time, now).getTime() - getNextRunTime(b.day, b.time, now).getTime());
        }
        return clubsToDisplay;
    }, [activeTab, clubs, visibleClubIds]);

    const isRunLive = useCallback((dayString: string, timeString: string, now: Date): boolean => {
        const nextRunTime = getNextRunTime(dayString, timeString, now);
        const lastRunTime = new Date(nextRunTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const liveWindow = 30 * 60 * 1000; // 30 minutes in milliseconds

        // Check if current time is within 30 minutes of a recent run start time
        // We need to check if it's today and within the time window
        const todayRunTime = new Date(now);
        const { hours, minutes } = parseRunTime(timeString);
        todayRunTime.setHours(hours, minutes, 0, 0);

        // Check if today's run, and we're within 30 minutes of start time
        if (now.toDateString() === todayRunTime.toDateString()) {
            const timeDiff = now.getTime() - todayRunTime.getTime();
            if (timeDiff >= 0 && timeDiff <= liveWindow) {
                return true;
            }
        }

        return false;
    }, []);

    const runs = useMemo(
        () => {
            const now = new Date();
            return [...clubs]
                .sort((a, b) => getNextRunTime(a.day, a.time, now).getTime() - getNextRunTime(b.day, b.time, now).getTime())
                .slice(0, 30)
                .map((club) => ({
                    id: `run-${club.id}`,
                    name: club.name,
                    club: club.name,
                    time: `${club.day} · ${club.time}`,
                    clubId: club.id,
                    isLive: isRunLive(club.day, club.time, currentTime),
                }));
        },
        [clubs, currentTime, isRunLive]
    );
    const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

    const clearClubMarkers = useCallback(() => {
        Object.values(markersRef.current).forEach((marker) => marker.remove());
        markersRef.current = {};
    }, []);

    const clearUserMarker = useCallback(() => {
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
    }, []);

    const updateVisibleClubs = useCallback((map: mapboxgl.Map) => {
        const bounds = map.getBounds();
        const visible = new Set<string>();

        if (bounds) {
            clubs.forEach(club => {
                if (bounds.contains([club.lng, club.lat])) {
                    visible.add(club.id);
                }
            });
        }

        setVisibleClubIds(visible);
    }, [clubs]);

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationStatus("denied");
            return;
        }

        setLocationStatus("pending");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lng = position.coords.longitude;
                const lat = position.coords.latitude;
                setUserCoords([lng, lat]);
                setLocationStatus("granted");
            },
            () => {
                setLocationStatus("denied");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 30000); // Update every 30 seconds

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!hasToken || !mapContainerRef.current || mapRef.current) {
            return;
        }

        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox/streets-v12",
            center: DEFAULT_CENTER,
            zoom: 11,
        });

        mapRef.current = map;

        map.on("load", () => {
            setMapReady(true);
            updateVisibleClubs(map);
        });

        map.on("move", () => {
            updateVisibleClubs(map);
        });

        return () => {
            clearClubMarkers();
            clearUserMarker();
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
    }, [clearClubMarkers, clearUserMarker, updateVisibleClubs, hasToken]);

    useEffect(() => {
        if (hasToken) {
            requestLocation();
        }
    }, [hasToken, requestLocation]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) {
            return;
        }

        // Remove existing route layer and source
        if (map.getLayer("route-layer")) {
            map.removeLayer("route-layer");
        }
        if (map.getSource("route-source")) {
            map.removeSource("route-source");
        }

        // If a club is selected and has a route, display it
        const selectedClub = clubs.find(c => c.id === selectedClubId);
        if (selectedClub?.route) {
            const routeCoordinates = selectedClub.route.coordinates;

            // Add the route source
            map.addSource("route-source", {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "LineString",
                        coordinates: routeCoordinates,
                    },
                },
            });

            // Add outer glow layer (wider, more transparent)
            map.addLayer({
                id: "route-glow-outer",
                type: "line",
                source: "route-source",
                paint: {
                    "line-color": "#ff0080",
                    "line-width": 28,
                    "line-opacity": 0.15,
                    "line-blur": 16,
                },
            });

            // Add mid glow layer
            map.addLayer({
                id: "route-glow-mid",
                type: "line",
                source: "route-source",
                paint: {
                    "line-color": "#ff0080",
                    "line-width": 18,
                    "line-opacity": 0.35,
                    "line-blur": 10,
                },
            });

            // Add inner glow layer
            map.addLayer({
                id: "route-glow",
                type: "line",
                source: "route-source",
                paint: {
                    "line-color": "#ff1493",
                    "line-width": 10,
                    "line-opacity": 0.6,
                    "line-blur": 4,
                },
            });

            // Add main route layer (core)
            map.addLayer({
                id: "route-layer",
                type: "line",
                source: "route-source",
                paint: {
                    "line-color": "#ff0080",
                    "line-width": 5,
                    "line-opacity": 1,
                },
            });

            setSelectedRoute(routeCoordinates);
        } else {
            setSelectedRoute(null);
        }

        return () => {
            const currentMap = mapRef.current;
            if (!currentMap) return;

            try {
                if (currentMap.getLayer("route-glow-outer")) {
                    currentMap.removeLayer("route-glow-outer");
                }
                if (currentMap.getLayer("route-glow-mid")) {
                    currentMap.removeLayer("route-glow-mid");
                }
                if (currentMap.getLayer("route-glow")) {
                    currentMap.removeLayer("route-glow");
                }
                if (currentMap.getLayer("route-layer")) {
                    currentMap.removeLayer("route-layer");
                }
                if (currentMap.getSource("route-source")) {
                    currentMap.removeSource("route-source");
                }
            } catch (e) {
                // Map already destroyed, silently fail
            }
        };
    }, [selectedClubId, clubs, mapReady]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) {
            return;
        }

        if (locationStatus !== "granted" || !userCoords) {
            clearClubMarkers();
            clearUserMarker();
            return;
        }

        clearClubMarkers();

        clubs.forEach((club) => {
            const el = document.createElement("button");
            el.type = "button";
            el.style.width = "16px";
            el.style.height = "16px";
            el.style.borderRadius = "999px";
            el.style.background = "#050505";
            el.style.border = "2px solid #fff";
            el.style.boxShadow = "0 6px 14px rgba(0,0,0,0.35)";
            el.style.cursor = "pointer";

            el.addEventListener("click", () => {
                setSelectedClubId(club.id);
                map.flyTo({ center: [club.lng, club.lat], zoom: 14, essential: true });
            });

            // Add tooltip on hover
            const popup = new mapboxgl.Popup({
                offset: 12,
                closeButton: false,
                className: 'club-tooltip'
            })
                .setHTML(`<div style="font-weight: 600; font-size: 11px; color: white; padding: 6px 10px; white-space: nowrap;">${club.name}</div>`);

            el.addEventListener("mouseenter", () => {
                popup.setLngLat([club.lng, club.lat]).addTo(map);
            });

            el.addEventListener("mouseleave", () => {
                popup.remove();
            });

            const marker = new mapboxgl.Marker({ element: el }).setLngLat([club.lng, club.lat]).addTo(map);
            markersRef.current[club.id] = marker;
        });

        if (!userMarkerRef.current) {
            const userEl = document.createElement("div");
            userEl.style.width = "24px";
            userEl.style.height = "24px";
            userEl.style.borderRadius = "999px";
            userEl.style.background = "#2563eb";
            userEl.style.border = "4px solid #ffffff";
            userEl.style.boxShadow = "0 0 0 8px rgba(37, 99, 235, 0.25)";

            userMarkerRef.current = new mapboxgl.Marker({ element: userEl })
                .setLngLat([userCoords[0], userCoords[1]])
                .addTo(map);
        } else {
            userMarkerRef.current.setLngLat([userCoords[0], userCoords[1]]);
        }

        map.flyTo({ center: [userCoords[0], userCoords[1]], zoom: 13, essential: true });
    }, [clubs, clearClubMarkers, clearUserMarker, locationStatus, mapReady, userCoords]);

    const handleSelectClub = (club: Club) => {
        if (locationStatus !== "granted") {
            return;
        }
        setSelectedClubId(club.id);
        mapRef.current?.flyTo({ center: [club.lng, club.lat], zoom: 14, essential: true });
    };

    return (
        <div className="fixed inset-0 bg-white text-[#050505]">
            <Link
                href="/"
                aria-label="Close map"
                className="absolute left-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#050505] shadow-sm transition hover:bg-black hover:text-white"
            >
                <X className="h-5 w-5" />
            </Link>

            <div className="grid h-full grid-cols-1 md:grid-cols-[1fr_360px]">
                <div className="relative">
                    {hasToken ? (
                        <>
                            <div
                                ref={mapContainerRef}
                                className={`h-full w-full transition ${locationStatus === "denied" ? "blur-[4px] brightness-60 grayscale-[25%]" : ""
                                    }`}
                            />

                            {locationStatus === "pending" && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050505]/25 px-6 backdrop-blur-[2px]">
                                    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#0a0a0a]/95 p-6 text-white shadow-[0_20px_45px_rgba(0,0,0,0.45)]">
                                        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                                        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
                                        <div className="relative flex items-start gap-4">
                                            <div className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10">
                                                <LocateFixed className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold tracking-[0.01em]">Locating you</p>
                                                <p className="mt-1 text-sm font-normal leading-relaxed text-white/70">
                                                    Hold tight while we request your location so we can show nearby run clubs.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {locationStatus === "denied" && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#050505]/30 px-6 backdrop-blur-[2px]">
                                    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-5 shadow-[0_24px_55px_rgba(0,0,0,0.35)]">
                                        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#050505]/8 blur-2xl" />
                                        <div className="relative">
                                            <div className="flex items-center gap-2.5">
                                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#050505] text-white">
                                                    <ShieldAlert className="h-4 w-4" />
                                                </span>
                                                <p className="text-xl font-semibold leading-tight text-[#050505]">
                                                    Location access needed
                                                </p>
                                            </div>
                                            <p className="mt-2.5 text-sm font-normal leading-relaxed text-[#4e5d72]">
                                                Please allow location access to unlock nearby run clubs and get personalized map results.
                                            </p>
                                            <div className="mt-5 flex flex-wrap gap-3">
                                                <button
                                                    type="button"
                                                    onClick={requestLocation}
                                                    className="rounded-full bg-[#050505] px-6 py-2.5 text-sm font-semibold tracking-[0.01em] text-white transition hover:bg-black/90"
                                                >
                                                    Enable Location
                                                </button>
                                                <Link
                                                    href="/"
                                                    className="rounded-full border border-[#d7dbe1] bg-white px-6 py-2.5 text-sm font-medium tracking-[0.01em] text-[#050505]"
                                                >
                                                    Back To Home
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[#5f6f85]">
                            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env.local to view the interactive map.
                        </div>
                    )}
                </div>

                <aside className="flex h-full min-h-0 flex-col border-l border-black/5 bg-white md:w-[360px]">
                    <div className="flex border-b border-black/5 px-4">
                        <div className="relative flex-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("run-clubs")}
                                className={`relative w-full overflow-hidden py-5 text-[15px] font-bold uppercase tracking-tight transition-all ${activeTab === "run-clubs"
                                    ? "text-black"
                                    : "text-black/20 hover:text-black/30"
                                    }`}
                            >
                                Run Clubs
                            </button>
                            {activeTab === "run-clubs" && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-black" />}
                        </div>
                        <div className="relative flex-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("upcoming-runs")}
                                className={`relative w-full overflow-hidden py-5 text-[15px] font-bold uppercase tracking-tight transition-all ${activeTab === "upcoming-runs"
                                    ? "text-black"
                                    : "text-black/20 hover:text-black/30"
                                    }`}
                            >
                                Upcoming Runs
                            </button>
                            {activeTab === "upcoming-runs" && (
                                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-black" />
                            )}
                        </div>
                    </div>

                    <div className="px-6 py-5">
                        <h2 className="text-xl font-black uppercase tracking-tighter leading-none text-[#050505]">
                            {activeTab === "run-clubs" ? `${displayedClubs.length} Communities near you` : `${runs.length} Runs scheduled`}
                        </h2>
                        <p className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] text-black/40">
                            In
                            <MapPin className="-mt-0.5 h-2.5 w-2.5" />
                            <span className="text-black">Sydney</span>
                        </p>
                    </div>

                    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
                        {locationStatus !== "granted" ? (
                            <div className="rounded-xl border border-[#e0e0e0] bg-white p-4 text-sm text-[#5f6f85] shadow-sm">
                                Enable location access to unlock nearby run clubs on the map.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {activeTab === "run-clubs" ? (
                                    displayedClubs.map((club) => {
                                        const active = selectedClubId === club.id;
                                        return (
                                            <button
                                                key={club.id}
                                                type="button"
                                                onClick={() => handleSelectClub(club)}
                                                className={`group w-full cursor-pointer rounded-xl border bg-white p-3 text-left shadow-sm transition-all ${active ? "border-black/20" : "border-black/5 hover:border-black/10"
                                                    }`}
                                            >
                                                <h3 className="text-[14px] leading-none font-extrabold uppercase tracking-tight text-black transition-colors group-hover:text-black">
                                                    {club.name}
                                                </h3>
                                                <p className="mt-1 text-xs font-medium text-black/50">{club.day} · {club.time}</p>
                                                <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-black/20 transition-colors group-hover:text-black/40">
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    {club.location}
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    runs.map((run) => {
                                        const relatedClub = clubs.find((c) => c.id === run.clubId);
                                        return (
                                            <button
                                                key={run.id}
                                                type="button"
                                                onClick={() => relatedClub && handleSelectClub(relatedClub)}
                                                className="group w-full cursor-pointer rounded-xl border border-black/5 bg-white p-3 text-left shadow-sm transition-all hover:border-black/10"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-[14px] leading-none font-extrabold uppercase tracking-tight text-black transition-colors group-hover:text-black">
                                                        {run.name}
                                                    </h3>
                                                    {run.isLive && (
                                                        <span className="shrink-0 rounded bg-black px-1 py-0.5 text-[7px] font-bold text-white">LIVE</span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs font-medium text-black/50">{run.club}</p>
                                                <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-black/20 transition-colors group-hover:text-black/40">
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    {run.time}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
