'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { panelStyle, useAnchoredPopover } from '@/components/ui/popover'
import { fieldLabel, inputStyle, theme } from '@/lib/theme'

export type SelectOption = { value: string; label: string; hint?: string }

/**
 * The console's dropdown.
 *
 * A native `<select>` renders the operating system's menu — grey, square, and
 * nothing like the rest of the console. This is the same control drawn in the
 * admin's own palette.
 *
 * Written as a listbox rather than a div with a click handler, because the
 * native element being replaced could be driven entirely from the keyboard and
 * a replacement that cannot is a downgrade however it looks. Typing a letter
 * jumps to the next option starting with it, as the native control does.
 */
export function SelectMenu({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select…',
  disabled,
  id,
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label?: string
  placeholder?: string
  disabled?: boolean
  id?: string
}) {
  const { open, setOpen, mounted, position, triggerRef, panelRef } =
    useAnchoredPopover<HTMLButtonElement>(260)
  const [activeIndex, setActiveIndex] = useState(0)
  const typeahead = useRef({ term: '', at: 0 })
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  /* Opening lands on the current value, not the top of the list, so arrowing
     moves relative to what is actually set. */
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open) return
    panelRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, panelRef])

  function commit(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return

    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      case 'Tab':
        setOpen(false)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        return
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, options.length - 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        return
      default:
        break
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now()
      const term = now - typeahead.current.at < 800 ? typeahead.current.term + event.key : event.key
      typeahead.current = { term, at: now }
      const match = options.findIndex((option) =>
        option.label.toLowerCase().startsWith(term.toLowerCase()),
      )
      if (match >= 0) setActiveIndex(match)
    }
  }

  const control = (
    <button
      id={id}
      type="button"
      ref={triggerRef}
      disabled={disabled}
      onClick={() => !disabled && setOpen(!open)}
      onKeyDown={onKeyDown}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      style={{
        ...inputStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        borderColor: open ? theme.bronzeBorder : theme.border,
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? theme.text : theme.textFaint,
        }}
      >
        {selected ? selected.label : placeholder}
      </span>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          color: theme.bronzeDark,
          fontSize: 10,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s ease',
        }}
      >
        ▼
      </span>
    </button>
  )

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              ...panelStyle,
              top: position.top,
              left: position.left,
              minWidth: position.width,
              maxHeight: 260,
              overflowY: 'auto',
              background: theme.surface,
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.modalShadow,
              padding: 4,
            }}
          >
            {options.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 13, color: theme.textFaint }}>
                Nothing to choose from
              </div>
            )}
            {options.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === activeIndex
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isActive}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                  style={{
                    padding: '9px 11px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    fontSize: 14,
                    fontFamily: theme.bodyFont,
                    color: theme.text,
                    background: isActive ? theme.bronzeBg : 'transparent',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: isSelected ? 700 : 500 }}>
                      {option.label}
                    </span>
                    {option.hint && (
                      <span style={{ display: 'block', fontSize: 12, color: theme.textMuted }}>
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <span aria-hidden style={{ color: theme.bronzeDark, fontWeight: 800 }}>
                      ✓
                    </span>
                  )}
                </div>
              )
            })}
          </div>,
          document.body,
        )
      : null

  if (!label) {
    return (
      <>
        {control}
        {panel}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      {control}
      {panel}
    </div>
  )
}
