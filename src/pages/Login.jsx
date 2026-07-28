import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/supabase'
import s from './Login.module.css'

const VIEWS = {
  login:        ['Welcome Back',     'Sign in to your Anaar account'],
  reset:        ['Reset Password',   "We'll email you a reset link"],
  sent:         ['Email Sent',       'Check your inbox'],
  'set-password':['Set New Password','Choose a secure new password'],
}

export default function Login() {
  const nav = useNavigate()
  const [view,      setView]      = useState('login')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [remember,  setRemember]  = useState(false)
  const [showPw,    setShowPw]    = useState(false)
  const [resetEmail,setResetEmail]= useState('')
  const [sentEmail, setSentEmail] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [alert,     setAlert]     = useState({ msg: '', type: '' })
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) nav('/', { replace: true })
    })
    const saved = localStorage.getItem('anaar_email')
    if (saved) { setEmail(saved); setRemember(true) }

    const h = new URLSearchParams(window.location.hash.replace('#', ''))
    if (h.get('type') === 'recovery' && h.get('access_token')) {
      window.history.replaceState({}, '', window.location.pathname)
      setView('set-password')
    }
    if (sessionStorage.getItem('anaar_pw_recovery')) {
      sessionStorage.removeItem('anaar_pw_recovery')
      setView('set-password')
    }
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setView('set-password')
    })
    return () => subscription.unsubscribe()
  }, [nav])

  function err(msg) { setAlert({ msg, type: 'error' }) }

  async function signIn() {
    setAlert({ msg: '', type: '' })
    if (!email)    { err('Please enter your email address.'); return }
    if (!password) { err('Please enter your password.'); return }
    setLoading(true)
    const { error } = await db.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      err(error.message.includes('Invalid login credentials')
        ? 'Incorrect email or password. Please try again.'
        : error.message.includes('Email not confirmed')
        ? '⚠️ Please verify your email first. Check your inbox.'
        : error.message)
      return
    }
    if (remember) localStorage.setItem('anaar_email', email)
    else localStorage.removeItem('anaar_email')
    nav('/', { replace: true })
  }

  async function sendReset() {
    setAlert({ msg: '', type: '' })
    if (!resetEmail) { err('Please enter your email address.'); return }
    setLoading(true)
    const { error } = await db.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '/'
    })
    setLoading(false)
    if (error) { err(error.message); return }
    setSentEmail(resetEmail)
    setView('sent')
  }

  async function updatePassword() {
    setAlert({ msg: '', type: '' })
    if (newPw.length < 6) { err('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { err('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await db.auth.updateUser({ password: newPw })
    setLoading(false)
    if (error) { err(error.message); return }
    setAlert({ msg: '✅ Password updated! Signing you in…', type: 'success' })
    setTimeout(() => nav('/', { replace: true }), 2000)
  }

  const [title, sub] = VIEWS[view] || VIEWS.login

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.header}>
          <div className={s.logo}>A</div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>

        <div className={s.body}>
          {alert.msg && <div className={`${s.alert} ${s[alert.type]}`}>{alert.msg}</div>}

          {view === 'login' && <>
            <div className={s.field}>
              <label>Email Address</label>
              <div className={s.inputWrap}>
                <span className={s.icon}>✉️</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  onKeyDown={e => e.key === 'Enter' && signIn()} />
              </div>
            </div>
            <div className={s.field}>
              <label>Password</label>
              <div className={s.inputWrap}>
                <span className={s.icon}>🔒</span>
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Your password"
                  autoComplete="current-password" onKeyDown={e => e.key === 'Enter' && signIn()} />
                <span className={s.eye} onClick={() => setShowPw(p => !p)}>👁️</span>
              </div>
            </div>
            <div className={s.row}>
              <label className={s.remember}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button className={s.link} onClick={() => setView('reset')}>Forgot password?</button>
            </div>
            <button className={s.btn} disabled={loading} onClick={signIn}>
              {loading ? <><span className="spinner"/>Signing in…</> : 'Sign In'}
            </button>
            <p className={s.foot}>
              Don't have an account?{' '}
              <button className={s.link} onClick={() => nav('/signup')}>Sign Up</button>
            </p>
          </>}

          {view === 'reset' && <>
            <button className={s.back} onClick={() => setView('login')}>← Back to Sign In</button>
            <p className={s.hint}>Enter your email and we'll send a link to reset your password.</p>
            <div className={s.field}>
              <label>Email Address</label>
              <div className={s.inputWrap}>
                <span className={s.icon}>✉️</span>
                <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && sendReset()} />
              </div>
            </div>
            <button className={s.btn} disabled={loading} onClick={sendReset}>
              {loading ? <><span className="spinner"/>Sending…</> : 'Send Reset Link'}
            </button>
          </>}

          {view === 'sent' && (
            <div className={s.sentBox}>
              <div className={s.big}>📧</div>
              <h3>Check your inbox</h3>
              <p>A reset link has been sent to <strong>{sentEmail}</strong>.</p>
              <button className={s.btn} onClick={() => setView('login')}>Back to Sign In</button>
            </div>
          )}

          {view === 'set-password' && <>
            <p className={s.hint}>Choose a new password for your account.</p>
            <div className={s.field}>
              <label>New Password</label>
              <div className={s.inputWrap}>
                <span className={s.icon}>🔒</span>
                <input type={showPw ? 'text' : 'password'} value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters"
                  onKeyDown={e => e.key === 'Enter' && updatePassword()} />
                <span className={s.eye} onClick={() => setShowPw(p => !p)}>👁️</span>
              </div>
            </div>
            <div className={s.field}>
              <label>Confirm Password</label>
              <div className={s.inputWrap}>
                <span className={s.icon}>🔒</span>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat password" onKeyDown={e => e.key === 'Enter' && updatePassword()} />
              </div>
            </div>
            <button className={s.btn} disabled={loading} onClick={updatePassword}>
              {loading ? <><span className="spinner"/>Updating…</> : 'Set New Password'}
            </button>
          </>}
        </div>
      </div>
    </div>
  )
}
