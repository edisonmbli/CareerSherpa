'use client'

import { Route, BrainCircuit, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

export function TrustBanner({ dict }: { dict: any }) {
    const t = dict.trustBanner || {}
    const items = [
        { icon: Route, text: t.privacy },
        { icon: BrainCircuit, text: t.ai },
        { icon: ShieldCheck, text: t.local },
    ]

    return (
        <section className="w-full border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-[#09090B]/50 overflow-hidden">
            <div className="mx-auto px-4 max-w-5xl py-6 sm:py-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 opacity-60 hover:opacity-100 transition-opacity duration-300">
                    {items.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex items-center justify-center flex-1 gap-2.5 text-slate-800 dark:text-slate-300"
                        >
                            <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.5} />
                            <span className="text-sm sm:text-base md:text-sm lg:text-base font-medium tracking-wide whitespace-nowrap">
                                {item.text}
                            </span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
