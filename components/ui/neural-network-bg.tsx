'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/lib/stores/ui-store'

interface NeuralNetworkBackgroundProps {
    variant?: 'hero' | 'workbench' | 'subdued'
    className?: string
}

export function NeuralNetworkBackground({ variant = 'hero', className }: NeuralNetworkBackgroundProps) {
    const [mounted, setMounted] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isInView = useInView(containerRef)

    const globalVariant = useUiStore((state) => state.bgVariant)
    const activeVariant = globalVariant ?? variant

    // Configure variant opacities and densities
    const isHero = activeVariant === 'hero'
    const isSubdued = activeVariant === 'subdued'
    const isWorkbench = activeVariant === 'workbench'

    const nodeCount = isHero ? 40 : 25
    const connCount = isHero ? 30 : 20
    const svgOpacityClasses = isHero
        ? "opacity-[0.5] dark:opacity-[0.6]"
        : isSubdued
            ? "opacity-[0.25] dark:opacity-[0.2]"
            : ""

    const nodes = useMemo(() => {
        const arr = []
        for (let i = 0; i < nodeCount; i++) {
            arr.push({
                id: i,
                // V8: Expand coverage well beyond the 100x100 viewBox so corners are populated
                x: Math.random() * 160 - 30, // [-30, 130] span
                y: Math.random() * 160 - 30, // [-30, 130] span
                size: Math.random() * 1.5 + 0.5,
            })
        }
        return arr
    }, [nodeCount])

    const connections = useMemo(() => {
        const arr = []
        for (let i = 0; i < connCount; i++) {
            const source = nodes[Math.floor(Math.random() * nodes.length)]!
            const target = nodes[Math.floor(Math.random() * nodes.length)]!
            if (source.id !== target.id) {
                arr.push({ id: i, source, target })
            }
        }
        return arr
    }, [nodes, connCount])

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        // Only apply opaque background for the hero variant. For the workbench, keep it fully transparent to let original themes pass through
        <div
            ref={containerRef}
            className={cn(
                "absolute inset-0 z-0 overflow-hidden pointer-events-none transition-colors duration-700",
                isHero ? "bg-slate-50 dark:bg-[#09090B]" : "bg-transparent",
                className
            )}
        >
            {mounted && isInView && (
                <motion.svg
                    aria-hidden="true"
                    focusable="false"
                    className={cn("absolute inset-0 w-full h-full", svgOpacityClasses)}
                    animate={{ rotate: 360, scale: isSubdued ? [1, 1.02, 1] : [1, 1.05, 1] }}
                    transition={{
                        rotate: { duration: isSubdued ? 600 : 250, repeat: Infinity, ease: 'linear' },
                        scale: { duration: isSubdued ? 120 : 30, repeat: Infinity, ease: 'easeInOut' }
                    }}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid slice"
                    style={{ originX: "50%", originY: "50%" }}
                >
                    {connections.map((conn) => (
                        <path
                            key={conn.id}
                            d={`M ${conn.source.x} ${conn.source.y} L ${conn.target.x} ${conn.target.y}`}
                            // V10: Hide paths on mobile (max-md:hidden) so it's a clean dot-only aesthetic
                            // V11: Hide paths on mobile (max-md:hidden) so it's a clean dot-only aesthetic
                            className={cn(
                                "fill-none",
                                !isHero && "max-md:hidden",
                                isHero
                                    ? "stroke-slate-400 dark:stroke-slate-700"
                                    : "stroke-slate-300/50 dark:stroke-slate-700/60" // V11: Deeper but thinner in Light mode
                            )}
                            strokeWidth={isHero ? "0.08" : "0.03"} // V11: Hairline thin
                        />
                    ))}

                    {/* Laser pulses - drastically reduced in subdued mode. Workbench capped at 8 to save CPU/GPU overhead */}
                    {connections.slice(0, isHero ? 20 : isSubdued ? 3 : 8).map((conn, idx) => (
                        <motion.path
                            key={`pulse-${conn.id}`}
                            d={`M ${conn.source.x} ${conn.source.y} L ${conn.target.x} ${conn.target.y}`}
                            // V12: Reduce light mode laser opacity for distraction-free workbench
                            className={cn(
                                isHero || "dark:stroke-amber-200/80 stroke-amber-300/40",
                                isHero && "stroke-amber-300 dark:stroke-amber-200/80"
                            )}
                            strokeWidth={idx % 3 === 0 ? "0.3" : "0.15"}
                            strokeLinecap="round"
                            fill="none"
                            initial={{ pathLength: 0.15, pathOffset: 0, opacity: 0 }}
                            animate={{
                                pathOffset: [0, 1],
                                opacity: [0, 1, 1, 0]
                            }}
                            transition={{
                                // Slower lasers for background distraction-free feel
                                duration: (isHero ? 2.5 : isSubdued ? 25 : 8) + Math.random() * (isSubdued ? 10 : 2.5),
                                repeat: Infinity,
                                delay: Math.random() * 3,
                                ease: "linear"
                            }}
                        // V13: Completely removed the drop-shadow SVG filter. 
                        // This filter operating continuously on up to 20 animated paths was causing extreme CPU/GPU usage and thermal spikes
                        />
                    ))}

                    {nodes.map((node) => (
                        <circle
                            key={node.id}
                            cx={node.x}
                            cy={node.y}
                            r={node.size * 0.15}
                            className={
                                isHero
                                    ? "fill-slate-500 dark:fill-slate-600"
                                    : "fill-slate-200/50 dark:fill-slate-600/80" // Faint nodes
                            }
                        />
                    ))}

                    {/* V11: Double the frequency of breathing cyan nodes (from 25% to 50%) */}
                    {nodes.map((node, i) => i % 2 === 0 && (
                        <motion.circle
                            key={`breath-${node.id}`}
                            cx={node.x}
                            cy={node.y}
                            r={node.size * 0.35}
                            // V12: Reduce light mode breathing node opacity
                            className={cn(
                                isHero || "dark:fill-cyan-400 fill-cyan-400/30",
                                isHero && "fill-cyan-500 dark:fill-cyan-400"
                            )}
                            animate={{ opacity: [0, isSubdued ? 0.3 : 0.9, 0], scale: isSubdued ? [1, 1.2, 1] : [1, 2, 1] }}
                            // Slow down breathing significantly on the subdued layer
                            transition={{ duration: (isHero ? 3 : isSubdued ? 15 : 6) + Math.random() * 3, repeat: Infinity, delay: Math.random() * 5 }}
                        />
                    ))}
                </motion.svg>
            )}

            {/* Extreme Fine Noise Texture for tactile feel (reduced weight in workbench mode) */}
            <div
                aria-hidden="true"
                className={cn(
                    "absolute inset-0 mix-blend-overlay pointer-events-none",
                    isHero ? "opacity-[0.03] dark:opacity-[0.05]" : "opacity-[0.01] dark:opacity-[0.02]"
                )}
                style={{ backgroundImage: 'url("/noise.svg")', backgroundRepeat: 'repeat' }}
            />
        </div>
    )
}
