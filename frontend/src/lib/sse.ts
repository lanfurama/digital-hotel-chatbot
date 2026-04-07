import type { SSEEvent } from '@/types/chat'

/**
 * Parse ReadableStream từ SSE response, gọi callback cho từng event.
 * Dùng fetch + ReadableStream thay vì EventSource vì endpoint là POST.
 */
export async function parseSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void,
) {
  if (!response.body) throw new Error('Không có response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw) as SSEEvent
          onEvent(event)
          if (event.type === 'done') {
            onDone()
            return
          }
        } catch {
          // Bỏ qua dòng parse lỗi
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  onDone()
}
