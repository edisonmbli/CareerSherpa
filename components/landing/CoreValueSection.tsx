'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Database, Zap, Target } from 'lucide-react'

function AbstractEngine() {
    const [phase, setPhase] = useState<'idle' | 'targetAppears' | 'gathering' | 'collision' | 'emitting'>('idle')
    const [targetPos, setTargetPos] = useState({ x: 150, y: 0 })
    const [loopKey, setLoopKey] = useState(0)

    useEffect(() => {
        let unmounted = false
        let loopCount = 1
        const runLoop = () => {
            if (unmounted) return

            // Random distance and angle for the new target
            const r = 90 + Math.random() * 60 // distance between 90 and 150
            const theta = Math.random() * Math.PI * 2

            setTargetPos({
                x: Number((Math.cos(theta) * r).toFixed(3)),
                y: Number((Math.sin(theta) * r).toFixed(3))
            })
            setLoopKey(loopCount++)
            setPhase('targetAppears')

            setTimeout(() => {
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
                            setPhase('idle')

                            setTimeout(() => {
                                if (unmounted) return
                                runLoop()
                            }, 3000) // relaxed pause duration
                        }, 1300) // emitting duration
                    }, 800) // collision duration
                }, 2000) // gathering duration
            }, 800) // targetAppears duration
        }

        const initialTimer = setTimeout(() => {
            runLoop()
        }, 300)

        return () => {
            unmounted = true
            clearTimeout(initialTimer)
        }
    }, [])

    // Deterministic pseudo-random for SSR hydration safety
    const getPseudoRandom = (seed: number) => {
        const x = Math.sin(seed + 1) * 10000;
        return x - Math.floor(x);
    }

    // Abstract particles
    const particles = Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180
        const distance = 110 + getPseudoRandom(i) * 50
        const startX = Number((Math.cos(angle) * distance).toFixed(3))
        const startY = Number((Math.sin(angle) * distance).toFixed(3))
        const delay = Number((getPseudoRandom(i + 100) * 1.5).toFixed(3))
        return { id: i, startX, startY, delay }
    })

    return (
        <div className="relative w-full aspect-[4/3] md:aspect-auto md:h-[500px] flex items-center justify-center p-4">
            <svg viewBox="-200 -150 400 300" className="w-full h-full overflow-visible z-10">
                <defs>
                    <radialGradient id="gridMaskGradient">
                        <stop offset="30%" stopColor="white" stopOpacity="1" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                    <mask id="gridMask">
                        <rect x="-200" y="-150" width="400" height="300" fill="url(#gridMaskGradient)" />
                    </mask>
                    <radialGradient id="auraLight">
                        <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.5" />
                        <stop offset="50%" stopColor="#a5f3fc" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#a5f3fc" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="auraDark">
                        <stop offset="0%" stopColor="#0891b2" stopOpacity="0.15" />
                        <stop offset="50%" stopColor="#0891b2" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
                    </radialGradient>
                    <filter id="glowDark">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="glowLight">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Central Aura Flare on Match */}
                <g className="pointer-events-none">
                    <motion.circle
                        cx="0" cy="0" r="200"
                        fill="url(#auraLight)"
                        className="dark:hidden"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: phase === 'emitting' ? 1 : 0, scale: phase === 'emitting' ? 1 : 0.8 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                    <motion.circle
                        cx="0" cy="0" r="200"
                        fill="url(#auraDark)"
                        className="hidden dark:block"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: phase === 'emitting' ? 1 : 0, scale: phase === 'emitting' ? 1 : 0.8 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </g>

                {/* Ambient Grid Lines (Data structure) */}
                <g className="stroke-blue-900/[0.08] dark:stroke-white/[0.05]" strokeWidth="1.5" mask="url(#gridMask)" strokeDasharray="1 10" strokeLinecap="round">
                    {Array.from({ length: 15 }).map((_, i) => (
                        <line key={`v${i}`} x1={-210 + i * 30} y1="-150" x2={-210 + i * 30} y2="150" />
                    ))}
                    {Array.from({ length: 13 }).map((_, i) => (
                        <line key={`h${i}`} x1="-210" y1={-180 + i * 30} x2="210" y2={-180 + i * 30} />
                    ))}
                </g>

                {/* Technical Viewfinder / Calibration Marks */}
                <g className="stroke-slate-300/70 dark:stroke-slate-700/50" strokeWidth="1" fill="none">
                    <path d="M-180 -120 L-180 -130 L-170 -130" />
                    <path d="M180 -120 L180 -130 L170 -130" />
                    <path d="M-180 120 L-180 130 L-170 130" />
                    <path d="M180 120 L180 130 L170 130" />
                    <circle cx="-180" cy="-130" r="1.5" className="fill-slate-300/70 dark:fill-slate-700/50" />
                    <circle cx="180" cy="-130" r="1.5" className="fill-slate-300/70 dark:fill-slate-700/50" />
                    <circle cx="-180" cy="130" r="1.5" className="fill-slate-300/70 dark:fill-slate-700/50" />
                    <circle cx="180" cy="130" r="1.5" className="fill-slate-300/70 dark:fill-slate-700/50" />
                </g>

                {/* Abstract HUD Rings (Blueprint aesthetic) */}
                <motion.g className="stroke-blue-900/[0.04] dark:stroke-white/[0.02]" fill="none" strokeWidth="1">
                    <circle cx="0" cy="0" r="120" />
                    <circle cx="0" cy="0" r="120" strokeDasharray="2 6" strokeWidth="2" />
                    <circle cx="0" cy="0" r="80" />

                    {/* Rotating Scanner Data Arcs */}
                    <motion.path
                        d="M 0 -120 A 120 120 0 0 1 120 0"
                        className="stroke-cyan-200/60 dark:stroke-cyan-500/20"
                        strokeWidth="1.5"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, ease: "linear", repeat: Infinity }}
                        style={{ transformOrigin: "0px 0px" }}
                    />
                    <motion.path
                        d="M -80 0 A 80 80 0 0 1 0 -80"
                        className="stroke-cyan-200/40 dark:stroke-cyan-400/30"
                        strokeWidth="1"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 25, ease: "linear", repeat: Infinity }}
                        style={{ transformOrigin: "0px 0px" }}
                    />
                </motion.g>

                {/* Abstract Particles (User specific data points) */}
                <g>
                    {particles.map((p) => {
                        const isGathering = phase === 'gathering' || phase === 'collision'
                        return (
                            <motion.circle
                                key={p.id}
                                r="1.5"
                                className="fill-slate-400 dark:fill-slate-500"
                                initial={{ cx: p.startX, cy: p.startY, opacity: 0 }}
                                animate={{
                                    cx: isGathering ? [p.startX, 0] : p.startX,
                                    cy: isGathering ? [p.startY, 0] : p.startY,
                                    opacity: isGathering ? [0, 1, 0] : 0,
                                }}
                                transition={{
                                    duration: 1.5,
                                    ease: "circIn",
                                    delay: isGathering ? p.delay : 0,
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
                            phase === 'collision' ? "stroke-cyan-200 dark:stroke-cyan-500" : "stroke-slate-300 dark:stroke-slate-700"
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
                        className={cn("transition-colors duration-300 [filter:url(#glowLight)] dark:[filter:url(#glowDark)]",
                            (phase === 'collision' || phase === 'emitting') ? "stroke-cyan-200 dark:stroke-cyan-400" : "stroke-slate-400 dark:stroke-slate-500"
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
                            transformOrigin: "0px 0px"
                        }}
                    />

                    <motion.circle
                        cx="0" cy="0" r="4"
                        className={cn("transition-colors duration-300 [filter:url(#glowLight)] dark:[filter:url(#glowDark)]",
                            (phase === 'collision' || phase === 'emitting') ? "fill-cyan-200 dark:fill-cyan-300" : "fill-slate-600 dark:fill-slate-400"
                        )}
                    />
                </g>

                {/* Target Node & Emitting */}
                <g>
                    {/* Laser Beam */}
                    <AnimatePresence>
                        {phase === 'emitting' && (
                            <motion.line
                                x1="0" y1="0"
                                x2={targetPos.x} y2={targetPos.y}
                                className="stroke-cyan-200 dark:stroke-cyan-400 [filter:url(#glowLight)] dark:[filter:url(#glowDark)]"
                                strokeWidth="2"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Target Geometry (JD Abstraction) */}
                    <motion.g
                        key={loopKey}
                        initial={{ opacity: 0, x: targetPos.x + 20, y: targetPos.y }}
                        animate={{
                            opacity: phase === 'idle' ? 0 : 1,
                            x: phase === 'idle' ? targetPos.x + 20 : targetPos.x,
                            y: targetPos.y
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        {/* Ripple Effect on hit */}
                        <AnimatePresence>
                            {phase === 'emitting' && (
                                <motion.circle
                                    cx="0" cy="0" r="16"
                                    fill="none"
                                    className="stroke-cyan-200 dark:stroke-cyan-400"
                                    strokeWidth="1.5"
                                    initial={{ scale: 0.5, opacity: 1 }}
                                    animate={{ scale: 2.5, opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    style={{ transformOrigin: "0px 0px" }}
                                />
                            )}
                        </AnimatePresence>
                        <AnimatePresence>
                            {phase === 'emitting' && (
                                <motion.circle
                                    cx="0" cy="0" r="16"
                                    fill="none"
                                    className="stroke-cyan-200 dark:stroke-cyan-400"
                                    strokeWidth="1"
                                    initial={{ scale: 0.5, opacity: 1 }}
                                    animate={{ scale: 3.5, opacity: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                                    style={{ transformOrigin: "0px 0px" }}
                                />
                            )}
                        </AnimatePresence>

                        <motion.rect
                            x="-8" y="-8" width="16" height="16"
                            fill="none"
                            className={cn("transition-colors duration-300",
                                phase === 'emitting' ? "stroke-cyan-200 dark:stroke-cyan-400" : "stroke-slate-400 dark:stroke-slate-600"
                            )}
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            animate={{ rotate: phase === 'emitting' ? 180 : 0 }}
                            transition={{ duration: phase === 'emitting' ? 0.5 : 20, ease: phase === 'emitting' ? "easeInOut" : "linear", repeat: Infinity }}
                            style={{ transformOrigin: "0px 0px" }}
                        />
                        <circle
                            cx="0" cy="0" r="3"
                            className={cn("transition-colors duration-300 [filter:url(#glowLight)] dark:[filter:url(#glowDark)]",
                                phase === 'emitting' ? "fill-cyan-200 dark:fill-cyan-300" : "fill-slate-400 dark:fill-slate-600"
                            )}
                        />

                        {/* Target Label */}
                        <text x="0" y="-16" className="text-[10px] fill-slate-500 dark:fill-slate-500 font-mono tracking-widest font-bold uppercase transition-opacity" textAnchor="middle">
                            [JD]
                        </text>
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
        <section className="w-full relative">
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
                        className={cn(
                            "w-full rounded-2xl sm:rounded-[2.5rem] overflow-hidden backdrop-blur-3xl relative",
                            "bg-white/80 dark:bg-black/20",
                            "border border-slate-200/50 dark:border-white/10",
                            "shadow-2xl shadow-slate-200/50 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                        )}
                    >
                        {/* Light Mode Inner Ambient Vignette */}
                        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.02)_100%)] dark:hidden" />

                        <AbstractEngine />
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
