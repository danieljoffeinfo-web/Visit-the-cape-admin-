'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Anchored popover positioning for the custom Select and Date controls.
 *
 * These open inside `.admin-modal`, which is `overflow-y: auto` — and a box
 * that clips one axis clips both, so an absolutely positioned panel would be
 * cut off at the modal edge and would scroll away from its own trigger. The
 * panel is therefore portalled to the body and positioned against the
 * viewport, which no ancestor can clip.
 *
 * Fixed coordinates have to be recomputed while open, since the modal behind
 * still scrolls. Both listeners are capturing so they fire for scrolls inside
 * the modal, not just the window.
 */
export function useAnchoredPopover<T extends HTMLElement>(preferredHeight = 260) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  })
  const triggerRef = useRef<T | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => setMounted(true), [])

  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom
    /* Flip above when the space below cannot hold the panel but the space
       above can. Near-equal cramped space keeps it below, where a dropdown is
       expected. */
    const flip = below < preferredHeight && rect.top > below
    setPosition({
      top: flip ? Math.max(8, rect.top - preferredHeight - 6) : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    })
  }, [preferredHeight])

  useLayoutEffect(() => {
    if (!open) return
    reposition()
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => reposition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, reposition])

  /* Pointerdown rather than click: a click listener would also catch the
     release of the very press that opened the panel on some browsers. */
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  return { open, setOpen, mounted, position, triggerRef, panelRef }
}

export const panelStyle = {
  position: 'fixed' as const,
  zIndex: 1000,
  borderRadius: 8,
  boxSizing: 'border-box' as const,
}
