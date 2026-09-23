import { useState, useEffect, useRef, useCallback, useMemo, memo, Component, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useUser, useClerk } from '@clerk/react'
import {
  Activity, Plus, Search, Trash2, Pencil, Check, Calendar,
  ListChecks, FileText, X, Download, Upload, AlertCircle, Filter,
  Folder, Command, RotateCcw, CheckCircle2, Hash, Flame, Target, Copy,
  LogOut, BookOpen, BarChart3, ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const SignInPage = lazy(() => import('./pages/SignInPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const PROJECT_COLORS = [
  '#a1a1aa', '#f97316', '#3b82f6', '#a855f7',
  '#ec4899', '#14b8a6', '#eab308', '#ef4444'
]

const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#fb923c', bg: 'bg-orange-400/10', border: 'border-orange-400/30', text: 'text-orange-400' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'bg-amber-400/10', border: 'border-amber-400/30', text: 'text-amber-400' },
  low:    { label: 'Low',    color: '#4ade80', bg: 'bg-green-400/10',  border: 'border-green-400/30',  text: 'text-green-400' },
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

let _idN = 0
const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${++_idN}-${Math.random().toString(36).slice(2, 7)}`

const toLocalDateString = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fmtDate = (iso, time) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const now = new Date(); now.setHours(0,0,0,0)
  const diff = Math.round((d - now) / 86400000)
  let base
  if (diff === 0) base = 'Today'
  else if (diff === 1) base = 'Tomorrow'
  else if (diff === -1) base = 'Yesterday'
  else if (diff > 1 && diff <= 6) base = d.toLocaleDateString('en-US', { weekday: 'short' })
  else base = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return time ? `${base} ${time}` : base
}

const isOverdue = (iso, time) => {
  if (!iso) return false
  const d = new Date(iso + 'T00:00:00'); d.setHours(0,0,0,0)
  const now = new Date(); now.setHours(0,0,0,0)
  if (d < now) return true
  if (d > now) return false
  if (time) {
    const [h, m] = time.split(':').map(Number)
    const due = new Date(); due.setHours(h, m, 0, 0)
    return due < new Date()
  }
  return false
}

const parseNaturalDate = (text) => {
  const t = text.toLowerCase().trim()
  const now = new Date(); now.setHours(0,0,0,0)
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

  if (t.includes('today')) return toLocalDateString(now)
  if (t.includes('tomorrow')) { const d = new Date(now); d.setDate(d.getDate()+1); return toLocalDateString(d) }

  for (let i = 0; i < 7; i++) {
    if (t.includes(dayNames[i])) {
      const d = new Date(now)
      const diff = (i - d.getDay() + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      return toLocalDateString(d)
    }
  }

  if (t.includes('next week')) { const d = new Date(now); d.setDate(d.getDate()+7); return toLocalDateString(d) }
  if (t.includes('next month')) { const d = new Date(now); d.setMonth(d.getMonth()+1); return toLocalDateString(d) }

  const monthMatch = t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/)
  if (monthMatch) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const mi = months.indexOf(monthMatch[1].slice(0,3))
    const day = parseInt(monthMatch[2])
    if (mi >= 0 && day > 0 && day <= 31) {
      const d = new Date(now.getFullYear(), mi, day)
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return toLocalDateString(d)
    }
  }

  const slashMatch = t.match(/(\d{1,2})\/(\d{1,2})/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]) - 1
    const d2 = parseInt(slashMatch[2])
    if (m >= 0 && m < 12 && d2 > 0 && d2 <= 31) {
      const d = new Date(now.getFullYear(), m, d2)
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return toLocalDateString(d)
    }
  }

  return null
}

const parsePriority = (text) => {
  const t = text.toLowerCase().trim()
  if (/\bhigh\b/.test(t)) return 'high'
  if (/\bmed\b|\bmedium\b/.test(t)) return 'medium'
  if (/\blow\b/.test(t)) return 'low'
  return null
}

const parseTags = (text) => {
  const matches = text.match(/(?:^|\s)#([\w-]+)/g) || []
  return matches.map(m => m.trim().slice(1)).filter(Boolean)
}

const stripParsed = (text) => {
  return text
    .replace(/\b(high|medium|med|low)\b\s*$/i, '')
    .replace(/\b(today|tomorrow|next week|next month)\b/gi, '')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/gi, '')
    .replace(/\d{1,2}\/\d{1,2}/g, '')
    .replace(/#([\w-]+)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ═══════════════════════════════════════════════════════════════════
// PICKER COMPONENTS (custom, zero deps)
// ═══════════════════════════════════════════════════════════════════

function useClickOutside(ref, open, onClose) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, ref])
}

function PriorityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))
  const cfg = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.medium
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Priority: ${cfg.label}. Change priority`}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border transition-all ${cfg.bg} ${cfg.border} ${cfg.text}`}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
        {cfg.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div role="listbox" aria-label="Priority options" className="absolute left-0 z-40 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          {Object.entries(PRIORITY_CONFIG).map(([key, c]) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={value === key}
              onClick={() => { onChange(key); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-800/60 transition-colors ${value === key ? 'text-white' : 'text-zinc-400'}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const TIME_SLOTS = (() => {
  const slots = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
})()

function DateTimePicker({ date, time, onChange, onClear, compact }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const d = date ? new Date(date + 'T00:00:00') : new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const ref = useRef(null)
  useClickOutside(ref, open, () => setOpen(false))

  const toggleOpen = () => {
    if (!open) {
      const d = date ? new Date(date + 'T00:00:00') : new Date()
      setView({ y: d.getFullYear(), m: d.getMonth() })
    }
    setOpen(o => !o)
  }

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const todayStr = toLocalDateString(new Date())

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const shiftMonth = (delta) => {
    setView(v => {
      const next = new Date(v.y, v.m + delta, 1)
      return { y: next.getFullYear(), m: next.getMonth() }
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={date ? `Due ${fmtDate(date, time)}. Change date and time` : 'Set due date and time'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs border transition-all ${
          compact ? '' : 'bg-zinc-950/60 '
        }${date ? 'border-zinc-600 text-white bg-zinc-800/60' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'}`}
      >
        <Calendar size={12} />
        {date ? fmtDate(date, time) : 'No date'}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div role="dialog" aria-label="Pick due date and time" className="absolute left-0 z-40 mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-3">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[
              { label: 'Today', get: () => todayStr },
              { label: 'Tomorrow', get: () => { const d = new Date(); d.setDate(d.getDate() + 1); return toLocalDateString(d) } },
              { label: 'Next week', get: () => { const d = new Date(); d.setDate(d.getDate() + 7); return toLocalDateString(d) } },
            ].map(q => (
              <button
                key={q.label}
                type="button"
                onClick={() => { onChange(q.get(), time || undefined); }}
                className="px-2.5 py-1 rounded-lg text-[10px] bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
              >
                {q.label}
              </button>
            ))}
            {date && (
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false) }}
                className="px-2.5 py-1 rounded-lg text-[10px] bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 transition-all"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="p-1 rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-white font-medium">{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="p-1 rounded-lg hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="text-[9px] text-zinc-400 text-center py-1">{d}</span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />
              const ds = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const selected = date === ds
              const isToday = ds === todayStr
              return (
                <button
                  key={ds}
                  type="button"
                  aria-label={ds}
                  aria-pressed={selected}
                  onClick={() => onChange(ds, time || undefined)}
                  className={`h-7 rounded-lg text-[11px] transition-all ${
                    selected ? 'bg-white text-zinc-950 font-semibold' :
                    isToday ? 'bg-zinc-800 text-white' :
                    'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="border-t border-zinc-800 pt-2">
            <label className="text-[9px] text-zinc-400 uppercase tracking-wider block mb-1" htmlFor="due-time-select">Time (optional)</label>
            <select
              id="due-time-select"
              value={time || ''}
              onChange={(e) => onChange(date || todayStr, e.target.value || null)}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-zinc-600 [color-scheme:dark]"
            >
              <option value="">No time</option>
              {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT (Authenticated)
// ═══════════════════════════════════════════════════════════════════

function AppContent() {
  const { user } = useUser()
  const clerk = useClerk()

  // ─── Convex Data ───────────────────────────────────────
  const convexTasks = useQuery(api.tasks.list)
  const convexProjects = useQuery(api.projects.list)
  const createTask = useMutation(api.tasks.create)
  const updateTask = useMutation(api.tasks.update)
  const removeTask = useMutation(api.tasks.remove)
  const createProject = useMutation(api.projects.create)
  const removeProject = useMutation(api.projects.remove)
  const syncUser = useMutation(api.users.syncUser)
  const seedProjects = useMutation(api.seed.seedDefaultProjects)

  // ─── Sync Clerk user to Convex on mount ────────────────
  useEffect(() => {
    if (user) {
      syncUser().then(() => seedProjects()).catch(console.error)
    }
  }, [user, syncUser, seedProjects])

  // ─── Loading timeout ────────────────────────────────────
  const [timedOut, setTimedOut] = useState(false)
  const dataReady = convexTasks !== undefined && convexProjects !== undefined
  useEffect(() => {
    if (dataReady) return
    const timer = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(timer)
  }, [dataReady, convexTasks, convexProjects])
  const loadTimeout = timedOut && !dataReady

  // ─── Local state ───────────────────────────────────────
  const dataLoading = (convexTasks === undefined || convexProjects === undefined) && !loadTimeout
  const tasks = useMemo(() => convexTasks ?? [], [convexTasks])
  const projects = useMemo(() => convexProjects ?? [], [convexProjects])

  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState(null)
  const [filterPriority, setFilterPriority] = useState(null)
  const [filterStatus, setFilterStatus] = useState('active')
  const [detailTaskId, setDetailTaskId] = useState(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [toast, setToast] = useState(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [pomodoroTaskId, setPomodoroTaskId] = useState(null)
  const [newPriority, setNewPriority] = useState('medium')
  const [newDueDate, setNewDueDate] = useState(null)
  const [newDueTime, setNewDueTime] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [activeView, setActiveView] = useState('tasks') // tasks | dashboard | journal | shared
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const inputRef = useRef(null)
  const searchRef = useRef(null)
  const editInputRef = useRef(null)
  const toastTimerRef = useRef(null)
  const pendingRef = useRef(new Set())
  const pendingAtRef = useRef({})

  // ─── Derived State ─────────────────────────────────────
  const detailTask = useMemo(() =>
    detailTaskId ? tasks.find(t => t._id === detailTaskId) : null
  , [detailTaskId, tasks])

  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (activeProject) result = result.filter(t => t.projectId === activeProject)
    if (filterPriority) result = result.filter(t => t.priority === filterPriority)
    if (filterStatus === 'active') result = result.filter(t => !t.done)
    else if (filterStatus === 'done') result = result.filter(t => t.done)
    else if (filterStatus === 'overdue') result = result.filter(t => !t.done && isOverdue(t.dueDate, t.dueTime))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.text.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      )
    }
    return result.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      const pOrder = { high: 0, medium: 1, low: 2 }
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority]
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || (a.dueTime || '').localeCompare(b.dueTime || '')
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return (b._creationTime ?? 0) - (a._creationTime ?? 0)
    })
  }, [tasks, activeProject, filterPriority, filterStatus, search])

  const stats = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0)
    const active = tasks.filter(t => !t.done)
    const completed = tasks.filter(t => t.done)
    const overdue = active.filter(t => isOverdue(t.dueDate, t.dueTime))
    const doneToday = completed.filter(t => {
      if (!t.completedAt) return false
      const d = new Date(t.completedAt); d.setHours(0,0,0,0)
      return d.getTime() === now.getTime()
    })
    const doneDates = new Set()
    for (const t of tasks) {
      if (t.done && t.completedAt) {
        const td = new Date(t.completedAt); td.setHours(0,0,0,0)
        doneDates.add(toLocalDateString(td))
      }
    }
    let streak = 0
    const d = new Date(now)
    for (let i = 0; i < 365; i++) {
      const hasDone = doneDates.has(toLocalDateString(d))
      if (hasDone || i === 0) {
        if (hasDone) streak++
        d.setDate(d.getDate() - 1)
      } else break
    }
    return {
      active: active.length,
      completed: completed.length,
      overdue: overdue.length,
      doneToday: doneToday.length,
      streak,
      total: tasks.length,
    }
  }, [tasks])

  // ─── Toast ─────────────────────────────────────────────
  const showToast = useCallback((message, opts = {}) => {
    setToast({ message, actionLabel: opts.actionLabel, onAction: opts.onAction, isError: !!opts.isError })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const duration = opts.duration ?? (opts.onAction ? 5000 : opts.isError ? 4000 : 2000)
    toastTimerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const allTags = useMemo(() => {
    const set = new Set()
    for (const t of tasks) for (const tag of t.tags) set.add(tag)
    return [...set].sort().slice(0, 16)
  }, [tasks])

  // ─── Task Handlers ─────────────────────────────────────
  const addTask = useCallback(async () => {
    if (!input.trim()) return
    const pendKey = 'add-task'
    if (pendingRef.current.has(pendKey)) {
      const startedAt = pendingAtRef.current[pendKey] || 0
      if (Date.now() - startedAt < 8000) return
      pendingRef.current.delete(pendKey)
    }
    pendingRef.current.add(pendKey)
    pendingAtRef.current[pendKey] = Date.now()
    try {
      const nlpDate = parseNaturalDate(input)
      const priority = parsePriority(input) || newPriority
      const tags = parseTags(input)
      const text = stripParsed(input) || input.trim()
      await createTask({
        text,
        projectId: activeProject || undefined,
        priority,
        dueDate: newDueDate ?? nlpDate ?? undefined,
        dueTime: newDueTime ?? undefined,
        tags,
      })
      setInput('')
      setNewDueDate(null)
      setNewDueTime(null)
      showToast('Task created')
    } catch (err) {
      console.error('Failed to create task', err)
      const detail = err?.message ? `: ${String(err.message).slice(0, 120)}` : ''
      showToast(`Failed to create task${detail}`, { isError: true })
    } finally {
      pendingRef.current.delete(pendKey)
      delete pendingAtRef.current[pendKey]
    }
  }, [input, newPriority, newDueDate, newDueTime, activeProject, createTask, showToast])

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t._id === id)
    if (!task) return
    try {
      await updateTask({ id, done: !task.done })
    } catch {
      showToast('Failed to update task')
    }
  }, [tasks, updateTask, showToast])

  const deleteTask = useCallback(async (id) => {
    if (pendingRef.current.has('del-task-' + id)) return
    const task = tasks.find(t => t._id === id)
    if (!task) return
    pendingRef.current.add('del-task-' + id)
    try {
      await removeTask({ id })
      if (detailTaskId === id) setDetailTaskId(null)
      showToast('Task deleted', {
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await createTask({
              text: task.text,
              projectId: task.projectId,
              priority: task.priority,
              dueDate: task.dueDate ?? undefined,
              dueTime: task.dueTime ?? undefined,
              tags: task.tags,
              subtasks: task.subtasks.length ? task.subtasks : undefined,
              notes: task.notes || undefined,
            })
            showToast('Task restored')
          } catch {
            showToast('Failed to restore task')
          }
        },
      })
    } catch {
      showToast('Failed to delete task')
    } finally {
      pendingRef.current.delete('del-task-' + id)
    }
  }, [tasks, detailTaskId, removeTask, createTask, showToast])

  const updateTaskField = useCallback(async (id, updates) => {
    try {
      await updateTask({ id, ...updates })
    } catch {
      showToast('Failed to update task')
    }
  }, [updateTask, showToast])

  const startInlineEdit = useCallback((task) => {
    setEditingTaskId(task._id)
    setEditingText(task.text)
  }, [])

  const saveInlineEdit = useCallback(async () => {
    if (!editingTaskId || !editingText.trim()) {
      setEditingTaskId(null)
      setEditingText('')
      return
    }
    if (pendingRef.current.has('edit-' + editingTaskId)) return
    pendingRef.current.add('edit-' + editingTaskId)
    try {
      await updateTask({ id: editingTaskId, text: editingText.trim() })
    } catch {
      showToast('Failed to save task')
    } finally {
      pendingRef.current.delete('edit-' + editingTaskId)
      setEditingTaskId(null)
      setEditingText('')
    }
  }, [editingTaskId, editingText, updateTask, showToast])

  // ─── Subtask Handlers ──────────────────────────────────
  const addSubtask = useCallback(async (taskId, text) => {
    if (!text.trim()) return
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    try {
      await updateTask({
        id: taskId,
        subtasks: [...task.subtasks, { id: uid('sts'), text: text.trim(), done: false }],
      })
    } catch {
      showToast('Failed to add subtask')
    }
  }, [tasks, updateTask, showToast])

  const toggleSubtask = useCallback(async (taskId, subId) => {
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    try {
      await updateTask({
        id: taskId,
        subtasks: task.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s),
      })
    } catch {
      showToast('Failed to update subtask')
    }
  }, [tasks, updateTask, showToast])

  const deleteSubtask = useCallback(async (taskId, subId) => {
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    try {
      await updateTask({
        id: taskId,
        subtasks: task.subtasks.filter(s => s.id !== subId),
      })
    } catch {
      showToast('Failed to delete subtask')
    }
  }, [tasks, updateTask, showToast])

  // ─── Project Handlers ──────────────────────────────────
  const addProject = useCallback(async () => {
    if (!newProjectName.trim() || pendingRef.current.has('add-project')) return
    pendingRef.current.add('add-project')
    try {
      await createProject({
        name: newProjectName.trim(),
        color: newProjectColor,
      })
      setNewProjectName('')
      setShowAddProject(false)
      showToast('Project created')
    } catch {
      showToast('Failed to create project')
    } finally {
      pendingRef.current.delete('add-project')
    }
  }, [newProjectName, newProjectColor, createProject, showToast])

  const deleteProject = useCallback(async (id) => {
    if (pendingRef.current.has('del-project-' + id)) return
    const project = projects.find(p => p._id === id)
    if (!project) return
    const linkedTasks = tasks.filter(t => t.projectId === id)
    pendingRef.current.add('del-project-' + id)
    try {
      await removeProject({ id })
      if (activeProject === id) setActiveProject(null)
      showToast('Project deleted', {
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            const newId = await createProject({ name: project.name, color: project.color, icon: project.icon })
            await Promise.all(linkedTasks.map(t => updateTask({ id: t._id, projectId: newId })))
            showToast('Project restored')
          } catch {
            showToast('Failed to restore project')
          }
        },
      })
    } catch {
      showToast('Failed to delete project')
    } finally {
      pendingRef.current.delete('del-project-' + id)
    }
  }, [projects, tasks, activeProject, removeProject, createProject, updateTask, showToast])

  // ─── Export / Import ───────────────────────────────────
  const handleExport = useCallback(() => {
    const exportData = { tasks, projects }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `devflow-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
    setShowExportModal(false)
    showToast('Exported successfully')
  }, [tasks, projects, showToast])

  const handleImport = useCallback(async () => {
    if (pendingRef.current.has('import')) return
    pendingRef.current.add('import')
    try {
      const parsed = JSON.parse(importText)
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        showToast('Invalid data format')
        return
      }
      for (const t of parsed.tasks) {
        await createTask({
          text: t.text,
          projectId: t.projectId,
          priority: t.priority ?? 'medium',
          dueDate: t.dueDate ?? undefined,
          dueTime: t.dueTime ?? undefined,
          tags: t.tags ?? [],
          subtasks: Array.isArray(t.subtasks) && t.subtasks.length ? t.subtasks : undefined,
          notes: t.notes ?? undefined,
        })
      }
      setShowImportModal(false)
      setImportText('')
      showToast('Imported successfully')
    } catch (e) {
      showToast(e instanceof SyntaxError ? 'Invalid JSON' : 'Import failed')
    } finally {
      pendingRef.current.delete('import')
    }
  }, [importText, createTask, showToast])

  const handleCopyJSON = useCallback(() => {
    try {
      navigator.clipboard.writeText(JSON.stringify({ tasks, projects }, null, 2))
      showToast('Copied to clipboard')
    } catch {
      showToast('Failed to copy')
    }
  }, [tasks, projects, showToast])

  const handleSignOut = useCallback(async () => {
    try {
      await clerk.signOut({ redirectUrl: '/' })
    } catch {
      showToast('Sign out failed')
    }
  }, [clerk, showToast])

  // ─── Pomodoro ──────────────────────────────────────────
  const startPomodoro = useCallback((taskId) => {
    setPomodoroTaskId(taskId)
    setPomodoroActive(true)
    showToast('Pomodoro started — 25 min')
  }, [showToast])

  const stopPomodoro = useCallback(() => {
    setPomodoroActive(false)
    setPomodoroTaskId(null)
  }, [])

  const completePomodoro = useCallback(async () => {
    setPomodoroActive(false)
    const taskId = pomodoroTaskId
    setPomodoroTaskId(null)
    if (taskId) {
      try {
        await updateTask({ id: taskId, done: true })
        showToast('Pomodoro complete — task done')
      } catch {
        showToast('Failed to complete task')
      }
    }
  }, [pomodoroTaskId, updateTask, showToast])

  // ─── Keyboard Shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setShowCommandPalette(p => !p)
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false)
        setDetailTaskId(null)
        setShowAddProject(false)
        setShowExportModal(false)
        setShowImportModal(false)
        setShowProfileMenu(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (detailTaskId && editInputRef.current) editInputRef.current.focus()
  }, [detailTaskId])

  // ─── Command Palette ───────────────────────────────────
  const COMMAND_ITEMS = [
    { id: 'add', label: 'Add new task', icon: Plus },
    { id: 'search', label: 'Search tasks', icon: Search },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'all', label: 'Show all tasks', icon: Filter },
    { id: 'overdue', label: 'Show overdue', icon: AlertCircle },
    { id: 'completed', label: 'Show completed', icon: CheckCircle2 },
    { id: 'pomodoro', label: 'Start Pomodoro', icon: Flame },
    { id: 'project', label: 'Add project', icon: Folder },
    { id: 'export', label: 'Export data', icon: Download },
    { id: 'signout', label: 'Sign out', icon: LogOut },
  ]

  const handleCommandAction = useCallback((id) => {
    setShowCommandPalette(false)
    switch (id) {
      case 'add': inputRef.current?.focus(); break
      case 'search': searchRef.current?.focus(); break
      case 'dashboard': setActiveView('dashboard'); break
      case 'journal': setActiveView('journal'); break
      case 'all': setActiveProject(null); setFilterPriority(null); setFilterStatus('active'); setActiveView('tasks'); break
      case 'overdue': setFilterStatus('overdue'); setFilterPriority(null); setActiveView('tasks'); break
      case 'completed': setFilterStatus('done'); setActiveView('tasks'); break
      case 'pomodoro': startPomodoro(detailTaskId || null); break
      case 'project': setShowAddProject(true); break
      case 'export': setShowExportModal(true); break
      case 'signout': handleSignOut(); break
      default: break
    }
  }, [detailTaskId, startPomodoro, handleSignOut])

  // ─── Loading state ─────────────────────────────────────
  if (dataLoading || loadTimeout) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)] animate-pulse">
            <Activity size={18} className="text-zinc-300" strokeWidth={1.5} />
          </div>
          {loadTimeout ? (
            <>
              <p className="text-sm text-zinc-400">Taking longer than expected...</p>
              <p className="text-xs text-zinc-400">Check your connection and try again</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 transition-colors"
              >
                Retry
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Loading DevFlow...</p>
          )}
        </motion.div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-white/20 font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-white/[0.012] blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-3xl md:max-w-5xl lg:max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {/* ── Header ──────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 26 }}
          className="mb-8 sm:mb-10"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)]">
                <Activity size={16} className="text-zinc-300" strokeWidth={1.5} />
              </div>
              <h1 className="text-lg font-medium tracking-tight">DevFlow</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* View tabs */}
              <div className="hidden sm:flex items-center gap-1 mr-2">
                {[
                  { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
                  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                  { id: 'journal', label: 'Journal', icon: BookOpen },
                ].map(v => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={activeView === v.id}
                    onClick={() => setActiveView(v.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all border ${
                      activeView === v.id
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'border-transparent text-zinc-400 hover:text-white'
                    }`}
                  >
                    <v.icon size={12} />
                    {v.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCommandPalette(true)}
                aria-label="Open command palette"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-xs hover:text-zinc-300 hover:border-zinc-700 transition-all"
              >
                <Command size={12} />
                <span className="hidden sm:inline">Commands</span>
                <kbd className="hidden sm:inline text-[10px] bg-zinc-800/80 px-1.5 py-0.5 rounded-md border border-zinc-700">⌘K</kbd>
              </button>
              {user && (
                <div className="relative ml-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileMenu(v => !v)}
                    aria-label="Open profile menu"
                    aria-expanded={showProfileMenu}
                    aria-haspopup="menu"
                    className="flex items-center gap-2 p-1 rounded-xl hover:bg-zinc-800/60 transition-all"
                  >
                    {user.imageUrl && (
                      <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full border border-zinc-800" />
                    )}
                  </button>
                  {showProfileMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                        className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-zinc-800">
                          {user.fullName && (
                            <p className="text-sm font-medium text-white">{user.fullName}</p>
                          )}
                          {user.primaryEmailAddress?.emailAddress && (
                            <p className="text-xs text-zinc-400 truncate">{user.primaryEmailAddress.emailAddress}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowProfileMenu(false); handleSignOut() }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-all"
                        >
                          <LogOut size={14} />
                          Sign out
                        </button>
                      </motion.div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-400 uppercase tracking-[0.3em] mt-1">
            {activeView === 'tasks' && 'Task management for developers'}
            {activeView === 'dashboard' && 'Analytics & insights'}
            {activeView === 'journal' && 'Daily reflections'}
          </p>
        </motion.header>

        {/* ════════════════════════════════════════════════════
            TASKS VIEW
            ════════════════════════════════════════════════════ */}
        {activeView === 'tasks' && (
          <>
            {/* Stats Bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 24 }}
              className="grid grid-cols-4 gap-2 sm:gap-3 mb-6"
            >
              {[
                { label: 'Active', value: stats.active, icon: Target, color: 'text-zinc-300' },
                { label: 'Done', value: stats.doneToday, icon: CheckCircle2, color: 'text-green-400' },
                { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: stats.overdue > 0 ? 'text-red-400' : 'text-zinc-400' },
                { label: 'Streak', value: `${stats.streak}d`, icon: Flame, color: 'text-amber-400' },
              ].map((s) => (
                <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={12} className="text-zinc-400" strokeWidth={1.5} />
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
                  </div>
                  <span className={`text-xl font-semibold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </motion.div>

            {/* Project Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 24 }}
              className="mb-4"
            >
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  aria-pressed={!activeProject}
                  onClick={() => setActiveProject(null)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    !activeProject
                      ? 'bg-white text-zinc-950 border-white shadow-[0_0_20px_-4px_rgba(255,255,255,0.3)]'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  All
                </button>
                {[...projects].sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(p => (
                  <div
                    key={p._id}
                    className={`flex-shrink-0 flex items-center rounded-xl text-xs font-medium transition-all border ${
                      activeProject === p._id
                        ? 'border-zinc-600 text-white'
                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                    style={activeProject === p._id ? { backgroundColor: p.color + '22', borderColor: p.color + '44' } : {}}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveProject(activeProject === p._id ? null : p._id)}
                      aria-pressed={activeProject === p._id}
                      className="flex items-center gap-1.5 px-3 py-1.5"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                    {activeProject === p._id && (
                      <button
                        type="button"
                        onClick={() => deleteProject(p._id)}
                        aria-label={`Delete project ${p.name}`}
                        className="pr-2 hover:text-white transition-colors"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddProject(true)}
                  aria-label="Add project"
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-zinc-400 border border-dashed border-zinc-800 hover:border-zinc-700 hover:text-white transition-all"
                >
                  <Plus size={12} />
                </button>
              </div>
            </motion.div>

            {/* Add Project Inline */}
            <AnimatePresence>
              {showAddProject && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Folder size={14} className="text-zinc-400" />
                      <span className="text-xs text-zinc-400 uppercase tracking-wider">New Project</span>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addProject()}
                        placeholder="Project name..."
                        className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-zinc-600 transition-colors"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Color</span>
                      <div className="flex gap-1.5">
                        {PROJECT_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Color ${c}`}
                            aria-pressed={newProjectColor === c}
                            onClick={() => setNewProjectColor(c)}
                            className={`w-5 h-5 rounded-full transition-all ${newProjectColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={addProject} className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors">Create</button>
                      <button type="button" onClick={() => { setShowAddProject(false); setNewProjectName('') }} className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/60 text-xs text-zinc-400 hover:text-zinc-300 transition-colors">Cancel</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search & Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 280, damping: 24 }}
              className="mb-4 space-y-2"
            >
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder='Search tasks... ( / )'
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-zinc-700 transition-all backdrop-blur-sm"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'active', label: 'Active' },
                  { id: 'done', label: 'Completed' },
                  { id: 'all', label: 'All' },
                  { id: 'overdue', label: 'Overdue' },
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={filterStatus === s.id}
                    onClick={() => setFilterStatus(s.id)}
                    className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs transition-all border ${
                      filterStatus === s.id
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="w-px h-3 bg-zinc-800 flex-shrink-0" />
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filterPriority === key}
                    onClick={() => setFilterPriority(filterPriority === key ? null : key)}
                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all border ${
                      filterPriority === key
                        ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                        : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_CONFIG[key].color }} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Quick Add */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 280, damping: 24 }}
              className="mb-6"
            >
              <form
                onSubmit={(e) => { e.preventDefault(); addTask() }}
                className="relative group"
              >
                <div className="relative flex items-center bg-zinc-900/60 border border-zinc-800 rounded-3xl backdrop-blur-sm overflow-hidden group-focus-within:border-zinc-700 transition-colors">
                  <Plus size={16} className="ml-4 text-zinc-400 flex-shrink-0 group-focus-within:text-zinc-400 transition-colors" />
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Add a task... ( #tag tomorrow high )"
                    aria-label="Add a task"
                    className="flex-1 bg-transparent px-3 py-3.5 text-sm text-white placeholder:text-zinc-400 outline-none"
                  />
                  {input && (
                    <button type="submit" className="mr-2 px-3 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors">
                      Add
                    </button>
                  )}
                </div>
                {input && (
                  <div className="flex items-center gap-2 mt-2 px-1 flex-wrap">
                    <PriorityDropdown value={newPriority} onChange={setNewPriority} />
                    <DateTimePicker
                      compact
                      date={newDueDate}
                      time={newDueTime}
                      onChange={(d, t) => { setNewDueDate(d); setNewDueTime(t ?? null) }}
                      onClear={() => { setNewDueDate(null); setNewDueTime(null) }}
                    />
                    {!newDueDate && parseNaturalDate(input) && (
                      <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <Calendar size={10} />
                        {fmtDate(parseNaturalDate(input))}
                      </span>
                    )}
                  </div>
                )}
              </form>
              <div className="flex items-center gap-3 mt-2 px-1 flex-wrap">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Tips:</span>
                <span className="text-[10px] text-zinc-400">#tag</span>
                <span className="text-[10px] text-zinc-400">tomorrow / monday / sep 25</span>
                <span className="text-[10px] text-zinc-400">high / medium / low</span>
              </div>
              {allTags.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 px-1 flex-wrap">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Tags:</span>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setInput(prev => `${prev.replace(/\s*$/, '')} #${tag} `)}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] text-zinc-400 bg-zinc-800/40 border border-zinc-700/40 hover:border-zinc-600 hover:text-white transition-all"
                    >
                      <Hash size={8} /> {tag}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Task List */}
            <motion.div layout className="space-y-2">
              <LayoutGroup>
                <AnimatePresence mode="popLayout">
                  {filteredTasks.length === 0 && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-16"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center">
                        <Target size={24} className="text-zinc-400" />
                      </div>
                      <p className="text-zinc-400 text-sm mb-1">
                        {filterStatus === 'done' ? 'No completed tasks yet' :
                         filterStatus === 'overdue' ? 'Nothing overdue' : 'No tasks found'}
                      </p>
                      <p className="text-zinc-400 text-xs">
                        {filterStatus === 'done' ? 'Complete some tasks to see them here' :
                         filterStatus === 'overdue' ? 'You\'re all caught up' : 'Add a task above or adjust your filters'}
                      </p>
                    </motion.div>
                  )}

                  {filteredTasks.map(task => (
                    <motion.div
                      key={task._id}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -30, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    >
                      <TaskItem
                        task={task}
                        projects={projects}
                        isEditing={editingTaskId === task._id}
                        editingText={editingText}
                        onToggle={() => toggleTask(task._id)}
                        onDelete={() => deleteTask(task._id)}
                        onEdit={() => startInlineEdit(task)}
                        onEditChange={setEditingText}
                        onEditSave={saveInlineEdit}
                        onEditCancel={() => { setEditingTaskId(null); setEditingText('') }}
                        onDetail={() => setDetailTaskId(task._id)}
                        onStartPomodoro={() => startPomodoro(task._id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </LayoutGroup>
            </motion.div>
          </>
        )}

        {/* ════════════════════════════════════════════════════
            DASHBOARD VIEW
            ════════════════════════════════════════════════════ */}
        {activeView === 'dashboard' && <DashboardView stats={stats} tasks={tasks} />}

        {/* ════════════════════════════════════════════════════
            JOURNAL VIEW
            ════════════════════════════════════════════════════ */}
        {activeView === 'journal' && <JournalView tasks={tasks} />}

        {/* ── Footer ──────────────────────────────────────── */}
        {activeView === 'tasks' && (
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 pt-6 border-t border-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <Download size={12} /> Export
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <Upload size={12} /> Import
                </button>
                <button
                  type="button"
                  onClick={handleCopyJSON}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">DevFlow v2</span>
            </div>
          </motion.footer>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════
          TASK DETAIL MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {detailTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setDetailTaskId(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Task details"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-lg bg-zinc-900/95 border border-zinc-800 rounded-3xl shadow-2xl backdrop-blur-xl max-h-[85vh] overflow-y-auto overflow-x-visible"
            >
              <div className="flex items-center justify-between p-5 pb-0">
                <span className="text-[10px] text-zinc-400 uppercase tracking-[0.3em]">Task Details</span>
                <button type="button" onClick={() => setDetailTaskId(null)} aria-label="Close task details" className="p-1.5 rounded-xl hover:bg-zinc-800/60 transition-colors">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>

              <div className="px-5 pt-4">
                {editingTaskId === detailTask._id ? (
                  <input
                    ref={editInputRef}
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onBlur={saveInlineEdit}
                    onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') { setEditingTaskId(null); setEditingText('') } }}
                    className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-zinc-600"
                  />
                ) : (
                  <h2
                    className={`text-base font-medium text-white leading-snug cursor-pointer hover:text-zinc-300 transition-colors ${detailTask.done ? 'line-through text-zinc-400' : ''}`}
                    onClick={() => startInlineEdit(detailTask)}
                  >
                    {detailTask.text}
                  </h2>
                )}
              </div>

              {/* Priority */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 block">Priority</label>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={detailTask.priority === key}
                      onClick={() => updateTaskField(detailTask._id, { priority: key })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all border ${
                        detailTask.priority === key
                          ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                          : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 block">Project</label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(p => (
                    <button
                      key={p._id}
                      type="button"
                      aria-pressed={detailTask.projectId === p._id}
                      onClick={() => updateTaskField(detailTask._id, { projectId: p._id })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all border ${
                        detailTask.projectId === p._id
                          ? 'border-zinc-600 text-white'
                          : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                      }`}
                      style={detailTask.projectId === p._id ? { backgroundColor: p.color + '22', borderColor: p.color + '44' } : {}}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 block">Due Date</label>
                <DateTimePicker
                  date={detailTask.dueDate || null}
                  time={detailTask.dueTime || null}
                  onChange={(d, t) => updateTaskField(detailTask._id, { dueDate: d, dueTime: t ?? null })}
                  onClear={() => updateTaskField(detailTask._id, { dueDate: null, dueTime: null })}
                />
                {detailTask.dueDate && !detailTask.done && isOverdue(detailTask.dueDate, detailTask.dueTime) && (
                  <span className="ml-2 text-xs text-red-400">Overdue</span>
                )}
              </div>

              {/* Tags */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {detailTask.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400">
                      <Hash size={10} />
                      {tag}
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        onClick={() => updateTaskField(detailTask._id, { tags: detailTask.tags.filter(t => t !== tag) })}
                        className="text-zinc-400 hover:text-white ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <AddTagInline currentTags={detailTask.tags} onAdd={(tag) => updateTaskField(detailTask._id, { tags: [...detailTask.tags, tag] })} />
                </div>
              </div>

              {/* Subtasks */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 block">
                  Subtasks {detailTask.subtasks.length > 0 && (
                    <span className="text-zinc-400 normal-case">
                      {detailTask.subtasks.filter(s => s.done).length}/{detailTask.subtasks.length}
                    </span>
                  )}
                </label>
                <div className="space-y-1.5">
                  {detailTask.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 group">
                      <button
                        type="button"
                        aria-label={sub.done ? `Reopen subtask ${sub.text}` : `Complete subtask ${sub.text}`}
                        aria-pressed={sub.done}
                        onClick={() => toggleSubtask(detailTask._id, sub.id)}
                        className={`w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                          sub.done
                            ? 'bg-white/20 border-white/30'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        {sub.done && <Check size={10} className="text-white" />}
                      </button>
                      <span className={`text-sm flex-1 ${sub.done ? 'text-zinc-400 line-through' : 'text-zinc-300'}`}>
                        {sub.text}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete subtask ${sub.text}`}
                        onClick={() => deleteSubtask(detailTask._id, sub.id)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-zinc-400 hover:text-red-400 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <AddSubtaskInline onAdd={(text) => addSubtask(detailTask._id, text)} />
                </div>
              </div>

              {/* Notes */}
              <div className="px-5 pt-4 pb-5">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2 block" htmlFor="task-notes">Notes</label>
                <textarea
                  id="task-notes"
                  defaultValue={detailTask.notes || ''}
                  key={`notes-${detailTask._id}-${detailTask._creationTime}`}
                  onBlur={e => {
                    const v = e.target.value
                    if (v !== (detailTask.notes || '')) updateTaskField(detailTask._id, { notes: v })
                  }}
                  placeholder="Add notes, code snippets, links..."
                  rows={4}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-400 outline-none focus:border-zinc-600 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { toggleTask(detailTask._id); setDetailTaskId(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    detailTask.done
                      ? 'bg-zinc-800/60 border border-zinc-700 text-zinc-300'
                      : 'bg-white text-zinc-950 shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)]'
                  }`}
                >
                  {detailTask.done ? <RotateCcw size={14} /> : <Check size={14} />}
                  {detailTask.done ? 'Undo' : 'Complete'}
                </button>
                <button
                  type="button"
                  onClick={() => { startPomodoro(detailTask._id); setDetailTaskId(null) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-orange-400/10 border border-orange-400/30 text-orange-400 hover:bg-orange-400/20 transition-all"
                >
                  <Flame size={14} /> Focus
                </button>
                <button
                  type="button"
                  onClick={() => deleteTask(detailTask._id)}
                  aria-label="Delete task"
                  className="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          COMMAND PALETTE
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] p-4"
            onClick={() => setShowCommandPalette(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Command size={14} />
                  <span className="text-sm">Command palette</span>
                  <kbd className="ml-auto text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-700">ESC</kbd>
                </div>
              </div>
              <div className="p-2">
                {COMMAND_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCommandAction(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all text-left"
                  >
                    <item.icon size={14} className="text-zinc-400" />
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          EXPORT MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowExportModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Export data"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-sm bg-zinc-900/95 border border-zinc-800 rounded-3xl shadow-2xl backdrop-blur-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-zinc-400 uppercase tracking-[0.3em]">Export Data</span>
                <button type="button" onClick={() => setShowExportModal(false)} aria-label="Close export dialog" className="p-1 rounded-xl hover:bg-zinc-800/60 transition-colors">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-5">Download your tasks and projects as a JSON file.</p>
              <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-white text-zinc-950 shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)]"
              >
                <Download size={14} /> Download JSON
              </button>
              <button type="button" onClick={handleCopyJSON} aria-label="Copy JSON to clipboard" className="flex items-center justify-center px-4 py-2.5 rounded-xl text-sm bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:text-white transition-all">
                  <Copy size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          IMPORT MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowImportModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Import data"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-3xl shadow-2xl backdrop-blur-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-zinc-400 uppercase tracking-[0.3em]">Import Data</span>
                <button type="button" onClick={() => setShowImportModal(false)} aria-label="Close import dialog" className="p-1 rounded-xl hover:bg-zinc-800/60 transition-colors">
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-3">Paste your JSON backup to restore tasks and projects.</p>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='{"tasks":[...],"projects":[...]}'
                aria-label="JSON backup to import"
                rows={6}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-400 outline-none focus:border-zinc-600 resize-none font-mono mb-4"
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={!importText.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-white text-zinc-950 shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          POMODORO FLOATING ORB
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {pomodoroActive && (
          <PomodoroOrb
            key={pomodoroTaskId || 'no-task'}
            taskText={pomodoroTaskId ? (tasks.find(t => t._id === pomodoroTaskId)?.text || 'Unnamed task') : null}
            onStop={stopPomodoro}
            onComplete={completePomodoro}
          />
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          TOAST
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div role={toast.isError ? 'alert' : 'status'} className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900/95 border rounded-2xl shadow-2xl backdrop-blur-xl ${toast.isError ? 'border-red-400/40' : 'border-zinc-800'}`}>
              {toast.isError
                ? <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                : <Check size={14} className="text-white/80" />}
              <span className="text-sm text-zinc-300">{toast.message}</span>
              {toast.onAction && (
                <button
                  type="button"
                  onClick={() => { const fn = toast.onAction; setToast(null); fn() }}
                  className="ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                >
                  {toast.actionLabel || 'Undo'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// POMODORO ORB (isolated re-render: only this ticks each second)
// ═══════════════════════════════════════════════════════════════════

function PomodoroOrb({ taskText, onStop, onComplete }) {
  const [time, setTime] = useState(25 * 60)
  const doneRef = useRef(false)

  useEffect(() => {
    const iv = setInterval(() => setTime(t => (t <= 1 ? 0 : t - 1)), 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (time <= 0 && !doneRef.current) {
      doneRef.current = true
      onComplete()
    }
  }, [time, onComplete])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="fixed bottom-6 right-6 z-40"
    >
      <div className="bg-zinc-900/95 border border-orange-400/30 rounded-3xl p-4 shadow-2xl backdrop-blur-xl min-w-[180px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs text-orange-400 font-medium">Focus Mode</span>
          </div>
          <button type="button" onClick={onStop} aria-label="Stop Pomodoro" className="text-zinc-400 hover:text-white transition-colors">
            <X size={12} />
          </button>
        </div>
        <div className="text-2xl font-mono text-white text-center my-2" role="timer">
          {Math.floor(time / 60).toString().padStart(2, '0')}:{(time % 60).toString().padStart(2, '0')}
        </div>
        {taskText && (
          <p className="text-[10px] text-zinc-400 text-center truncate">{taskText}</p>
        )}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════

function DashboardView({ stats, tasks }) {
  const weeklyData = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0)
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const dateStr = toLocalDateString(d)
      const count = tasks.filter(t => {
        if (!t.done || !t.completedAt) return false
        const td = new Date(t.completedAt); td.setHours(0,0,0,0)
        return toLocalDateString(td) === dateStr
      }).length
      days.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), count, date: dateStr })
    }
    return days
  }, [tasks])

  const maxWeekly = Math.max(...weeklyData.map(d => d.count), 1)

  const monthlyData = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0)
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const dateStr = toLocalDateString(d)
      const count = tasks.filter(t => {
        if (!t.done || !t.completedAt) return false
        const td = new Date(t.completedAt); td.setHours(0,0,0,0)
        return toLocalDateString(td) === dateStr
      }).length
      days.push({ date: dateStr, count })
    }
    return days
  }, [tasks])

  const byPriority = useMemo(() => {
    const active = tasks.filter(t => !t.done)
    return {
      high: active.filter(t => t.priority === 'high').length,
      medium: active.filter(t => t.priority === 'medium').length,
      low: active.filter(t => t.priority === 'low').length,
    }
  }, [tasks])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="space-y-4"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Active', value: stats.active, color: 'text-zinc-300' },
          { label: 'Completed', value: stats.completed, color: 'text-green-400' },
          { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-400' : 'text-zinc-400' },
          { label: 'Streak', value: `${stats.streak} days`, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-4">This Week</p>
        <div className="flex items-end gap-2 h-32">
          {weeklyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-zinc-800 rounded-lg relative" style={{ height: `${Math.max((d.count / maxWeekly) * 100, 4)}%` }}>
                <div
                  className="absolute inset-0 bg-white/20 rounded-lg"
                  style={{ height: `${(d.count / maxWeekly) * 100}%`, bottom: 0, top: 'auto' }}
                />
              </div>
          <span className="text-[10px] text-zinc-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Heatmap */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-4">Last 30 Days</p>
        <div className="flex flex-wrap gap-1">
          {monthlyData.map((d, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: d.count === 0 ? '#18181b' :
                  d.count === 1 ? '#27272a' :
                  d.count === 2 ? '#3f3f46' :
                  d.count <= 4 ? '#52525b' : '#71717a'
              }}
              title={`${d.date}: ${d.count} completed`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-zinc-400">Less</span>
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{
              backgroundColor: ['#18181b','#27272a','#3f3f46','#52525b','#71717a'][i]
            }} />
          ))}
          <span className="text-[10px] text-zinc-400">More</span>
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-4">Active by Priority</p>
        <div className="space-y-3">
          {[
            { label: 'High', count: byPriority.high, color: '#fb923c' },
            { label: 'Medium', count: byPriority.medium, color: '#fbbf24' },
            { label: 'Low', count: byPriority.low, color: '#4ade80' },
          ].map(p => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 w-14">{p.label}</span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.active > 0 ? (p.count / stats.active) * 100 : 0}%`,
                    backgroundColor: p.color,
                  }}
                />
              </div>
              <span className="text-xs text-zinc-400 w-6 text-right">{p.count}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// JOURNAL VIEW
// ═══════════════════════════════════════════════════════════════════

function JournalView({ tasks }) {
  const today = useMemo(() => toLocalDateString(new Date()), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [journalToast, setJournalToast] = useState(null)
  const toastTimerRef = useRef(null)
  const hydratedForRef = useRef(null)
  const contentRef = useRef('')
  const moodRef = useRef('')

  const journalEntries = useQuery(api.journal.list)
  const getJournalByDate = useQuery(api.journal.getByDate, { date: selectedDate })
  const saveJournal = useMutation(api.journal.create)
  const removeJournal = useMutation(api.journal.remove)

  useEffect(() => {
    contentRef.current = content
    moodRef.current = mood
  }, [content, mood])

  const flash = useCallback((message, opts = {}) => {
    setJournalToast({ message, actionLabel: opts.actionLabel, onAction: opts.onAction, isError: !!opts.isError })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const duration = opts.duration ?? (opts.onAction ? 5000 : opts.isError ? 4000 : 2000)
    toastTimerRef.current = setTimeout(() => setJournalToast(null), duration)
  }, [])

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }, [])

  // Hydrate when date changes (query for new date starts as undefined)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    hydratedForRef.current = selectedDate
    setDirty(false)
    if (getJournalByDate) {
      setContent(getJournalByDate.content || '')
      setMood(getJournalByDate.mood || '')
    } else {
      setContent('')
      setMood('')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // Hydrate when query resolves for the current date — never clobber in-progress edits
  useEffect(() => {
    if (hydratedForRef.current !== selectedDate) return
    if (dirty || contentRef.current.trim() || moodRef.current) return
    /* eslint-disable react-hooks/set-state-in-effect */
    if (getJournalByDate) {
      setContent(getJournalByDate.content || '')
      setMood(getJournalByDate.mood || '')
    } else if (getJournalByDate === null) {
      setContent('')
      setMood('')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getJournalByDate])

  const serverContent = getJournalByDate ? (getJournalByDate.content || '') : ''
  const serverMood = getJournalByDate ? (getJournalByDate.mood || '') : ''
  const effectiveDirty = dirty || content !== serverContent || mood !== serverMood

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const snapshot = { content: contentRef.current, mood: moodRef.current }
      await saveJournal({
        date: selectedDate,
        content: snapshot.content,
        mood: snapshot.mood || undefined,
      })
      if (contentRef.current === snapshot.content && moodRef.current === snapshot.mood) {
        setDirty(false)
      }
      flash('Journal saved')
    } catch (err) {
      console.error('Failed to save journal', err)
      const detail = err?.message ? `: ${String(err.message).slice(0, 120)}` : ''
      flash(`Failed to save journal${detail}`, { isError: true })
    } finally {
      setSaving(false)
    }
  }, [saving, selectedDate, saveJournal, flash])

  const deleteEntry = useCallback(async () => {
    const entry = getJournalByDate
    if (!entry || saving) return
    try {
      await removeJournal({ id: entry._id })
      setContent('')
      setMood('')
      setDirty(false)
      flash('Journal deleted', {
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await saveJournal({
              date: entry.date,
              content: entry.content,
              mood: entry.mood,
              taskIds: entry.taskIds,
            })
            setSelectedDate(entry.date)
            flash('Journal restored')
          } catch {
            flash('Failed to restore journal')
          }
        },
      })
    } catch {
      flash('Failed to delete journal')
    }
  }, [getJournalByDate, saving, removeJournal, saveJournal, flash])

  const gotoDate = useCallback(async (date) => {
    if (date === selectedDate) return
    if (dirty && (contentRef.current.trim() || moodRef.current)) {
      try {
        await saveJournal({
          date: selectedDate,
          content: contentRef.current,
          mood: moodRef.current || undefined,
        })
      } catch { /* best-effort autosave on navigate */ }
    }
    setSelectedDate(date)
  }, [selectedDate, dirty, saveJournal])

  const filteredEntries = useMemo(() => {
    if (!journalEntries) return []
    if (!searchQuery.trim()) return journalEntries
    const q = searchQuery.toLowerCase()
    return journalEntries.filter(e =>
      e.content.toLowerCase().includes(q) || e.date.includes(q)
    )
  }, [journalEntries, searchQuery])

  const MOODS = ['productive', 'focused', 'tired', 'motivated', 'distracted', 'creative']

  const dateNav = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00')
    const prev = new Date(d); prev.setDate(prev.getDate() - 1)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    return {
      prev: toLocalDateString(prev),
      next: toLocalDateString(next),
      label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    }
  }, [selectedDate])

  const todayTasks = useMemo(() => {
    return tasks.filter(t => !t.done).slice(0, 5)
  }, [tasks])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="space-y-4"
    >
      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => gotoDate(dateNav.prev)}
          aria-label="Previous day"
          className="p-1.5 rounded-xl hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-white">{dateNav.label}</p>
          {selectedDate === today && (
            <span className="text-[10px] text-green-400 uppercase tracking-wider">Today</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => gotoDate(dateNav.next)}
          aria-label="Next day"
          className="p-1.5 rounded-xl hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Editor */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-zinc-400 uppercase tracking-[0.3em]">Journal Entry</span>
          <div className="flex items-center gap-2">
            {getJournalByDate && (
              <button
                type="button"
                onClick={deleteEntry}
                aria-label="Delete journal entry"
                className="p-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : effectiveDirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setDirty(true) }}
          placeholder="What did you work on today? Any wins, challenges, or ideas..."
          aria-label="Journal content"
          rows={8}
          className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-400 outline-none focus:border-zinc-600 resize-none font-mono leading-relaxed mb-4"
        />

        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-2" id="mood-label">Mood</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="mood-label">
            {MOODS.map(m => (
              <button
                key={m}
                type="button"
                aria-pressed={mood === m}
                onClick={() => { setMood(mood === m ? '' : m); setDirty(true) }}
                className={`px-3 py-1 rounded-xl text-xs transition-all border ${
                  mood === m
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Tasks */}
      {todayTasks.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-3">Active Tasks</p>
          <div className="space-y-2">
            {todayTasks.map(t => (
              <div key={t._id} className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full" style={{
                  backgroundColor: t.priority === 'high' ? '#fb923c' : t.priority === 'medium' ? '#fbbf24' : '#4ade80'
                }} />
                {t.text}
                {t.dueDate && (
                  <span className="text-[10px] text-zinc-400 ml-auto">{fmtDate(t.dueDate, t.dueTime)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 backdrop-blur-sm">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search journal entries..."
            aria-label="Search journal entries"
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-zinc-400 outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredEntries.slice(0, 10).map(entry => (
            <button
              key={entry._id}
              type="button"
              onClick={() => gotoDate(entry.date)}
              className="w-full text-left p-3 rounded-xl hover:bg-zinc-800/60 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400">{entry.date}</span>
                {entry.mood && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-md">{entry.mood}</span>
                )}
              </div>
              <p className="text-sm text-zinc-400 truncate">{entry.content || 'Empty entry'}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {journalToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div role={journalToast.isError ? 'alert' : 'status'} className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900/95 border rounded-2xl shadow-2xl backdrop-blur-xl ${journalToast.isError ? 'border-red-400/40' : 'border-zinc-800'}`}>
              {journalToast.isError
                ? <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                : <Check size={14} className="text-white/80" />}
              <span className="text-sm text-zinc-300">{journalToast.message}</span>
              {journalToast.onAction && (
                <button
                  type="button"
                  onClick={() => { const fn = journalToast.onAction; setJournalToast(null); fn() }}
                  className="ml-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors"
                >
                  {journalToast.actionLabel || 'Undo'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const TaskItem = memo(function TaskItem({
  task, projects, isEditing, editingText,
  onToggle, onDelete, onEdit, onEditChange, onEditSave, onEditCancel,
  onDetail, onStartPomodoro
}) {
  const project = projects.find(p => p._id === task.projectId)
  const subtaskDone = task.subtasks.filter(s => s.done).length
  const subtaskTotal = task.subtasks.length
  const overdue = !task.done && isOverdue(task.dueDate, task.dueTime)

  return (
    <div
      className={`group relative bg-zinc-900/60 border rounded-3xl backdrop-blur-sm transition-all hover:border-zinc-700 ${
        task.done ? 'border-zinc-800/50 opacity-60' : 'border-zinc-800'
      }`}
      style={!task.done && task.priority === 'high' ? { borderLeftColor: PRIORITY_CONFIG.high.color + '44', borderLeftWidth: '3px' } :
             !task.done && task.priority === 'medium' ? { borderLeftColor: PRIORITY_CONFIG.medium.color + '33', borderLeftWidth: '2px' } :
             !task.done && task.priority === 'low' ? { borderLeftColor: PRIORITY_CONFIG.low.color + '22', borderLeftWidth: '2px' } : {}}
    >
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={onToggle} aria-label={task.done ? `Reopen ${task.text}` : `Complete ${task.text}`} aria-pressed={task.done}
          className={`mt-0.5 w-[18px] h-[18px] rounded-lg border-[1.5px] flex-shrink-0 flex items-center justify-center transition-all ${
            task.done
              ? 'bg-white/20 border-white/30'
              : 'border-zinc-600 hover:border-zinc-400 hover:shadow-[0_0_12px_-3px_rgba(255,255,255,0.25)]'
          }`}
        >
          {task.done && <Check size={10} className="text-white" strokeWidth={2.5} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEditing ? (
              <input
                value={editingText}
                onChange={e => onEditChange(e.target.value)}
                onBlur={onEditSave}
                onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
                className="flex-1 bg-zinc-950/60 border border-zinc-800 rounded-lg px-2 py-0.5 text-sm text-white outline-none focus:border-zinc-600"
                autoFocus
              />
            ) : (
              <span
                className={`text-sm leading-snug cursor-pointer transition-colors ${
                  task.done ? 'text-zinc-400 line-through' : 'text-white hover:text-zinc-300'
                }`}
                onDoubleClick={onEdit}
              >
                {task.text}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${PRIORITY_CONFIG[task.priority].bg} ${PRIORITY_CONFIG[task.priority].text}`}>
              {PRIORITY_CONFIG[task.priority].label}
            </span>

            {project && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}

            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] ${overdue ? 'text-red-400' : 'text-zinc-400'}`}>
                <Calendar size={10} />
                {fmtDate(task.dueDate, task.dueTime)}
              </span>
            )}

            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className="flex items-center gap-0.5 text-[10px] text-zinc-400 bg-zinc-800/40 px-1.5 py-0.5 rounded-md">
                <Hash size={8} />{tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-zinc-400">+{task.tags.length - 2}</span>
            )}

            {subtaskTotal > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <ListChecks size={10} />
                {subtaskDone}/{subtaskTotal}
              </span>
            )}

            {task.notes && (
              <FileText size={10} className="text-zinc-400" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button type="button" onClick={onDetail} aria-label="Edit details" className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all" title="Edit details">
            <Pencil size={13} />
          </button>
          <button type="button" onClick={onStartPomodoro} aria-label="Start Pomodoro" className="p-1.5 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-orange-400/10 transition-all" title="Start Pomodoro">
            <Flame size={13} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete task" className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
})

function AddSubtaskInline({ onAdd }) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)

  if (!adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mt-1">
        <Plus size={12} /> Add subtask
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && text.trim()) { onAdd(text); setText('') }
          if (e.key === 'Escape') { setAdding(false); setText('') }
        }}
        onBlur={() => { if (text.trim()) onAdd(text); setText(''); setAdding(false) }}
        placeholder="Subtask..."
        className="flex-1 bg-zinc-950/40 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white placeholder:text-zinc-400 outline-none focus:border-zinc-600"
        autoFocus
      />
    </div>
  )
}

function AddTagInline({ currentTags, onAdd }) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)

  if (!adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-zinc-400 border border-dashed border-zinc-800 hover:border-zinc-700 hover:text-white transition-all">
        <Plus size={10} /> tag
      </button>
    )
  }

  return (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && text.trim() && !currentTags.includes(text.trim())) {
          onAdd(text.trim()); setText(''); setAdding(false)
        }
        if (e.key === 'Escape') { setText(''); setAdding(false) }
      }}
      onBlur={() => { setText(''); setAdding(false) }}
      placeholder="tag name"
      className="w-20 bg-zinc-950/40 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-zinc-400 outline-none focus:border-zinc-600"
      autoFocus
    />
  )
}

// ═══════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <h2 className="text-lg font-medium mb-2">Something went wrong</h2>
            <p className="text-sm text-zinc-400 mb-6">Try refreshing the page. If the problem persists, clear your browser cache.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROTECTED APP ROUTE
// ═══════════════════════════════════════════════════════════════════

function ProtectedApp() {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)] animate-pulse">
            <Activity size={18} className="text-zinc-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <AppContent />
}

// ═══════════════════════════════════════════════════════════════════
// ROOT APP WITH ROUTING
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/app" element={<ProtectedApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
