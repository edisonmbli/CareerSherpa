'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LandingHero({ dict, locale }: { dict: any; locale: string }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-48 md:pb-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-stone-50/30 dark:bg-stone-950/30">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/10 opacity-30 blur-[120px]" />
      </div>

      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center text-center space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6 max-w-4xl flex flex-col items-center"
          >
            <div className="inline-flex items-center rounded-full border border-stone-200 bg-white/80 dark:bg-stone-900/80 px-4 py-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 backdrop-blur-md shadow-sm mb-2">
              <Sparkles className="mr-2 h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="text-xs md:text-sm tracking-wide uppercase">
                AI-Powered Career Assistant
              </span>
            </div>
            
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-stone-900 to-stone-600 dark:from-white dark:to-stone-400 font-[family-name:var(--font-playfair),serif] leading-[1.1]">
              {dict.title}
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-stone-600 dark:text-stone-400 leading-relaxed">
              {dict.subtitle}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 w-full justify-center"
          >
            <Button asChild size="lg" className="rounded-full px-8 h-14 text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
              <Link href={`/${locale}/workbench`}>
                {dict.cta}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </motion.div>

          {/* Abstract Visual Representation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.8, delay: 0.4, type: "spring" }}
            className="relative mt-16 w-full max-w-6xl perspective-1000"
          >
            <div className="rounded-2xl border bg-stone-100/50 dark:bg-stone-900/50 p-2 md:p-3 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10">
               <div className="aspect-[16/9] w-full rounded-xl bg-background border shadow-inner relative overflow-hidden group">
                  {/* Window Controls */}
                  <div className="absolute top-0 left-0 right-0 h-10 border-b bg-muted/30 flex items-center px-4 gap-2 z-10">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-stone-300" />
                        <div className="w-3 h-3 rounded-full bg-stone-300" />
                        <div className="w-3 h-3 rounded-full bg-stone-300" />
                    </div>
                  </div>
                  
                  {/* Skeleton UI Content */}
                  <div className="absolute inset-0 pt-10 p-8 flex gap-8">
                     {/* Sidebar */}
                     <div className="w-64 h-full hidden md:flex flex-col gap-4 border-r pr-6 opacity-40">
                        <div className="h-8 w-3/4 bg-stone-200 dark:bg-stone-800 rounded-md" />
                        <div className="space-y-2 mt-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-4 w-full bg-stone-100 dark:bg-stone-800/50 rounded" />
                            ))}
                        </div>
                     </div>
                     
                     {/* Main Content */}
                     <div className="flex-1 flex flex-col gap-6">
                        <div className="flex justify-between items-center">
                            <div className="h-8 w-1/3 bg-stone-200 dark:bg-stone-800 rounded-md animate-pulse" />
                            <div className="h-8 w-24 bg-primary/20 rounded-md" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 h-full">
                            <div className="rounded-xl border bg-stone-50 dark:bg-stone-900/50 p-4 space-y-4">
                                <div className="h-4 w-1/2 bg-stone-200 dark:bg-stone-800 rounded" />
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded" />
                                    <div className="h-2 w-5/6 bg-stone-100 dark:bg-stone-800 rounded" />
                                </div>
                            </div>
                             <div className="rounded-xl border bg-stone-50 dark:bg-stone-900/50 p-4 space-y-4">
                                <div className="h-4 w-1/2 bg-stone-200 dark:bg-stone-800 rounded" />
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded" />
                                    <div className="h-2 w-5/6 bg-stone-100 dark:bg-stone-800 rounded" />
                                </div>
                            </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Floating Elements - "Magic" */}
                  <div className="absolute bottom-12 right-12 p-4 bg-white dark:bg-stone-900 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-stone-100 dark:border-stone-800 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
                     <div className="h-10 w-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                     </div>
                     <div>
                        <div className="text-sm font-bold">92% Match Score</div>
                        <div className="text-xs text-muted-foreground">Ready to apply</div>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
