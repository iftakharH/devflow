import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import { useUser, useClerk } from '@clerk/react'
import {
  Activity, Plus, Search, Trash2, Pencil, Check, Calendar,
  ListChecks, FileText, X, Download, Upload, AlertCircle, Filter,
  Folder, Command, RotateCcw, CheckCircle2, Hash, Flame, Target, Copy,
  LogOut, BookOpen, BarChart3
} from 'lucide-react'

import LandingPage from './pages/LandingPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

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

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const now = new Date(); now.setHours(0,0,0,0)
  const diff = Math.round((d - now) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 6) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const isOverdue = (iso) => {
  if (!iso) return false
  const d = new Date(iso + 'T00:00:00'); d.setHours(0,0,0,0)
  const now = new Date(); now.setHours(0,0,0,0)
  return d < now
}

const parseNaturalDate = (text) => {
  const t = text.toLowerCase().trim()
  const now = new Date(); now.setHours(0,0,0,0)
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

  if (t.includes('today')) return now.toISOString().split('T')[0]
  if (t.includes('tomorrow')) { const d = new Date(now); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] }

  for (let i = 0; i < 7; i++) {
    if (t.includes(dayNames[i])) {
      const d = new Date(now)
      const diff = (i - d.getDay() + 7) % 7 || 7
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    }
  }

  if (t.includes('next week')) { const d = new Date(now); d.setDate(d.getDate()+7); return d.toISOString().split('T')[0] }
  if (t.includes('next month')) { const d = new Date(now); d.setMonth(d.getMonth()+1); return d.toISOString().split('T')[0] }

  const monthMatch = t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})/)
  if (monthMatch) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
    const mi = months.indexOf(monthMatch[1].slice(0,3))
    const day = parseInt(monthMatch[2])
    if (mi >= 0 && day > 0 && day <= 31) {
      const d = new Date(now.getFullYear(), mi, day)
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().split('T')[0]
    }
  }

  const slashMatch = t.match(/(\d{1,2})\/(\d{1,2})/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1]) - 1
    const d2 = parseInt(slashMatch[2])
    if (m >= 0 && m < 12 && d2 > 0 && d2 <= 31) {
      const d = new Date(now.getFullYear(), m, d2)
      if (d < now) d.setFullYear(d.getFullYear() + 1)
      return d.toISOString().split('T')[0]
    }
  }

  return null
}

const parsePriority = (text) => {
  const t = text.toLowerCase().trim()
  if (/\bhigh\b/.test(t)) return 'high'
  if (/\bmed\b|\bmedium\b/.test(t)) return 'medium'
  if (/\blow\b/.test(t)) return 'low'
  return 'medium'
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
      syncUser().then(() => seedProjects())
    }
  }, [user, syncUser, seedProjects])

  // ─── Local state ───────────────────────────────────────
  const tasks = useMemo(() => convexTasks ?? [], [convexTasks])
  const projects = useMemo(() => convexProjects ?? [], [convexProjects])

  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeProject, setActiveProject] = useState(null)
  const [filterPriority, setFilterPriority] = useState(null)
  const [filterStatus, setFilterStatus] = useState('active')
  const [detailTaskId, setDetailTaskId] = useState(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showCompletedToast, setShowCompletedToast] = useState(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0])
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60)
  const [pomodoroTaskId, setPomodoroTaskId] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [activeView, setActiveView] = useState('tasks') // tasks | dashboard | journal | shared

  const inputRef = useRef(null)
  const searchRef = useRef(null)
  const editInputRef = useRef(null)
  const toastTimerRef = useRef(null)

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
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return (b._creationTime ?? 0) - (a._creationTime ?? 0)
    })
  }, [tasks, activeProject, filterPriority, filterStatus, search])

  const stats = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0)
    const active = tasks.filter(t => !t.done)
    const completed = tasks.filter(t => t.done)
    const overdue = active.filter(t => isOverdue(t.dueDate))
    const doneToday = completed.filter(t => {
      if (!t.completedAt) return false
      const d = new Date(t.completedAt); d.setHours(0,0,0,0)
      return d.getTime() === now.getTime()
    })
    let streak = 0
    const d = new Date(now)
    for (let i = 0; i < 365; i++) {
      const ds = d.toISOString().split('T')[0]
      const hasDone = tasks.some(t => {
        if (!t.done || !t.completedAt) return false
        const td = new Date(t.completedAt); td.setHours(0,0,0,0)
        return td.toISOString().split('T')[0] === ds
      })
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
  const showToast = useCallback((msg) => {
    setShowCompletedToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setShowCompletedToast(null), 2000)
  }, [])

  // ─── Task Handlers ─────────────────────────────────────
  const addTask = useCallback(async () => {
    if (!input.trim()) return
    const date = parseNaturalDate(input)
    const priority = parsePriority(input)
    const tags = parseTags(input)
    const text = stripParsed(input) || input.trim()
    await createTask({
      text,
      projectId: activeProject || undefined,
      priority,
      dueDate: date ?? undefined,
      tags,
    })
    setInput('')
    showToast('Task created')
  }, [input, activeProject, createTask, showToast])

  const toggleTask = useCallback(async (id) => {
    const task = tasks.find(t => t._id === id)
    if (!task) return
    await updateTask({ id, done: !task.done })
  }, [tasks, updateTask])

  const deleteTask = useCallback(async (id) => {
    await removeTask({ id })
    if (detailTaskId === id) setDetailTaskId(null)
    showToast('Task deleted')
  }, [detailTaskId, removeTask, showToast])

  const updateTaskField = useCallback(async (id, updates) => {
    await updateTask({ id, ...updates })
  }, [updateTask])

  const startInlineEdit = useCallback((task) => {
    setEditingTaskId(task._id)
    setEditingText(task.text)
  }, [])

  const saveInlineEdit = useCallback(async () => {
    if (editingTaskId && editingText.trim()) {
      await updateTask({ id: editingTaskId, text: editingText.trim() })
    }
    setEditingTaskId(null)
    setEditingText('')
  }, [editingTaskId, editingText, updateTask])

  // ─── Subtask Handlers ──────────────────────────────────
  const addSubtask = useCallback(async (taskId, text) => {
    if (!text.trim()) return
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    await updateTask({
      id: taskId,
      subtasks: [...task.subtasks, { id: uid('sts'), text: text.trim(), done: false }],
    })
  }, [tasks, updateTask])

  const toggleSubtask = useCallback(async (taskId, subId) => {
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    await updateTask({
      id: taskId,
      subtasks: task.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s),
    })
  }, [tasks, updateTask])

  const deleteSubtask = useCallback(async (taskId, subId) => {
    const task = tasks.find(t => t._id === taskId)
    if (!task) return
    await updateTask({
      id: taskId,
      subtasks: task.subtasks.filter(s => s.id !== subId),
    })
  }, [tasks, updateTask])

  // ─── Project Handlers ──────────────────────────────────
  const addProject = useCallback(async () => {
    if (!newProjectName.trim()) return
    await createProject({
      name: newProjectName.trim(),
      color: newProjectColor,
    })
    setNewProjectName('')
    setShowAddProject(false)
    showToast('Project created')
  }, [newProjectName, newProjectColor, createProject, showToast])

  const deleteProject = useCallback(async (id) => {
    await removeProject({ id })
    if (activeProject === id) setActiveProject(null)
  }, [activeProject, removeProject])

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
    try {
      const parsed = JSON.parse(importText)
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        for (const t of parsed.tasks) {
          await createTask({
            text: t.text,
            projectId: t.projectId,
            priority: t.priority ?? 'medium',
            dueDate: t.dueDate,
            tags: t.tags ?? [],
          })
        }
        setShowImportModal(false)
        setImportText('')
        showToast('Imported successfully')
      } else {
        showToast('Invalid data format')
      }
    } catch {
      showToast('Invalid JSON')
    }
  }, [importText, createTask, showToast])

  const handleCopyJSON = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify({ tasks, projects }, null, 2))
    showToast('Copied to clipboard')
  }, [tasks, projects, showToast])

  // ─── Pomodoro ──────────────────────────────────────────
  const startPomodoro = useCallback((taskId) => {
    setPomodoroTaskId(taskId)
    setPomodoroTime(25 * 60)
    setPomodoroActive(true)
    showToast('Pomodoro started — 25 min')
  }, [showToast])

  const stopPomodoro = useCallback(() => {
    setPomodoroActive(false)
    setPomodoroTime(25 * 60)
    setPomodoroTaskId(null)
  }, [])

  // ─── Pomodoro Timer ────────────────────────────────────
  useEffect(() => {
    if (!pomodoroActive || pomodoroTime <= 0) return
    const interval = setInterval(() => {
      setPomodoroTime(prev => {
        if (prev <= 1) {
          setPomodoroActive(false)
          if (pomodoroTaskId) {
            updateTask({ id: pomodoroTaskId, done: true })
          }
          return 25 * 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [pomodoroActive, pomodoroTime, pomodoroTaskId, updateTask])

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
    { label: 'Add new task', icon: Plus },
    { label: 'Search tasks', icon: Search },
    { label: 'Dashboard', icon: BarChart3 },
    { label: 'Journal', icon: BookOpen },
    { label: 'Show all tasks', icon: Filter },
    { label: 'Show overdue', icon: AlertCircle },
    { label: 'Show completed', icon: CheckCircle2 },
    { label: 'Start Pomodoro', icon: Flame },
    { label: 'Add project', icon: Folder },
    { label: 'Export data', icon: Download },
    { label: 'Sign out', icon: LogOut },
  ]

  const handleCommandAction = useCallback((index) => {
    setShowCommandPalette(false)
    switch (index) {
      case 0: inputRef.current?.focus(); break
      case 1: searchRef.current?.focus(); break
      case 2: setActiveView('dashboard'); break
      case 3: setActiveView('journal'); break
      case 4: setActiveProject(null); setFilterPriority(null); setFilterStatus('active'); setActiveView('tasks'); break
      case 5: setFilterStatus('active'); setFilterPriority(null); setActiveView('tasks'); break
      case 6: setFilterStatus('done'); setActiveView('tasks'); break
      case 7: startPomodoro(detailTaskId || null); break
      case 8: setShowAddProject(true); break
      case 9: setShowExportModal(true); break
      case 10: clerk.signOut({ redirectUrl: '/' }); break
      default: break
    }
  }, [detailTaskId, startPomodoro, clerk])

  // ─── Loading state ─────────────────────────────────────
  if (convexTasks === undefined || convexProjects === undefined) {
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
          <p className="text-sm text-zinc-600">Loading DevFlow...</p>
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

      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
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
                    onClick={() => setActiveView(v.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all border ${
                      activeView === v.id
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'border-transparent text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    <v.icon size={12} />
                    {v.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCommandPalette(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 text-xs hover:text-zinc-300 hover:border-zinc-700 transition-all"
              >
                <Command size={12} />
                <span className="hidden sm:inline">Commands</span>
                <kbd className="hidden sm:inline text-[10px] bg-zinc-800/80 px-1.5 py-0.5 rounded-md border border-zinc-700">⌘K</kbd>
              </button>
              {user && (
                <div className="flex items-center gap-2 ml-2">
                  {user.imageUrl && (
                    <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full border border-zinc-800" />
                  )}
                  <button
                    onClick={() => clerk.signOut({ redirectUrl: '/' })}
                    className="p-1.5 rounded-xl text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/60 transition-all"
                    title="Sign out"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-600 uppercase tracking-[0.3em] mt-1">
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
                { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: stats.overdue > 0 ? 'text-red-400' : 'text-zinc-500' },
                { label: 'Streak', value: `${stats.streak}d`, icon: Flame, color: 'text-amber-400' },
              ].map((s) => (
                <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-3 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={12} className="text-zinc-600" strokeWidth={1.5} />
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{s.label}</span>
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
                  onClick={() => setActiveProject(null)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    !activeProject
                      ? 'bg-white text-zinc-950 border-white shadow-[0_0_20px_-4px_rgba(255,255,255,0.3)]'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  All
                </button>
                {projects.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(p => (
                  <button
                    key={p._id}
                    onClick={() => setActiveProject(activeProject === p._id ? null : p._id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                      activeProject === p._id
                        ? 'border-zinc-600 text-white'
                        : 'bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                    style={activeProject === p._id ? { backgroundColor: p.color + '22', borderColor: p.color + '44' } : {}}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                    {activeProject === p._id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteProject(p._id) }}
                        className="ml-1 hover:text-white transition-colors"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setShowAddProject(true)}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-zinc-600 border border-dashed border-zinc-800 hover:border-zinc-700 hover:text-zinc-400 transition-all"
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
                      <Folder size={14} className="text-zinc-500" />
                      <span className="text-xs text-zinc-500 uppercase tracking-wider">New Project</span>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addProject()}
                        placeholder="Project name..."
                        className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Color</span>
                      <div className="flex gap-1.5">
                        {PROJECT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewProjectColor(c)}
                            className={`w-5 h-5 rounded-full transition-all ${newProjectColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addProject} className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors">Create</button>
                      <button onClick={() => { setShowAddProject(false); setNewProjectName('') }} className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800/60 text-xs text-zinc-400 hover:text-zinc-300 transition-colors">Cancel</button>
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
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder='Search tasks... ( / )'
                  className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-all backdrop-blur-sm"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['active', 'done', 'all'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs transition-all border ${
                      filterStatus === s
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {s === 'active' ? 'Active' : s === 'done' ? 'Completed' : 'All'}
                  </button>
                ))}
                <span className="w-px h-3 bg-zinc-800 flex-shrink-0" />
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFilterPriority(filterPriority === key ? null : key)}
                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all border ${
                      filterPriority === key
                        ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                        : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
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
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-white/[0.04] to-transparent rounded-3xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center bg-zinc-900/60 border border-zinc-800 rounded-3xl backdrop-blur-sm overflow-hidden group-focus-within:border-zinc-700 transition-colors">
                  <Plus size={16} className="ml-4 text-zinc-600 flex-shrink-0 group-focus-within:text-zinc-400 transition-colors" />
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="Add a task... ( #tag tomorrow high )"
                    className="flex-1 bg-transparent px-3 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none"
                  />
                  {input && (
                    <button onClick={addTask} className="mr-2 px-3 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors">
                      Add
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2 px-1">
                <span className="text-[10px] text-zinc-700 uppercase tracking-wider">Tips:</span>
                <span className="text-[10px] text-zinc-600">#tag</span>
                <span className="text-[10px] text-zinc-600">tomorrow / monday / sep 25</span>
                <span className="text-[10px] text-zinc-600">high / medium / low</span>
              </div>
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
                        <Target size={24} className="text-zinc-700" />
                      </div>
                      <p className="text-zinc-500 text-sm mb-1">
                        {filterStatus === 'done' ? 'No completed tasks yet' : 'No tasks found'}
                      </p>
                      <p className="text-zinc-600 text-xs">
                        {filterStatus === 'done' ? 'Complete some tasks to see them here' : 'Add a task above or adjust your filters'}
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
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Download size={12} /> Export
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Upload size={12} /> Import
                </button>
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <span className="text-[10px] text-zinc-800 uppercase tracking-wider">DevFlow v2</span>
            </div>
          </motion.footer>
        )}
      </div>

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
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-lg bg-zinc-900/95 border border-zinc-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 pb-0">
                <span className="text-[10px] text-zinc-600 uppercase tracking-[0.3em]">Task Details</span>
                <button onClick={() => setDetailTaskId(null)} className="p-1.5 rounded-xl hover:bg-zinc-800/60 transition-colors">
                  <X size={14} className="text-zinc-500" />
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
                    className={`text-base font-medium text-white leading-snug cursor-pointer hover:text-zinc-300 transition-colors ${detailTask.done ? 'line-through text-zinc-500' : ''}`}
                    onClick={() => startInlineEdit(detailTask)}
                  >
                    {detailTask.text}
                  </h2>
                )}
              </div>

              {/* Priority */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Priority</label>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => updateTaskField(detailTask._id, { priority: key })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all border ${
                        detailTask.priority === key
                          ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                          : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
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
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Project</label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(p => (
                    <button
                      key={p._id}
                      onClick={() => updateTaskField(detailTask._id, { projectId: p._id })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all border ${
                        detailTask.projectId === p._id
                          ? 'border-zinc-600 text-white'
                          : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
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
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Due Date</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={detailTask.dueDate || ''}
                    onChange={e => updateTaskField(detailTask._id, { dueDate: e.target.value || undefined })}
                    className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-zinc-600 [color-scheme:dark]"
                  />
                  {detailTask.dueDate && (
                    <span className={`text-xs ${isOverdue(detailTask.dueDate) && !detailTask.done ? 'text-red-400' : 'text-zinc-500'}`}>
                      {fmtDate(detailTask.dueDate)}
                    </span>
                  )}
                  {detailTask.dueDate && (
                    <button
                      onClick={() => updateTaskField(detailTask._id, { dueDate: undefined })}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="px-5 pt-4">
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {detailTask.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-400">
                      <Hash size={10} />
                      {tag}
                      <button
                        onClick={() => updateTaskField(detailTask._id, { tags: detailTask.tags.filter(t => t !== tag) })}
                        className="text-zinc-600 hover:text-zinc-300 ml-0.5"
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
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">
                  Subtasks {detailTask.subtasks.length > 0 && (
                    <span className="text-zinc-500 normal-case">
                      {detailTask.subtasks.filter(s => s.done).length}/{detailTask.subtasks.length}
                    </span>
                  )}
                </label>
                <div className="space-y-1.5">
                  {detailTask.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => toggleSubtask(detailTask._id, sub.id)}
                        className={`w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                          sub.done
                            ? 'bg-white/20 border-white/30'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        {sub.done && <Check size={10} className="text-white" />}
                      </button>
                      <span className={`text-sm flex-1 ${sub.done ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
                        {sub.text}
                      </span>
                      <button
                        onClick={() => deleteSubtask(detailTask._id, sub.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 transition-all"
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
                <label className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Notes</label>
                <textarea
                  value={detailTask.notes || ''}
                  onChange={e => updateTaskField(detailTask._id, { notes: e.target.value })}
                  placeholder="Add notes, code snippets, links..."
                  rows={4}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex items-center gap-2">
                <button
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
                  onClick={() => { startPomodoro(detailTask._id); setDetailTaskId(null) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-orange-400/10 border border-orange-400/30 text-orange-400 hover:bg-orange-400/20 transition-all"
                >
                  <Flame size={14} /> Focus
                </button>
                <button
                  onClick={() => deleteTask(detailTask._id)}
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
                <div className="flex items-center gap-2 text-zinc-500">
                  <Command size={14} />
                  <span className="text-sm">Command palette</span>
                  <kbd className="ml-auto text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-700">ESC</kbd>
                </div>
              </div>
              <div className="p-2">
                {COMMAND_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleCommandAction(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-all text-left"
                  >
                    <item.icon size={14} className="text-zinc-500" />
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
                <span className="text-[10px] text-zinc-600 uppercase tracking-[0.3em]">Export Data</span>
                <button onClick={() => setShowExportModal(false)} className="p-1 rounded-xl hover:bg-zinc-800/60 transition-colors">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-5">Download your tasks and projects as a JSON file.</p>
              <div className="flex gap-2">
                <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-white text-zinc-950 shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)]">
                  <Download size={14} /> Download JSON
                </button>
                <button onClick={handleCopyJSON} className="flex items-center justify-center px-4 py-2.5 rounded-xl text-sm bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:text-white transition-all">
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
                <span className="text-[10px] text-zinc-600 uppercase tracking-[0.3em]">Import Data</span>
                <button onClick={() => setShowImportModal(false)} className="p-1 rounded-xl hover:bg-zinc-800/60 transition-colors">
                  <X size={14} className="text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-3">Paste your JSON backup to restore tasks and projects.</p>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='{"tasks":[...],"projects":[...]}'
                rows={6}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600 resize-none font-mono mb-4"
              />
              <button
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
                <button onClick={stopPomodoro} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                  <X size={12} />
                </button>
              </div>
              <div className="text-2xl font-mono text-white text-center my-2">
                {Math.floor(pomodoroTime / 60).toString().padStart(2, '0')}:{(pomodoroTime % 60).toString().padStart(2, '0')}
              </div>
              {pomodoroTaskId && (
                <p className="text-[10px] text-zinc-500 text-center truncate">
                  {tasks.find(t => t._id === pomodoroTaskId)?.text || 'Unnamed task'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          TOAST
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCompletedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl">
              <Check size={14} className="text-white/80" />
              <span className="text-sm text-zinc-300">{showCompletedToast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
      const dateStr = d.toISOString().split('T')[0]
      const count = tasks.filter(t => {
        if (!t.done || !t.completedAt) return false
        const td = new Date(t.completedAt); td.setHours(0,0,0,0)
        return td.toISOString().split('T')[0] === dateStr
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
      const dateStr = d.toISOString().split('T')[0]
      const count = tasks.filter(t => {
        if (!t.done || !t.completedAt) return false
        const td = new Date(t.completedAt); td.setHours(0,0,0,0)
        return td.toISOString().split('T')[0] === dateStr
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
          { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-400' : 'text-zinc-500' },
          { label: 'Streak', value: `${stats.streak} days`, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 backdrop-blur-sm">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly Chart */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-4">This Week</p>
        <div className="flex items-end gap-2 h-32">
          {weeklyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-zinc-800 rounded-lg relative" style={{ height: `${Math.max((d.count / maxWeekly) * 100, 4)}%` }}>
                <div
                  className="absolute inset-0 bg-white/20 rounded-lg"
                  style={{ height: `${(d.count / maxWeekly) * 100}%`, bottom: 0, top: 'auto' }}
                />
              </div>
              <span className="text-[10px] text-zinc-600">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Heatmap */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-4">Last 30 Days</p>
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
          <span className="text-[10px] text-zinc-600">Less</span>
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{
              backgroundColor: ['#18181b','#27272a','#3f3f46','#52525b','#71717a'][i]
            }} />
          ))}
          <span className="text-[10px] text-zinc-600">More</span>
        </div>
      </div>

      {/* Priority Breakdown */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-4">Active by Priority</p>
        <div className="space-y-3">
          {[
            { label: 'High', count: byPriority.high, color: '#fb923c' },
            { label: 'Medium', count: byPriority.medium, color: '#fbbf24' },
            { label: 'Low', count: byPriority.low, color: '#4ade80' },
          ].map(p => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-14">{p.label}</span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.active > 0 ? (p.count / stats.active) * 100 : 0}%`,
                    backgroundColor: p.color,
                  }}
                />
              </div>
              <span className="text-xs text-zinc-500 w-6 text-right">{p.count}</span>
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
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const journalEntries = useQuery(api.journal.list)
  const getJournalByDate = useQuery(api.journal.getByDate, { date: selectedDate })
  const saveJournal = useMutation(api.journal.create)
  const [showToast, setShowToast] = useState(null)
  const toastRef = useRef(null)

  const flash = useCallback((msg) => {
    setShowToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setShowToast(null), 2000)
  }, [])

  useEffect(() => {
    if (getJournalByDate) {
      setContent(getJournalByDate.content || '') // eslint-disable-line react-hooks/set-state-in-effect
      setMood(getJournalByDate.mood || '')
    } else {
      setContent('')
      setMood('')
    }
  }, [getJournalByDate, selectedDate])

  const handleSave = useCallback(async () => {
    await saveJournal({
      date: selectedDate,
      content,
      mood: mood || undefined,
    })
    flash('Journal saved')
  }, [selectedDate, content, mood, saveJournal, flash])

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
      prev: prev.toISOString().split('T')[0],
      next: next.toISOString().split('T')[0],
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
          onClick={() => setSelectedDate(dateNav.prev)}
          className="p-1.5 rounded-xl hover:bg-zinc-800/60 text-zinc-500 hover:text-white transition-all"
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
          onClick={() => setSelectedDate(dateNav.next)}
          className="p-1.5 rounded-xl hover:bg-zinc-800/60 text-zinc-500 hover:text-white transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Editor */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-zinc-600 uppercase tracking-[0.3em]">Journal Entry</span>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            Save
          </button>
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What did you work on today? Any wins, challenges, or ideas..."
          rows={8}
          className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-600 resize-none font-mono leading-relaxed mb-4"
        />

        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Mood</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map(m => (
              <button
                key={m}
                onClick={() => setMood(mood === m ? '' : m)}
                className={`px-3 py-1 rounded-xl text-xs transition-all border ${
                  mood === m
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-zinc-900/40 border-zinc-800/50 text-zinc-500 hover:text-zinc-300'
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
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-3">Active Tasks</p>
          <div className="space-y-2">
            {todayTasks.map(t => (
              <div key={t._id} className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full" style={{
                  backgroundColor: t.priority === 'high' ? '#fb923c' : t.priority === 'medium' ? '#fbbf24' : '#4ade80'
                }} />
                {t.text}
                {t.dueDate && (
                  <span className="text-[10px] text-zinc-600 ml-auto">{fmtDate(t.dueDate)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 backdrop-blur-sm">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search journal entries..."
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {filteredEntries.slice(0, 10).map(entry => (
            <button
              key={entry._id}
              onClick={() => setSelectedDate(entry.date)}
              className="w-full text-left p-3 rounded-xl hover:bg-zinc-800/60 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">{entry.date}</span>
                {entry.mood && (
                  <span className="text-[10px] text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-md">{entry.mood}</span>
                )}
              </div>
              <p className="text-sm text-zinc-400 truncate">{entry.content || 'Empty entry'}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl">
              <Check size={14} className="text-white/80" />
              <span className="text-sm text-zinc-300">{showToast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Need these for the JournalView
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const overdue = !task.done && isOverdue(task.dueDate)

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
        <button
          onClick={onToggle}
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
                  task.done ? 'text-zinc-600 line-through' : 'text-white hover:text-zinc-300'
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
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}

            {task.dueDate && (
              <span className={`flex items-center gap-1 text-[10px] ${overdue ? 'text-red-400' : 'text-zinc-500'}`}>
                <Calendar size={10} />
                {fmtDate(task.dueDate)}
              </span>
            )}

            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className="flex items-center gap-0.5 text-[10px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded-md">
                <Hash size={8} />{tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-zinc-600">+{task.tags.length - 2}</span>
            )}

            {subtaskTotal > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <ListChecks size={10} />
                {subtaskDone}/{subtaskTotal}
              </span>
            )}

            {task.notes && (
              <FileText size={10} className="text-zinc-600" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onDetail} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition-all" title="Edit details">
            <Pencil size={13} />
          </button>
          <button onClick={onStartPomodoro} className="p-1.5 rounded-lg text-zinc-600 hover:text-orange-400 hover:bg-orange-400/10 transition-all" title="Start Pomodoro">
            <Flame size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
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
      <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1">
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
        className="flex-1 bg-zinc-950/40 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
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
      <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-zinc-600 border border-dashed border-zinc-800 hover:border-zinc-700 hover:text-zinc-400 transition-all">
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
      className="w-20 bg-zinc-950/40 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
      autoFocus
    />
  )
}

// ═══════════════════════════════════════════════════════════════════
// ROOT APP WITH ROUTING
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/app" element={
          <>
            <AuthLoading>
              <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)] animate-pulse">
                    <Activity size={18} className="text-zinc-300" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-zinc-600">Loading...</p>
                </div>
              </div>
            </AuthLoading>
            <Unauthenticated>
              <Navigate to="/sign-in" replace />
            </Unauthenticated>
            <Authenticated>
              <AppContent />
            </Authenticated>
          </>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
