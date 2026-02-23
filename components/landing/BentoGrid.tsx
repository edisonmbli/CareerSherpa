'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { FileText, Compass, MessageSquareCode, Swords } from 'lucide-react'

// Resume Skeleton Animation
function ResumeSkeleton() {
    return (
        <div className="relative w-full h-[240px] sm:h-[300px] mt-8 bg-white dark:bg-slate-900 rounded-t-xl border border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-8 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>

            <div className="p-6 sm:p-8 pt-12 sm:pt-14 w-full h-full flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col gap-3">
                    <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="w-1/3 h-5 sm:h-6 bg-slate-800 dark:bg-slate-200 rounded shrink-0 origin-left"
                    />
                    <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                        className="w-1/4 h-3 sm:h-4 bg-slate-300 dark:bg-slate-700 rounded shrink-0 origin-left"
                    />
                </div>

                {/* Body sections */}
                {[0, 1].map((i) => (
                    <div key={i} className="flex flex-col gap-3">
                        <motion.div
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 + i * 0.2, ease: "easeOut" }}
                            className="w-1/5 h-4 sm:h-5 bg-slate-900 dark:bg-slate-100 rounded shrink-0 origin-left"
                        />
                        <div className="flex flex-col gap-2">
                            <motion.div
                                initial={{ scaleX: 0, opacity: 0 }}
                                whileInView={{ scaleX: 1, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.5 + i * 0.2 }}
                                className="w-[90%] h-2 sm:h-3 bg-slate-200 dark:bg-slate-800 rounded shrink-0 origin-left -ml-1 sm:-ml-0"
                            />
                            <motion.div
                                initial={{ scaleX: 0, opacity: 0 }}
                                whileInView={{ scaleX: 1, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.6 + i * 0.2 }}
                                className="w-[75%] h-2 sm:h-3 bg-slate-200 dark:bg-slate-800 rounded shrink-0 origin-left -ml-1 sm:-ml-0"
                            />
                        </div>
                    </div>
                ))}

                {/* Highlight Sweep */}
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent skew-x-[-20deg]"
                    initial={{ x: '-100%' }}
                    whileInView={{ x: '200%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 1.5, ease: "easeInOut" }}
                />
            </div>
        </div>
    )
}

function RadarChartSkeleton() {
    return (
        <div className="w-full h-full min-h-[160px] flex items-center justify-center relative mt-6">
            <svg viewBox="0 0 100 100" className="w-[120px] h-[120px] overflow-visible">
                {/* Base Grid */}
                {[20, 35, 50].map((r) => (
                    <polygon key={r} points={`50,${50 - r} ${50 + r * 0.866},${50 - r * 0.5} ${50 + r * 0.866},${50 + r * 0.5} 50,${50 + r} ${50 - r * 0.866},${50 + r * 0.5} ${50 - r * 0.866},${50 - r * 0.5}`}
                        fill="none"
                        className="stroke-slate-200 dark:stroke-slate-800"
                        strokeWidth="0.5"
                    />
                ))}
                {/* Axes */}
                {[0, 60, 120, 180, 240, 300].map((angle) => (
                    <line key={angle} x1="50" y1="50"
                        x2={Number((50 + 50 * Math.sin(angle * Math.PI / 180)).toFixed(3))}
                        y2={Number((50 - 50 * Math.cos(angle * Math.PI / 180)).toFixed(3))}
                        className="stroke-slate-200 dark:stroke-slate-800"
                        strokeWidth="0.5"
                    />
                ))}

                {/* Data Area */}
                <motion.polygon
                    points="50,15 80,30 85,75 50,80 20,60 15,25"
                    className="fill-cyan-500/20 stroke-cyan-500 dark:stroke-cyan-400"
                    strokeWidth="1.5"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, type: "spring", bounce: 0.5 }}
                    style={{ originX: "50px", originY: "50px" }}
                />

                {/* Data Dots */}
                {[
                    { x: 50, y: 15 }, { x: 80, y: 30 }, { x: 85, y: 75 },
                    { x: 50, y: 80 }, { x: 20, y: 60 }, { x: 15, y: 25 }
                ].map((pt, i) => (
                    <motion.circle key={i} cx={pt.x} cy={pt.y} r="2.5"
                        className="fill-slate-900 dark:fill-white"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1 + i * 0.1 }}
                    />
                ))}
            </svg>
        </div>
    )
}

function TypingBubbleSkeleton() {
    return (
        <div className="w-full h-full min-h-[160px] flex items-end justify-center pb-4 relative mt-6">
            <div className="flex flex-col gap-3 w-[85%]">
                {/* Assistant Bubble */}
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9, originY: 1, originX: 0 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="w-[90%] bg-slate-200 dark:bg-slate-800 rounded-2xl rounded-bl-sm p-4 relative"
                >
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "80%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-2 bg-slate-400 dark:bg-slate-600 rounded-full mb-2"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: "60%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 1.5 }}
                        className="h-2 bg-slate-400 dark:bg-slate-600 rounded-full"
                    />
                </motion.div>
                {/* User Bubble */}
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9, originY: 1, originX: 1 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 2.5 }}
                    className="w-[70%] ml-auto bg-slate-900 dark:bg-slate-100 rounded-2xl rounded-br-sm p-4"
                >
                    <div className="flex gap-1.5 items-center justify-center">
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                    </div>
                </motion.div>
            </div>
        </div>
    )
}

function BattleBlocksSkeleton() {
    return (
        <div className="w-full h-full min-h-[160px] flex items-center justify-center relative mt-6 perspective-1000">
            <motion.div
                className="relative w-[120px] h-[120px] transform-style-3d"
                initial={{ rotateX: 60, rotateZ: -45 }}
                whileInView={{ rotateX: 50, rotateZ: -30 }}
                viewport={{ once: true }}
                transition={{ duration: 2, ease: "easeOut" }}
            >
                {/* Foundation Block */}
                <div className="absolute inset-0 bg-slate-300 dark:bg-slate-800 rounded-xl border border-white dark:border-slate-700 shadow-xl" />

                {/* Falling/Opposing Block */}
                <motion.div
                    className="absolute inset-0 bg-cyan-500/80 backdrop-blur-md rounded-xl border border-cyan-400/50 dark:border-cyan-400 shadow-[0_20px_40px_rgba(6,182,212,0.3)]"
                    initial={{ z: 120, opacity: 0 }}
                    whileInView={{ z: 30, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.5, type: "spring", bounce: 0.4 }}
                />
            </motion.div>
        </div>
    )
}

export function BentoGrid({ dict }: { dict: any }) {
    const t = dict.bentoGrid || {}

    return (
        <section className="w-full py-24 bg-slate-100 dark:bg-[#09090B]">
            <div className="container mx-auto px-4 max-w-6xl">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">

                    {/* Card 1: Resume Builder (Span 3 on Desktop) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        className={cn(
                            "md:col-span-3 flex flex-col md:flex-row justify-between items-start md:items-center overflow-hidden",
                            "p-8 sm:p-12 min-h-[320px] rounded-[2rem]",
                            "bg-white/50 dark:bg-black/20 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_10px_30px_-10px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                        )}
                    >
                        <div className="flex flex-col gap-4 w-full md:w-1/2 z-10 shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center mb-2 shadow-sm">
                                <FileText className="w-6 h-6 text-white dark:text-slate-900" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.resumeBuilder?.title}
                            </h3>
                            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.resumeBuilder?.desc}
                            </p>
                        </div>

                        <div className="w-full md:w-1/2 flex justify-center md:justify-end shrink-0 z-0 pl-0 md:pl-12">
                            <ResumeSkeleton />
                        </div>
                    </motion.div>

                    {/* Card 2: Match Analysis */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: 0.1 }}
                        className={cn(
                            "md:col-span-1 flex flex-col justify-between overflow-hidden",
                            "p-8 min-h-[360px] rounded-[2rem]",
                            "bg-white/50 dark:bg-black/20 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10"
                        )}
                    >
                        <div className="flex flex-col gap-3 z-10">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2 border border-black/5 dark:border-white/5 shadow-sm">
                                <Compass className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.matchAnalysis?.title}
                            </h3>
                            <p className="text-base text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.matchAnalysis?.desc}
                            </p>
                        </div>
                        <RadarChartSkeleton />
                    </motion.div>

                    {/* Card 3: Smart Pitch */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: 0.2 }}
                        className={cn(
                            "md:col-span-1 flex flex-col justify-between overflow-hidden",
                            "p-8 min-h-[360px] rounded-[2rem]",
                            "bg-white/50 dark:bg-black/20 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10"
                        )}
                    >
                        <div className="flex flex-col gap-3 z-10">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2 border border-black/5 dark:border-white/5 shadow-sm">
                                <MessageSquareCode className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.smartPitch?.title}
                            </h3>
                            <p className="text-base text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.smartPitch?.desc}
                            </p>
                        </div>
                        <TypingBubbleSkeleton />
                    </motion.div>

                    {/* Card 4: Mock Interview */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ delay: 0.3 }}
                        className={cn(
                            "md:col-span-1 flex flex-col justify-between overflow-hidden relative",
                            "p-8 min-h-[360px] rounded-[2rem]",
                            "bg-white/50 dark:bg-black/20 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10"
                        )}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-cyan-500/5 dark:bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />

                        <div className="flex flex-col gap-3 z-10">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2 border border-black/5 dark:border-white/5 shadow-sm">
                                <Swords className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.mockInterview?.title}
                            </h3>
                            <p className="text-base text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.mockInterview?.desc}
                            </p>
                        </div>
                        <BattleBlocksSkeleton />
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
