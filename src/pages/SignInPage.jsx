import { SignIn, useUser } from '@clerk/react'
import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

export default function SignInPage() {
  const { isLoaded, isSignedIn } = useUser()

  if (isLoaded && isSignedIn) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-white/20 font-sans flex items-center justify-center p-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-white/[0.012] blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 250, damping: 26 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-zinc-800 flex items-center justify-center shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)]">
            <Activity size={18} className="text-zinc-300" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-medium tracking-tight">DevFlow</h1>
        </Link>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 backdrop-blur-sm shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-lg font-medium text-white mb-1">Welcome back</h2>
            <p className="text-sm text-zinc-500">Sign in to your account</p>
          </div>

          <SignIn
            routing="path"
            path="/sign-in"
            signInForceRedirectUrl="/app"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-transparent border-0 shadow-none',
                headerTitle: 'text-white',
                headerSubtitle: 'text-zinc-500',
                socialButtonsBlockButton: 'bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:bg-zinc-800',
                socialButtonsBlockButtonText: 'text-zinc-300',
                dividerLine: 'bg-zinc-800',
                dividerText: 'text-zinc-600',
                formFieldLabel: 'text-zinc-500',
                formFieldInput: 'bg-zinc-950/80 border border-zinc-800 text-white placeholder:text-zinc-600',
                formButtonPrimary: 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)]',
                footerActionLink: 'text-zinc-400 hover:text-white',
                identityPreviewEditButton: 'text-zinc-400',
              },
            }}
          />
        </div>

        <p className="text-center mt-6 text-xs text-zinc-600">
          Don&apos;t have an account?{' '}
          <Link to="/sign-up" className="text-zinc-400 hover:text-white transition-colors">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
