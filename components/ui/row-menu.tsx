'use client'

import { createPortal } from 'react-dom'
import { panelStyle, useAnchoredPopover } from '@/components/ui/popover'
import { theme } from '@/lib/theme'

export type RowMenuItem = {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/**
 * The overflow menu on a booking row.
 *
 * Every row used to carry five competing actions in a line — view, raise in
 * Xero, edit, cancel, delete — with Delete no quieter than the thing you
 * actually came to do. The three that get used daily stay on the row; the rest
 * live behind this, which also puts a deliberate second step in front of the
 * two that cannot be undone.
 */
export function RowMenu({ items, label = 'More actions' }: { items: RowMenuItem[]; label?: string }) {
  const { open, setOpen, mounted, position, triggerRef, panelRef } =
    useAnchoredPopover<HTMLButtonElement>(180)

  const usable = items.filter((item) => !item.disabled)
  if (usable.length === 0) return null

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: `1px solid ${open ? theme.bronzeBorder : 'transparent'}`,
          background: open ? theme.bronzeBg : 'transparent',
          color: theme.textMuted,
          cursor: 'pointer',
          fontSize: 17,
          lineHeight: 1,
          fontFamily: theme.bodyFont,
        }}
      >
        ⋯
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              ...panelStyle,
              top: position.top,
              /* Right-aligned to the trigger: this sits in the last column, so
                 a panel growing rightwards would leave the page. */
              left: Math.max(8, position.left + position.width - 190),
              width: 190,
              background: theme.surface,
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.modalShadow,
              padding: 4,
            }}
          >
            {usable.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: item.danger ? theme.danger : theme.text,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: theme.bodyFont,
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = item.danger
                    ? 'rgba(196, 92, 74, 0.08)'
                    : theme.surfaceMuted
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
