'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Database, Zap, Target } from 'lucide-react'

function AbstractEngine() {
    const [phase, setPhase] = useState<'gathering' | 'collision' | 'emitting'>('gathering')

    useEffect(() => {
        let unmounted = false
        const runLoop = () => {
            if (unmounted) return
            setPhase('gathering')

            setTimeout(() => {
                if (unmounted) return
                setPhase('collision')

                setTimeout(() => {
                    if (unmounted) return
                    setPhase('emitting')

                    setTimeout(() => {
                        if (unmounted) return
                        runLoop()
                    }, 2000) // emitting duration
                }, 800) // collision duration
            }, 2500) // gathering duration
        }

        runLoop()
        return () => { unmounted = true }
    }, [])

    // Deterministic pseudo-random for SSR hydration safety
    const getPseudoRandom = (seed: number) => {
        const x = Math.sin(seed + 1) * 10000;
        return x - Math.floor(x);
    }

    // Abstract particles streaming into the core
    const particles = Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 22.5 * Math.PI) / 180
        // scatter particles off-center
        const distance = 140 + getPseudoRandom(i) * 40
        const startX = Number((Math.cos(angle) * distance).toFixed(3))
        const startY = Number((Math.sin(angle) * distance).toFixed(3))
        const delay = Number((getPseudoRandom(i + 100) * 2).toFixed(3))
        return { id: i, startX, startY, delay }
    })

    return (
        <div className="relative w-full aspect-[4/3] md:aspect-auto md:h-[500px] flex items-center justify-center p-4">
            {/* Background Volumetric Glow (Cyan only) */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[120px] pointer-events-none transition-colors duration-1000"
                animate={{
                    backgroundColor: phase === 'emitting' || phase === 'collision' ? 'rgba(6, 182, 212, 0.15)' : 'transparent'
                }}
            />

            <svg viewBox="-200 -150 400 300" className="w-full h-full overflow-visible z-10">
                <defs>
                    <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Ambient Grid Lines (Data structure) */}
                <g className="stroke-white/5 dark:stroke-white/5" strokeWidth="0.5">
                    {Array.from({ length: 11 }).map((_, i) => (
                        <line key={`v${i}`} x1={-150 + i * 30} y1="-150" x2={-150 + i * 30} y2="150" />
                    ))}
                    {Array.from({ length: 11 }).map((_, i) => (
                        <line key={`h${i}`} x1="-150" y1={-150 + i * 30} x2="150" y2={-150 + i * 30} />
                    ))}
                </g>

                {/* Abstract Particles (User specific data points) */}
                <g>
                    {particles.map((p) => {
                        const isGathering = phase === 'gathering'
                        return (
                            <motion.circle
                                key={p.id}
                                r="1.5"
                                className="fill-slate-400 dark:fill-slate-500"
                                initial={{ cx: p.startX, cy: p.startY, opacity: 0 }}
                                animate={{
                                    cx: isGathering ? [p.startX, 0] : 0,
                                    cy: isGathering ? [p.startY, 0] : 0,
                                    opacity: isGathering ? [0, 1, 0] : 0,
                                }}
                                transition={{
                                    duration: 2.5,
                                    ease: "circIn",
                                    delay: p.delay,
                                    repeat: isGathering ? Infinity : 0
                                }}
                            />
                        )
                    })}
                </g>

                {/* The Collision Core (Engine) */}
                <g>
                    {/* Outer Ring */}
                    <motion.circle
                        cx="0" cy="0" r="45"
                        fill="none"
                        className="stroke-slate-300 dark:stroke-slate-700"
                        strokeWidth="0.5"
                        strokeDasharray="2 10"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 30, ease: "linear", repeat: Infinity }}
                        style={{ transformOrigin: "0px 0px" }}
                    />

                    {/* Middle Data Track */}
                    <motion.circle
                        cx="0" cy="0" r="30"
                        fill="none"
                        className={cn("transition-colors duration-500",
                            phase === 'collision' ? "stroke-cyan-500" : "stroke-slate-400 dark:stroke-slate-600"
                        )}
                        strokeWidth="1"
                        strokeDasharray="15 5"
                        animate={{
                            rotate: phase === 'collision' ? -360 : 360,
                            scale: phase === 'collision' ? 1.1 : 1
                        }}
                        transition={{
                            rotate: { duration: phase === 'collision' ? 1 : 15, ease: "linear", repeat: Infinity },
                            scale: { duration: 0.3 }
                        }}
                        style={{ transformOrigin: "0px 0px" }}
                    />

                    {/* Intense Inner Core */}
                    <motion.circle
                        cx="0" cy="0" r="12"
                        fill="none"
                        className={cn("transition-colors duration-300",
                            (phase === 'collision' || phase === 'emitting') ? "stroke-cyan-400" : "stroke-slate-500 dark:stroke-slate-400"
                        )}
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        animate={{
                            scale: phase === 'gathering' ? [1, 1.1, 1] : (phase === 'collision' ? [1, 1.5, 1] : 1),
                            rotate: phase === 'collision' ? 360 : -360
                        }}
                        transition={{
                            scale: { duration: phase === 'collision' ? 0.3 : 2, repeat: Infinity },
                            rotate: { duration: phase === 'collision' ? 0.5 : 8, ease: "linear", repeat: Infinity }
                        }}
                        style={{
                            filter: (phase === 'collision' || phase === 'emitting') ? "url(#glow)" : "none",
                            transformOrigin: "0px 0px"
                        }}
                    />

                    <motion.circle
                        cx="0" cy="0" r="4"
                        className={cn("transition-colors duration-300",
                            (phase === 'collision' || phase === 'emitting') ? "fill-cyan-300" : "fill-slate-600 dark:fill-slate-300"
                        )}
                        style={{ filter: (phase === 'collision' || phase === 'emitting') ? "url(#glow)" : "none" }}
                    />
                </g>

                {/* Emitting Laser & Target Node */}
                <g>
                    {/* Laser Beam */}
                    <AnimatePresence>
                        {phase === 'emitting' && (
                            <motion.line
                                x1="20" y1="0"
                                x2="150" y2="0"
                                stroke="url(#laserGrad)"
                                strokeWidth="2"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                style={{ filter: "url(#glow)" }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Target Geometry (JD Abstraction) */}
                    <motion.g
                        animate={{ scale: phase === 'emitting' ? [1, 1.1, 1] : 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <motion.rect
                            x="142" y="-8" width="16" height="16"
                            fill="none"
                            className={cn("transition-colors duration-300",
                                phase === 'emitting' ? "stroke-cyan-500" : "stroke-slate-300 dark:stroke-slate-700"
                            )}
                            strokeWidth="1"
                            animate={{ rotate: 180 }}
                            transition={{ duration: 15, ease: "linear", repeat: Infinity }}
                            style={{ transformOrigin: "150px 0px" }}
                        />
                        <circle
                            cx="150" cy="0" r="3"
                            className={cn("transition-colors duration-300",
                                phase === 'emitting' ? "fill-cyan-400" : "fill-slate-400 dark:fill-slate-600"
                            )}
                            style={{ filter: phase === 'emitting' ? "url(#glow)" : "none" }}
                        />

                        {/* Output trailing data */}
                        <AnimatePresence>
                            {phase === 'emitting' && (
                                <motion.line
                                    x1="160" y1="0" x2="200" y2="0"
                                    className="stroke-cyan-500/50"
                                    strokeWidth="1"
                                    strokeDasharray="2 4"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: [0, 1, 0] }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
                                />
                            )}
                        </AnimatePresence>
                    </motion.g>
                </g>

            </svg>
        </div>
    )
}

export function CoreValueSection({ dict }: { dict: any }) {
    const t = dict.coreValue || {}

    const features = [
        {
            icon: Database,
            title: t.f1Title,
            desc: t.f1Desc
        },
        {
            icon: Zap,
            title: t.f2Title,
            desc: t.f2Desc
        },
        {
            icon: Target,
            title: t.f3Title,
            desc: t.f3Desc
        }
    ]

    return (
        <section className="w-full py-24 sm:py-32 relative overflow-hidden bg-slate-50 border-b border-black/5 dark:border-white/5 dark:bg-[#09090B]">
            <div className="container mx-auto px-4 relative z-10 max-w-6xl">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">

                    {/* Left Column: Storytelling / Copy */}
                    <div className="flex flex-col gap-10 lg:-mt-[50px]">
                        <div className="flex flex-col gap-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 w-fit border border-black/5 dark:border-white/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                    {t.tag}
                                </span>
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance break-words leading-tight">
                                {t.title}
                            </h2>

                            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 font-medium tracking-tight text-balance break-words leading-relaxed max-w-xl">
                                {t.subtitle}
                            </p>
                        </div>

                        {/* Abstract Feature List */}
                        <div className="flex flex-col gap-6">
                            {features.map((feature, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 backdrop-blur-md">
                                        <feature.icon className="w-5 h-5 stroke-[1.5]" />
                                    </div>
                                    <div className="flex flex-col gap-1 pt-0.5">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                            {feature.title}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-balance">
                                            {feature.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Abstract Engine Graphic */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="w-full rounded-2xl sm:rounded-[2.5rem] bg-white/50 dark:bg-black/20 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden"
                    >
                        <AbstractEngine />
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
