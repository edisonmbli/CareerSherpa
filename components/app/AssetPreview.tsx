import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Globe, Github } from 'lucide-react'

interface AssetPreviewProps {
    data: any
    locale: 'en' | 'zh'
    labels: {
        header: string
        summary: string
        summaryPoints: string
        specialties: string
        experience: string
        projects: string
        education: string
        skills: string
        certifications: string
        languages: string
        awards: string
        openSource: string
        extras: string
        capabilities: string
        contributions: string
        courses: string
        link: string
        metric: string
        task: string
        action: string
        result: string
        [key: string]: string
    }
}

export function AssetPreview({ data: rawData, locale, labels: L }: AssetPreviewProps) {
    if (!rawData) return null

    // Normalization: Ensure 'experiences' is populated even if 'experience' (general resume) is used
    const d = {
        ...rawData,
        experiences: Array.isArray(rawData.experiences) && rawData.experiences.length > 0
            ? rawData.experiences
            : Array.isArray(rawData.experience)
                ? rawData.experience
                : []
    }

    return (
        <div
            className="space-y-4 text-xs text-slate-700 dark:text-slate-300 pb-6 px-4 sm:px-6 md:px-10 leading-relaxed font-sans relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 shadow-sm bg-stone-50 dark:bg-white/[0.02] backdrop-blur-2xl"
            style={{
                backgroundImage: 'url("/noise.svg")',
            }}
        >
            {/* Header Info */}
            {d.header && (
                <div className="text-center mb-5 pt-4">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3 font-[family-name:var(--font-playfair),serif]">
                        {d.header.name}
                    </h1>
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-[family-name:var(--font-jetbrains-mono),monospace] uppercase tracking-wide">
                        {[d.header.mobile || d.header.phone, d.header.email, d.header.location].filter(Boolean).map((item, i) => (
                            <span key={i} className={i > 0 ? "before:content-['/'] before:mr-3 before:text-slate-300 dark:before:text-slate-600" : ""}>{item}</span>
                        ))}
                    </div>
                    {Array.isArray(d.header.links) && d.header.links.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-x-4 mt-2 text-[11px] font-[family-name:var(--font-jetbrains-mono),monospace]">
                            {d.header.links.map((l: any, i: number) => (
                                <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    {l.label}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Summary Section */}
            {Array.isArray(d.summary_points) && d.summary_points.length > 0 ? (
                <Section title={L.summaryPoints}>
                    <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-slate-300 dark:marker:text-slate-600">
                        {d.summary_points.map((s: string, i: number) => (
                            <li key={i} className="pl-1">{s}</li>
                        ))}
                    </ul>
                </Section>
            ) : d.summary ? (
                <Section title={L.summary}>
                    <div className="text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{String(d.summary)}</div>
                </Section>
            ) : null}

            {/* Specialties */}
            {Array.isArray(d.specialties_points) && d.specialties_points.length > 0 ? (
                <Section title={L.specialties}>
                    <div className="flex flex-wrap gap-2">
                        {d.specialties_points.map((s: string, i: number) => (
                            <span key={i} className="list-disc px-2.5 py-1 bg-emerald-100/20 dark:bg-emerald-400/[0.05] text-gray-600 dark:text-emerald-300 rounded-sm font-[family-name:var(--font-jetbrains-mono),monospace] border border-emerald-100/50 dark:border-emerald-500/20 marker:text-slate-300">
                                {s}
                            </span>
                        ))}
                    </div>
                </Section>
            ) : null}

            {/* Capabilities (Detailed Resume) */}
            {Array.isArray(d.capabilities) && d.capabilities.length > 0 ? (
                <Section title={L.capabilities}>
                    <div className="space-y-3">
                        {d.capabilities.map((c: any, i: number) => {
                            // Support string[] (V4) or {name, points}[] (Deep Schema)
                            if (typeof c === 'string') {
                                return <div key={i} className="flex gap-2"><span className="text-primary/70">•</span><span>{c}</span></div>
                            }
                            return (
                                <div key={i} className="text-sm">
                                    <div className="font-semibold text-gray-800 dark:text-slate-200 mb-1">{c.name}</div>
                                    <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-slate-400 marker:text-slate-300 dark:marker:text-slate-600">
                                        {Array.isArray(c.points) && c.points.map((p: string, pi: number) => (
                                            <li key={pi}>{p}</li>
                                        ))}
                                    </ul>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            ) : null}

            {/* Work Experiences (Normalized) */}
            {Array.isArray(d.experiences) && d.experiences.length > 0 ? (
                <Section title={L.experience}>
                    <div className="space-y-0">
                        {d.experiences.map((e: any, i: number) => (
                            <div key={i} className="group relative border-l border-slate-200 dark:border-slate-800 pl-5 ml-1.5 pb-8 last:pb-0 last:border-l-0">
                                {/* Timeline Dot */}
                                <div className="absolute top-1.5 -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-slate-200 bg-white dark:border-white/20 dark:bg-transparent group-hover:border-slate-300 dark:group-hover:border-white/40 transition-colors" />

                                {/* Header: Company & Date line */}
                                <div className="flex justify-between items-baseline mb-1">
                                    <div className="font-bold text-slate-900 dark:text-slate-100 text-[1.05em]">
                                        {e.company}
                                        {e.product_or_team && <span className="font-normal text-slate-500 dark:text-slate-400 ml-2 text-sm italic serif"> {e.product_or_team}</span>}
                                    </div>
                                    <span className="font-[family-name:var(--font-jetbrains-mono),monospace] font-bold text-slate-500 dark:text-slate-400 text-[10px] tabular-nums whitespace-nowrap bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">
                                        {e.duration}
                                    </span>
                                </div>

                                {/* Role */}
                                <div className="font-medium text-blue-700/90 dark:text-blue-400/90 text-sm mb-2">
                                    {e.role}
                                </div>

                                {/* Keywords/Tags */}
                                {Array.isArray(e.keywords) && e.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {e.keywords.map((k: string, ki: number) => (
                                            <span key={ki} className="text-[10px] font-bold font-[family-name:var(--font-jetbrains-mono),monospace] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-full">
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3 text-gray-600 dark:text-slate-300">
                                    {/* Highlights */}
                                    {Array.isArray(e.highlights) && e.highlights.length > 0 && (
                                        <ul className="list-disc pl-5 space-y-1 marker:text-gray-300 dark:marker:text-slate-600">
                                            {e.highlights.map((h: string, j: number) => (<li key={j}>{h}</li>))}
                                        </ul>
                                    )}

                                    {/* General Resume "stack" often inside experience */}
                                    {Array.isArray(e.stack) && e.stack.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {e.stack.map((s: string, si: number) => (
                                                <Badge key={si} variant="outline" className="text-[10px] font-normal text-muted-foreground dark:text-slate-400 dark:border-white/10 dark:bg-white/[0.02]">{s}</Badge>
                                            ))}
                                        </div>
                                    )}

                                    {/* Contributions */}
                                    {Array.isArray(e.contributions) && e.contributions.length > 0 && (
                                        <div className="mt-2">
                                            <div className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1 opacity-80">{L.contributions}</div>
                                            <ul className="list-disc pl-5 space-y-1 marker:text-gray-300 dark:marker:text-slate-600">{e.contributions.map((c: string, ci: number) => (<li key={ci}>{c}</li>))}</ul>
                                        </div>
                                    )}

                                    {/* Experience Metrics */}
                                    {Array.isArray(e.metrics) && e.metrics.length > 0 && (
                                        <div className="mt-2">
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {e.metrics.map((m: any, mi: number) => (
                                                    <li key={mi} className="text-xs bg-emerald-50/50 dark:bg-emerald-400/[0.05] border border-emerald-100/50 dark:border-emerald-500/20 px-2 py-1.5 rounded flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
                                                        <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                                                        {typeof m === 'string' ? m : <span className="truncate"><span className="font-semibold">{m.label}:</span> {m.value} {m.unit}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Nested Projects (Detailed Resume) */}
                                    {Array.isArray(e.projects) && e.projects.length > 0 && (
                                        <div className="mt-4 pt-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="text-xs font-bold text-gray-900 dark:text-slate-300 uppercase tracking-widest">{L.projects}</div>
                                                <div className="h-px bg-gray-100 dark:bg-white/5 flex-1"></div>
                                            </div>

                                            <div className="space-y-4">
                                                {e.projects.map((p: any, k: number) => (
                                                    <div key={k} className="relative pl-4 border-l-2 border-indigo-100 dark:border-indigo-400/20 py-0.5">
                                                        {/* Project Title */}
                                                        <div className="flex flex-wrap items-baseline gap-2 mb-1">
                                                            <span className="font-semibold text-gray-800 dark:text-slate-200">{p.name}</span>
                                                            {p.link && (
                                                                <a href={p.link} target="_blank" className="text-xs text-blue-500 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                                                                    <Globe className="w-3 h-3" /> {L.link}
                                                                </a>
                                                            )}
                                                        </div>

                                                        {p.description && <div className="text-xs text-gray-500 dark:text-slate-400 mb-2 italic leading-normal">{p.description}</div>}

                                                        {/* STAR Method Grid */}
                                                        <div className="space-y-2.5">
                                                            {(['task', 'actions', 'results'] as const).map((key) => {
                                                                const items = p[key === 'actions' ? 'actions' : key === 'results' ? 'results' : 'task'];
                                                                if (!Array.isArray(items) || items.length === 0) return null;

                                                                const colorMap = {
                                                                    task: 'bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400',
                                                                    actions: 'bg-blue-50 dark:bg-blue-400/[0.05] text-blue-600 dark:text-blue-300',
                                                                    results: 'bg-emerald-50 dark:bg-emerald-400/[0.05] text-emerald-600 dark:text-emerald-300'
                                                                }
                                                                const label = key === 'task' ? L.task : key === 'actions' ? L.action : L.result;

                                                                return (
                                                                    <div key={key} className="flex gap-3 text-xs leading-relaxed">
                                                                        <div className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold h-fit tracking-wider uppercase min-w-[55px] text-center select-none", colorMap[key])}>
                                                                            {label}
                                                                        </div>
                                                                        <div className="space-y-1 flex-1 text-gray-600 dark:text-slate-300">
                                                                            {items.map((t: string, ti: number) => <div key={ti}>{t}</div>)}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        {Array.isArray(p.highlights) && p.highlights.length > 0 && (
                                                            <ul className="list-disc pl-5 space-y-1 mt-2 text-xs text-gray-600 dark:text-slate-400">
                                                                {p.highlights.map((h: string, hi: number) => <li key={hi}>{h}</li>)}
                                                            </ul>
                                                        )}

                                                        {/* Project Metrics */}
                                                        {Array.isArray(p.metrics) && p.metrics.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-dashed border-gray-100 dark:border-white/5">
                                                                {p.metrics.map((m: any, mi: number) => {
                                                                    const isObj = typeof m === 'object'
                                                                    const label = isObj ? m.label : L.metric
                                                                    const value = isObj ? m.value : m
                                                                    const unit = isObj ? m.unit : ''
                                                                    return (
                                                                        <div key={mi} className="inline-flex items-center text-[10px] border border-gray-200 dark:border-white/10 rounded px-2 py-0.5 bg-white dark:bg-white/[0.02] text-gray-600 dark:text-slate-300 shadow-sm dark:shadow-none">
                                                                            <span className="mr-1.5">{label}</span>
                                                                            <span className="font-bold text-gray-900 dark:text-white">{value}</span>
                                                                            {unit && <span className="ml-0.5 text-gray-400 dark:text-slate-500">{unit}</span>}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            ) : null}

            {/* Top Level Projects (General Resume) */}
            {Array.isArray(d.projects) && d.projects.length > 0 ? (
                <Section title={L.projects}>
                    <div className="space-y-0">
                        {d.projects.map((p: any, i: number) => (
                            <div key={i} className="group">
                                <div className="flex justify-between items-baseline mb-1">
                                    <div className="font-bold text-gray-900 dark:text-slate-100 text-[1.05em] flex gap-2 items-center">
                                        {p.name}
                                        {p.link && <a href={p.link} target="_blank" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"><Globe className="w-3 h-3" /></a>}
                                    </div>
                                </div>
                                {p.description && <div className="text-sm text-gray-500 dark:text-slate-400 mb-2 italic">{p.description}</div>}
                                {Array.isArray(p.highlights) && p.highlights.length > 0 && (
                                    <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-slate-300 marker:text-gray-300 dark:marker:text-slate-600">
                                        {p.highlights.map((h: string, j: number) => (<li key={j}>{h}</li>))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            ) : null}

            {/* Skills */}
            {d.skills ? (
                <Section title={L.skills}>
                    {renderSkills(d.skills)}
                </Section>
            ) : null}

            {/* Education */}
            {Array.isArray(d.education) && d.education.length > 0 ? (
                <Section title={L.education}>
                    <ul className="space-y-6">
                        {d.education.map((e: any, i: number) => (
                            <li key={i} className="text-slate-600 group relative border-l border-slate-200 dark:border-slate-800 pl-5 ml-1.5 pb-2">
                                {/* Timeline Dot */}
                                <div className="absolute top-1.5 -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-slate-200 bg-white dark:border-white/20 dark:bg-transparent" />

                                <div className="flex justify-between font-bold text-slate-900 text-sm mb-0.5">
                                    <span>{e.school}</span>
                                    <span className="font-[family-name:var(--font-jetbrains-mono),monospace] font-normal text-slate-500 tabular-nums text-[10px] bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">{e.duration}</span>
                                </div>
                                <div className="text-sm mb-1 font-medium text-slate-700">{e.degree} {e.major && <span className="text-slate-500 font-normal">· {e.major}</span>}</div>
                                {e.gpa && <div className="text-xs text-slate-400 font-[family-name:var(--font-jetbrains-mono),monospace]">GPA: {e.gpa}</div>}
                                {Array.isArray(e.courses) && <div className="text-xs mt-2 text-slate-500 leading-relaxed"><span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">{L.courses}:</span> {e.courses.join(', ')}</div>}
                            </li>
                        ))}
                    </ul>
                </Section>
            ) : null}

            {/* Raw Sections (Extra customized sections) */}
            {Array.isArray(d.rawSections) && d.rawSections.length > 0 ? (
                <div className="space-y-6">
                    {d.rawSections.map((s: any, i: number) => (
                        <Section key={i} title={s.title}>
                            <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-slate-300 marker:text-gray-300 dark:marker:text-slate-600">
                                {Array.isArray(s.points) && s.points.map((p: string, pi: number) => (
                                    <li key={pi}>{p}</li>
                                ))}
                            </ul>
                        </Section>
                    ))}
                </div>
            ) : null}

        </div>
    )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="mb-10 break-inside-avoid relative">
            {/* Header: Half-Highlight V6 Style */}
            <div className="mb-6 relative pl-2">
                <div className="relative inline-block ml-0">
                    {/* Highlight Block */}
                    <div className="absolute bottom-2 -left-2 w-full min-w-[60px] h-3 bg-slate-200/60 dark:bg-white/[0.06] -z-10" />
                    {/* Title Text */}
                    <h3 className="font-[family-name:var(--font-playfair),serif] font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight relative z-10">
                        {title}
                    </h3>
                </div>
            </div>

            <div className="pl-1">
                {children}
            </div>
        </div>
    )
}

function renderSkills(skills: any) {
    // Array of strings
    if (Array.isArray(skills)) {
        if (typeof skills[0] === 'string') {
            return (
                <div className="flex flex-wrap gap-2">
                    {skills.map((s: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-bold font-[family-name:var(--font-jetbrains-mono),monospace] border border-slate-200/50 dark:border-white/10">
                            {s}
                        </span>
                    ))}
                </div>
            )
        }
        // V3 Array of Objects {name, points}
        return (
            <div className="space-y-2">
                {skills.map((s: any, i: number) => (
                    <div key={i} className="text-sm grid grid-cols-[120px_1fr] gap-4">
                        <span className="font-semibold text-gray-800 dark:text-slate-200 text-right">{s.name}</span>
                        <span className="text-gray-600 dark:text-slate-400">{Array.isArray(s.points) ? s.points.join(', ') : s.points}</span>
                    </div>
                ))}
            </div>
        )
    }
    // Object { technical: [], soft: [] }
    if (typeof skills === 'object') {
        const entries = Object.entries(skills).filter(([_, v]) => Array.isArray(v) && v.length > 0)
        if (entries.length === 0) return null
        return (
            <div className="space-y-3">
                {entries.map(([key, vals]: [string, any]) => (
                    <div key={key} className="text-sm">
                        <div className="font-medium capitalize text-gray-900 dark:text-slate-100 mb-1">{key}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {vals.map((v: string, vi: number) => (
                                <span key={vi} className="px-2 py-0.5 bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-[family-name:var(--font-jetbrains-mono),monospace] font-medium border border-slate-200/50 dark:border-white/10">{v}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )
    }
    return null
}
