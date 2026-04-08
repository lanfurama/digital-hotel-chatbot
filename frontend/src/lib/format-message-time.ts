/** Thời gian gửi/nhận hiển thị dưới bubble (locale Việt Nam). */
export function formatMessageDateTime(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
