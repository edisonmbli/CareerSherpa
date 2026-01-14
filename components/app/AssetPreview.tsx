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
        <div className="space-y-6 text-sm text-gray-700 pb-8 px-2 leading-relaxed font-sans">
            {/* Header Info */}
            {d.header && (
                <div className="text-center mb-6 pb-4 border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">{d.header.name}</h1>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {[d.header.mobile || d.header.phone, d.header.email, d.header.location].filter(Boolean).map((item, i) => (
                            <span key={i} className={i > 0 ? "before:content-['•'] before:mr-4 before:text-gray-300" : ""}>{item}</span>
                        ))}
                    </div>
                    {Array.isArray(d.header.links) && d.header.links.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-x-4 mt-2 text-xs text-blue-600">
                            {d.header.links.map((l: any, i: number) => (
                                <a key={i} href={l.url} target="_blank" rel="noreferrer" className="hover:underline">
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
                    <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                        {d.summary_points.map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                        ))}
                    </ul>
                </Section>
            ) : d.summary ? (
                <Section title={L.summary}>
                    <div className="text-gray-600 whitespace-pre-wrap">{String(d.summary)}</div>
                </Section>
            ) : null}

            {/* Specialties */}
            {Array.isArray(d.specialties_points) && d.specialties_points.length > 0 ? (
                <Section title={L.specialties}>
                    <div className="flex flex-wrap gap-2">
                        {d.specialties_points.map((s: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs border border-gray-100">
                                {s}
                            </span>
                        ))}
                    </div>
                </Section>
            ) : null}

            {/* Capabilities (Detailed Resume) */}
            {Array.isArray(d.capabilities) && d.capabilities.length > 0 ? (
                <Section title={locale === 'zh' ? '核心能力' : 'Capabilities'}>
                    <div className="space-y-3">
                        {d.capabilities.map((c: any, i: number) => {
                            // Support string[] (V4) or {name, points}[] (Deep Schema)
                            if (typeof c === 'string') {
                                return <div key={i} className="flex gap-2"><span className="text-primary/70">•</span><span>{c}</span></div>
                            }
                            return (
                                <div key={i} className="text-sm">
                                    <div className="font-semibold text-gray-800 mb-1">{c.name}</div>
                                    <ul className="list-disc pl-5 space-y-1 text-gray-600">
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
                <Section title={L.experience || (locale === 'zh' ? '工作经历' : 'Experience')}>
                    <div className="space-y-8">
                        {d.experiences.map((e: any, i: number) => (
                            <div key={i} className="group">
                                {/* Header: Company & Date line */}
                                <div className="flex justify-between items-baseline mb-1">
                                    <div className="font-bold text-gray-900 text-[1.05em]">
                                        {e.company}
                                        {e.product_or_team && <span className="font-normal text-gray-500 ml-2 text-sm">· {e.product_or_team}</span>}
                                    </div>
                                    <span className="font-medium text-gray-500 text-xs tabular-nums whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded">
                                        {e.duration}
                                    </span>
                                </div>

                                {/* Role */}
                                <div className="font-medium text-blue-700/90 text-sm mb-2">
                                    {e.role}
                                </div>

                                {/* Keywords/Tags */}
                                {Array.isArray(e.keywords) && e.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {e.keywords.map((k: string, ki: number) => (
                                            <span key={ki} className="text-[10px] uppercase tracking-wider font-medium text-gray-400 border border-gray-100 px-1.5 py-0.5 rounded-sm">
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3 text-gray-600">
                                    {/* Highlights */}
                                    {Array.isArray(e.highlights) && e.highlights.length > 0 && (
                                        <ul className="list-disc pl-5 space-y-1 marker:text-gray-300">
                                            {e.highlights.map((h: string, j: number) => (<li key={j}>{h}</li>))}
                                        </ul>
                                    )}

                                    {/* General Resume "stack" often inside experience */}
                                    {Array.isArray(e.stack) && e.stack.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {e.stack.map((s: string, si: number) => (
                                                <Badge key={si} variant="outline" className="text-[10px] font-normal text-muted-foreground">{s}</Badge>
                                            ))}
                                        </div>
                                    )}

                                    {/* Contributions */}
                                    {Array.isArray(e.contributions) && e.contributions.length > 0 && (
                                        <div className="mt-2">
                                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 opacity-80">{locale === 'zh' ? '重要产出' : 'Contributions'}</div>
                                            <ul className="list-disc pl-5 space-y-1 marker:text-gray-300">{e.contributions.map((c: string, ci: number) => (<li key={ci}>{c}</li>))}</ul>
                                        </div>
                                    )}

                                    {/* Experience Metrics */}
                                    {Array.isArray(e.metrics) && e.metrics.length > 0 && (
                                        <div className="mt-2">
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {e.metrics.map((m: any, mi: number) => (
                                                    <li key={mi} className="text-xs bg-emerald-50/50 border border-emerald-100/50 px-2 py-1.5 rounded flex items-center gap-2 text-emerald-900">
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
                                                <div className="text-xs font-bold text-gray-900 uppercase tracking-widest">{L.projects}</div>
                                                <div className="h-px bg-gray-100 flex-1"></div>
                                            </div>

                                            <div className="space-y-4">
                                                {e.projects.map((p: any, k: number) => (
                                                    <div key={k} className="relative pl-4 border-l-2 border-indigo-100 py-0.5">
                                                        {/* Project Title */}
                                                        <div className="flex flex-wrap items-baseline gap-2 mb-1">
                                                            <span className="font-semibold text-gray-800">{p.name}</span>
                                                            {p.link && (
                                                                <a href={p.link} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                                                                    <Globe className="w-3 h-3" /> Link
                                                                </a>
                                                            )}
                                                        </div>

                                                        {p.description && <div className="text-xs text-gray-500 mb-2 italic leading-normal">{p.description}</div>}

                                                        {/* STAR Method Grid */}
                                                        <div className="space-y-2.5">
                                                            {(['task', 'actions', 'results'] as const).map((key) => {
                                                                const items = p[key === 'actions' ? 'actions' : key === 'results' ? 'results' : 'task'];
                                                                if (!Array.isArray(items) || items.length === 0) return null;

                                                                const colorMap = {
                                                                    task: 'bg-slate-100 text-slate-600',
                                                                    actions: 'bg-blue-50 text-blue-600',
                                                                    results: 'bg-emerald-50 text-emerald-600'
                                                                }
                                                                const label = key === 'task' ? 'TASK' : key === 'actions' ? 'ACTION' : 'RESULT';

                                                                return (
                                                                    <div key={key} className="flex gap-3 text-xs leading-relaxed">
                                                                        <div className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold h-fit tracking-wider uppercase min-w-[55px] text-center select-none", colorMap[key])}>
                                                                            {label}
                                                                        </div>
                                                                        <div className="space-y-1 flex-1">
                                                                            {items.map((t: string, ti: number) => <div key={ti}>{t}</div>)}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                        {Array.isArray(p.highlights) && p.highlights.length > 0 && (
                                                            <ul className="list-disc pl-5 space-y-1 mt-2 text-xs text-gray-600">
                                                                {p.highlights.map((h: string, hi: number) => <li key={hi}>{h}</li>)}
                                                            </ul>
                                                        )}

                                                        {/* Project Metrics */}
                                                        {Array.isArray(p.metrics) && p.metrics.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-dashed border-gray-100">
                                                                {p.metrics.map((m: any, mi: number) => {
                                                                    const isObj = typeof m === 'object'
                                                                    const label = isObj ? m.label : 'Metric'
                                                                    const value = isObj ? m.value : m
                                                                    const unit = isObj ? m.unit : ''
                                                                    return (
                                                                        <div key={mi} className="inline-flex items-center text-[10px] border border-gray-200 rounded px-2 py-0.5 bg-white text-gray-600 shadow-sm">
                                                                            <span className="mr-1.5">{label}</span>
                                                                            <span className="font-bold text-gray-900">{value}</span>
                                                                            {unit && <span className="ml-0.5 text-gray-400">{unit}</span>}
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
                    <div className="space-y-6">
                        {d.projects.map((p: any, i: number) => (
                            <div key={i} className="group">
                                <div className="flex justify-between items-baseline mb-1">
                                    <div className="font-bold text-gray-900 text-[1.05em] flex gap-2 items-center">
                                        {p.name}
                                        {p.link && <a href={p.link} target="_blank" className="text-blue-500 hover:text-blue-600"><Globe className="w-3 h-3" /></a>}
                                    </div>
                                </div>
                                {p.description && <div className="text-sm text-gray-500 mb-2 italic">{p.description}</div>}
                                {Array.isArray(p.highlights) && p.highlights.length > 0 && (
                                    <ul className="list-disc pl-5 space-y-1 text-gray-600">
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
                    <ul className="space-y-4">
                        {d.education.map((e: any, i: number) => (
                            <li key={i} className="text-gray-600">
                                <div className="flex justify-between font-semibold text-gray-900 text-sm mb-0.5">
                                    <span>{e.school}</span>
                                    <span className="font-normal text-gray-500 tabular-nums text-xs">{e.duration}</span>
                                </div>
                                <div className="text-sm mb-1">{e.degree} {e.major && `· ${e.major}`}</div>
                                {e.gpa && <div className="text-xs text-gray-400">GPA: {e.gpa}</div>}
                                {Array.isArray(e.courses) && <div className="text-xs mt-1 text-gray-500 italic"><span className="font-medium not-italic text-gray-400">{locale === 'zh' ? '课程' : 'Courses'}:</span> {e.courses.join(', ')}</div>}
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
                            <ul className="list-disc pl-5 space-y-1 text-gray-600">
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
        <div className="mb-6 break-inside-avoid">
            <div className="flex items-center gap-3 mb-4">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm whitespace-nowrap">{title}</h3>
                <div className="h-[1px] flex-1 bg-gray-200" />
            </div>
            {children}
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
                        <span key={i} className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs border border-gray-100">
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
                        <span className="font-semibold text-gray-800 text-right">{s.name}</span>
                        <span className="text-gray-600">{Array.isArray(s.points) ? s.points.join(', ') : s.points}</span>
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
                        <div className="font-medium capitalize text-gray-900 mb-1">{key}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {vals.map((v: string, vi: number) => (
                                <span key={vi} className="px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded-sm text-xs border border-gray-100">{v}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )
    }
    return null
}
