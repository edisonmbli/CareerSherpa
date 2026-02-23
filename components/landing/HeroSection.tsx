'use client'

import React, { useEffect, useMemo } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
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
      duration: 3,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.5
    })
    return controls.stop
  }, [value, count])

  return <motion.span>{rounded}</motion.span>
}

// 2. Neural Network Background (SVG + Framer Motion)
// Generates a static web of nodes and animates glowing paths along them
function NeuralNetworkBackground() {
  // Generate random nodes deterministically for hydration safety
  const nodes = useMemo(() => {
    const arr = []
    for (let i = 0; i < 40; i++) {
      arr.push({
        id: i,
        x: 10 + Math.random() * 80, // percentage
        y: 10 + Math.random() * 80,
        size: Math.random() * 2 + 1,
      })
    }
    return arr
  }, [])

  const connections = useMemo(() => {
    const arr = []
    for (let i = 0; i < 30; i++) {
      const source = nodes[Math.floor(Math.random() * nodes.length)]!
      const target = nodes[Math.floor(Math.random() * nodes.length)]!
      if (source.id !== target.id) {
        arr.push({ id: i, source, target })
      }
    }
    return arr
  }, [nodes])

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-50 dark:bg-[#0B1120] transition-colors duration-700">
      <motion.svg
        className="absolute inset-0 w-full h-full opacity-40 dark:opacity-60"
        animate={{ rotate: 360 }}
        transition={{ duration: 300, repeat: Infinity, ease: 'linear' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Draw connections with animating dasharrays to simulate energy flow */}
        {connections.map((conn) => (
          <motion.path
            key={conn.id}
            d={`M ${conn.source.x} ${conn.source.y} L ${conn.target.x} ${conn.target.y}`}
            className="stroke-amber-400/20 dark:stroke-amber-500/20"
            strokeWidth="0.1"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: [0, 1, 1, 0],
              opacity: [0, 1, 1, 0]
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Draw nodes */}
        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.size * 0.1}
            className="fill-blue-900/30 dark:fill-blue-400/30"
          />
        ))}

        {/* Pulse nodes */}
        {nodes.map((node, i) => i % 3 === 0 && (
          <motion.circle
            key={`pulse-${node.id}`}
            cx={node.x}
            cy={node.y}
            r={node.size * 0.2}
            className="fill-amber-400 pb-blend-screen"
            animate={{ opacity: [0, 0.8, 0], scale: [1, 2, 1] }}
            transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 5 }}
          />
        ))}
      </motion.svg>

      {/* Base Radial Gradients to give depth to the grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(23,37,84,0.05),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.15),transparent_70%)]" />

      {/* Extreme Fine Noise Texture */}
      <div className="absolute inset-0 mix-blend-overlay opacity-[0.06] dark:opacity-[0.08]" style={{ backgroundImage: 'url("/noise.svg")' }} />
    </div>
  )
}

// 3. Holographic Data Cloud
function HolographicCloud() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 2, delay: 1 }}
      className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-20 pointer-events-none z-20 flex items-end justify-center perspective-1000"
    >
      <motion.div
        animate={{ rotateY: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="relative w-24 h-24 transform-style-3d opacity-60 flex items-center justify-center"
      >
        <svg viewBox="0 0 100 100" className="absolute w-full h-full overflow-visible">
          {/* Abstract projected grid lines */}
          <motion.path d="M 10 50 L 90 50 M 50 10 L 50 90 M 15 15 L 85 85 M 15 85 L 85 15" className="stroke-amber-400/40" strokeWidth="0.5" fill="none"
            animate={{ strokeDasharray: ["0, 100", "100, 0"], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
          {/* Glowing data rings */}
          <ellipse cx="50" cy="50" rx="30" ry="10" className="stroke-indigo-400/50 fill-none" strokeWidth="0.5" />
          <ellipse cx="50" cy="50" rx="10" ry="30" className="stroke-amber-400/40 fill-none" strokeWidth="0.5" />
          <motion.circle cx="50" cy="50" r="40" className="stroke-blue-400/30 stroke-dashed fill-none" strokeWidth="0.5" animate={{ rotate: 360, transformOrigin: 'center' }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} strokeDasharray="2 4" />
        </svg>
      </motion.div>
      {/* Subtle light beam projecting upwards */}
      <div className="absolute bottom-0 w-8 h-24 bg-gradient-to-t from-amber-400/10 to-transparent blur-md" />
    </motion.div>
  )
}

export function HeroSection({ dict, locale }: HeroSectionProps) {
  return (
    <section className={cn(
      "relative w-full min-h-[105vh] flex flex-col items-center justify-center overflow-hidden",
      "pt-32 pb-24 px-4 sm:px-6 lg:px-8",
      plusJakarta.variable,
      playfair.variable,
      "font-sans text-slate-900 dark:text-slate-50"
    )}>

      {/* 1. Deep Indigo / Gold Neural Network Background */}
      <NeuralNetworkBackground />

      {/* Main Content Area */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-8 sm:space-y-10">

        {/* Headline: Haute Couture sizing and balance */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.1] font-extrabold tracking-tight text-balance",
            "font-[family-name:var(--font-plus-jakarta)]",
            // Deep text with subtle gradient that shines
            "text-transparent bg-clip-text bg-gradient-to-br from-indigo-950 via-slate-800 to-indigo-800 dark:from-white dark:via-slate-200 dark:to-indigo-200 drop-shadow-sm"
          )}
        >
          {dict.title || "你的 AI 求职私教"}
        </motion.h1>

        {/* Subheadline: Elegant text balance */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg sm:text-xl md:text-2xl text-slate-600 dark:text-slate-400/90 max-w-3xl leading-relaxed sm:leading-loose px-4 text-balance"
        >
          {dict.subtitle || "告别海投。沉淀个人经历，让 AI 为你精准匹配岗位、定制惊艳简历并制定面试通关策略。"}
        </motion.p>

        {/* Master CTA Button: Luxury Gold Accent */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="pt-6"
        >
          <Link href={`/${locale}/workbench`} className={cn(
            "group relative inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 text-lg font-bold text-slate-900",
            "rounded-full overflow-hidden transition-all duration-500 ease-out",
            // Rich Metallic Gold Gradient
            "bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600",
            "shadow-[0_0_30px_rgba(245,158,11,0.2),0_8px_16px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,0.8)]",
            "hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(245,158,11,0.4),0_12px_24px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.9)]",
            "active:scale-95 active:shadow-inner"
          )}>
            {/* Glossy Shimmer Sweep */}
            <motion.div
              className="absolute inset-0 -translate-x-[150%] skew-x-[-25deg] bg-gradient-to-r from-transparent via-white/50 to-transparent"
              animate={{ x: ['-150%', '250%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            />

            <span className="relative flex items-center gap-2 drop-shadow-sm">
              {dict.cta || "开始免费诊断"}
              <svg className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:translate-x-1 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>
        </motion.div>

        {/* The Digital Haute Couture Card */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl mt-20 sm:mt-28 relative perspective-1000 px-4"
        >
          {/* Holographic Projection Above */}
          <HolographicCloud />

          {/* Diffused Gold Base Glow */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[70%] h-12 bg-amber-500/20 dark:bg-amber-500/30 blur-[40px] rounded-[100%] pointer-events-none" />

          {/* Multi-layered Optical Instrument Card */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "w-full rounded-2xl sm:rounded-3xl p-6 sm:p-10 relative overflow-hidden",
              // Deep frosted glass
              "bg-white/60 dark:bg-[#0B1120]/60 backdrop-blur-2xl",
              // Double complex shadowing: physical depth + glow + inner sheen
              "shadow-[0_20px_80px_-10px_rgba(23,37,84,0.1),0_0_0_1px_rgba(23,37,84,0.05)_inset,inset_0_2px_4px_rgba(255,255,255,0.4)]",
              "dark:shadow-[0_20px_80px_-10px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset,inset_0_1px_2px_rgba(255,255,255,0.1)]",
              "flex flex-col sm:flex-row items-center sm:items-start gap-8 transform-gpu preserve-3d"
            )}
            style={{ rotateX: "3deg", rotateY: "-1deg" }}
          >
            {/* Metallic Gold Gradient Border via pseudo-element illusion */}
            <div className="absolute inset-0 rounded-2xl sm:rounded-3xl p-[1px] bg-gradient-to-br from-amber-300/60 via-transparent to-indigo-500/30 dark:from-amber-500/40 dark:via-transparent dark:to-indigo-500/20 pointer-events-none [mask-image:linear-gradient(black,black)] [mask-composite:exclude]" />

            {/* Fine Noise Texture for tactile feel */}
            <div className="absolute inset-0 mix-blend-overlay opacity-20 pointer-events-none" style={{ backgroundImage: 'url("/noise.svg")' }} />

            {/* Energy Sweep (Scanner Line) */}
            <motion.div
              className="absolute left-0 right-0 h-[80px] z-30 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent, rgba(251,191,36,0.15) 50%, rgba(251,191,36,0.8) 100%)',
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
              }}
              animate={{ top: ['-20%', '120%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-amber-300 shadow-[0_0_15px_3px_rgba(251,191,36,0.6)]" />
            </motion.div>

            {/* Score Ring */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center text-amber-500 z-10">
              {/* Outer Glow Ring */}
              <div className="absolute inset-[-4px] rounded-full border border-amber-500/20 shadow-[0_0_20px_rgba(251,191,36,0.2)]" />
              {/* Thick Semi-transparent track */}
              <div className="absolute inset-0 rounded-full border-[8px] border-indigo-900/5 dark:border-white/5" />
              {/* Animated Conic Energy Stream */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[0px] rounded-full border-[8px] border-transparent"
                style={{
                  borderTopColor: '#fbbf24',
                  boxShadow: '0 0 10px #fbbf24 inset, 0 0 10px #fbbf24',
                  filter: 'drop-shadow(0 0 4px #f59e0b)'
                }}
              />
              <span className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter drop-shadow-md text-amber-600 dark:text-amber-400">
                <AnimatedScore value={98} />
              </span>
            </div>

            {/* Data Skeletons matched to the Indigo/Gold theme */}
            <div className="flex-1 w-full flex flex-col gap-5 pt-2 z-10">
              <div className="flex flex-col gap-3">
                <div className="h-5 w-48 sm:w-64 bg-indigo-950/10 dark:bg-white/10 rounded-md relative overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  />
                </div>
                <div className="h-4 w-32 sm:w-40 bg-indigo-950/5 dark:bg-white/5 rounded-md" />
              </div>

              <div className="h-px w-full bg-indigo-900/10 dark:bg-white/10 my-2" />

              <div className="flex flex-col gap-3 w-full">
                {/* Row 1 - Success/Highlight in Gold */}
                <div className="flex gap-3 w-full items-center">
                  <div className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <div className="h-4 w-3/4 bg-indigo-950/5 dark:bg-white/5 rounded-full" />
                </div>
                {/* Row 2 */}
                <div className="flex gap-3 w-full items-center">
                  <div className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <div className="h-4 w-1/2 bg-indigo-950/5 dark:bg-white/5 rounded-full" />
                </div>
                {/* Row 3 - Subtle alert in secondary tone */}
                <div className="flex gap-3 w-full items-center mt-2">
                  <div className="h-3 w-3 rounded-full bg-indigo-400 dark:bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  <div className="h-4 w-2/3 bg-indigo-950/5 dark:bg-white/5 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

      </div>

    </section>
  )
}