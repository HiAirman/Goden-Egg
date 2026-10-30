/// <reference types="vite/client" />
import type { Quote } from './types'

declare global {
  interface Window {
    goldenEgg?: {
      fetchQuotes?: (codes: string[]) => Promise<Quote[]>
      aiChat?: (payload: {
        endpoint: string
        apiKey: string
        model: string
        messages: { role: string; content: string }[]
      }) => Promise<{ content?: string; error?: string }>
    }
  }
}

export {}
