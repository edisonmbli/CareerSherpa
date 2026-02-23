'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// Data models for the animation
const SCENARIOS = [
    { id: 'jd1', x: 200, y: -80, name: 'Product Manager', matchColor: '#0ea5e9', activeBlocks: [0, 2, 4, 7] }, // cyan
    { id: 'jd2', x: 200, y: 0, name: 'Software Engineer', matchColor: '#10b981', activeBlocks: [1, 3, 5, 8] }, // emerald
    { id: 'jd3', x: 200, y: 80, name: 'Data Analyst', matchColor: '#8b5cf6', activeBlocks: [0, 4, 6, 8] }, // violet
]

const BLOCKS = [
    { id: 0, x: -130, y: -80, w: 30, h: 30, label: 'Edu' },
    { id: 1, x: -80, y: -80, w: 50, h: 30, label: 'Code' },
    { id: 2, x: -10, y: -80, w: 30, h: 30, label: 'Cert' },

    { id: 3, x: -130, y: -30, w: 60, h: 40, label: 'Proj A' },
    { id: 4, x: -50, y: -30, w: 70, h: 40, label: 'Exp B' },

    { id: 5, x: -130, y: 30, w: 40, h: 50, label: 'Skill' },
    { id: 6, x: -70, y: 30, w: 30, h: 50, label: 'Data' },
    { id: 7, x: -20, y: 30, w: 40, h: 50, label: 'Lead' },

    { id: 8, x: -130, y: 100, w: 150, h: 20, label: 'Interests' }
]

function CollisionEngine({ dict }: { dict: any }) {
    const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0)
    const [phase, setPhase] = useState<'idle' | 'scanning' | 'matching'>('idle')

    useEffect(() => {
        let unmounted = false

        const runLoop = () => {
            if (unmounted) return
            setPhase('idle')

            setTimeout(() => {
                if (unmounted) return
                setPhase('scanning')

                setTimeout(() => {
                    if (unmounted) return
                    setPhase('matching')

                    setTimeout(() => {
                        if (unmounted) return
                        // Move to next scenario
                        setCurrentScenarioIndex((prev) => (prev + 1) % SCENARIOS.length)
                        runLoop()
                    }, 3000) // Match display duration
                }, 1500) // Scanning duration
            }, 500) // Idle duration
        }

        runLoop()

        return () => {
            unmounted = true
        }
    }, [])

    const scenario = SCENARIOS[currentScenarioIndex]!

    return (
        <div className="relative w-full aspect-[4/3] md:aspect-auto md:h-[500px] flex items-center justify-center p-4">
            {/* Dynamic Background Glow */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full blur-[100px] pointer-events-none transition-colors duration-1000"
                animate={{
                    backgroundColor: phase === 'matching' ? `${scenario.matchColor}20` : 'transparent'
                }}
            />

            <svg viewBox="-150 -150 460 300" className="w-full h-full overflow-visible z-10">

                {/* Column 1: Personal Asset Library */}
                <g>
                    <text x="-55" y="-130" className="text-[12px] fill-slate-900 dark:fill-white font-bold" textAnchor="middle">{dict?.step1}</text>
                    <text x="-55" y="-115" className="text-[8px] fill-slate-400 dark:fill-slate-500 font-mono tracking-widest" textAnchor="middle">ASSET LIBRARY</text>

                    {/* Library Boundary */}
                    <rect x="-140" y="-100" width="170" height="240" rx="12" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Library Blocks */}
                    {BLOCKS.map((block) => {
                        const isMatched = phase === 'matching' && scenario.activeBlocks.includes(block.id)

                        return (
                            <g key={block.id}>
                                {/* Connecting Lines during match */}
                                {isMatched && (
                                    <motion.line
                                        x1={block.x + block.w} y1={block.y + block.h / 2}
                                        x2={scenario.x} y2={scenario.y + 15}
                                        stroke={scenario.matchColor}
                                        strokeWidth="1.5"
                                        strokeDasharray="4 2"
                                        className="opacity-40"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                )}

                                {/* The Block */}
                                <motion.rect
                                    x={block.x} y={block.y}
                                    width={block.w} height={block.h}
                                    rx="4"
                                    className={cn(
                                        "transition-all duration-500",
                                        isMatched
                                            ? "fill-white dark:fill-slate-900 shadow-lg"
                                            : "fill-white/50 dark:fill-slate-800/50 outline outline-1 outline-black/5 dark:outline-white/10"
                                    )}
                                    style={{
                                        stroke: isMatched ? scenario.matchColor : 'transparent',
                                        strokeWidth: 2
                                    }}
                                    animate={{
                                        scale: isMatched ? 1.05 : 1,
                                        opacity: phase === 'idle' ? 0.7 : (isMatched ? 1 : 0.3)
                                    }}
                                />

                                {/* Block Label */}
                                <motion.text
                                    x={block.x + block.w / 2}
                                    y={block.y + block.h / 2 + 3}
                                    textAnchor="middle"
                                    className="text-[8px] font-medium"
                                    animate={{
                                        fill: isMatched ? scenario.matchColor : '#64748b'
                                    }}
                                >
                                    {block.label}
                                </motion.text>
                            </g>
                        )
                    })}

                    {/* Scanning Laser */}
                    <AnimatePresence>
                        {phase === 'scanning' && (
                            <motion.line
                                x1="-150" x2="30"
                                y1="-90" y2="-90"
                                stroke={scenario.matchColor}
                                strokeWidth="2"
                                initial={{ y: -90, opacity: 0 }}
                                animate={{ y: [-90, 130, -90], opacity: [0, 1, 1, 0] }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1.5, ease: "linear" }}
                                className="drop-shadow-lg"
                            />
                        )}
                    </AnimatePresence>
                </g>

                {/* Column 2: Graph Engine */}
                <g>
                    <text x="115" y="-130" className="text-[12px] fill-slate-900 dark:fill-white font-bold" textAnchor="middle">{dict?.step2}</text>
                    <text x="115" y="-115" className="text-[8px] fill-slate-400 dark:fill-slate-500 font-mono tracking-widest" textAnchor="middle">AI COLLISION</text>
                </g>

                {/* Column 3: Target Opportunities */}
                <g>
                    <text x="245" y="-130" className="text-[12px] fill-slate-900 dark:fill-white font-bold" textAnchor="middle">{dict?.step3}</text>
                    <text x="245" y="-115" className="text-[8px] fill-slate-400 dark:fill-slate-500 font-mono tracking-widest" textAnchor="middle">TARGET OPPORTUNITIES</text>

                    {SCENARIOS.map((scen, idx) => {
                        const isActive = currentScenarioIndex === idx

                        return (
                            <motion.g
                                key={scen.id}
                                animate={{
                                    opacity: isActive ? 1 : 0.4,
                                    scale: isActive ? 1.05 : 0.95,
                                    x: isActive ? -10 : 0
                                }}
                                transition={{ duration: 0.5 }}
                            >
                                <rect
                                    x={scen.x} y={scen.y}
                                    width="90" height="30"
                                    rx="6"
                                    className="fill-white dark:fill-slate-900 stroke-1 shadow-sm transition-all duration-300"
                                    style={{
                                        stroke: isActive ? scen.matchColor : 'rgba(156, 163, 175, 0.2)'
                                    }}
                                />
                                <text
                                    x={scen.x + 45} y={scen.y + 18}
                                    textAnchor="middle"
                                    className="text-[9px] font-bold"
                                    style={{ fill: isActive ? scen.matchColor : '#94a3b8' }}
                                >
                                    {scen.name}
                                </text>
                                {/* Mini JD lines */}
                                <line x1={scen.x + 10} y1={scen.y + 24} x2={scen.x + 40} y2={scen.y + 24} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-slate-700" />
                                <line x1={scen.x + 45} y1={scen.y + 24} x2={scen.x + 80} y2={scen.y + 24} stroke="#cbd5e1" strokeWidth="1" className="dark:stroke-slate-700" />
                            </motion.g>
                        )
                    })}
                </g>

            </svg>
        </div>
    )
}

export function CoreValueSection({ dict }: { dict: any }) {
    const t = dict.coreValue || {}

    return (
        <section className="w-full py-20 sm:py-32 relative overflow-hidden bg-slate-50 border-b border-black/5 dark:border-white/5 dark:bg-[#09090B]">
            <div className="container mx-auto px-4 relative z-10 max-w-6xl">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">

                    {/* Left Column: Storytelling / Copy */}
                    <div className="flex flex-col gap-6 sm:gap-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 w-fit border border-black/5 dark:border-white/5">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                                {t.tag}
                            </span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance break-words leading-tight">
                            {t.title}
                        </h2>

                        <p className="text-base sm:text-xl text-slate-600 dark:text-slate-400 font-medium tracking-tight text-balance break-words leading-relaxed">
                            {t.subtitle}
                        </p>
                    </div>

                    {/* Right Column: Animation Graphic */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                        className="w-full rounded-2xl sm:rounded-[2.5rem] bg-white/50 dark:bg-black/20 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden"
                    >
                        <CollisionEngine dict={t} />
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
