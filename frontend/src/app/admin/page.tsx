'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { admin as adminApi, clients as clientsApi, knowledge as knowledgeApi } from '@/lib/api'
import type { User, KnowledgeDoc } from '@/types/chat'
import type { ClientOut } from '@/types/client'

interface Stats { users: number; messages: number; sessions: number; knowledge_docs: number; total_tokens: number }

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-2xl">{icon}</p>
      <p className="text-2xl font-bold text-gray-800 mt-2">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

const ACCESS_LEVEL_BADGE: Record<string, string> = {
  public: 'bg-green-100 text-green-600',
  internal: 'bg-blue-100 text-blue-600',
  confidential: 'bg-red-100 text-red-600',
}

const ACCESS_LEVEL_LABEL: Record<string, string> = {
  public: 'Công khai',
  internal: 'Nội bộ',
  confidential: 'Bảo mật',
}

const DOC_STATUS_BADGE: Record<string, string> = {
  processing: 'bg-yellow-100 text-yellow-600',
  ready: 'bg-green-100 text-green-600',
  error: 'bg-red-100 text-red-600',
}

const DOC_STATUS_LABEL: Record<string, string> = {
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  error: 'Lỗi',
}

export default function AdminPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [clientList, setClientList] = useState<ClientOut[]>([])
  const [docList, setDocList] = useState<KnowledgeDoc[]>([])
  const [tab, setTab] = useState<'stats' | 'users' | 'clients' | 'kb' | 'logs'>('stats')
  const [newClientName, setNewClientName] = useState('')
  const [newClientDomain, setNewClientDomain] = useState('')
  const [crawlUrl, setCrawlUrl] = useState<Record<string, string>>({})
  const [fetching, setFetching] = useState(true)

  // Knowledge Base upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploadAccessLevel, setUploadAccessLevel] = useState<'public' | 'internal' | 'confidential'>('internal')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && user.role !== 'admin') router.replace('/chat')
  }, [loading, user, router])

  useEffect(() => {
    if (user?.role === 'admin') {
      Promise.all([
        adminApi.stats(),
        adminApi.users(),
        adminApi.auditLogs(50),
        clientsApi.list(),
        knowledgeApi.list(),
      ]).then(([s, u, a, c, docs]) => {
        setStats(s as unknown as Stats)
        setUsers(u)
        setAuditLogs(a)
        setClientList(c)
        setDocList(docs)
      }).finally(() => setFetching(false))
    }
  }, [user])

  const handleRoleChange = async (userId: string, newRole: string) => {
    await adminApi.changeRole(userId, newRole)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', uploadCategory)
      fd.append('access_level', uploadAccessLevel)
      const doc = await knowledgeApi.upload(fd)
      setDocList(prev => [doc, ...prev])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDoc = async (id: string) => {
    await knowledgeApi.delete(id)
    setDocList(prev => prev.filter(d => d.id !== id))
  }

  if (loading || fetching) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/chat')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-900">Admin Panel</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {([
            ['stats', 'Tổng quan'],
            ['users', 'Người dùng'],
            ['clients', 'Widget Clients'],
            ['kb', 'Knowledge Base'],
            ['logs', 'Audit Log'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Stats tab */}
        {tab === 'stats' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard label="Người dùng" value={stats.users} icon="👥" />
            <StatCard label="Sessions" value={stats.sessions} icon="💬" />
            <StatCard label="Tin nhắn" value={stats.messages} icon="📨" />
            <StatCard label="Tài liệu KB" value={stats.knowledge_docs} icon="📚" />
            <StatCard label="Tokens dùng" value={stats.total_tokens} icon="🪙" />
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Tên</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Phòng ban</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {u.avatar_url
                          ? <img src={u.avatar_url} className="w-7 h-7 rounded-full" />
                          : <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs">{u.name[0]}</div>
                        }
                        {u.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500">{u.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none"
                      >
                        <option value="staff">staff</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Clients tab */}
        {tab === 'clients' && (
          <div className="space-y-4">
            {/* Create client form */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-medium text-gray-800 mb-3">Tạo Widget Client mới</h3>
              <div className="flex gap-3">
                <input
                  placeholder="Tên client"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <input
                  placeholder="Domain (vd: hotel.com)"
                  value={newClientDomain}
                  onChange={e => setNewClientDomain(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <button
                  onClick={async () => {
                    if (!newClientName || !newClientDomain) return
                    const c = await clientsApi.create({ name: newClientName, domain: newClientDomain })
                    setClientList(prev => [c, ...prev])
                    setNewClientName(''); setNewClientDomain('')
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg"
                >
                  Tạo
                </button>
              </div>
            </div>

            {/* Clients list */}
            {clientList.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{c.name}</p>
                    <p className="text-sm text-gray-400">{c.domain}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {c.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">API Key</p>
                  <code className="text-xs text-gray-700 break-all">{c.api_key}</code>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Embed code</p>
                  <code className="text-xs text-gray-700 break-all">
                    {`<script src="https://your-domain/widget.js" data-key="${c.api_key}" data-color="${c.widget_color}"></script>`}
                  </code>
                </div>

                {/* Crawl */}
                <div className="flex gap-2">
                  <input
                    placeholder="https://hotel.com để crawl"
                    value={crawlUrl[c.id] ?? ''}
                    onChange={e => setCrawlUrl(prev => ({ ...prev, [c.id]: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={async () => {
                      const url = crawlUrl[c.id]
                      if (!url) return
                      await clientsApi.triggerCrawl(c.id, url)
                      alert(`Đã bắt đầu crawl ${url}`)
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg whitespace-nowrap"
                  >
                    Crawl site
                  </button>
                  {c.is_active && (
                    <button
                      onClick={async () => {
                        await clientsApi.disable(c.id)
                        setClientList(prev => prev.map(x => x.id === c.id ? { ...x, is_active: false } : x))
                      }}
                      className="px-3 py-1.5 text-red-500 hover:text-red-700 text-sm border border-red-200 rounded-lg"
                    >
                      Vô hiệu hoá
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Knowledge Base tab */}
        {tab === 'kb' && (
          <div className="space-y-4">
            {/* Upload form */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-medium text-gray-800 mb-3">Tải lên tài liệu mới</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.md"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none file:mr-3 file:py-1 file:px-3 file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 file:rounded-md"
                />
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="general">Tổng hợp</option>
                  <option value="policy">Chính sách</option>
                  <option value="room">Phòng & gói</option>
                  <option value="procedure">Quy trình</option>
                  <option value="training">Đào tạo</option>
                </select>
                <select
                  value={uploadAccessLevel}
                  onChange={e => setUploadAccessLevel(e.target.value as 'public' | 'internal' | 'confidential')}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="public">Công khai</option>
                  <option value="internal">Nội bộ</option>
                  <option value="confidential">Bảo mật</option>
                </select>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg whitespace-nowrap flex items-center gap-2"
                >
                  {uploading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {uploading ? 'Đang tải...' : 'Tải lên'}
                </button>
              </div>
              {uploadError && <p className="text-sm text-red-500 mt-2">{uploadError}</p>}
              <p className="text-xs text-gray-400 mt-2">Hỗ trợ: PDF, DOCX, XLSX, MD</p>
            </div>

            {/* Docs table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600">Tên tài liệu</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Danh mục</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Quyền truy cập</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                    <th className="px-4 py-3 font-medium text-gray-600">Ngày tải</th>
                    <th className="px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {docList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                        Chưa có tài liệu nào. Hãy tải lên tài liệu đầu tiên.
                      </td>
                    </tr>
                  ) : docList.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{doc.name}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{doc.category}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_LEVEL_BADGE[doc.access_level]}`}>
                          {ACCESS_LEVEL_LABEL[doc.access_level]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOC_STATUS_BADGE[doc.status]}`}>
                          {DOC_STATUS_LABEL[doc.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit log tab */}
        {tab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600">Thời gian</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 font-medium text-gray-600">IP</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{log.action}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{log.ip_address ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.response_code < 300 ? 'bg-green-100 text-green-600'
                        : log.response_code < 500 ? 'bg-yellow-100 text-yellow-600'
                        : 'bg-red-100 text-red-600'
                      }`}>
                        {log.response_code}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
