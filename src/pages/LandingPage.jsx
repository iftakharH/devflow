import { motion } from 'framer-motion'
import { Activity, CheckCircle2, Users, BarChart3, ArrowRight, Sparkles } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useUser } from '@clerk/react'

const features = [
  {
    icon: CheckCircle2,
    title: 'Smart Tasks',
    description: 'Priorities, due dates, subtasks, tags, and natural language input. Everything you need, nothing you don\'t.',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Track your streaks, weekly completion rates, and productivity patterns. See where your time goes.',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Create workspaces, invite teammates, and share projects. Real-time sync across all devices.',
  },
]

const steps = [
  { step: '01', title: 'Capture', desc: 'Quick-add tasks with natural language. Type "#tag tomorrow high" and DevFlow parses it automatically.' },
  { step: '02', title: 'Organize', desc: 'Group tasks into projects, set priorities, and add subtasks. Your workflow, your way.' },
  { step: '03', title: 'Execute', desc: 'Focus mode with Pomodoro timer. Keyboard shortcuts for power users. Get things done.' },
  { step: '04', title: 'Reflect', desc: 'Daily journal, analytics dashboard, and history. Learn from your patterns.' },
]

export default function LandingPage() {
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

  if (isSignedIn) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-white/20 font-sans overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-white/[0.012] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-white/[0.008] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)]">
            <Activity size={16} className="text-zinc-300" strokeWidth={1.5} />
          </div>
          <span className="text-lg font-medium tracking-tight">DevFlow</span>
        </div>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <Link
              to="/app"
              className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)] hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="px-4 py-2 rounded-xl bg-white text-zinc-950 text-sm font-semibold shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)] hover:bg-zinc-200 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 sm:px-12 pt-20 sm:pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 26 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 mb-8">
              <Sparkles size={12} className="text-amber-400" />
              Built for developers, by developers
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] mb-6">
              Task management<br />
              <span className="text-zinc-400">that actually works.</span>
            </h1>

            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              DevFlow is a daily driver for developers who want to ship more and manage less.
              Natural language input, real-time sync, analytics, and collaboration — all in one beautiful app.
            </p>

            <div className="flex items-center justify-center gap-4">
              {isSignedIn ? (
                <Link
                  to="/app"
                  className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-zinc-950 text-sm font-semibold shadow-[0_0_60px_-12px_rgba(255,255,255,0.55)] hover:bg-zinc-200 transition-all"
                >
                  Go to Dashboard
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
                <Link
                  to="/sign-up"
                  className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-zinc-950 text-sm font-semibold shadow-[0_0_60px_-12px_rgba(255,255,255,0.55)] hover:bg-zinc-200 transition-all"
                >
                  Start for free
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
              <a
                href="#features"
                className="px-6 py-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-all backdrop-blur-sm"
              >
                Learn more
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 sm:px-12 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 250, damping: 26 }}
            className="text-center mb-16"
          >
            <p className="text-xs text-zinc-400 uppercase tracking-[0.3em] mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Everything you need,<br />
              <span className="text-zinc-400">nothing you don&apos;t.</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 250, damping: 26 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm hover:border-zinc-700 transition-all group"
              >
                <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center mb-4 group-hover:shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)] transition-shadow">
                  <f.icon size={18} className="text-zinc-400" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-medium text-white mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 sm:px-12 py-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 250, damping: 26 }}
            className="text-center mb-16"
          >
            <p className="text-xs text-zinc-400 uppercase tracking-[0.3em] mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Four steps to<br />
              <span className="text-zinc-400">productive flow.</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 250, damping: 26 }}
                className="flex gap-4 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm"
              >
                <span className="text-3xl font-light text-zinc-800">{s.step}</span>
                <div>
                  <h3 className="text-base font-medium text-white mb-1">{s.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 sm:px-12 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 250, damping: 26 }}
          className="max-w-3xl md:max-w-5xl lg:max-w-6xl mx-auto text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-6">
            Ready to ship more?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
            Join developers who use DevFlow as their daily driver. Free to start, no credit card required.
          </p>
          <Link
            to={isSignedIn ? "/app" : "/sign-up"}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-white text-zinc-950 text-sm font-semibold shadow-[0_0_60px_-12px_rgba(255,255,255,0.55)] hover:bg-zinc-200 transition-all"
          >
            {isSignedIn ? 'Go to Dashboard' : 'Get started for free'}
            <ArrowRight size={16} />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 sm:px-12 py-8 border-t border-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-zinc-400" />
            <span className="text-xs text-zinc-400">DevFlow</span>
          </div>
          <span className="text-[10px] text-zinc-800 uppercase tracking-wider">v2</span>
        </div>
      </footer>
    </div>
  )
}
