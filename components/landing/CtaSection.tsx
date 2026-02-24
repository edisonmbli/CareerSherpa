'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export function CtaSection({ dict }: { dict: any }) {
  const t = dict.cta || {}

  return (
    <section className="relative w-full">
      {/* Background Ambient Glow (Breathing Cyber Blue Aura) */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <motion.div
          className="w-[600px] h-[400px] bg-cyan-500/20 dark:bg-cyan-500/10 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="container relative z-10 px-4 md:px-6 mx-auto"
      >
        <div className="max-w-4xl mx-auto">
          {/* Main Container - Silicon Valley Elite Glassmorphism */}
          <div className="p-10 md:p-16 rounded-[2rem] bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border-[0.5px] border-black/5 dark:border-white/10 shadow-2xl flex flex-col items-center text-center">

            {/* Hook Title */}
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-slate-900 dark:text-white mb-6 text-balance">
              {t.title}
            </h2>

            {/* Subtitle / Hook Proposition */}
            <p className="max-w-[700px] text-slate-500 dark:text-slate-400 md:text-lg mb-12 leading-relaxed text-balance">
              {t.subtitle}
            </p>

            {/* The Ultimate CTA Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative group"
            >
              {/* Outer Breathing Glow Layer */}
              <div aria-hidden="true" className="absolute -inset-1 rounded-full animate-pulse bg-cyan-500/20 blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500 shadow-[0_0_40px_-10px_rgba(6,182,212,0.8)]" />

              <Button
                asChild
                size="lg"
                className="relative z-10 h-20 px-12 sm:px-14 rounded-full text-xl font-bold bg-slate-900 dark:bg-cyan-500/10 text-white dark:text-cyan-400 hover:bg-slate-800 dark:hover:bg-cyan-500/20 border border-transparent dark:border-cyan-500/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] dark:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 overflow-hidden"
              >
                <Link href="/workbench" className="flex items-center gap-3">
                  <Sparkles aria-hidden="true" focusable="false" className="w-6 h-6 text-cyan-400 dark:text-cyan-300" />
                  <span>{t.button}</span>
                  <ArrowRight aria-hidden="true" focusable="false" className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1.5" />

                  {/* Subtle Shimmer Sweep */}
                  <div aria-hidden="true" className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-cyan-400/20 to-transparent" />
                </Link>
              </Button>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </section>
  )
}
