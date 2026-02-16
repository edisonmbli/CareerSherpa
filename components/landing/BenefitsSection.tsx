'use client'

import { motion } from 'framer-motion'
import { Target, Zap, ShieldCheck } from 'lucide-react'

export function BenefitsSection({ dict }: { dict: any }) {
  const icons = [Target, Zap, ShieldCheck]

  return (
    <section className="py-24 bg-background">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-[family-name:var(--font-playfair),serif]">
            {dict.title}
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {dict.items.map((item: any, index: number) => {
            const Icon = icons[index] || Target
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="group flex flex-col items-center text-center p-8 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 transition-all duration-300 hover:shadow-xl hover:border-stone-200 dark:hover:border-stone-700"
              >
                <div className="p-4 rounded-2xl bg-white dark:bg-stone-800 shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
