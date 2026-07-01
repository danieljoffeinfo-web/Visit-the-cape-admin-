import { getJarvisModel, getOpenRouterApiKey } from '@/lib/jarvis-config'
import { executeJarvisTool, JARVIS_TOOLS, type JarvisToolName } from '@/lib/jarvis-context'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
}

type ToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      role: string
      content?: string | null
      tool_calls?: ToolCall[]
    }
    finish_reason?: string
  }>
  error?: { message?: string }
}

const MAX_TOOL_ROUNDS = 4

export async function runJarvisCompletion(
  messages: ChatMessage[],
  onToken?: (chunk: string) => void,
): Promise<string> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error(
      'Jarvis is not configured. Add OPENROUTER_API_KEY (sk-or-v1-…) in Vercel environment variables.',
    )
  }

  const workingMessages: Array<Record<string, unknown>> = messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name }
    }
    return { role: m.role, content: m.content }
  })

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const useTools = round < MAX_TOOL_ROUNDS - 1

    const body: Record<string, unknown> = {
      model: getJarvisModel(),
      messages: workingMessages,
      temperature: 0.4,
      max_tokens: 2048,
    }

    if (useTools) {
      body.tools = JARVIS_TOOLS
      body.tool_choice = 'auto'
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://admin.visitthecape.co.za',
        'X-OpenRouter-Title': 'Visit The Cape Jarvis',
      },
      body: JSON.stringify(body),
    })

    const data = (await response.json()) as OpenRouterResponse & {
      error?: { message?: string; code?: number }
    }

    if (!response.ok) {
      const msg = data.error?.message || `OpenRouter error (${response.status})`
      if (msg.toLowerCase().includes('authentication')) {
        throw new Error('OpenRouter API key is invalid. Check OPENROUTER_API_KEY in Vercel (must start with sk-or-v1-).')
      }
      throw new Error(msg)
    }

    const choice = data.choices?.[0]
    const message = choice?.message
    if (!message) {
      throw new Error('Empty response from Jarvis model')
    }

    const toolCalls = message.tool_calls
    if (toolCalls && toolCalls.length > 0) {
      workingMessages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: toolCalls,
      })

      for (const call of toolCalls) {
        const toolName = call.function.name as JarvisToolName
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        } catch {
          args = {}
        }

        const result = await executeJarvisTool(toolName, args)
        workingMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: JSON.stringify(result),
        })
      }

      continue
    }

    const text = (message.content || '').trim()
    if (!text) {
      throw new Error('Jarvis returned an empty message')
    }

    if (onToken) {
      await streamText(text, onToken)
    }

    return text
  }

  throw new Error('Jarvis exceeded maximum tool rounds')
}

async function streamText(text: string, onToken: (chunk: string) => void) {
  const words = text.split(/(\s+)/)
  for (const part of words) {
    onToken(part)
    await new Promise((r) => setTimeout(r, 8))
  }
}
