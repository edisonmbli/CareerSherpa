'use client'

import { Route, BrainCircuit, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

export function TrustBanner({ dict }: { dict: any }) {
    const t = dict.trustBanner || {}
    const items = [
        { icon: Route, text: t.privacy },
        { icon: BrainCircuit, text: t.ai },
        { icon: ShieldCheck, text: t.local },
    ]

    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveIndex((current) => (current - 1 + items.length) % items.length)
        }, 8000)
        return () => clearInterval(timer)
    }, [items.length])

    // Helper to get relative positions for the 3 items
    // -1 = left side, 0 = center, 1 = right side
    const getPos = (index: number) => {
        const diff = index - activeIndex
        if (diff === 0) return 0
        if (diff === 1 || diff === -(items.length - 1)) return 1
        return -1
    }

    return (
        <section className="w-full">
            <div className="mx-auto px-4 max-w-5xl py-6 sm:py-8">
                {/* Desktop View: All items inline */}
                <div className="hidden sm:flex flex-row flex-nowrap justify-between items-center gap-6 opacity-60 hover:opacity-100 transition-opacity duration-300">
                    {items.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex items-center justify-center flex-1 gap-2.5 text-slate-800 dark:text-slate-300"
                        >
                            <item.icon className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.5} />
                            <span className="text-sm md:text-sm lg:text-base font-medium tracking-wide whitespace-nowrap">
                                {item.text}
                            </span>
                        </motion.div>
                    ))}
                </div>

                {/* Mobile View: Horizontal scrolling carousel */}
                <div className="sm:hidden w-full h-8 relative flex items-center justify-center overflow-hidden">
                    {items.map((item, i) => {
                        const pos = getPos(i)
                        const isCenter = pos === 0

                        return (
                            <motion.div
                                key={i}
                                className="absolute flex items-center justify-center gap-2 text-slate-800 dark:text-slate-300 w-full"
                                initial={false}
                                animate={{
                                    x: pos === 0 ? "0%" : pos > 0 ? "100%" : "-100%",
                                    opacity: isCenter ? 1 : 0.3,
                                    filter: isCenter ? "blur(0px)" : "blur(2px)",
                                    scale: isCenter ? 1 : 0.85
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                    mass: 1
                                }}
                            >
                                <item.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.5} />
                                <span className="text-sm font-medium tracking-wide whitespace-nowrap">
                                    {item.text}
                                </span>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
