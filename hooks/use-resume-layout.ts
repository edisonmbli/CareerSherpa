import { useState, useCallback, useEffect } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { debounce } from 'lodash'

const PX_PER_MM = 96 / 25.4
const A4_HEIGHT_MM = 297
const A4_VISUAL_HEIGHT_MM = 307 // 297mm content + 10mm gray gap for visual separation

/**
 * 获取 A4 纸的视觉高度 (px)
 * 用于 PageDivider 定位和背景对齐 - 必须与 backgroundSize: 307mm 一致
 */
export function getVisualPageHeightPx() {
  return A4_VISUAL_HEIGHT_MM * PX_PER_MM // ~1160px
}

/**
 * 获取 A4 纸的物理内容区高度 (px)
 * 不含 padding，用于页数计算
 */
export function getA4ContentHeightPx() {
  return A4_HEIGHT_MM * PX_PER_MM // ~1122px
}

/**
 * 获取内容区域的有效高度 (px)
 * 用于 Smart Fill 计算 - 考虑页边距
 */
export function getEffectivePageHeightPx(pageMarginMm?: number) {
  // 如果没有传入 margin，使用一个保守的估计值
  const margin = typeof pageMarginMm === 'number' ? pageMarginMm : 10
  const safety = 2 // 小的安全边距
  const effectiveMm = Math.max(1, A4_HEIGHT_MM - margin * 2 - safety)
  return effectiveMm * PX_PER_MM
}

/**
 * 获取分页预览线的定位高度 (px)
 * 
 * 背景 pattern 每 307mm 重复 (297mm 白色 + 10mm 灰色)
 * 分页线应该在每个 "白→灰" 交界处：
 *   - 第1条: 297mm
 *   - 第2条: 297 + 307 = 604mm
 *   - 第3条: 297 + 307×2 = 911mm
 * 通用公式: 297 + (n-1) × 307 = n×307 - 10
 */
export function getPageDividerPositionPx(pageIndex: number) {
  const positionMm = pageIndex * A4_VISUAL_HEIGHT_MM - 10 // n×307 - 10
  return positionMm * PX_PER_MM
}

export function useResumeLayout(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const { resumeData, sectionConfig, styleConfig, viewMode } = useResumeStore()
  const [spacers, setSpacers] = useState<Record<string, number>>({})
  const [totalPages, setTotalPages] = useState(1)
  const [pureContentHeight, setPureContentHeight] = useState(0)

  const calculateLayout = useCallback(() => {
    if (!containerRef.current) return

    const pageHeightPx = getEffectivePageHeightPx(styleConfig?.pageMargin)

    // 1. 获取所有可交互区块
    const sections = Array.from(
      containerRef.current.querySelectorAll('[data-section-id]')
    ) as HTMLElement[]

    if (sections.length === 0) return

    const newSpacers: Record<string, number> = {}
    let pendingSpacer = 0 // 待处理的分页垫片

    // 获取容器位置，用于计算相对坐标
    const containerRect = containerRef.current.getBoundingClientRect()
    const containerTop = containerRect.top

    // 2. 预先测量所有元素高度 (Batch Read)
    // 使用 getBoundingClientRect 获取真实渲染位置（包含 margin 折叠等浏览器行为）
    const measurements = sections.map((el) => {
      // 临时移除 marginTop 以获取“自然流”位置（排除之前的 Spacer 影响）
      // 注意：这里假设我们想要基于“无垫片”状态计算。
      // 但对于手动分页，我们需要知道“如果加了垫片后的位置”。
      // 实际上，每次 Render 后，如果 Spacer 变了，React 会重绘，我们再测。
      // 所以我们直接测量当前状态即可？
      // 不，为了计算准确，我们通常希望测量“无 Spacer”状态，然后手动累加 Spacer。
      // 但这里我们只处理 Manual Spacer。
      // 让我们先获取“当前 DOM 状态”的底部位置。
      const originalMarginTop = el.style.marginTop
      el.style.marginTop = '0px'
      const rect = el.getBoundingClientRect()
      el.style.marginTop = originalMarginTop

      return {
        id: el.getAttribute('data-section-id')!,
        height: rect.height,
        // 相对容器的底部位置 (包含 Margin 的影响，因为 rect.top 是浏览器布局后的结果)
        bottom: rect.bottom - containerTop,
        hasPageBreak: el.getAttribute('data-has-page-break') === 'true',
      }
    })

    // 3. 计算逻辑
    let currentVisualBottom = 0

    measurements.forEach((item, index) => {
      // 基础位置：当前测量的无 Spacer 底部
      // 但如果之前的元素加了 Spacer，所有后续元素的 rect 都会下移。
      // 但我们在上面测量时移除了所有 marginTop='0px' (暂时的)。
      // 等等，上面 map 是瞬间执行的。
      // 如果我在 map 里改了 style，DOM 不会重排吗？
      // 会，但是 synchronous reflow。
      // 如果我改了 Item 1，测量 Item 1。改回 Item 1。
      // 然后改 Item 2...
      // Item 2 的位置取决于 Item 1 的最终状态（即改回后的状态）。
      // 所以 measurements 里的 rect 是基于 "Item 1 has Spacer, Item 2 no Spacer" 的混合状态？
      // 不，originalMarginTop 是 React 赋予的 style。
      // 如果我们想测量“纯净高度”，我们应该假设所有 Spacer 都是 0。
      // 但这样会导致巨大的 Layout Shift。

      // 简单策略：
      // 我们只关注 Manual Break。
      // 如果 viewMode !== 'print'，不需要计算 Spacer。
      if (viewMode !== 'print') {
        currentVisualBottom = item.bottom // 记录最后的底部
        return
      }

      const spacer = pendingSpacer
      pendingSpacer = 0

      // 如果有待处理的 Spacer (来自上一个元素的手动分页)
      if (spacer > 0) {
        newSpacers[item.id] = spacer
      }

      // 计算当前元素加了 Spacer 后的虚拟底部
      // 注意：item.bottom 是无 Spacer 的底部。
      // 如果我们加了 Spacer，元素下移 Spacer 距离。
      const virtualBottom = item.bottom + spacer

      // 累加 Spacer 对后续元素的影响?
      // 不，pendingSpacer 只影响当前元素。
      // 但如果当前元素下移了，它的 bottom 也变了。
      // 这是一个累积效应。
      // 鉴于我们只处理 Manual Break，我们不需要模拟复杂的自动分页堆叠。
      // 我们只需要知道：当前元素结束后，是否需要分页？

      // 重新修正逻辑：
      // 既然只支持手动分页，我们只需要检测 data-has-page-break。
      // 如果有，计算剩余空间，塞给下一个元素。
      // 我们不需要这一轮的 "Simulation"，因为下一轮 Render 会反映真实位置。
      // 只要我们算出了 spacer，React 更新，位置就变了。
      // 再次测量时，item.bottom 就已经是新的位置了！
      // 只要我们不再无故清除 spacer (setSpacers({}) unless necessary)，它就是稳定的。

      // 所以：
      // 1. 读取当前位置 (含 Spacer)。
      // 2. 如果有 Manual Break，检查是否需要调整 Spacer。
      //    - 如果当前已经在页底，Spacer = 0。
      //    - 如果不在页底，Spacer = PageEnd - Bottom。
      // 3. 如果没有 Manual Break，Spacer = 0。

      // 这样逻辑更简单稳定！不需要模拟！

      // 但是，如果我们要移除 Auto Spacer，我们需要确保 newSpacers 不包含旧的 Auto Spacer。
      // 现在的代码只处理 Manual Spacer，所以没问题。

      // 获取当前实际底部 (包括现有的 spacer)
      // 注意：不要在 map 里设 marginTop=0，直接测！
    })

    // 重写 measurements 逻辑：直接测当前状态
    const realMeasurements = sections.map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        id: el.getAttribute('data-section-id')!,
        bottom: rect.bottom - containerTop,
        hasPageBreak: el.getAttribute('data-has-page-break') === 'true',
      }
    })

    realMeasurements.forEach((item, index) => {
      currentVisualBottom = item.bottom // 更新总高度

      if (viewMode !== 'print') return

      if (item.hasPageBreak) {
        // 计算当前页结束位置
        const pageIndex = Math.floor(item.bottom / pageHeightPx)
        const pageEnd = (pageIndex + 1) * pageHeightPx

        // 如果还有剩余空间
        if (item.bottom < pageEnd) {
          // 下一个元素需要的 Spacer
          const gap = pageEnd - item.bottom
          // 找到下一个元素 ID
          if (index + 1 < sections.length) {
            const nextEl = sections[index + 1]
            if (nextEl) {
              const nextId = nextEl.getAttribute('data-section-id')
              if (nextId) {
                newSpacers[nextId] = gap
              }
            }
          }
        }
      }
    })

    // 4. 更新状态
    setSpacers(newSpacers)

    // 真实总高度
    // 修复 Bug: 不再依赖 scrollHeight，因为它会受到 minHeight (即 totalPages) 的影响，导致无限循环。
    // 我们只信任内容元素的实际底部位置。
    // 为了防止空页面，确保至少有 1 页高度 (PAGE_HEIGHT_PX) 或 0 (如果没内容)
    // 但 currentVisualBottom 可能是 0。
    // 如果没有内容，pureContentHeight = 0, totalPages = 1.

    // 修正 currentVisualBottom 计算逻辑，确保取最大值
    // currentVisualBottom 在上面循环中只是最后一个元素的 bottom。
    // 应该遍历所有 measurements 取 max。
    let maxContentBottom = 0
    realMeasurements.forEach((m) => {
      // 如果有 spacer，需要加上 spacer？
      // realMeasurements 是基于 DOM 测量的，如果 DOM 已经应用了 Spacer，getBoundingClientRect 会包含它。
      // 所以直接用 m.bottom 即可。
      if (m.bottom > maxContentBottom) maxContentBottom = m.bottom
    })

    const contentEndCandidates: HTMLElement[] = []
    const lastEl = containerRef.current.lastElementChild
    if (lastEl instanceof HTMLElement) contentEndCandidates.push(lastEl)
    contentEndCandidates.push(
      ...(Array.from(
        containerRef.current.querySelectorAll('footer')
      ) as HTMLElement[])
    )

    contentEndCandidates.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const bottom = rect.bottom - containerTop
      if (bottom > maxContentBottom) maxContentBottom = bottom
    })

    // 如果有 pendingSpacer (虽然在手动分页逻辑中通常给了下一个元素，但为了保险)
    // 实际上 pendingSpacer 已经分配给了 newSpacers 并会在下一次渲染生效。
    // 这里我们只关心“当前渲染的内容高度”。

    // 使用 maxContentBottom 作为真实内容高度
    const finalHeight = maxContentBottom

    // 计算页数 - 使用 A4 物理高度 (297mm) 保持与背景 pattern 一致
    const a4HeightPx = getA4ContentHeightPx()
    const calculatedPages = Math.ceil(finalHeight / a4HeightPx) || 1

    setTotalPages(calculatedPages)
    setPureContentHeight(finalHeight)
  }, [resumeData, sectionConfig, styleConfig, viewMode])

  useEffect(() => {
    if (!containerRef.current) return
    const debouncedCalculate = debounce(calculateLayout, 100)

    const observer = new ResizeObserver(() => {
      debouncedCalculate()
    })
    observer.observe(containerRef.current)

    calculateLayout()

    return () => {
      observer.disconnect()
      debouncedCalculate.cancel()
    }
  }, [calculateLayout])

  return { spacers, totalPages, pureContentHeight }
}
