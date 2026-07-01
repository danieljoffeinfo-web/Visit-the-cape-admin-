'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { cardStyle, inputStyle, pageTitle, primaryButton, secondaryButton, theme } from '@/lib/theme'

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What tours do we offer and what are the prices?',
  'How many unread enquiries do we have?',
  'Which fleet vehicles are available this week?',
  'Summarise revenue for the last 7 days',
]

export function JarvisPanel() {
  const { admin } = useAuth()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [jarvisConfigured, setJarvisConfigured] = useState(true)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  const loadSession = useCallback(async () => {
    setLoading(true)
    try {
      const [sessionRes, statusRes] = await Promise.all([
        fetch('/api/jarvis/session', { cache: 'no-store' }),
        fetch('/api/jarvis/status', { cache: 'no-store' }),
      ])

      if (statusRes.ok) {
        const status = await statusRes.json()
        setJarvisConfigured(Boolean(status.configured))
      } else {
        setJarvisConfigured(false)
      }

      if (sessionRes.status === 403) {
        toast.error('Jarvis is not enabled for your account')
        return
      }

      const data = await sessionRes.json()
      if (data.setupRequired) {
        setSetupRequired(true)
        setThreadId(null)
        setMessages([])
        return
      }

      if (!sessionRes.ok) {
        throw new Error(data.error || 'Failed to load Jarvis')
      }

      setSetupRequired(false)
      setThreadId(data.thread?.id || null)
      setMessages(data.messages || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load Jarvis')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  async function clearChat() {
    if (!confirm('Clear this conversation? Your chat history will be removed.')) return
    try {
      const res = await fetch('/api/jarvis/session', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to clear')
      setMessages([])
      setStreamingText('')
      toast.success('Conversation cleared')
    } catch {
      toast.error('Could not clear conversation')
    }
  }

  async function sendMessage(text?: string) {
    const message = (text ?? input).trim()
    if (!message || sending || setupRequired || !jarvisConfigured) return

    setInput('')
    setSending(true)
    setStreamingText('')

    setMessages((prev) => [...prev, { role: 'user', content: message }])

    try {
      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, threadId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Jarvis request failed')
      }

      if (!res.body) throw new Error('No response stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as {
              type: string
              threadId?: string
              content?: string
              error?: string
            }

            if (event.type === 'meta' && event.threadId) {
              setThreadId(event.threadId)
            }
            if (event.type === 'token' && event.content) {
              fullText += event.content
              setStreamingText(fullText)
            }
            if (event.type === 'done' && event.content) {
              fullText = event.content
            }
            if (event.type === 'error') {
              throw new Error(event.error || 'Jarvis error')
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }

      setStreamingText('')
      if (fullText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Jarvis failed to respond'
      toast.error(msg)
      setMessages((prev) => prev.slice(0, -1))
      setInput(message)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const chatDisabled = sending || setupRequired || !jarvisConfigured

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 120px)', minHeight: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Jarvis</h1>
          <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 4 }}>
            Your private assistant for tours, pricing, bookings, fleet, and reports.
            {admin ? ` Signed in as ${admin.full_name}.` : ''}
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={() => void clearChat()} style={{ ...secondaryButton, fontSize: 12 }}>
            Clear chat
          </button>
        )}
      </div>

      {setupRequired && (
        <div style={{ ...cardStyle, borderColor: theme.bronzeBorder, background: theme.bronzeBg }}>
          <strong style={{ color: theme.bronzeDark }}>Setup required</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: theme.textMuted }}>
            Run <code>supabase/jarvis_chat.sql</code> in the admin Supabase SQL editor, then refresh.
          </p>
        </div>
      )}

      {!jarvisConfigured && !setupRequired && (
        <div style={{ ...cardStyle, borderColor: 'rgba(196, 92, 74, 0.35)', background: 'rgba(196, 92, 74, 0.08)' }}>
          <strong style={{ color: theme.danger }}>Jarvis is not connected</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: theme.textMuted }}>
            OpenRouter API key is missing or invalid on the server. Contact your admin to set <code>OPENROUTER_API_KEY</code> in Vercel.
          </p>
        </div>
      )}

      <section style={{ ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: `linear-gradient(135deg, ${theme.bronzeBg} 0%, ${theme.surface} 100%)`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: theme.bronze,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontFamily: theme.headingFont,
            }}
          >
            J
          </div>
          <div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 16, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.bronzeDark }}>
              Jarvis SK v1
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>Connected to Visit The Cape admin data</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ margin: 'auto', color: theme.textMuted, fontSize: 14 }}>Loading Jarvis…</div>
          ) : messages.length === 0 && !streamingText && !sending ? (
            <div style={{ margin: 'auto 0', maxWidth: 640 }}>
              <p style={{ fontSize: 15, color: theme.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Ask anything about tours, pricing, bookings, fleet, enquiries, or reports.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void sendMessage(s)} disabled={chatDisabled} style={{ ...secondaryButton, fontSize: 13, textAlign: 'left' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id || i} role={msg.role} content={msg.content} />
              ))}
              {streamingText && <MessageBubble role="assistant" content={streamingText} streaming />}
              {sending && !streamingText && (
                <div style={{ color: theme.textFaint, fontSize: 13 }}>Jarvis is thinking…</div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${theme.border}`, background: theme.surfaceMuted }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Jarvis…"
              rows={2}
              disabled={chatDisabled}
              style={{ ...inputStyle, flex: 1, resize: 'none', minHeight: 52, maxHeight: 120 }}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={chatDisabled || !input.trim()}
              style={{ ...primaryButton, opacity: chatDisabled || !input.trim() ? 0.6 : 1, minWidth: 88 }}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function MessageBubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '12px 16px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? theme.bronze : theme.surfaceMuted,
          color: isUser ? '#fff' : theme.text,
          border: isUser ? 'none' : `1px solid ${theme.border}`,
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {!isUser && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.bronze, marginBottom: 6 }}>
            Jarvis {streaming ? '· typing' : ''}
          </div>
        )}
        {content}
      </div>
    </div>
  )
}
