'use client'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

function splitTitle(title: string): [string, string] {
  const parts = title.split(/—|——|-/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) return [parts[0]!, parts.slice(1).join(' — ')]
  return [title, '']
}

function highlightWord(text: string, highlightKeyword: string) {
  const key = highlightKeyword
  const idx = text.toLowerCase().indexOf(key.toLowerCase())
  if (idx < 0) return text
  const start = text.slice(0, idx)
  const match = text.slice(idx, idx + key.length)
  const end = text.slice(idx + key.length)
  return (
    <>
      {start}
      <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
        {match}
      </span>
      {end}
    </>
  )
}

export function HeroSection({ dict, visualSrc, locale }: { dict: any; visualSrc?: string; locale: string }) {
  return (
    <section className="container mx-auto px-4 py-24 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {(() => {
          const [line1, line2] = splitTitle(String(dict.title || ''))
          return (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              <span className="block">{line1}</span>
              {line2 && (
                <span className="block">{highlightWord(line2, dict.landing?.highlightKeyword || '')}</span>
              )}
            </h1>
          )
        })()}
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">{dict.subtitle}</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <Button asChild size="lg" className="mt-8 rounded-full px-6">
          <Link href="/workbench">{dict.cta}</Link>
        </Button>
      </motion.div>
      <div className="mt-12">
        {visualSrc ? (
          <div className="rounded-2xl overflow-hidden border mx-auto max-w-4xl">
            <Image src={visualSrc} alt="Hero Visual" width={1600} height={900} className="w-full h-auto" priority />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl h-56 md:h-72 rounded-3xl shadow-xl border bg-[radial-gradient(ellipse_at_center,theme(colors.blue.500),theme(colors.indigo.500),theme(colors.cyan.400))] opacity-85" />
        )}
      </div>
    </section>
  )
}