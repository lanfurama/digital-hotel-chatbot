'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { tasks as tasksApi } from '@/lib/api'
import type { Task, TaskStatus } from '@/types/task'

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'Cần làm', color: 'bg-slate-100' },
  { status: 'in_progress', label: 'Đang làm', color: 'bg-blue-50' },
  { status: 'review', label: 'Đang review', color: 'bg-yellow-50' },
  { status: 'done', label: 'Hoàn thành', color: 'bg-green-50' },
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn',
}

/** Pill styles for “move to column” actions — reads as buttons, not raw text. */
const MOVE_TO_STYLES: Record<TaskStatus, string> = {
  todo: 'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50',
  in_progress: 'border-blue-200/90 bg-white text-blue-700 hover:bg-blue-50/90',
  review: 'border-amber-200/90 bg-white text-amber-800 hover:bg-amber-50/70',
  done: 'border-emerald-200/90 bg-white text-emerald-700 hover:bg-emerald-50/90',
  cancelled: 'border-gray-200/90 bg-white text-gray-600 hover:bg-gray-50',
}

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: TaskStatus) => void }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2 hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>

      {task.description && (
        <p className="text-xs text-gray-400 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.due_date && (
          <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap pt-1">
        {COLUMNS.filter(c => c.status !== task.status).map(col => (
          <button
            key={col.status}
            type="button"
            title={`Chuyển sang: ${col.label}`}
            onClick={() => onStatusChange(task.id, col.status)}
            className={`text-xs font-medium px-2.5 py-1 rounded-xl border shadow-sm transition-all duration-200 ease-in-out hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400/50 ${MOVE_TO_STYLES[col.status]}`}
          >
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NewTaskModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: object) => void }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Tạo task mới</h3>
        <input
          autoFocus
          placeholder="Tiêu đề task *"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <div className="flex gap-3">
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Huỷ</button>
          <button
            onClick={() => {
              if (!title.trim()) return
              onCreate({ title: title.trim(), priority, due_date: dueDate || null })
              onClose()
            }}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
          >
            Tạo
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [taskList, setTaskList] = useState<Task[]>([])
  const [showModal, setShowModal] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      tasksApi.list({ assigned_to_me: false })
        .then(setTaskList)
        .finally(() => setFetching(false))
    }
  }, [user])

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    setTaskList(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await tasksApi.update(id, { status })
  }

  const handleCreate = async (data: object) => {
    const newTask = await tasksApi.create(data)
    setTaskList(prev => [newTask, ...prev])
  }

  if (loading || fetching) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  }

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
          <h1 className="font-semibold text-gray-900">Task Board</h1>
          <span className="text-sm text-gray-400">{taskList.length} tasks</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tạo task
        </button>
      </div>

      {/* Kanban */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const colTasks = taskList.filter(t => t.status === col.status)
          return (
            <div key={col.status} className={`rounded-2xl ${col.color} p-3 space-y-2 min-h-48`}>
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                <span className="text-xs bg-white text-gray-500 rounded-full px-2 py-0.5 font-medium">
                  {colTasks.length}
                </span>
              </div>
              {colTasks.map(task => (
                <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
              ))}
              {colTasks.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-4">Không có task</p>
              )}
            </div>
          )
        })}
      </div>

      {showModal && <NewTaskModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  )
}
