"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calendar,
    Map as MapIcon,
    MapPin,
    Menu,
    Users,
    X,
} from "lucide-react";
import { Logo } from "@/app/components/Logo";

export default function Page() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="min-h-screen overflow-x-hidden bg-white selection:bg-[#050505] selection:text-white">
            <nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
                <div className="mx-auto h-20 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-full items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Logo className="h-10 w-10 rounded-lg" />
                            <span className="brutal-text text-2xl">RUNCLUBSNEARME</span>
                        </div>

                        <div className="hidden items-center gap-8 md:flex">
                            <a href="#about" className="text-sm font-semibold uppercase tracking-[0.02em] hover:text-black/60">
                                About
                            </a>
                            <a href="#contact" className="text-sm font-semibold uppercase tracking-[0.02em] hover:text-black/60">
                                Contact
                            </a>
                            <Link href="/auth" className="text-sm font-semibold uppercase tracking-[0.02em] hover:text-black/60">
                                Login
                            </Link>
                            <Link href="/auth?mode=signup&role=club_owner" className="text-sm font-semibold uppercase tracking-[0.02em] hover:text-black/60">
                                Register Club
                            </Link>
                            <Link
                                href="/map"
                                className="rounded-xl bg-[#050505] px-8 py-3.5 font-display text-base uppercase tracking-[0.05em] text-white shadow-sm transition-all hover:bg-black/90 active:scale-95"
                            >
                                FIND CLUBS
                            </Link>
                        </div>

                        <button
                            className="p-2 md:hidden"
                            onClick={() => setIsMenuOpen((v) => !v)}
                            aria-label="Toggle navigation"
                        >
                            {isMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </nav>

            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-40 bg-white px-6 pt-24 md:hidden"
                    >
                        <div className="flex flex-col gap-6">
                            <a href="#about" className="text-2xl font-display uppercase" onClick={() => setIsMenuOpen(false)}>
                                About
                            </a>
                            <a href="#contact" className="text-2xl font-display uppercase" onClick={() => setIsMenuOpen(false)}>
                                Contact
                            </a>
                            <Link href="/auth" className="text-2xl font-display uppercase" onClick={() => setIsMenuOpen(false)}>
                                Login
                            </Link>
                            <Link href="/auth?mode=signup&role=club_owner" className="text-2xl font-display uppercase" onClick={() => setIsMenuOpen(false)}>
                                Register Club
                            </Link>
                            <Link
                                href="/map"
                                className="rounded-lg bg-[#050505] py-4 text-center brutal-text text-lg text-white"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                FIND CLUBS
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <section className="relative min-h-screen w-full overflow-hidden pb-16 pt-32">
                <div className="diagonal-stripes absolute inset-0 -z-10 opacity-40" />
                <div className="mx-auto w-full max-w-7xl px-4 text-center sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <span className="mb-4 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40 sm:text-xs">
                            FIND YOUR RUNNING COMMUNITY
                        </span>
                        <h1 className="font-display text-6xl uppercase leading-[0.85] tracking-tighter sm:text-8xl md:text-9xl">
                            FIND A RUN CLUB <br />
                            <span className="outline-text">NEAR YOU</span>
                        </h1>
                        <p className="mx-auto mb-12 mt-8 max-w-2xl text-lg font-medium text-black/60 sm:text-xl">
                            The easiest way to match your pace with a local crew. Discover clubs, track real-time runs, and meet your next running buddy.
                        </p>

                        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <Link
                                href="/map"
                                className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#050505] px-10 py-5 font-display text-lg uppercase tracking-[0.04em] text-white transition-all hover:bg-black/80 sm:w-auto"
                            >
                                OPEN THE MAP
                                <MapIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                            <a
                                href="#about"
                                className="w-full rounded-full border border-black/10 bg-white px-10 py-5 text-center font-display text-lg uppercase tracking-[0.04em] transition-all hover:bg-black/5 sm:w-auto"
                            >
                                SEE HOW IT WORKS
                            </a>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="bg-[#050505] py-24 text-white">
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
                        <motion.div whileHover={{ y: -10 }} className="rounded-2xl border border-white/10 bg-white/5 p-8">
                            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
                                <MapPin className="h-6 w-6" />
                            </div>
                            <h3 className="mb-4 font-display text-2xl uppercase">Real-time Directory</h3>
                            <p className="leading-relaxed text-white/60">
                                Browse an interactive map of run clubs across Australia. Filter by pace, distance, and vibe.
                            </p>
                        </motion.div>

                        <motion.div whileHover={{ y: -10 }} className="rounded-2xl border border-white/10 bg-white/5 p-8">
                            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <h3 className="mb-4 font-display text-2xl uppercase">Live Run Listings</h3>
                            <p className="leading-relaxed text-white/60">
                                Never miss a session. Get up-to-the-minute updates on club schedules and special events.
                            </p>
                        </motion.div>

                        <motion.div whileHover={{ y: -10 }} className="rounded-2xl border border-white/10 bg-white/5 p-8">
                            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-black">
                                <Users className="h-6 w-6" />
                            </div>
                            <h3 className="mb-4 font-display text-2xl uppercase">Run Buddy (Beta)</h3>
                            <p className="leading-relaxed text-white/60">
                                Looking for a specific pace? Connect with individual runners in your area for solo-turned-duo sessions.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            <section id="about" className="flex min-h-screen w-full items-center bg-white py-24">
                <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-20 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
                    <div>
                        <h2 className="mb-8 font-display text-5xl uppercase">About Us</h2>
                        <p className="mb-8 text-xl leading-relaxed text-black/60">
                            runclubsnearme is your go-to platform for discovering and connecting with running clubs across Australia. We believe that running is more enjoyable when you do it with others. Whether you are a seasoned runner or just getting started, we are here to help you find your crew.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <img
                                        key={i}
                                        src={`https://picsum.photos/seed/runner${i}/100/100`}
                                        alt="Runner"
                                        className="h-12 w-12 rounded-full border-2 border-white object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                ))}
                            </div>
                            <span className="text-sm font-medium text-black/40">+ 200 runners joined this month</span>
                        </div>
                    </div>

                    <div className="relative">
                        <img
                            src="https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&q=80&w=1000"
                            alt="Runners"
                            className="rounded-3xl shadow-2xl grayscale transition-all duration-700 hover:grayscale-0"
                            referrerPolicy="no-referrer"
                        />
                        <div className="absolute -bottom-6 -right-6 hidden rounded-2xl bg-[#050505] p-8 text-white sm:block">
                            <span className="block font-display text-4xl">100+</span>
                            <span className="text-xs uppercase tracking-widest opacity-60">Verified Clubs</span>
                        </div>
                    </div>
                </div>
            </section>

            <section id="coming-soon" className="flex min-h-screen w-full items-center border-t border-white/10 bg-[#050505] py-24 text-white">
                <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Coming Soon</p>
                        <h2 className="mb-6 font-display text-5xl uppercase leading-[0.95]">
                            Find Run Bud<br />
                            Match Feature
                        </h2>
                        <p className="max-w-xl text-lg leading-relaxed text-white/70">
                            We are introducing Find Run Bud, a smart matching feature to help runners discover partners with similar pace, distance goals, and preferred run times. Quickly move from browsing clubs to building your own reliable running crew.
                        </p>
                    </div>

                    <div className="grid grid-cols-6 gap-4">
                        <div className="col-span-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-white/30" />
                                <div className="h-2 w-2 rounded-full bg-white/30" />
                                <div className="h-2 w-2 rounded-full bg-white/30" />
                            </div>
                            <div className="space-y-2">
                                <div className="h-3 w-2/3 rounded bg-white/20" />
                                <div className="h-3 w-1/2 rounded bg-white/20" />
                                <div className="h-20 rounded-xl bg-[#0f0f0f] border border-white/10" />
                            </div>
                        </div>
                        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
                            <div className="h-full rounded-xl border border-dashed border-white/20 bg-[#0f0f0f]" />
                        </div>
                        <div className="col-span-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
                            <div className="h-24 rounded-xl border border-white/10 bg-[#0f0f0f]" />
                        </div>
                        <div className="col-span-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
                            <div className="h-24 rounded-xl border border-white/10 bg-[#0f0f0f]" />
                        </div>
                    </div>
                </div>
            </section>

            <section id="contact" className="border-t border-black/5 bg-white py-20">
                <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-[#ffffff] to-[#f7f7f7] p-8 shadow-[0_14px_40px_rgba(0,0,0,0.08)]">
                        <h2 className="mb-3 font-display text-4xl uppercase">Contact Us</h2>
                        <p className="mb-7 text-black/65">Questions, partnerships, media, or support? Send us a message and we will get back to you.</p>
                        <form className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <input
                                    type="text"
                                    placeholder="Your name"
                                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(5,5,5,0.08)]"
                                />
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(5,5,5,0.08)]"
                                />
                            </div>
                            <textarea
                                placeholder="Message"
                                rows={4}
                                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/40 focus:shadow-[0_0_0_3px_rgba(5,5,5,0.08)]"
                            />
                            <button
                                type="submit"
                                className="rounded-full bg-[#050505] px-9 py-3.5 font-display text-sm uppercase tracking-[0.08em] text-white transition hover:bg-black/90"
                            >
                                Send Message
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            <section id="register" className="border-t border-black/5 bg-[#f5f5f5] py-24">
                <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
                    <div className="rounded-2xl border border-black/8 bg-white p-10 shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
                        <h2 className="mb-4 font-display text-4xl uppercase">Want to register your run club with us?</h2>
                        <p className="mb-8 text-lg text-black/65">Share your schedule, route, and socials so local runners can find your community.</p>
                        <Link
                            href="/auth?mode=signup&role=club_owner"
                            className="inline-flex items-center rounded-full bg-[#050505] px-8 py-3 font-display text-sm uppercase tracking-[0.08em] text-white transition hover:bg-black/90"
                        >
                            Register My Club
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="border-t border-white/10 bg-[#050505] py-12 text-white">
                <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:px-8">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8 w-8 rounded-lg" />
                        <span className="brutal-text text-xl">RUNCLUBSNEARME</span>
                    </div>
                    <div className="flex gap-8 text-sm font-medium text-white/60">
                        <a href="#" className="hover:text-white">Privacy</a>
                        <a href="#" className="hover:text-white">Terms</a>
                        <a href="#" className="hover:text-white">Instagram</a>
                        <a href="#" className="hover:text-white">Strava</a>
                    </div>
                    <p className="text-sm text-white/55">© 2026 runclubsnearme. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
