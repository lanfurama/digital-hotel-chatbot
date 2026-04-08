'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { reminders as remindersApi } from '@/lib/api'
import type { Reminder } from '@/types/task'

const CHANNELS = [
  { value: 'web', label: 'Web' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'email', label: 'Email' },
]

const CHANNEL_BADGE: Record<string, string> = {
  web: 'bg-blue-100 text-blue-600',
  zalo: 'bg-sky-100 text-sky-600',
  email: 'bg-purple-100 text-purple-600',
}

interface NewReminderModalProps {
  onClose: () => void
  onCreate: (data: object) => void
}

function NewReminderModal({ onClose, onCreate }: NewReminderModalProps) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [channels, setChannels] = useState<string[]>(['web'])

  const toggleChannel = (ch: string) => {
    setChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  const handleSubmit = () => {
    if (!title.trim() || !remindAt || channels.length === 0) return
    onCreate({ title: title.trim(), message: message.trim() || null, remind_at: remindAt, channels })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Thêm nhắc nhở</h3>

        <input
          autoFocus
          placeholder="Tiêu đề *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />

        <textarea
          placeholder="Nội dung nhắc nhở (tuỳ chọn)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none"
        />

        <div>
          <label className="block text-xs text-gray-500 mb-1">Thời gian nhắc *</label>
          <input
            type="datetime-local"
            value={remindAt}
            onChange={e => setRemindAt(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-2">Kênh nhắc *</label>
          <div className="flex gap-3">
            {CHANNELS.map(ch => (
              <label key={ch.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={channels.includes(ch.value)}
                  onChange={() => toggleChannel(ch.value)}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">{ch.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Huỷ</button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !remindAt || channels.length === 0}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg"
          >
            Tạo
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RemindersPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [reminderList, setReminderList] = useState<Reminder[]>([])
  const [showModal, setShowModal] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      remindersApi.list()
        .then(setReminderList)
        .finally(() => setFetching(false))
    }
  }, [user])

  const handleCreate = async (data: object) => {
    const newReminder = await remindersApi.create(data)
    setReminderList(prev => [newReminder, ...prev])
  }

  const handleDelete = async (id: string) => {
    await remindersApi.delete(id)
    setReminderList(prev => prev.filter(r => r.id !== id))
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const upcoming = reminderList.filter(r => !r.is_sent && new Date(r.remind_at) >= new Date())
  const past = reminderList.filter(r => r.is_sent || new Date(r.remind_at) < new Date())

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/chat')} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900">Nhắc nhở</h1>
          <span className="text-sm text-gray-400">{upcoming.length} sắp tới</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm nhắc nhở
        </button>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Upcoming */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sắp tới</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-gray-400 text-sm">Không có nhắc nhở nào sắp tới</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 text-indigo-600 text-sm hover:underline"
              >
                Thêm nhắc nhở đầu tiên
              </button>
            </div>
          ) : upcoming.map(r => (
            <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} />
          ))}
        </section>

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Đã qua</h2>
            {past.map(r => (
              <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} dimmed />
            ))}
          </section>
        )}
      </div>

      {showModal && <NewReminderModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  )
}

function ReminderCard({ reminder, onDelete, dimmed = false }: { reminder: Reminder; onDelete: (id: string) => void; dimmed?: boolean }) {
  const remindDate = new Date(reminder.remind_at)
  const isOverdue = !reminder.is_sent && remindDate < new Date()

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-2 flex items-start justify-between gap-4 ${dimmed ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-800 text-sm">{reminder.title}</p>
          {reminder.is_sent && (
            <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Đã gửi</span>
          )}
          {isOverdue && (
            <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Quá hạn</span>
          )}
        </div>

        {reminder.message && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{reminder.message}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
            {remindDate.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
          <div className="flex gap-1">
            {reminder.channels.map(ch => (
              <span key={ch} className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${CHANNEL_BADGE[ch] ?? 'bg-gray-100 text-gray-500'}`}>
                {ch}
              </span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => onDelete(reminder.id)}
        className="text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5"
        title="Xoá nhắc nhở"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
