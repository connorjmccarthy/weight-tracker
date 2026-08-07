import { useEffect, useRef, useState } from 'react'

/**
 * Measures a container so charts can be drawn at real pixel dimensions.
 *
 * The alternative — a fixed viewBox scaled with `width: 100%` — stretches axis labels
 * along with the geometry, so the same chart has 10px text on a phone and 19px text on a
 * tablet. Measuring keeps type at its intended size at every width.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth || fallback)
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])

  return [ref, width] as const
}
