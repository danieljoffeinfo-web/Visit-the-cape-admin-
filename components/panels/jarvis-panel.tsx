'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { cardStyle, inputStyle, pageTitle, primaryButton, secondaryButton, theme } from '@/lib/theme'

type Thread = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type Message = {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
}

const SUGGESTIONS = [
  'What tours do we offer and what are the prices?',
  'How many unread enquiries do we have?',
  'Which fleet vehicles are available this week?',
  'Summarise revenue for the last 7 days',
  'What departures are coming up and how many seats are left?',
  'Any suggestions to improve bookings this month?',
]

export function JarvisPanel() {
  const { admin } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/jarvis/threads', { cache: 'no-store' })
      if (res.status === 403) {
        toast.error('Jarvis is not enabled for your account')
        return
      }
      const data = await res.json()
      if (data.setupRequired) {
        setSetupRequired(true)
        setThreads([])
        return
      }
      setSetupRequired(false)
      setThreads(data.threads || [])
    } catch {
      toast.error('Failed to load Jarvis conversations')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadThread = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/jarvis/threads/${threadId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMessages((data.messages || []).filter((m: Message) => m.role !== 'system'))
    } catch {
      toast.error('Failed to load conversation')
    }
  }, [])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (activeThreadId) {
      loadThread(activeThreadId)
    } else {
      setMessages([])
    }
  }, [activeThreadId, loadThread])

  async function startNewChat() {
    setActiveThreadId(null)
    setMessages([])
    setStreamingText('')
    inputRef.current?.focus()
  }

  async function deleteThread(threadId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this conversation?')) return
    try {
      const res = await fetch(`/api/jarvis/threads/${threadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setThreads((prev) => prev.filter((t) => t.id !== threadId))
      if (activeThreadId === threadId) {
        setActiveThreadId(null)
        setMessages([])
      }
      toast.success('Conversation deleted')
    } catch {
      toast.error('Could not delete conversation')
    }
  }

  async function sendMessage(text?: string) {
    const message = (text ?? input).trim()
    if (!message || sending) return

    setInput('')
    setSending(true)
    setStreamingText('')

    const userMessage: Message = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])

    try {
      const res = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, threadId: activeThreadId }),
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
      let threadId = activeThreadId

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
              threadId = event.threadId
              if (!activeThreadId) setActiveThreadId(event.threadId)
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
      setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
      await loadThreads()
      if (threadId && !activeThreadId) setActiveThreadId(threadId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Jarvis failed to respond'
      toast.error(msg)
      setMessages((prev) => prev.slice(0, -1))
      setInput(message)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: 'calc(100vh - 120px)', minHeight: 520 }}>
      <div>
        <h1 style={pageTitle}>Jarvis</h1>
        <p style={{ color: theme.textMuted, fontSize: 14, marginTop: 4 }}>
          Your private AI assistant for tours, pricing, bookings, fleet, reports, and suggestions.
          {admin ? ` Signed in as ${admin.full_name}.` : ''}
        </p>
      </div>

      {setupRequired && (
        <div style={{ ...cardStyle, borderColor: theme.bronzeBorder, background: theme.bronzeBg }}>
          <strong style={{ color: theme.bronzeDark }}>Setup required</strong>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: theme.textMuted }}>
            Run <code>supabase/jarvis_chat.sql</code> in the admin Supabase SQL editor, then refresh this page.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Thread sidebar */}
        <aside style={{ ...cardStyle, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          <button type="button" onClick={startNewChat} style={{ ...primaryButton, width: '100%' }}>
            + New chat
          </button>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 4 }}>
            {loading && <p style={{ fontSize: 13, color: theme.textFaint, padding: 8 }}>Loading…</p>}
            {!loading && threads.length === 0 && (
              <p style={{ fontSize: 13, color: theme.textFaint, padding: 8 }}>No conversations yet.</p>
            )}
            {threads.map((thread) => {
              const active = activeThreadId === thread.id
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    marginBottom: 4,
                    borderRadius: 8,
                    border: `1px solid ${active ? theme.bronzeBorder : 'transparent'}`,
                    background: active ? theme.bronzeBg : 'transparent',
                    cursor: 'pointer',
                    fontFamily: theme.bodyFont,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {thread.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: theme.textFaint }}>
                      {format(new Date(thread.updated_at), 'd MMM')}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => deleteThread(thread.id, e)}
                      onKeyDown={(e) => e.key === 'Enter' && deleteThread(thread.id, e as unknown as React.MouseEvent)}
                      style={{ fontSize: 11, color: theme.textFaint, padding: '2px 6px' }}
                    >
                      Delete
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Chat area */}
        <section style={{ ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: `linear-gradient(135deg, ${theme.bronzeBg} 0%, ${theme.surface} 100%)`,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: theme.bronze,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: 16,
                fontFamily: theme.headingFont,
              }}
            >
              J
            </div>
            <div>
              <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 18, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.bronzeDark }}>
                Jarvis SK v1
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Connected to Visit The Cape admin data</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 && !streamingText && !sending && (
              <div style={{ margin: 'auto 0', maxWidth: 640 }}>
                <p style={{ fontSize: 15, color: theme.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                  Ask me anything about the admin dashboard — tour pricing, bookings, fleet availability, enquiries, content calendar, or business suggestions.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      style={{ ...secondaryButton, fontSize: 13, textAlign: 'left' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages
              .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
              .map((msg, i) => (
                <MessageBubble key={msg.id || i} role={msg.role as 'user' | 'assistant'} content={msg.content} />
              ))}

            {streamingText && <MessageBubble role="assistant" content={streamingText} streaming />}

            {sending && !streamingText && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: theme.textFaint, fontSize: 13 }}>
                <span className="jarvis-typing">Jarvis is thinking</span>
                <span style={{ animation: 'pulse 1s infinite' }}>…</span>
              </div>
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
                placeholder="Ask Jarvis about tours, pricing, bookings, reports…"
                rows={2}
                disabled={sending || setupRequired}
                style={{
                  ...inputStyle,
                  flex: 1,
                  resize: 'none',
                  minHeight: 52,
                  maxHeight: 120,
                }}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={sending || !input.trim() || setupRequired}
                style={{
                  ...primaryButton,
                  opacity: sending || !input.trim() ? 0.6 : 1,
                  minWidth: 88,
                }}
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}) {
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
