'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { FileText, Compass, MessageSquareCode, Swords } from 'lucide-react'
import Image from 'next/image'

// Template Images
import tplCorporate from '@/assets/images/templates/corporate.png'
import tplCreative from '@/assets/images/templates/creative.png'
import tplDarkSidebar from '@/assets/images/templates/darkSidebar.png'
import tplElegant from '@/assets/images/templates/elegant.png'
import tplProduct from '@/assets/images/templates/product.png'
import tplProfessional from '@/assets/images/templates/professional.png'
import tplStandard from '@/assets/images/templates/standard.png'
import tplTechnical from '@/assets/images/templates/technical.png'

// Template Gallery Animation (Card A)
function TemplateGalleryAnimation() {
    const templates = [
        { src: tplCorporate, alt: "Corporate", rotate: -12, x: -140, y: 15 },
        { src: tplCreative, alt: "Creative", rotate: -8, x: -100, y: 5 },
        { src: tplDarkSidebar, alt: "Dark Sidebar", rotate: -4, x: -60, y: -2 },
        { src: tplElegant, alt: "Elegant", rotate: 0, x: -20, y: -5 },
        { src: tplProduct, alt: "Product", rotate: 4, x: 20, y: -5 },
        { src: tplProfessional, alt: "Professional", rotate: 8, x: 60, y: -2 },
        { src: tplStandard, alt: "Standard", rotate: 12, x: 100, y: 5 },
        { src: tplTechnical, alt: "Technical", rotate: 16, x: 140, y: 15 },
    ]

    return (
        <div className="relative w-full h-[300px] mt-8 flex items-center justify-center group perspective-[1200px]">
            {templates.map((tpl, i) => (
                <motion.div
                    key={i}
                    className="absolute w-[140px] h-[198px] sm:w-[180px] sm:h-[254px] rounded-lg border-[0.5px] border-black/10 dark:border-white/20 shadow-xl overflow-hidden bg-white cursor-pointer origin-bottom"
                    initial={{
                        rotate: (i - 3.5) * 2,
                        x: (i - 3.5) * 8,
                        y: Math.abs(i - 3.5) * 4,
                        scale: 1 - Math.abs(i - 3.5) * 0.05,
                        zIndex: i
                    }}
                    whileHover={{ scale: 1.05, zIndex: 10, y: -10, transition: { duration: 0.2 } }}
                    variants={{
                        hover: {
                            rotate: tpl.rotate,
                            x: tpl.x,
                            y: tpl.y,
                            scale: 1.02,
                            transition: {
                                type: "spring",
                                stiffness: 260,
                                damping: 20
                            }
                        }
                    }}
                >
                    <Image
                        src={tpl.src}
                        alt={tpl.alt}
                        fill
                        className="object-cover pointer-events-none"
                        sizes="(max-width: 768px) 140px, 180px"
                    />
                </motion.div>
            ))}

            {/* Add global group hover trigger context block */}
            <motion.div
                className="absolute inset-0 z-20 cursor-crosshair opacity-0"
                whileHover="hover"
            />
        </div>
    )
}

// Matrix-style Terminal Animation (Card B)
function TerminalAnimation() {
    return (
        <div className="w-full h-full min-h-[160px] flex items-center justify-center relative mt-6">
            <div className="w-full max-w-[280px] bg-[#0A0A0A] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col font-mono text-xs sm:text-sm">
                {/* Terminal Header */}
                <div className="h-8 bg-[#1A1A1A] border-b border-white/5 flex items-center px-3 gap-1.5 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                    <div className="ml-2 text-[10px] text-white/30 font-sans tracking-widest">sys_match_core</div>
                </div>
                {/* Terminal Body */}
                <div className="p-4 flex flex-col gap-2 min-h-[120px] relative">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0, delay: 0.5 }}
                        className="text-cyan-400 dark:text-cyan-500 font-medium"
                    >
                        <span className="text-white/40 select-none mr-2">&gt;</span>
                        载入 RAG 行业知识库...
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0, delay: 1.8 }}
                        className="text-white/70"
                    >
                        <span className="text-white/40 select-none mr-2">&gt;</span>
                        执行红蓝对抗校验...
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0, delay: 3.5 }}
                        className="text-emerald-400 font-semibold mt-1"
                    >
                        <span className="text-white/40 select-none mr-2">&gt;</span>
                        匹配精准度：98.5% <span className="bg-emerald-400/20 text-emerald-400 px-1 ml-1 rounded">PASS</span>
                    </motion.div>

                    {/* Blinking Cursor */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="absolute bottom-4 left-4 inline-block w-2 h-4 bg-white/50"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: 4.5 }}
                    />
                </div>
            </div>
        </div>
    )
}

// Message Comparison Animation (Card C)
function MessageComparisonAnimation() {
    return (
        <div className="w-full h-full min-h-[160px] flex items-center justify-center relative mt-6 font-sans">
            <div className="w-full max-w-[260px] relative pb-16">
                {/* Weak Message */}
                <motion.div
                    className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl rounded-tl-sm p-3.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 relative"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                >
                    您好，我对贵司的这个岗位很感兴趣，期待回复...

                    {/* Strike-through Line */}
                    <motion.div
                        className="absolute top-1/2 left-2 h-[2px] bg-red-500/80 origin-left z-10"
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: 1.5, ease: "easeOut" }}
                        style={{ width: "calc(100% - 16px)" }}
                    />
                </motion.div>

                {/* Strong Pitch Message */}
                <motion.div
                    className="absolute top-10 left-4 w-[105%] bg-[#080808] dark:bg-black/90 border border-cyan-500/50 shadow-[0_10px_30px_rgba(6,182,212,0.15)] rounded-2xl rounded-br-sm p-3.5 text-xs sm:text-sm text-slate-200"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 2.2, type: "spring", bounce: 0.4 }}
                    style={{ zIndex: 20 }}
                >
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-cyan-400 font-medium text-[10px] uppercase tracking-wider">Smart Pitch</span>
                    </div>
                    基于 JD 要求的“0-1 亿级增长”，我曾主导过同类破局矩阵，实现 300% 营收跃升。有空聊聊具体打法吗？
                </motion.div>
            </div>
        </div>
    )
}

// Tactical Sand Table Animation (Card D)
function TacticalSandTableAnimation() {
    return (
        <div className="w-full h-full min-h-[160px] flex items-center justify-center relative mt-6">
            <svg viewBox="0 0 200 160" className="w-[180px] h-[140px] overflow-visible">
                {/* Background Grid */}
                <pattern id="sandTableGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="0.5" />
                </pattern>
                <rect width="200" height="160" fill="url(#sandTableGrid)" className="opacity-50" />

                {/* Question Path (Interviewer -> User) */}
                <motion.line
                    x1="100" y1="30" x2="100" y2="80"
                    className="stroke-rose-500"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: [0, 1, 0] }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                />

                {/* Interviewer Node (Red) */}
                <motion.circle
                    cx="100" cy="25" r="5"
                    className="fill-rose-500"
                    initial={{ scale: 0.8 }}
                    whileInView={{ scale: [0.8, 1.2, 0.8] }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                />
                {/* Interviewer Ping */}
                <motion.circle
                    cx="100" cy="25" r="5"
                    className="stroke-rose-500 fill-none"
                    strokeWidth="1"
                    initial={{ scale: 1, opacity: 0.8 }}
                    whileInView={{ scale: 3, opacity: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                />

                {/* User Node (Cyan) */}
                <motion.circle
                    cx="100" cy="85" r="6"
                    className="fill-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                    initial={{ scale: 1 }}
                    whileInView={{ scale: [1, 1.3, 1] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 1, repeat: Infinity, repeatDelay: 3 }}
                />

                {/* Defense Paths (Branching out) */}
                {/* Path 1: Left */}
                <motion.line
                    x1="95" y1="90" x2="50" y2="135"
                    className="stroke-cyan-500 dark:stroke-cyan-400"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: [0, 1, 0.5] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 1.2, repeat: Infinity, repeatDelay: 2.9 }}
                />
                <motion.circle cx="50" cy="135" r="3" className="fill-cyan-400"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: [0, 1, 0.5] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 1.6, repeat: Infinity, repeatDelay: 3.2 }}
                />

                {/* Path 2: Center (Deep) */}
                <motion.line
                    x1="100" y1="92" x2="100" y2="145"
                    className="stroke-cyan-500 dark:stroke-cyan-400"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: [0, 1, 0.5] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 1.3, repeat: Infinity, repeatDelay: 2.9 }}
                />
                <motion.circle cx="100" cy="145" r="3" className="fill-cyan-400"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: [0, 1, 0.5] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 1.7, repeat: Infinity, repeatDelay: 3.2 }}
                />

                {/* Path 3: Right */}
                <motion.line
                    x1="105" y1="90" x2="150" y2="135"
                    className="stroke-cyan-500 dark:stroke-cyan-400"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: [0, 1, 0.5] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 1.4, repeat: Infinity, repeatDelay: 2.9 }}
                />
                <motion.circle cx="150" cy="135" r="3" className="fill-cyan-400"
                    initial={{ scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: [0, 1, 0.5] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 1.8, repeat: Infinity, repeatDelay: 3.2 }}
                />
            </svg>
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
                            "bg-white/5 dark:bg-black/10 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
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

                        <div className="w-full md:w-1/2 flex justify-center md:justify-end shrink-0 z-0 pl-0 md:pl-12 group">
                            <TemplateGalleryAnimation />
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
                            "bg-white/5 dark:bg-black/10 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
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
                        <TerminalAnimation />
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
                            "bg-white/5 dark:bg-black/10 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
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
                        <MessageComparisonAnimation />
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
                            "bg-white/5 dark:bg-black/10 backdrop-blur-3xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
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
                        <TacticalSandTableAnimation />
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
