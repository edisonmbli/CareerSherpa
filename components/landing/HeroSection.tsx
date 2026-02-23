'use client'

import React, { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// Initialize fonts
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

// Subcomponent: Animated Counter to 98
function AnimatedScore({ value }: { value: number }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 2.5,
      ease: [0.16, 1, 0.3, 1],
      delay: 1.5
    })
    return controls.stop
  }, [value, count])

  return <motion.span>{rounded}</motion.span>
}

// Main Component
export function HeroSection({ dict, locale }: HeroSectionProps) {
  return (
    <section className={cn(
      "relative w-full min-h-[100vh] flex flex-col items-center justify-center overflow-hidden",
      "pt-32 pb-24 px-4 sm:px-6 lg:px-8",
      plusJakarta.variable,
      playfair.variable,
      "font-sans"
    )}>

      {/* Background 1: Ambient Aurora Grid / Node Network Feel */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Sky Blue Aurora Blob */}
        <motion.div
          animate={{
            x: ['-10%', '10%', '-10%'],
            y: ['0%', '20%', '0%'],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-10%] left-[10%] w-[50vw] h-[50vh] max-w-[800px] max-h-[800px] bg-sky-500/20 dark:bg-sky-500/10 rounded-full blur-[100px] md:blur-[140px]"
        />
        {/* Emerald Aurora Blob */}
        <motion.div
          animate={{
            x: ['10%', '-10%', '10%'],
            y: ['20%', '-10%', '20%'],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-[20%] right-[10%] w-[40vw] h-[40vh] max-w-[700px] max-h-[700px] bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-[100px] md:blur-[140px]"
        />
        {/* Deep Blue Aurora Blob */}
        <motion.div
          animate={{
            y: ['0%', '15%', '0%'],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[-10%] left-[30%] w-[60vw] h-[40vh] max-w-[900px] max-h-[600px] bg-blue-600/15 dark:bg-blue-600/15 rounded-full blur-[120px] md:blur-[150px]"
        />

        {/* Global Noise Overlay for Texture */}
        <div className="absolute inset-0 mix-blend-overlay opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'url("/noise.svg")' }} />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-8 sm:space-y-10">

        {/* Headline with subtle gradient and massive sizing */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.1] font-extrabold tracking-tight",
            "font-[family-name:var(--font-plus-jakarta)]",
            "text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/90 to-sky-900/60 dark:to-sky-200/60 drop-shadow-sm"
          )}
        >
          {dict.title || "你的 AI 求职私教"}
        </motion.h1>

        {/* Subheadline updated for visual balance */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed sm:leading-loose px-4"
        >
          {dict.subtitle || "告别海投。沉淀个人经历，让 AI 为你精准匹配岗位、定制惊艳简历并制定面试通关策略。"}
        </motion.p>

        {/* Master CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="pt-6"
        >
          <Link href={`/${locale}/workbench`} className={cn(
            "group relative inline-flex items-center justify-center px-8 sm:px-10 py-4 sm:py-5 text-lg font-bold text-white",
            "rounded-full overflow-hidden transition-all duration-500 ease-out",
            "bg-gradient-to-b from-sky-400 to-sky-600 dark:from-sky-500 dark:to-sky-700",
            // Complex shadow stacking: Colored Glow + Drop Shadow + Inset highlight
            "shadow-[0_0_40px_rgba(14,165,233,0.3),0_8px_16px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.4)]",
            "hover:scale-[1.02] hover:shadow-[0_0_60px_rgba(14,165,233,0.5),0_12px_24px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.6)]",
            "active:scale-95 active:shadow-inner"
          )}>
            {/* Shimmer / Sweep Animation Layer */}
            <motion.div
              className="absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-150%', '250%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
            />

            <span className="relative flex items-center gap-2 drop-shadow-md">
              {dict.cta || "开始免费诊断"}
              {/* Arrow Icon */}
              <svg className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>
        </motion.div>

        {/* Decorative Scene: The "AI Match Card" with glassmorphism, scanner line, and animated counter */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl mt-16 sm:mt-24 relative perspective-1000 px-4"
        >
          {/* Intense Glow Blobs Behind the Card to feed the backdrop-blur */}
          <div className="absolute top-1/2 left-1/4 w-[30vw] h-[30vw] max-w-[300px] max-h-[300px] bg-emerald-400/40 dark:bg-emerald-500/30 rounded-full blur-[80px] -translate-y-1/2 -z-10 animate-pulse" />
          <div className="absolute top-1/2 right-1/4 w-[30vw] h-[30vw] max-w-[300px] max-h-[300px] bg-sky-400/40 dark:bg-sky-500/30 rounded-full blur-[80px] -translate-y-1/2 -z-10 animate-pulse" style={{ animationDelay: '1s' }} />

          {/* Glass Card */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "w-full rounded-2xl sm:rounded-3xl p-6 sm:p-10 relative overflow-hidden",
              "bg-background/40 dark:bg-card/40 backdrop-blur-xl",
              "border border-white/20 dark:border-white/10",
              "shadow-[0_0_0_1px_rgba(255,255,255,0.2)_inset,0_20px_60px_rgba(0,0,0,0.1)]",
              "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_20px_60px_rgba(0,0,0,0.4)]",
              "flex flex-col sm:flex-row items-center sm:items-start gap-8 origin-center transform-gpu preserve-3d"
            )}
            style={{ rotateX: "4deg", rotateY: "-1deg" }}
          >
            {/* Inner noise overlay strictly for the card */}
            <div className="absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none" style={{ backgroundImage: 'url("/noise.svg")' }} />

            {/* AI Scanner Line Animation */}
            <motion.div
              className="absolute left-0 right-0 h-[2px] bg-emerald-400/70 z-50 pointer-events-none shadow-[0_0_12px_3px_rgba(52,211,153,0.5)]"
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />

            {/* Score Ring */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-full border-[6px] border-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[inset_0_4px_20px_rgba(16,185,129,0.1)] bg-background/50">
              {/* Spinning Dashed Ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-6px] rounded-full border-[6px] border-emerald-500 border-dashed opacity-50"
              />
              <span className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter drop-shadow-md">
                <AnimatedScore value={98} />
              </span>
            </div>

            {/* Data Skeletons */}
            <div className="flex-1 w-full flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-3">
                <div className="h-5 w-48 sm:w-64 bg-foreground/15 rounded-md relative overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
                  />
                </div>
                <div className="h-4 w-32 sm:w-40 bg-foreground/10 rounded-md" />
              </div>

              <div className="h-px w-full bg-border/50 my-2" />

              <div className="flex flex-col gap-3 w-full">
                {/* Row 1 */}
                <div className="flex gap-3 w-full items-center">
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div className="h-4 w-3/4 bg-foreground/10 rounded-full" />
                </div>
                {/* Row 2 */}
                <div className="flex gap-3 w-full items-center">
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div className="h-4 w-1/2 bg-foreground/10 rounded-full" />
                </div>
                {/* Row 3 - Warning */}
                <div className="flex gap-3 w-full items-center mt-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  <div className="h-4 w-2/3 bg-foreground/10 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

      </div>

      {/* Bottom fade to seamlessly blend into next section */}
      <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}