export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  project_id: string | null
  created_by: string | null
  assigned_to: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  type: string | null
  status: string
  start_date: string | null
  end_date: string | null
  owner_id: string | null
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  task_id: string | null
  title: string
  message: string | null
  remind_at: string
  channels: string[]
  is_sent: boolean
  created_at: string
}
