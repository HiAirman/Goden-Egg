import type { AppState } from '../types'

export interface StateResponse {
  state: AppState | null
  savedAt: string | null
  path: string
  bytes: number
}

export interface SaveResponse {
  savedAt: string
  path: string
  bytes: number
}

export interface DataInfo {
  path: string
  dataDir: string
  exists: boolean
  bytes: number
  savedAt: string | null
  backupCount: number
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `本地数据服务返回 ${response.status}`)
    }
    return data as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('本地数据服务响应超时')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function loadServerState(): Promise<StateResponse> {
  return requestJson<StateResponse>('/api/state')
}

export async function saveServerState(state: AppState): Promise<SaveResponse> {
  return requestJson<SaveResponse>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ state }),
  })
}

export async function clearServerState(): Promise<{ path: string }> {
  return requestJson<{ path: string }>('/api/state', { method: 'DELETE' })
}

export async function fetchDataInfo(): Promise<DataInfo> {
  return requestJson<DataInfo>('/api/info')
}
