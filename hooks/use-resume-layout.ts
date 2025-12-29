import { useState, useCallback, useEffect } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { debounce } from 'lodash'

const PX_PER_MM = 96 / 25.4
const A4_HEIGHT_MM = 297

/**
 * 获取 A4 纸的物理内容区高度 (px)
 * 不含 padding，用于页数计算
 */
export function getA4ContentHeightPx() {
  return A4_HEIGHT_MM * PX_PER_MM // ~1122px
}

/**
 * 获取内容区域的有效高度 (px)
 * 考虑页边距 - 保留用于可能的未来需求
 */
export function getEffectivePageHeightPx(pageMarginMm?: number) {
  const margin = typeof pageMarginMm === 'number' ? pageMarginMm : 10
  const safety = 2
  const effectiveMm = Math.max(1, A4_HEIGHT_MM - margin * 2 - safety)
  return effectiveMm * PX_PER_MM
}
