import type { AiSettings } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatWithAi(
  settings: AiSettings,
  messages: ChatMessage[],
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error('请先在设置中填写 AI API Key')
  }
  if (window.goldenEgg?.aiChat) {
    const result = await window.goldenEgg.aiChat({
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
    })
    if (result?.content) return result.content
    throw new Error(result?.error || 'AI 服务没有返回内容')
  }

  const endpoint = settings.endpoint.replace(/\/$/, '')
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.6,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI 请求失败（${response.status}）${text.slice(0, 160)}`)
  }
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 服务没有返回内容')
  return content
}
