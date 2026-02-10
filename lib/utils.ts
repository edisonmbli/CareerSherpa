import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { MATCH_SCORE_THRESHOLDS } from "@/lib/constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMatchScore(
  data: { score?: unknown; match_score?: unknown } | null | undefined,
  fallback = 0,
): number {
  const raw = data?.score ?? data?.match_score ?? fallback
  const parsed = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getMatchThemeColor(
  score: number,
): "emerald" | "amber" | "rose" {
  if (score >= MATCH_SCORE_THRESHOLDS.HIGHLY_MATCHED) return "emerald"
  if (score >= MATCH_SCORE_THRESHOLDS.GOOD_FIT) return "amber"
  return "rose"
}

export function getMatchThemeClass(color?: string) {
  if (color === "emerald") return "match-theme-high"
  if (color === "amber") return "match-theme-medium"
  if (color === "rose") return "match-theme-low"
  return "match-theme-neutral"
}
