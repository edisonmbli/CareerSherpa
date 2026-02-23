'use client'

import React from 'react'
import { motion } from 'framer-motion'
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

export function HeroSection({ dict, locale }: HeroSectionProps) {
  return (
    <section className={cn(
      "relative w-full min-h-[90vh] flex flex-col items-center justify-center overflow-hidden",
      "pt-20 pb-16 px-4 sm:px-6 lg:px-8",
      plusJakarta.variable,
      playfair.variable,
      "font-sans" // Use plus jakarta as default sans for this section
    )}>
      {/* Background Effect: Slow-spinning, blurred SVG gradient orb */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.05, 1],
          }}
          transition={{
            rotate: { duration: 40, repeat: Infinity, ease: 'linear' },
            scale: { duration: 10, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full opacity-[0.15] dark:opacity-20 blur-3xl filter"
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.8) 0%, rgba(56,189,248,0.4) 50%, rgba(255,255,255,0) 70%)',
          }}
        />
        {/* Subtle grid pattern overlay for texture */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: 'url("/noise.svg")' }} />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-8">

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground",
            "font-[family-name:var(--font-plus-jakarta)]"
          )}
        >
          {dict.title || "你的 AI 求职私教"}
        </motion.h1>

        {/* Subheadline (Using dict.subtitle as per previous HeroSection)*/}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed"
        >
          {dict.subtitle || "告别海投。沉淀个人经历，让 AI 为你精准匹配岗位、定制惊艳简历并制定面试通关策略。"}
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="pt-4"
        >
          <Link href={`/${locale}/workbench`} className={cn(
            "group relative inline-flex items-center justify-center px-8 py-4 text-base sm:text-lg font-semibold text-white",
            "bg-primary rounded-full overflow-hidden transition-all duration-300",
            "hover:scale-105 hover:shadow-[0_8px_30px_rgb(14,165,233,0.3)]",
            "active:scale-95"
          )}>
            {/* Button Glow Effect */}
            <span className="absolute inset-0 rounded-full ring-2 ring-primary/50 ring-offset-2 ring-offset-background animate-pulse" />

            <span className="relative flex items-center gap-2">
              {dict.cta || "开始免费诊断"}
              {/* Optional Icon */}
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>
        </motion.div>

        {/* Abstract Floating UI Component (The "Mock Match Score Card") */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-3xl mt-12 sm:mt-16 relative perspective-1000"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className={cn(
              "w-full rounded-xl sm:rounded-2xl p-6 sm:p-8 backdrop-blur-md bg-card/60",
              "border border-border/50",
              "shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset,0_10px_40px_rgba(0,0,0,0.08)]",
              "dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_10px_40px_rgba(0,0,0,0.3)]",
              "flex flex-col items-center gap-4 origin-center transform-gpu preserve-3d"
            )}
            style={{ rotateX: "5deg" }}
          >
            {/* Fake Card Content to simulate ResultCard aesthetic */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <span className="text-2xl sm:text-3xl font-bold">98</span>
            </div>
            <div className="h-4 w-32 bg-foreground/10 rounded-full animate-pulse" />
            <div className="flex gap-2 w-full justify-center">
              <div className="h-2 w-1/4 bg-foreground/5 rounded-full" />
              <div className="h-2 w-1/3 bg-foreground/5 rounded-full" />
              <div className="h-2 w-1/5 bg-foreground/5 rounded-full" />
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  )
}