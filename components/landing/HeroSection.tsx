'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence, useInView } from 'framer-motion'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
})

interface HeroSectionProps {
  dict: any
  locale: string
}

// 1. Animated Counter (0 to 98)
function AnimatedScore({ value }: { value: number }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 2.5,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.2
    })
    return controls.stop
  }, [value, count])

  return <motion.span>{rounded}</motion.span>
}

// 2. High-Quality Neural Network Background (SVG + Framer Motion)
// Refined: Darker lines, bolder nodes, faint yellow insight lasers, reduced density, wider spread.
function NeuralNetworkBackground() {
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef)

  // Deterministic hydration-safe random nodes (only rendered post-mount anyway, but good practice)
  const nodes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 40; i++) { // Reduced density
      arr.push({
        id: i,
        x: Math.random() * 120 - 10, // Spread beyond 0-100 bounds
        y: Math.random() * 120 - 10,
        size: Math.random() * 1.5 + 0.5,
      })
    }
    return arr
  }, [])

  const connections = useMemo(() => {
    const arr = []
    for (let i = 0; i < 30; i++) { // Reduced density
      const source = nodes[Math.floor(Math.random() * nodes.length)]!
      const target = nodes[Math.floor(Math.random() * nodes.length)]!
      if (source.id !== target.id) {
        arr.push({ id: i, source, target })
      }
    }
    return arr
  }, [nodes])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-50 dark:bg-[#09090B] transition-colors duration-700">
      {mounted && isInView && (
        <motion.svg
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 w-full h-full opacity-[0.5] dark:opacity-[0.6]"
          // Restored full rotation of the network
          animate={{ rotate: 360, scale: [1, 1.05, 1] }}
          transition={{
            rotate: { duration: 250, repeat: Infinity, ease: 'linear' },
            scale: { duration: 30, repeat: Infinity, ease: 'easeInOut' }
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{ originX: "50%", originY: "50%" }}
        >
          {/* Base Static Connections - Darkened for contrast */}
          {connections.map((conn) => (
            <path
              key={conn.id}
              d={`M ${conn.source.x} ${conn.source.y} L ${conn.target.x} ${conn.target.y}`}
              className="stroke-slate-400 dark:stroke-slate-700"
              strokeWidth="0.08"
              fill="none"
            />
          ))}

          {/* Flowing Highlight Connections (AI Thought Paths / Insights 💡) - Faint Yellow */}
          {connections.slice(0, 15).map((conn, idx) => (
            <motion.path
              key={`pulse-${conn.id}`}
              d={`M ${conn.source.x} ${conn.source.y} L ${conn.target.x} ${conn.target.y}`}
              className="stroke-amber-300 dark:stroke-amber-200/80"
              strokeWidth={idx % 3 === 0 ? "0.3" : "0.15"}
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0.15, pathOffset: 0, opacity: 0 }}
              animate={{
                pathOffset: [0, 1],
                opacity: [0, 1, 1, 0]
              }}
              transition={{
                duration: 2.5 + Math.random() * 2.5,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: "linear"
              }}
              style={{
                filter: 'drop-shadow(0 0 1px rgba(252,211,77,0.8))'
              }}
            />
          ))}

          {/* Base Nodes - Darkened */}
          {nodes.map((node) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={node.size * 0.15}
              className="fill-slate-500 dark:fill-slate-600"
            />
          ))}

          {/* Breathing / Flashing Nodes representing past experiences - Slightly strengthened */}
          {nodes.map((node, i) => i % 4 === 0 && (
            <motion.circle
              key={`breath-${node.id}`}
              cx={node.x}
              cy={node.y}
              r={node.size * 0.35}
              className="fill-cyan-500 dark:fill-cyan-400"
              animate={{ opacity: [0, 0.9, 0], scale: [1, 2, 1] }}
              transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
            />
          ))}
        </motion.svg>
      )}

      {/* Generous elliptical gradient: visible center, soft falloff, allowing nodes to be seen near edges */}
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(248,250,252,0.5)_0%,rgba(248,250,252,1)_120%)] dark:bg-[radial-gradient(ellipse_at_50%_50%,rgba(9,9,11,0.2)_0%,rgba(9,9,11,1)_120%)]" />

      {/* Extreme Fine Noise Texture for premium tactile feel */}
      <div aria-hidden="true" className="absolute inset-0 mix-blend-overlay opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("/noise.svg")', backgroundRepeat: 'repeat' }} />
    </div>
  )
}

export function HeroSection({ dict, locale }: HeroSectionProps) {
  // Setup cyclic mock data (3 scenarios)
  const [mockIdx, setMockIdx] = useState(0)

  // Fallback mock strictly matches the data schema defined in zh.ts / en.ts
  const mockDataList = dict.mocks && dict.mocks.length > 0 ? dict.mocks : [
    {
      role: 'Full Stack Engineer (AI Applied)',
      tag: 'Highly Compatible',
      score: 90,
      desc: 'Your 5 years of React/Node.js experience aligns perfectly, but the JD heavily emphasizes LLM integration workflows where your resume lacks specific keywords.',
      insights: [
        { title: 'Quantify "LangChain" Experience', desc: 'Add metrics to your RAG project. E.g., "Improved retrieval accuracy by 30% using vector databases."' },
        { title: 'Highlight System Design', desc: 'The JD requires architecture skills. Move the "Microservices Migration" bullet point to the top of your most recent role.' }
      ]
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setMockIdx((prev) => (prev + 1) % mockDataList.length)
    }, 9000)
    return () => clearInterval(timer)
  }, [mockDataList.length])

  const currentMock = mockDataList[mockIdx]

  const signInHref = `/${locale}/auth/sign-in?redirect=${encodeURIComponent(
    `/${locale}/workbench`,
  )}`

  return (
    // Breakout Layout: w-screen absolute trick to break out of container.
    // RESPONSIVE/ABOVE-THE-FOLD: using calc to subtract header height (approx 4rem), with a sane max fallback.
    <section className={cn(
      "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[max(800px,calc(100svh-4rem))] flex flex-col items-center justify-center overflow-hidden",
      "pt-16 pb-12 px-4 sm:px-6 lg:px-8",
      plusJakarta.variable,
      "font-sans text-slate-900 dark:text-slate-50"
    )}>

      {/* 1. Silicon Valley Neural Network Background (Restored) */}
      <NeuralNetworkBackground />

      {/* Main Content Area (Max-W preserved) */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center space-y-6 sm:space-y-8 mt-4">

        {/* Headline: Absolute starkness, high contrast, adjusted tracking, gradient clipping */}
        <motion.h1
          initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] font-extrabold tracking-[-0.02em] text-balance",
            "font-[family-name:var(--font-plus-jakarta)]",
            "bg-clip-text text-transparent bg-gradient-to-br from-slate-900 via-slate-800 to-slate-500 dark:from-white dark:via-slate-100 dark:to-slate-300",
            "pb-2" // padding to prevent lowercase clip cutoffs
          )}
        >
          {dict.title || "你的 AI 求职私教"}
        </motion.h1>

        {/* Subheadline: Muted, precise, polished typography */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed px-4 text-balance font-medium tracking-tight drop-shadow-sm whitespace-pre-line"
        >
          {dict.subtitle}
        </motion.p>

        {/* Master CTA Button: Polished interaction details, inner glow, diffuse drop shadow, shimmer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="pt-2 sm:pt-4 relative group"
        >
          {/* Diffuse glow shadow */}
          <div aria-hidden="true" className="absolute -inset-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-blue-500/0 rounded-full blur-lg opacity-30 group-hover:opacity-60 transition duration-500" />

          <Link href={signInHref} className={cn(
            "relative inline-flex items-center justify-center px-8 py-3.5 sm:px-10 sm:py-4 text-sm sm:text-base font-bold",
            "rounded-full transition-all duration-300 ease-out overflow-hidden z-10",
            "bg-gradient-to-b from-slate-800 to-slate-900 dark:from-white/10 dark:to-white/5 backdrop-blur-md",
            "text-white dark:text-white",
            "hover:from-slate-700 hover:to-slate-800 dark:hover:from-white/20 dark:hover:to-white/10",
            "shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_4px_20px_rgba(0,0,0,0.5)]",
            "border border-slate-900/10 dark:border-white/10",
            "active:scale-[0.98]"
          )}>
            <span className="relative z-10 flex items-center gap-2">
              {dict.cta || "开始免费诊断"}
              <svg aria-hidden="true" focusable="false" className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            {/* Shimmer sweep animation */}
            <motion.div
              className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent skew-x-[-25deg]"
              initial={{ x: '-150%' }}
              animate={{ x: '150%' }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            />
          </Link>
        </motion.div>

        {/* The Platinum Glass Card - Now featuring "Dry Goods" Mock Data */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl mt-12 sm:mt-16 relative perspective-1000 px-4"
        >

          {/* Main Depth Decorator - Volumetric Glow behind the card */}
          {/* Strong cyan/blue pop in light mode, subtle hollowed aura in dark mode that only glows outside the card */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[130%] bg-gradient-to-tr from-blue-400/15 via-cyan-300/20 to-indigo-400/15 dark:bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(6,182,212,0.12)_60%,rgba(59,130,246,0.1)_100%)] blur-[140px] dark:blur-[80px] rounded-[100%] pointer-events-none z-0 mix-blend-normal dark:mix-blend-screen" />

          <motion.div
            className={cn(
              "w-full rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 lg:p-10 relative overflow-hidden text-left z-10",
              // Light mode & Dark mode: unified standard card token
              "bg-white/70 dark:bg-white/[0.03] backdrop-blur-2xl",
              "border-[0.5px] border-black/5 dark:border-white/10 ring-1 ring-emerald-500/5 dark:ring-0",
              // Augmented shadow: sharp inner white rim + colored deep drop shadow (applied to both modes now)
              "shadow-[inset_0_2px_5px_rgba(255,255,255,0.9),0_40px_80px_-20px_rgba(14,165,233,0.15)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_15px_40px_-10px_rgba(14,165,233,0.15)]",
              "flex flex-col sm:flex-row items-center sm:items-start gap-8 lg:gap-12"
            )}
          >
            {/* Opacity Blocker for Dark Mode - Prevents neural network from bleeding through too much */}
            <div aria-hidden="true" className="absolute inset-0 bg-transparent dark:bg-[#09090B]/80 z-[-1] pointer-events-none" />

            {/* Fine Noise Texture for the glass */}
            <div aria-hidden="true" className="absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/noise.svg")', backgroundRepeat: 'repeat' }} />

            {/* Hyper-minimal Laser Sweep (Scanner Line) */}
            <motion.div
              className="absolute left-0 right-0 h-[100px] z-30 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent, rgba(6,182,212,0.02) 70%, rgba(6,182,212,0.1) 100%)',
              }}
              animate={{ top: ['-30%', '130%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            >
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-cyan-500/70 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            </motion.div>

            {/* Minimalist Score Ring - Reduced to 90 */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center z-10">
              {/* Ultra-thin Track */}
              <div className="absolute inset-0 rounded-full border border-slate-200 dark:border-slate-800" />

              {/* Progress Line (Cyan/Electric Blue) */}
              <svg aria-hidden="true" focusable="false" className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <motion.circle
                  cx="50" cy="50" r="49"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="stroke-cyan-500 dark:stroke-cyan-400"
                  initial={{ strokeDasharray: "0 308" }}
                  animate={{ strokeDasharray: `${currentMock.score * 308 / 100} 308` }} // Dyanmic completion based on mock score out of 2*pi*r (308)
                  transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>

              <div className="flex flex-col items-center justify-center">
                <span className="text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tighter text-slate-900 dark:text-white leading-none">
                  <AnimatedScore value={currentMock.score} />
                </span>
                <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mt-1">Match</span>
              </div>
            </div>

            {/* Live Data Mockup (Cyclic) */}
            {/* Using CSS Grid to overlap items so the container inherently sizes to the absolute identical children without explicit static heights, completely removing collapse jitter */}
            <div className="flex-1 w-full pt-1 z-10 relative grid">
              <AnimatePresence>
                <motion.div
                  key={mockIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="col-start-1 row-start-1 flex flex-col gap-6 w-full"
                >
                  {/* Target Role Header */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate mr-2">{currentMock.role}</h3>

                      {/* Custom UI Badge - Borderless, Soft Fill */}
                      <span className="flex shrink-0 items-center justify-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
                        {currentMock.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium line-clamp-2 min-h-[40px]">{currentMock.desc}</p>
                  </div>

                  <div className="h-px w-full bg-slate-200 dark:bg-white/10" />

                  {/* Actionable Insights Layout */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{dict.optimizationInsights || "Optimization Insights"}</h4>

                    {currentMock.insights.map((insight: any, i: number) => (
                      <motion.div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 relative overflow-hidden group shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-none transition-shadow hover:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.08)]"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.15 + 0.2 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent skew-x-[-20deg]"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 + i * 0.2 }}
                        />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0 mt-1.5 shadow-[0_0_6px_theme(colors.cyan.500)]" />
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{insight.title}</span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 min-h-[40px]">{insight.desc}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>

      </div>

    </section>
  )
}
