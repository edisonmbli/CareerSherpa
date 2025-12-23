'use client'

import React from 'react'
import { TemplateProps } from './types'
import { useResumeTheme } from './hooks/useResumeTheme'
import { renderDescription, formatDate } from './utils'
import { cn } from '@/lib/utils'
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Globe,
  ExternalLink,
  Linkedin,
  Dribbble,
  Palette,
  LucideIcon,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

/**
 * Designer Template V4 - "Studio Pro"
 * Refinements:
 * - Unified Icon Styles
 * - Grid Alignment for Contact Links
 * - Consistent Section Widths (Fixed Alignment)
 * - Enhanced Visual Depth (Gradients & Noise)
 * - Full Visible Links for Print
 */
export function TemplateDesign({ data, config, styleConfig }: TemplateProps) {
  const {
    basics,
    workExperiences,
    projectExperiences,
    educations,
    skills,
    certificates,
    hobbies,
    customSections,
  } = data

  const theme = useResumeTheme({
    themeColor: '#2563EB',
    ...styleConfig,
  })

  // Helper: Generate Gradient Colors
  // This is a simplified logic. In a real app, use a color manipulation library.
  // We'll generate a secondary color by shifting the hue of the primary color.
  const getGradientStyle = (hexColor: string) => {
    // Simple logic: If we can't parse, return fallback.
    // For this demo, we will use a "smart" approach using CSS variables or HSL if possible,
    // but since we only have a hex string, we might need to rely on CSS filters or just
    // simple overlay opacity tricks if we want to be safe without a library.
    //
    // HOWEVER, the user asked for "calculated 1-2 auxiliary colors".
    // Let's assume standard theme colors are passed.
    // We will use a "hardcoded relative" approach:
    // We can't easily manipulate HEX in vanilla JS without 50 lines of code.
    // BUT we can use CSS `color-mix` if modern browsers, or just use the noise overlay which we already have.
    //
    // Let's implement a proper Hex to RGB/HSL converter to do this right.

    const hexToRgb = (hex: string) => {
      let c: any = hex.substring(1).split('')
      if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]]
      }
      c = '0x' + c.join('')
      return [(c >> 16) & 255, (c >> 8) & 255, c & 255]
    }

    const rgbToHsl = (r: number, g: number, b: number) => {
      r /= 255
      g /= 255
      b /= 255
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b)
      let h: number = 0,
        s: number,
        l: number = (max + min) / 2

      if (max === min) {
        h = s = 0 // achromatic
      } else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0)
            break
          case g:
            h = (b - r) / d + 2
            break
          case b:
            h = (r - g) / d + 4
            break
        }
        h /= 6
      }
      return [h * 360, s * 100, l * 100]
    }

    try {
      const [r, g, b] = hexToRgb(hexColor)
      const [h, s, l] = rgbToHsl(r || 0, g || 0, b || 0)

      // Calculate auxiliary colors
      // 1. Analogous Color (shifted 30-40 degrees)
      const h2 = ((h || 0) + 35) % 360
      // 2. Darker/Richer shade
      const l2 = Math.max((l || 0) - 15, 10) // Darken by 15%

      const color1 = `hsl(${h || 0}, ${s || 0}%, ${l || 0}%)` // Original
      const color2 = `hsl(${h2}, ${s || 0}%, ${l2}%)` // Shifted & Darker

      return {
        background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
      }
    } catch (e) {
      // Fallback if hex parsing fails
      return { backgroundColor: hexColor }
    }
  }

  const gradientStyle = getGradientStyle(theme.themeColor)

  // Helper: Remove protocol for cleaner display but keep path
  const displayUrl = (url: string) =>
    url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

  // Helper: Unified Social Link Component
  const SocialLink = ({
    href,
    icon: Icon,
    label,
    className,
  }: {
    href: string
    icon: React.ElementType
    label: string
    className?: string
  }) => (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'flex items-center gap-3 text-gray-600 hover:text-black transition-colors group min-w-0 whitespace-nowrap',
        className
      )}
    >
      <div
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 group-hover:scale-110 group-hover:shadow-md transition-all shrink-0"
        style={{ color: theme.themeColor }}
      >
        <Icon size={15} className="w-[15px] h-[15px]" />
      </div>
      <span className="font-medium text-[0.9em] border-b border-transparent group-hover:border-gray-300 transition-colors">
        {displayUrl(label)}
      </span>
    </a>
  )

  // Component: "Line & Dot" Section Header
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mb-4 mt-4 first:mt-0 relative group">
      <div className="flex items-center gap-4">
        <h3
          className="font-black uppercase tracking-[0.15em] text-gray-900 shrink-0"
          style={{ fontSize: '1.1em' }}
        >
          {title}
        </h3>
        {/* Decorative Line with Gradient */}
        <div className="flex-1 h-[1px] relative top-[1px] opacity-20 bg-gradient-to-r from-gray-900 to-transparent" />
      </div>
    </div>
  )

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null,
    summary: basics.summary && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="summary">
          <SectionHeader title="About Me" />
          <div
            className="leading-loose text-gray-700 font-medium text-justify"
            style={{ fontSize: '0.95em' }}
          >
            {renderDescription(basics.summary)}
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="skills">
          <SectionHeader title="Skills & Tools" />
          <div className="flex flex-wrap gap-3">
            {skills.split('\n').map((skill, idx) => (
              <span
                key={idx}
                className="px-4 py-1.5 bg-gray-50 border border-gray-100 rounded-full font-bold text-gray-700 text-[0.85em]"
              >
                {skill.trim().replace(/^[-•]\s*/, '')}
              </span>
            ))}
          </div>
        </InteractiveSection>
      </section>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader title="Experience" />
        </InteractiveSection>
        <div className="space-y-4">
          {workExperiences.map((item) => (
            <div key={item.id} className="relative pl-0 md:pl-0">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-baseline gap-2 mb-3">
                  <h4
                    className="font-black text-gray-900 leading-tight"
                    style={{ fontSize: '1.25em' }}
                  >
                    {item.company}
                  </h4>
                  <span
                    className="font-bold text-gray-400 tracking-wider tabular-nums uppercase shrink-0"
                    style={{ fontSize: '0.8em' }}
                  >
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Present'}
                  </span>
                </div>

                <div
                  className="font-bold mb-4 uppercase tracking-wider flex items-center gap-2"
                  style={{ color: theme.themeColor, fontSize: '0.85em' }}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-50" />
                  {item.position}
                </div>

                <div
                  className="text-gray-600 leading-relaxed"
                  style={{ fontSize: '0.92em' }}
                >
                  {renderDescription(item.description)}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: projectExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="projectExperiences">
          <SectionHeader title="Featured Projects" />
        </InteractiveSection>
        <div className="grid grid-cols-1 gap-10">
          {projectExperiences.map((item) => (
            <div key={item.id} className="group">
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-3">
                  <div>
                    <h4
                      className="font-black text-gray-900 uppercase tracking-tight"
                      style={{ fontSize: '1.1em' }}
                    >
                      {item.projectName}
                    </h4>
                    {item.role && (
                      <div
                        className="font-bold mt-3 mb-1 uppercase tracking-wider flex items-center gap-2"
                        style={{ color: theme.themeColor, fontSize: '0.85em' }}
                      >
                        <span className="w-2 h-2 rounded-full bg-current opacity-50" />
                        {item.role}
                      </div>
                    )}
                  </div>
                  <span
                    className="font-bold text-gray-400 tracking-wider tabular-nums uppercase shrink-0"
                    style={{ fontSize: '0.75em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>

                <div
                  className="text-gray-600 mb-5 leading-relaxed"
                  style={{ fontSize: '0.92em' }}
                >
                  {renderDescription(item.description)}
                </div>

                {/* Unified Project Links - Full Text Display */}
                {(item.demoUrl || item.githubUrl) && (
                  <div className="flex flex-col sm:flex-row gap-4 mt-4">
                    {item.demoUrl && (
                      <a
                        href={item.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors group"
                        style={{ fontSize: '0.9em' }}
                      >
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 group-hover:border-gray-400 transition-all shrink-0"
                          style={{ color: theme.themeColor }}
                        >
                          <Globe size={14} />
                        </div>
                        <span className="font-medium border-b border-transparent group-hover:border-gray-400 break-all">
                          {displayUrl(item.demoUrl)}
                        </span>
                      </a>
                    )}
                    {item.githubUrl && (
                      <a
                        href={item.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors group"
                        style={{ fontSize: '0.9em' }}
                      >
                        <div
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 group-hover:border-gray-400 transition-all shrink-0"
                          style={{ color: theme.themeColor }}
                        >
                          <Github size={14} />
                        </div>
                        <span className="font-medium border-b border-transparent group-hover:border-gray-400 break-all">
                          {displayUrl(item.githubUrl)}
                        </span>
                      </a>
                    )}
                  </div>
                )}
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    educations: educations?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="educations">
          <SectionHeader title="Education" />
        </InteractiveSection>
        <div className="space-y-6">
          {educations.map((item) => (
            <div key={item.id}>
              <InteractiveSection sectionKey="educations" itemId={item.id}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-baseline gap-1">
                  <h4
                    className="font-black text-gray-900"
                    style={{ fontSize: '1.1em' }}
                  >
                    {item.school}
                  </h4>
                  <span
                    className="font-bold text-gray-400 tracking-wider tabular-nums uppercase"
                    style={{ fontSize: '0.75em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                <div
                  className="mt-1 font-medium text-gray-600"
                  style={{ fontSize: '0.9em' }}
                >
                  {item.major} {item.degree && `| ${item.degree}`}
                </div>
                {item.description && (
                  <div
                    className="mt-2 text-gray-500"
                    style={{ fontSize: '0.85em' }}
                  >
                    {renderDescription(item.description)}
                  </div>
                )}
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    certificates: certificates && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="certificates">
          <SectionHeader title="Certificates" />
          <div
            className="text-gray-600 leading-relaxed"
            style={{ fontSize: '0.9em' }}
          >
            {renderDescription(certificates)}
          </div>
        </InteractiveSection>
      </section>
    ),
    hobbies: hobbies && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="hobbies">
          <SectionHeader title="Interests" />
          <div
            className="text-gray-600 leading-relaxed"
            style={{ fontSize: '0.9em' }}
          >
            {renderDescription(hobbies)}
          </div>
        </InteractiveSection>
      </section>
    ),
    customSections: customSections?.length > 0 && (
      <>
        {customSections.map((item) => (
          <section key={item.id} style={theme.section}>
            <InteractiveSection sectionKey="customSections" itemId={item.id}>
              <SectionHeader title={item.title} />
              <div
                className="text-gray-600 leading-relaxed"
                style={{ fontSize: '0.9em' }}
              >
                {renderDescription(item.description)}
              </div>
            </InteractiveSection>
          </section>
        ))}
      </>
    ),
  }

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300 relative overflow-hidden flex flex-col',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* HEADER SECTION - Full Width */}
      <header className="w-full">
        {/* Main Hero Area with Stronger Gradient */}
        <div
          className="w-full text-white relative overflow-hidden"
          style={gradientStyle}
        >
          {/* Artistic Noise/Texture Overlay */}
          <div
            className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Geometric Shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl pointer-events-none" />

          {/* Content Container - PADDING INSIDE HEADER */}
          <div className="px-8 md:px-12 py-12 md:py-16 relative z-10">
            {/* InteractiveSection INSIDE padding to align with body */}
            <InteractiveSection sectionKey="basics">
              <div className="flex flex-col-reverse md:flex-row items-center md:items-start justify-between gap-8 text-center md:text-left">
                <div className="flex-1 min-w-0">
                  <h1
                    className="font-black tracking-tighter leading-none mb-6"
                    style={{ fontSize: '3.8em' }}
                  >
                    {basics.name}
                  </h1>

                  {/* Basic Contact Info - Horizontal Flow */}
                  <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-3 text-white/90 font-medium text-[0.9em] tracking-wide">
                    {basics.mobile && (
                      <div className="flex items-center gap-2.5">
                        <Phone size={15} className="opacity-80" />
                        <span>{basics.mobile}</span>
                      </div>
                    )}
                    {basics.email && (
                      <div className="flex items-center gap-2.5">
                        <Mail size={15} className="opacity-80" />
                        <span>{basics.email}</span>
                      </div>
                    )}
                    {basics.location && (
                      <div className="flex items-center gap-2.5">
                        <MapPin size={15} className="opacity-80" />
                        <span>{basics.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avatar */}
                {basics.photoUrl && (
                  <div className="shrink-0 relative">
                    <div className="w-36 h-36 rounded-full border-[6px] border-white/10 shadow-2xl overflow-hidden bg-white relative z-10">
                      <img
                        src={basics.photoUrl}
                        alt={basics.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Decorative Ring */}
                    <div className="absolute inset-0 rounded-full border border-white/20 scale-110 -z-0" />
                  </div>
                )}
              </div>
            </InteractiveSection>
          </div>
        </div>

        {/* Social Links Bar - Full Width but Aligned Content */}
        <div className="w-full bg-gray-50 border-b border-gray-100">
          <div className="px-8 md:px-12 py-6">
            {/* InteractiveSection INSIDE padding to align with body */}
            <InteractiveSection sectionKey="basics">
              {/* Flex Layout for Perfect Single-Line Wrapping */}
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {basics.website && (
                  <SocialLink
                    href={basics.website}
                    icon={Globe}
                    label={basics.website}
                  />
                )}
                {basics.behance && (
                  <SocialLink
                    href={basics.behance}
                    icon={() => (
                      <span className="font-black text-[10px]">Be</span>
                    )}
                    label={basics.behance}
                  />
                )}
                {basics.dribbble && (
                  <SocialLink
                    href={basics.dribbble}
                    icon={Dribbble}
                    label={basics.dribbble}
                  />
                )}
                {basics.linkedin && (
                  <SocialLink
                    href={basics.linkedin}
                    icon={Linkedin}
                    label={basics.linkedin}
                  />
                )}
                {basics.github && (
                  <SocialLink
                    href={basics.github}
                    icon={Github}
                    label={basics.github}
                  />
                )}
              </div>
            </InteractiveSection>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 w-full py-4 flex flex-col gap-2">
        {config.order.map((key) => {
          if (
            config.hidden.includes(key) ||
            key === 'basics' ||
            !sectionMap[key]
          )
            return null
          return <div key={key}>{sectionMap[key]}</div>
        })}
      </div>
    </div>
  )
}
