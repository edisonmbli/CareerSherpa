'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResultCard } from '@/components/workbench/ResultCard'
import { InterviewBattlePlan } from '@/components/workbench/interview/InterviewBattlePlan'
import { MockResume } from './MockResume'
import { MOCK_RESULT_DATA, MOCK_INTERVIEW_DATA } from '@/lib/mocks/landing-data'
import { cn } from '@/lib/utils'
import { BarChart3, FileEdit, Mic2, Share2, ArrowRight } from 'lucide-react'
import Image from 'next/image'

export function FeatureShowcase({ dict }: { dict: any }) {
  const [activeTab, setActiveTab] = useState<'match' | 'customize' | 'interview' | 'share'>('match')

  const tabs = [
    {
      id: 'match',
      label: dict.tabs.match,
      icon: BarChart3,
      description: dict.match.description,
      title: dict.match.title,
    },
    {
      id: 'customize',
      label: dict.tabs.customize,
      icon: FileEdit,
      description: dict.customize.description,
      title: dict.customize.title,
    },
    {
      id: 'interview',
      label: dict.tabs.interview,
      icon: Mic2,
      description: dict.interview.description,
      title: dict.interview.title,
    },
    {
        id: 'share',
        label: dict.tabs.share || 'Share',
        icon: Share2,
        description: dict.share?.description || 'Share your tailored resume with a simple link.',
        title: dict.share?.title || 'Share with Recruiters',
    }
  ] as const

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-[family-name:var(--font-playfair),serif]">
            {dict.title}
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-5xl mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex flex-col items-center p-6 rounded-xl transition-all duration-300 border text-center group relative overflow-hidden',
                  isActive
                    ? 'bg-primary/5 border-primary/20 shadow-sm'
                    : 'bg-card hover:bg-muted/50 border-transparent hover:border-border/50'
                )}
              >
                <div
                  className={cn(
                    'p-3 rounded-full mb-4 transition-colors duration-300',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  )}
                >
                  <tab.icon className="w-6 h-6" />
                </div>
                <h3
                  className={cn(
                    'font-semibold text-sm md:text-base transition-colors duration-300',
                    isActive ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {tab.label}
                </h3>
                
                {isActive && (
                    <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute bottom-0 left-0 right-0 h-1 bg-primary"
                    />
                )}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="relative min-h-[600px] max-w-6xl mx-auto perspective-1000">
             {/* Text Description for Active Tab */}
            <div className="text-center mb-8 max-w-2xl mx-auto min-h-[80px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h3 className="text-xl font-semibold mb-2">{tabs.find(t => t.id === activeTab)?.title}</h3>
                        <p className="text-muted-foreground">{tabs.find(t => t.id === activeTab)?.description}</p>
                    </motion.div>
                </AnimatePresence>
            </div>

          <div className="relative w-full rounded-2xl border bg-stone-50/50 dark:bg-stone-900/50 shadow-2xl overflow-hidden p-4 md:p-8 backdrop-blur-sm min-h-[600px] flex items-center justify-center">
             {/* Background Grid Pattern */}
            <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
            
            <AnimatePresence mode="wait">
              {activeTab === 'match' && (
                <motion.div
                  key="match"
                  initial={{ opacity: 0, x: 20, rotateY: 5 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  exit={{ opacity: 0, x: -20, rotateY: -5 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full max-w-3xl mx-auto"
                >
                  <ResultCard
                    data={MOCK_RESULT_DATA}
                    company="TechFlow Inc."
                    jobTitle="Senior Backend Engineer"
                    className="shadow-xl"
                  />
                </motion.div>
              )}

              {activeTab === 'customize' && (
                <motion.div
                  key="customize"
                  initial={{ opacity: 0, x: 20, rotateY: 5 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  exit={{ opacity: 0, x: -20, rotateY: -5 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full h-full flex items-center justify-center"
                >
                   {/* Resume Showcase: Split View or Enhanced Mock */}
                   <div className="grid md:grid-cols-2 gap-8 items-center w-full">
                        <div className="relative group">
                            {/* Editor UI Representation */}
                            <div className="rounded-xl border bg-background shadow-xl overflow-hidden relative z-10 transform transition-transform duration-500 group-hover:-translate-y-2 group-hover:-rotate-1">
                                <div className="h-8 border-b bg-muted/30 flex items-center px-3 gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground ml-2 font-mono">Editor</div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="h-4 w-3/4 bg-stone-100 dark:bg-stone-800 rounded" />
                                    <div className="h-20 w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded p-2 text-xs text-blue-600/80 font-mono">
                                        AI Suggestion: "Quantify your impact..."
                                    </div>
                                    <div className="h-4 w-1/2 bg-stone-100 dark:bg-stone-800 rounded" />
                                    <div className="h-4 w-5/6 bg-stone-100 dark:bg-stone-800 rounded" />
                                </div>
                            </div>
                            
                            {/* Templates Fanned Out Behind */}
                            <div className="absolute top-4 left-4 w-full h-full bg-stone-200 dark:bg-stone-800 rounded-xl border -z-10 transform rotate-3 scale-95" />
                            <div className="absolute top-8 left-8 w-full h-full bg-stone-100 dark:bg-stone-900 rounded-xl border -z-20 transform rotate-6 scale-90" />
                        </div>

                        <div className="h-[600px] w-full overflow-hidden rounded-lg border shadow-2xl bg-white transform md:scale-105 origin-left">
                            <MockResume />
                        </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'interview' && (
                <motion.div
                  key="interview"
                  initial={{ opacity: 0, x: 20, rotateY: 5 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  exit={{ opacity: 0, x: -20, rotateY: -5 }}
                  transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full max-w-3xl mx-auto"
                >
                  <InterviewBattlePlan
                    data={MOCK_INTERVIEW_DATA as any}
                    matchScore={85}
                    className="shadow-xl"
                  />
                </motion.div>
              )}

              {activeTab === 'share' && (
                  <motion.div
                    key="share"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center py-12"
                  >
                      <div className="relative w-full max-w-2xl aspect-[16/9] bg-white dark:bg-stone-950 rounded-xl shadow-2xl border flex flex-col overflow-hidden">
                          {/* Browser Chrome */}
                          <div className="h-10 bg-muted/30 border-b flex items-center px-4 justify-between">
                              <div className="flex gap-2">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                  <div className="w-3 h-3 rounded-full bg-green-400" />
                              </div>
                              <div className="flex-1 mx-4 bg-background rounded-md h-6 flex items-center justify-center text-xs text-muted-foreground font-mono">
                                  careershaper.ai/r/alex-chen-senior-backend
                              </div>
                          </div>
                          {/* Content */}
                          <div className="flex-1 bg-stone-50/50 p-8 flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                                <div className="bg-white p-6 shadow-lg rounded-lg border max-w-sm w-full transform -rotate-1 transition-transform hover:rotate-0 duration-500">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-stone-200 rounded-full" />
                                        <div>
                                            <div className="h-4 w-32 bg-stone-800 rounded mb-1" />
                                            <div className="h-3 w-20 bg-stone-400 rounded" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 w-full bg-stone-100 rounded" />
                                        <div className="h-3 w-5/6 bg-stone-100 rounded" />
                                        <div className="h-3 w-4/6 bg-stone-100 rounded" />
                                    </div>
                                </div>
                                
                                {/* Floating Share Card */}
                                <div className="absolute -bottom-6 -right-6 bg-white dark:bg-stone-900 p-4 rounded-xl shadow-xl border flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                            <Share2 className="w-5 h-5" />
                                        </div>
                                        <div className="text-sm font-medium">Public Link Active</div>
                                    </div>
                                    <div className="h-8 bg-stone-100 dark:bg-stone-800 rounded flex items-center px-3 text-xs text-muted-foreground font-mono w-48">
                                        /r/k8s-expert
                                    </div>
                                </div>
                          </div>
                      </div>
                  </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
