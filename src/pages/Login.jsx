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

  // Deterministic star positions
  const STARS = Array.from({ length: 60 }, (_, i) => ({
    left:  `${(i * 37 + 11) % 100}%`,
    top:   `${(i * 53 + 7)  % 62}%`,
    size:  i % 5 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.4,
    dur:   `${2.5 + (i % 7) * 0.4}s`,
    delay: `${(i * 0.27) % 4}s`,
  }))

  return (
    <div className={s.page}>

      {/* Stars */}
      {STARS.map((st, i) => (
        <span key={i} className={s.star} style={{
          left: st.left, top: st.top,
          width: st.size, height: st.size,
          '--dur': st.dur, '--delay': st.delay,
        }} />
      ))}

      {/* Moon */}
      <div className={s.moon} />

      {/* Shooting star */}
      <div className={s.shootingStar} />

      {/* Landscape: mountains + trees */}
      <div className={s.landscape}>
        <svg viewBox="0 0 1440 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* Distant mountains – soft violet */}
          <path d="M0,220 C60,180 110,200 160,160 C210,120 260,155 320,130
                   C380,105 430,140 490,120 C550,100 600,130 660,110
                   C720,90 775,115 830,100 C885,85 940,118 1000,105
                   C1060,92 1120,120 1180,108 C1240,96 1300,130 1360,115
                   L1440,110 L1440,300 L0,300 Z"
            fill="rgba(90,20,130,0.55)" />

          {/* Mid mountains – darker purple */}
          <path d="M0,260 C50,230 100,250 150,220 C200,190 250,215 310,200
                   C370,185 420,210 480,195 C540,180 600,205 660,190
                   C720,175 790,200 850,185 C910,170 970,198 1030,183
                   C1090,168 1150,195 1210,180 C1270,165 1340,195 1400,180
                   L1440,175 L1440,300 L0,300 Z"
            fill="rgba(50,5,90,0.75)" />

          {/* Foreground hills – near black */}
          <path d="M0,285 C80,265 160,278 240,262 C320,246 400,270 480,258
                   C560,246 640,265 720,255 C800,245 880,268 960,258
                   C1040,248 1120,268 1200,258 C1280,248 1360,270 1440,260
                   L1440,300 L0,300 Z"
            fill="rgba(15,0,35,0.95)" />

          {/* Pine trees – left cluster */}
          <g fill="#0a0018">
            <polygon points="30,285 46,248 62,285" />
            <polygon points="55,285 68,258 81,285" />
            <polygon points="76,285 91,244 106,285" />
            <polygon points="100,285 116,252 132,285" />
            <polygon points="125,285 138,262 151,285" />
          </g>

          {/* Pine trees – right cluster */}
          <g fill="#0a0018">
            <polygon points="1290,285 1305,248 1320,285" />
            <polygon points="1315,285 1328,256 1341,285" />
            <polygon points="1338,285 1354,244 1370,285" />
            <polygon points="1362,285 1376,252 1390,285" />
            <polygon points="1385,285 1398,258 1411,285" />
          </g>

          {/* Rounded tree tops – mid left */}
          <g fill="#080014">
            <ellipse cx="220" cy="272" rx="18" ry="16" />
            <ellipse cx="248" cy="276" rx="14" ry="12" />
            <rect x="217" y="272" width="6" height="14" />
            <rect x="244" y="276" width="5" height="10" />

            <ellipse cx="290" cy="270" rx="20" ry="18" />
            <ellipse cx="320" cy="274" rx="15" ry="13" />
            <rect x="287" y="270" width="7" height="16" />
            <rect x="317" y="274" width="6" height="12" />
          </g>

          {/* Rounded tree tops – mid right */}
          <g fill="#080014">
            <ellipse cx="1130" cy="272" rx="18" ry="16" />
            <ellipse cx="1158" cy="276" rx="14" ry="12" />
            <rect x="1127" y="272" width="6" height="14" />
            <rect x="1154" y="276" width="5" height="10" />

            <ellipse cx="1200" cy="270" rx="20" ry="18" />
            <ellipse cx="1230" cy="274" rx="15" ry="13" />
            <rect x="1197" y="270" width="7" height="16" />
            <rect x="1227" y="274" width="6" height="12" />
          </g>

          {/* Ground bar */}
          <rect x="0" y="290" width="1440" height="10" fill="#080014" />
        </svg>
      </div>

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
