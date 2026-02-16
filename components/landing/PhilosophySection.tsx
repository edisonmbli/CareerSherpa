'use client'

import { motion } from 'framer-motion'
import { FileText, ArrowRight, Layers, Briefcase, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PhilosophySection({ dict }: { dict: any }) {
  const steps = [
    {
      icon: Layers,
      title: dict.step1,
      desc: 'Chaos',
      color: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
      delay: 0,
    },
    {
      icon: FileText,
      title: dict.step2,
      desc: 'Order',
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      highlight: true,
      delay: 0.2,
    },
    {
      icon: Sparkles,
      title: dict.step3,
      desc: 'Magic',
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      delay: 0.4,
    },
  ]

  return (
    <section className="py-32 bg-stone-50/50 dark:bg-stone-900/10 border-y border-stone-200/60 dark:border-stone-800/60 overflow-hidden">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="grid gap-16 lg:grid-cols-2 items-center">
          {/* Left: Text Content */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight font-[family-name:var(--font-playfair),serif] leading-tight">
              {dict.title}
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
              {dict.description}
            </p>
          </motion.div>

          {/* Right: Interactive Visual */}
          <div className="relative h-[400px] flex items-center justify-center">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-700 to-transparent -translate-y-1/2 z-0" />

            <div className="relative z-10 grid grid-cols-3 gap-4 w-full max-w-xl">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: step.delay, duration: 0.5 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -10, transition: { duration: 0.2 } }}
                  className="flex flex-col items-center group cursor-default"
                >
                  <div 
                    className={cn(
                      "w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 relative bg-background border",
                      step.highlight 
                        ? "border-blue-200 shadow-blue-100 dark:shadow-none dark:border-blue-800" 
                        : "border-stone-200 dark:border-stone-800"
                    )}
                  >
                    <div className={cn("p-4 rounded-xl transition-transform duration-300 group-hover:scale-110", step.color)}>
                      <step.icon className="w-8 h-8" />
                    </div>
                    
                    {/* Hover Glow */}
                    {step.highlight && (
                      <div className="absolute inset-0 rounded-2xl bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    )}
                  </div>
                  
                  <div className="mt-6 text-center space-y-1">
                    <h3 className="font-bold text-lg">{step.title}</h3>
                    <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                      {step.desc}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
