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

    const [index, setIndex] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            // Decaying index to slide items to the right
            setIndex((current) => current - 1)
        }, 8000)
        return () => clearInterval(timer)
    }, [])

    const getItem = (i: number) => items[((i % items.length) + items.length) % items.length]
    // Render left (-1), center (0), right (+1)
    const visibleIndices = [index - 1, index, index + 1]

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
                {/* Apply opacity-70 to the wrapper so the max opacity matches the desktop 60%~70% aesthetic */}
                <div className="sm:hidden w-full h-10 relative flex items-center justify-center overflow-hidden opacity-70">
                    <AnimatePresence>
                        {visibleIndices.map((i) => {
                            const pos = i - index
                            const isCenter = pos === 0
                            const item = getItem(i)
                            if (!item) return null

                            return (
                                <motion.div
                                    key={i}
                                    className="absolute flex items-center justify-center gap-2 text-slate-800 dark:text-slate-300 w-auto"
                                    initial={{
                                        x: pos < 0 ? -220 : 220,
                                        opacity: 0,
                                        filter: "blur(4px)",
                                        scale: 0.8
                                    }}
                                    animate={{
                                        x: pos * 180, // Offset by 180px so edges peek in safely
                                        opacity: isCenter ? 1 : 0.35,
                                        filter: isCenter ? "blur(0px)" : "blur(1px)",
                                        scale: isCenter ? 1 : 0.85
                                    }}
                                    exit={{
                                        x: pos < 0 ? -220 : 220,
                                        opacity: 0,
                                        filter: "blur(4px)",
                                        scale: 0.8
                                    }}
                                    transition={{
                                        duration: 2.0, // extremely elegant, slow, breathable transition
                                        ease: [0.16, 1, 0.3, 1]
                                    }}
                                >
                                    <item.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" strokeWidth={1.5} />
                                    <span className="text-sm font-medium tracking-wide whitespace-nowrap">
                                        {item.text}
                                    </span>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
