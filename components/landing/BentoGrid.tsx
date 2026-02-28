'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import { FileText, Compass, MessageSquareCode, Swords, Target, Shield, Zap } from 'lucide-react'
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

const defaultTemplates = [
    { src: tplCorporate, alt: "Corporate" },
    { src: tplCreative, alt: "Creative" },
    { src: tplDarkSidebar, alt: "Dark Sidebar" },
    { src: tplElegant, alt: "Elegant" },
    { src: tplProduct, alt: "Product" },
    { src: tplProfessional, alt: "Professional" },
    { src: tplStandard, alt: "Standard" },
    { src: tplTechnical, alt: "Technical" },
]

// Template Gallery Animation (Card A)
function TemplateGalleryAnimation({ t }: { t: any }) {

    const [templates, setTemplates] = useState(defaultTemplates)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)
    const [mounted, setMounted] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(containerRef, { margin: "200px" })

    // Shuffle and mount
    useEffect(() => {
        const shuffled = [...defaultTemplates].sort(() => 0.5 - Math.random())
        setTemplates(shuffled)
        setMounted(true)
    }, [])

    // Auto-advance
    useEffect(() => {
        if (!mounted || isHovered || !isInView) return

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev - 1 + templates.length) % templates.length)
        }, 2500)

        return () => clearInterval(timer)
    }, [mounted, isHovered, isInView, templates.length])

    // Helper to calculate relative positions
    const getPositionIndex = (index: number) => {
        const diff = (index - currentIndex + templates.length) % templates.length
        if (diff === 0) return 0 // Center
        if (diff === 1) return 1 // Right 1
        if (diff === 2) return 2 // Right 2
        if (diff === templates.length - 1) return -1 // Left 1
        if (diff === templates.length - 2) return -2 // Left 2
        return 3 // Hidden
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-[300px] mt-8 flex items-center justify-center overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {mounted && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <AnimatePresence initial={false}>
                        {templates.map((tpl, i) => {
                            const pos = getPositionIndex(i)
                            if (pos === 3) return null // Do not render hidden cards

                            const isCenter = pos === 0
                            const absPos = Math.abs(pos)

                            return (
                                <motion.div
                                    key={tpl.alt}
                                    className="absolute w-[160px] h-[226px] sm:w-[200px] sm:h-[282px] rounded-lg shadow-2xl overflow-hidden bg-white cursor-pointer border-[0.5px] border-black/10 dark:border-white/20"
                                    initial={{
                                        x: pos * 150,
                                        scale: 0.8,
                                        opacity: 0,
                                        zIndex: 0
                                    }}
                                    animate={{
                                        x: pos * 110, // Distance between cards
                                        scale: isCenter ? (isHovered ? 1.1 : 1) : (absPos === 1 ? 0.8 : 0.65),
                                        opacity: isCenter ? 1 : (absPos === 1 ? 0.6 : 0.2),
                                        zIndex: isCenter ? 10 : (absPos === 1 ? 5 : 0),
                                        filter: isCenter ? 'blur(0px)' : (absPos === 1 ? 'blur(1px)' : 'blur(2px)'),
                                        rotateY: pos * -15 // Add a slight 3D tilt
                                    }}
                                    exit={{
                                        x: pos > 0 ? 250 : -250,
                                        scale: 0.8,
                                        opacity: 0,
                                        zIndex: 0
                                    }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30,
                                        mass: 1
                                    }}
                                    style={{ perspective: 1000 }}
                                >
                                    <Image
                                        src={tpl.src}
                                        alt={tpl.alt}
                                        fill
                                        className="object-cover pointer-events-none"
                                        sizes="(max-width: 768px) 160px, 200px"
                                    />
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}

// Typewriter Text Helper
function TypewriterText({ text, className = "" }: { text: string, className?: string }) {
    return (
        <motion.span
            className={className}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.03 } } }}
            initial="hidden"
            animate="visible"
        >
            {text.split('').map((char, i) => (
                <motion.span key={i} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
                    {char}
                </motion.span>
            ))}
        </motion.span>
    )
}

// Matrix-style Terminal Animation (Card B)
function TerminalAnimation({ t }: { t: any }) {
    const [step, setStep] = useState(0)
    const [mounted, setMounted] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(wrapperRef, { margin: "200px" })

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted || !isInView) return

        let timer: NodeJS.Timeout

        // State 0: Idle, State 1: Typing Step 1, State 2: Typing Step 2, State 3: Result, State 4: PASS, State 5: End
        switch (step) {
            case 0:
                timer = setTimeout(() => setStep(1), 500); break;
            case 1:
                timer = setTimeout(() => setStep(2), 1500); break;
            case 2:
                timer = setTimeout(() => setStep(3), 1500); break;
            case 3:
                timer = setTimeout(() => setStep(4), 1000); break;
            case 4:
                timer = setTimeout(() => setStep(0), 5000); break;
        }

        return () => clearTimeout(timer)
    }, [step, mounted, isInView])

    // Auto-scroll to bottom when new steps appear
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [step])

    const termStrings = t?.matchAnalysis?.terminal || {
        step1: 'Loading RAG Knowledge Base...',
        step2: 'Executing Red/Blue Validation...',
        result: 'Match Accuracy: 98.5%',
        pass: 'PASS',
    }

    return (
        <div ref={wrapperRef} className="w-full h-full min-h-[190px] flex items-center justify-center relative mt-6">
            {mounted && (
                <>
                    {/* Ambient High-Tech Glow */}
                    <div aria-hidden="true" className="absolute w-[200px] h-[100px] bg-cyan-500/20 dark:bg-cyan-500/10 blur-[40px] rounded-full pointer-events-none" />

                    <motion.div
                        className="w-full max-w-[290px] h-[170px] bg-[#0A0A0A]/95 dark:bg-[#050505]/95 backdrop-blur-2xl rounded-xl border border-white/10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col font-mono text-[11px] sm:text-xs relative z-10"
                        animate={{ y: [-3, 3, -3] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    >
                        {/* Subtle Grid Background inside Terminal */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

                        {/* Terminal Header */}
                        <div className="h-8 bg-[#1A1A1A]/80 border-b border-white/5 flex items-center px-3 gap-1.5 shrink-0 relative z-10">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/50 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/50 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/50 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                            <div className="ml-2 text-[10px] text-white/40 font-sans tracking-widest font-medium">sys_match_core</div>
                        </div>

                        {/* Terminal Body */}
                        <div
                            ref={scrollRef}
                            className="p-4 flex flex-col gap-3 h-[138px] overflow-y-auto relative z-10 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                        >
                            {step >= 1 && (
                                <div className="text-cyan-400 font-medium drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] flex items-start">
                                    <span className="text-white/40 select-none mr-2 flex-shrink-0 mt-0.5">&gt;</span>
                                    <TypewriterText text={termStrings.step1} />
                                </div>
                            )}

                            {step >= 2 && (
                                <div className="text-slate-300 flex items-start mt-1">
                                    <span className="text-white/40 select-none mr-2 flex-shrink-0 mt-0.5">&gt;</span>
                                    <TypewriterText text={termStrings.step2} />
                                </div>
                            )}

                            {step >= 3 && (
                                <div className="text-emerald-400 font-semibold mt-2 flex items-start gap-1 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                                    <span className="text-white/40 select-none mr-2 flex-shrink-0 mt-0.5">&gt;</span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <TypewriterText text={termStrings.result} />
                                        {step >= 4 && (
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="inline-block bg-emerald-400/20 border border-emerald-400/30 text-emerald-400 px-1.5 py-0.5 rounded flex-shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.3)] text-[10px]"
                                            >
                                                {termStrings.pass}
                                            </motion.span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Blinking Cursor */}
                            {(step === 0 || step === 4) && (
                                <motion.div
                                    className="inline-block w-2 h-3.5 bg-white/60 ml-4 mt-1"
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                />
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    )
}

// Message Comparison Animation (Card C)
function MessageComparisonAnimation({ t }: { t: any }) {
    const [step, setStep] = useState(1)
    const [mounted, setMounted] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(containerRef, { margin: "200px" })

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted || !isInView) return

        let timer: NodeJS.Timeout

        // State 1: Weak Msg, State 2: Strike, State 3: Strong Msg, State 4: Reset Pause
        switch (step) {
            case 1:
                timer = setTimeout(() => setStep(2), 1500); break;
            case 2:
                timer = setTimeout(() => setStep(3), 1000); break; // Slightly longer to let the stamp register
            case 3:
                timer = setTimeout(() => setStep(4), 5000); break;
            case 4:
                timer = setTimeout(() => setStep(1), 600); break;
        }

        return () => clearTimeout(timer)
    }, [step, mounted, isInView])

    const pitchStrings = t?.smartPitch?.pitch || {
        weakMsg: '您好，我对贵司的这个岗位很感兴趣，期待回复...',
        strongMsg: '基于 JD 要求的“0-1 亿级增长”，我曾主导过同类破局矩阵，实现 300% 营收跃升。有空聊聊具体打法吗？',
        tag: 'Smart Pitch',
        rejectStamp: '一秒划走'
    }

    return (
        <div ref={containerRef} className="w-full h-full min-h-[190px] flex items-center justify-center relative mt-6 font-sans">
            {mounted && (
                <>
                    {/* Ambient Pulse Glow - adjusted to match Terminal */}
                    <div aria-hidden="true" className="absolute w-[200px] h-[100px] bg-cyan-500/10 dark:bg-cyan-500/10 blur-[40px] rounded-full pointer-events-none" />

                    {/* Container fixed height to prevent vertical jumping between steps, sized to match Terminal exactly */}
                    <div className="w-full max-w-[290px] h-[170px] relative flex flex-col justify-center items-center">

                        {/* Weak Message */}
                        <AnimatePresence>
                            {(step === 1 || step === 2) && (
                                <motion.div
                                    className="absolute z-10 w-[85%] bg-white/70 dark:bg-white/5 backdrop-blur-md border border-slate-200/50 dark:border-white/10 rounded-xl p-3.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 shadow-sm"
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        y: 0,
                                        x: step === 2 ? [-2, 2, -2, 2, 0] : 0
                                    }}
                                    exit={{
                                        opacity: 0,
                                        scale: 0.85,
                                        y: 40,
                                        rotate: -4,
                                        filter: "blur(4px)",
                                        transition: { duration: 0.6, ease: "easeIn" }
                                    }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {pitchStrings.weakMsg}

                                    {/* "Instant Reject" Stamp */}
                                    {step === 2 && (
                                        <motion.div
                                            className="absolute top-1/2 left-1/2 z-10 flex items-center justify-center pointer-events-none"
                                            initial={{ scale: 2.5, opacity: 0, x: "-50%", y: "-50%", rotate: -15 }}
                                            animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%", rotate: -15 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        >
                                            <div className="border-[2px] border-red-500 text-red-500 font-black text-xs sm:text-sm px-2.5 py-0.5 rounded shadow-[0_0_15px_rgba(239,68,68,0.4)] backdrop-blur-md bg-white/20 tracking-wider uppercase origin-center whitespace-nowrap">
                                                {pitchStrings.rejectStamp}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Strong Pitch Message */}
                        <AnimatePresence>
                            {step === 3 && (
                                <motion.div
                                    className="absolute inset-0 bg-[#0A0A0A]/95 dark:bg-[#050505]/95 backdrop-blur-2xl border border-white/10 dark:border-cyan-500/50 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] dark:shadow-[0_0_30px_rgba(6,182,212,0.25)] rounded-xl py-5 px-6 text-[11px] sm:text-xs text-slate-200 z-20 flex flex-col justify-center overflow-hidden"
                                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98, y: -5, filter: "blur(2px)", transition: { duration: 0.3 } }}
                                    transition={{ duration: 0.8, type: "spring", bounce: 0.25, delay: 0.4 }}
                                >
                                    {/* Inner Grid for tech aesthetic matching Terminal */}
                                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-1.5 mb-2.5 h-4">
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                                            <span className="text-cyan-400 font-medium text-[10px] uppercase tracking-widest">{pitchStrings.tag}</span>
                                        </div>
                                        <div className="leading-relaxed drop-shadow-md text-slate-300">
                                            {pitchStrings.strongMsg}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </>
            )}
        </div>
    )
}

// Mock Interview Animation (Card D)
function MockInterviewAnimation({ t }: { t: any }) {
    const [step, setStep] = useState(0)
    const [mounted, setMounted] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(containerRef, { margin: "200px" })

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted || !isInView) return

        let timer: NodeJS.Timeout

        // State 0: Idle, State 1: Question, State 2: Analysis, State 3: Strategy, State 4: Reset
        switch (step) {
            case 0:
                timer = setTimeout(() => setStep(1), 500); break;
            case 1:
                timer = setTimeout(() => setStep(2), 2000); break;
            case 2:
                timer = setTimeout(() => setStep(3), 1200); break;
            case 3:
                timer = setTimeout(() => setStep(4), 5000); break;
            case 4:
                timer = setTimeout(() => setStep(0), 400); break;
        }

        return () => clearTimeout(timer)
    }, [step, mounted, isInView])

    const simStrings = t?.mockInterview?.simulation || {
        question: 'Tough HR Probe:',
        questionText: '"This 6-month gap shows no output. Explain?"',
        strategy: 'AI Strategy Deployed',
        point1: 'STAR Method',
        point2: 'Focus on Upskilling',
        point3: 'Pivot to Strength'
    }

    return (
        <div ref={containerRef} className="w-full h-full min-h-[190px] flex items-center justify-center relative mt-6 font-sans">
            {mounted && (
                <>
                    {/* Ambient Pulse Glow */}
                    <div aria-hidden="true" className="absolute w-[200px] h-[100px] bg-cyan-500/10 dark:bg-cyan-500/10 blur-[40px] rounded-full pointer-events-none" />

                    <div className="w-full max-w-[290px] h-[170px] relative flex flex-col justify-center items-center">
                        <AnimatePresence>
                            {(step >= 1 && step < 4) && (
                                <motion.div
                                    className="absolute inset-0 bg-[#0A0A0A]/95 dark:bg-[#050505]/95 backdrop-blur-2xl border border-white/10 dark:border-cyan-500/50 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] dark:shadow-[0_0_30px_rgba(6,182,212,0.25)] rounded-xl py-4 px-5 flex flex-col font-sans text-xs overflow-hidden z-20"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                                    transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}
                                >
                                    {/* Inner Grid */}
                                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

                                    {/* HR Question Box */}
                                    <motion.div
                                        className="relative z-10 bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 mb-3 shrink-0"
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: 0.1 }}
                                    >
                                        <div className="flex items-center gap-1.5 mb-2 h-3 text-rose-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_5px_rgba(244,63,94,0.8)]" />
                                            <span className="font-medium text-[10px] uppercase tracking-widest leading-none">{simStrings.question}</span>
                                        </div>
                                        <div className="text-slate-200">
                                            {simStrings.questionText}
                                        </div>
                                    </motion.div>

                                    {/* AI Scanning / Analysis Step */}
                                    <AnimatePresence>
                                        {step === 2 && (
                                            <motion.div
                                                className="relative z-10 flex-1 flex items-center justify-center h-full mb-6"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                                            >
                                                <div className="flex space-x-1.5 items-center bg-cyan-500/10 border border-cyan-500/20 rounded-md px-3 py-1.5 text-cyan-400">
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                                                    <span className="font-mono text-[10px] uppercase ml-1">Analyzing...</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Strategy Breakdown */}
                                    <AnimatePresence>
                                        {step === 3 && (
                                            <motion.div
                                                className="relative z-10 flex flex-col gap-3"
                                                initial={{ opacity: 0, y: 25 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                                            >
                                                <div className="flex items-center gap-1.5 h-3 text-cyan-400">
                                                    <Zap className="w-3 h-3 text-cyan-400" />
                                                    <span className="font-medium text-[10px] uppercase tracking-widest leading-none">{simStrings.strategy}</span>
                                                </div>

                                                <div className="flex justify-between items-center w-full gap-1.5 overflow-hidden">
                                                    <motion.div className="flex-1 text-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 px-1 py-1.5 rounded-md text-[10px] shadow-[inset_0_1px_4px_rgba(6,182,212,0.1)] truncate"
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.7, delay: 0.6, type: "spring", bounce: 0.1 }}
                                                    >
                                                        {simStrings.point1}
                                                    </motion.div>
                                                    <motion.div className="flex-1 text-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 px-1 py-1.5 rounded-md text-[10px] shadow-[inset_0_1px_4px_rgba(6,182,212,0.1)] truncate"
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.7, delay: 1.2, type: "spring", bounce: 0.1 }}
                                                    >
                                                        {simStrings.point2}
                                                    </motion.div>
                                                    <motion.div className="flex-1 text-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 px-1 py-1.5 rounded-md text-[10px] shadow-[inset_0_1px_4px_rgba(6,182,212,0.1)] truncate"
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.7, delay: 1.8, type: "spring", bounce: 0.1 }}
                                                    >
                                                        {simStrings.point3}
                                                    </motion.div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </>
            )}
        </div>
    )
}

export function BentoGrid({ dict }: { dict: any }) {
    const t = dict.bentoGrid || {}

    return (
        <section className="w-full relative">
            <div className="mx-auto px-4 max-w-6xl">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">

                    {/* Card 1: Resume Builder (Span 3 on Desktop) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        className={cn(
                            "md:col-span-3 flex flex-col md:flex-row justify-between items-start md:items-center overflow-hidden",
                            "p-8 sm:p-12 min-h-[320px] rounded-[2rem]",
                            "bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
                        )}
                    >
                        <div className="flex flex-col gap-4 w-full md:w-1/2 z-10 shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center mb-2 shadow-sm">
                                <FileText className="w-6 h-6 text-white dark:text-slate-900" strokeWidth={1.5} aria-hidden="true" />
                            </div>
                            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.resumeBuilder?.title}
                            </h3>
                            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.resumeBuilder?.desc}
                            </p>
                        </div>

                        <div className="w-full md:w-1/2 flex justify-center md:justify-end shrink-0 z-0 pl-0 md:pl-12 group">
                            <TemplateGalleryAnimation t={t} />
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
                            "bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
                        )}
                    >
                        <div className="flex flex-col gap-3 z-10">
                            <div className="w-12 h-12 md:w-10 md:h-10 rounded-2xl md:rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center mb-2 shadow-sm">
                                <Compass className="w-6 h-6 md:w-5 md:h-5 text-white dark:text-slate-900" strokeWidth={1.5} aria-hidden="true" />
                            </div>
                            <h3 className="text-3xl md:text-2xl font-extrabold md:font-bold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.matchAnalysis?.title}
                            </h3>
                            <p className="text-lg md:text-base text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.matchAnalysis?.desc}
                            </p>
                        </div>
                        <TerminalAnimation t={t} />
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
                            "bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
                        )}
                    >
                        <div className="flex flex-col gap-3 z-10">
                            <div className="w-12 h-12 md:w-10 md:h-10 rounded-2xl md:rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center mb-2 shadow-sm">
                                <MessageSquareCode className="w-6 h-6 md:w-5 md:h-5 text-white dark:text-slate-900" strokeWidth={1.5} aria-hidden="true" />
                            </div>
                            <h3 className="text-3xl md:text-2xl font-extrabold md:font-bold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.smartPitch?.title}
                            </h3>
                            <p className="text-lg md:text-base text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.smartPitch?.desc}
                            </p>
                        </div>
                        <MessageComparisonAnimation t={t} />
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
                            "bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10",
                            "shadow-xl shadow-black/5 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]"
                        )}
                    >
                        <div className="flex flex-col gap-3 z-10">
                            <div className="w-12 h-12 md:w-10 md:h-10 rounded-2xl md:rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center mb-2 shadow-sm">
                                <Swords className="w-6 h-6 md:w-5 md:h-5 text-white dark:text-slate-900" strokeWidth={1.5} aria-hidden="true" />
                            </div>
                            <h3 className="text-3xl md:text-2xl font-extrabold md:font-bold text-slate-900 dark:text-white tracking-tight break-words text-balance">
                                {t.mockInterview?.title}
                            </h3>
                            <p className="text-lg md:text-base text-slate-600 dark:text-slate-400 font-medium break-words text-balance">
                                {t.mockInterview?.desc}
                            </p>
                        </div>
                        <MockInterviewAnimation t={t} />
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
