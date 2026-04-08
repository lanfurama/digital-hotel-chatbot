/**
 * Human-readable label for chat `model_used` / SSE model ids
 * (Anthropic API ids, Ollama names, etc.).
 */
export function formatChatModelLabel(model: string | null | undefined): string {
  if (!model?.trim()) return ''

  const raw = model.trim()
  const lower = raw.toLowerCase()

  if (!lower.includes('claude')) {
    if (raw.length > 42) return `${raw.slice(0, 40)}…`
    return raw
  }

  const tier = lower.includes('haiku')
    ? 'Haiku'
    : lower.includes('sonnet')
      ? 'Sonnet'
      : lower.includes('opus')
        ? 'Opus'
        : null

  if (!tier) {
    const tail = raw.replace(/^claude-?/i, '').replace(/[-_]/g, ' ').trim()
    return tail.length > 32 ? `Claude · ${tail.slice(0, 30)}…` : `Claude · ${tail}`
  }

  let s = raw
    .replace(/^claude-/i, '')
    .replace(new RegExp(tier, 'i'), '')
    .replace(/^[-_.]+|[-_.]+$/g, '')
  s = s.replace(/-\d{8}$/i, '').replace(/-\d{4}-\d{2}-\d{2}$/i, '')
  s = s.replace(/[-_]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '')

  if (s && s.length <= 24) return `Claude ${tier} · ${s}`
  return `Claude ${tier}`
}
