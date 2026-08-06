import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../lib/supabase'
import s from './Signup.module.css'

export default function Signup() {
  const nav = useNavigate()
  const [params] = useSearchParams()

  const [step,     setStep]    = useState(1)
  const [role,     setRole]    = useState(params.get('role') || null)
  const [alert,    setAlert]   = useState({ msg: '', type: '' })
  const [loading,  setLoading] = useState(false)

  // Step 1
  const [name,      setName]     = useState('')
  const [email,     setEmail]    = useState('')
  const [password,  setPassword] = useState('')
  const [confirm,   setConfirm]  = useState('')
  const [terms,     setTerms]    = useState(false)
  const [showPw,    setShowPw]   = useState(false)
  const [pwScore,   setPwScore]  = useState(0)
  const [refCode,   setRefCode]  = useState('')
  const [refValid,  setRefValid] = useState(false)
  const [refStatus, setRefStatus]= useState('')
  const [refHint,   setRefHint]  = useState('')

  // Step 2
  const [mobile,    setMobile]   = useState('')
  const [dob,       setDob]      = useState('')
  const [gender,    setGender]   = useState('')
  const [pincode,   setPincode]  = useState('')
  const [stateName, setStateName]= useState('')
  const [district,  setDistrict] = useState('')
  const [districts, setDistricts]= useState([])
  const [pinStatus, setPinStatus]= useState('')
  const [pinHint,   setPinHint]  = useState('')

  // Step 4
  const [verifyEmail, setVerifyEmail] = useState('')
  const [successTitle,setSuccessTitle]= useState('Account Created!')
  const [successMsg,  setSuccessMsg]  = useState('')

  useEffect(() => {
    const ref = params.get('ref')?.toUpperCase() || ''
    if (ref) {
      setRefCode(ref)
      setRefValid(true)
      setRefStatus('✅')
      setRefHint('🎁 You were invited — enjoy bonus coins on signup!')
    }
  }, [params])

  function err(msg) { setAlert({ msg, type: 'error' }) }

  function checkStrength(val) {
    let score = 0
    if (val.length >= 8)          score++
    if (/[A-Z]/.test(val))        score++
    if (/[0-9]/.test(val))        score++
    if (/[^A-Za-z0-9]/.test(val)) score++
    setPwScore(val.length === 0 ? 0 : score)
  }

  const refTimer = useRef(null)
  async function validateRefCode(val) {
    if (!val) { setRefStatus(''); setRefHint(''); setRefCode(''); setRefValid(false); return }
    if (val.length < 6) { setRefHint('Referral codes are 8 characters'); setRefValid(false); return }
    setRefStatus('⏳'); setRefHint('Checking…')
    clearTimeout(refTimer.current)
    refTimer.current = setTimeout(async () => {
      try {
        const { data: isValid } = await db.rpc('validate_referral_code', { p_code: val })
        if (isValid) {
          setRefStatus('✅'); setRefHint("🎁 Valid code! You'll both earn bonus coins.")
          setRefCode(val); setRefValid(true)
        } else {
          setRefStatus('❌'); setRefHint('Invalid referral code.')
          setRefCode(''); setRefValid(false)
        }
      } catch { setRefStatus(''); setRefHint('') }
    }, 600)
  }

  async function autoFillLocation(pin) {
    setPinStatus('⏳'); setPinHint('Looking up pincode…')
    try {
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
      const data = await res.json()
      if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length) {
        const offices = data[0].PostOffice
        const st = offices[0].State || ''
        setStateName(st)
        const dists = [...new Set(offices.map(o => o.District).filter(Boolean))]
        setDistricts(dists)
        if (dists.length === 1) setDistrict(dists[0])
        else setDistrict('')
        setPinStatus('✅')
        setPinHint(dists.length > 1 ? `${dists.length} districts found` : st)
      } else {
        setPinStatus('❌'); setPinHint('Invalid pincode.')
        setStateName(''); setDistricts([]); setDistrict('')
      }
    } catch {
      setPinStatus('❌'); setPinHint('Could not fetch location.')
    }
  }

  function submitStep1() {
    setAlert({ msg: '', type: '' })
    if (!name)                         { err('Enter your full name.'); return }
    if (!email || !email.includes('@')){ err('Enter a valid email address.'); return }
    if (password.length < 8)           { err('Password must be at least 8 characters.'); return }
    if (password !== confirm)          { err('Passwords do not match.'); return }
    if (!terms)                        { err('Please accept the Terms of Service.'); return }
    setStep(2)
  }

  function submitStep2() {
    setAlert({ msg: '', type: '' })
    if (!pincode || pincode.length !== 6) { err('Please enter a valid 6-digit pincode.'); return }
    if (!district)                        { err('Please select your district.'); return }
    setStep(3)
  }

  async function submitStep3() {
    setAlert({ msg: '', type: '' })
    if (!role) { err('Please choose a role.'); return }
    setLoading(true)
    try {
      const inputCode = document.getElementById('ref-code-input')?.value?.trim().toUpperCase() || refCode
      const { data, error } = await db.auth.signUp({
        email, password,
        options: {
          data: { name, role, ref_code: inputCode },
          emailRedirectTo: window.location.origin + '/'
        }
      })
      if (error) { err(_fmtErr(error)); setLoading(false); return }
      const user = data?.user
      if (user?.id && (mobile || dob || gender || pincode || stateName || district)) {
        const profileData = { id: user.id }
        if (mobile)    profileData.mobile   = mobile
        if (dob)       profileData.dob      = dob
        if (gender)    profileData.gender   = gender
        if (pincode)   profileData.pincode  = pincode
        if (stateName) profileData.state    = stateName
        if (district)  profileData.district = district
        await db.from('users').update(profileData).eq('id', user.id)
      }
      setVerifyEmail(email)
      const titles = { viewer: 'Account Created!', advertiser: 'Advertiser Account Created!', both: 'Full Access Account Created!' }
      const msgs   = {
        viewer:     'After verifying your email, you can watch ads and earn real coin rewards!',
        advertiser: 'After verifying your email, you can post ads and track performance.',
        both:       'After verifying your email, you can run ads and earn coins as a viewer!'
      }
      setSuccessTitle(titles[role] || 'Account Created!')
      setSuccessMsg(msgs[role] || 'Please verify your email to get started.')
      setStep(4)
    } catch (e) {
      err(_fmtErr(e) || 'An unexpected error occurred. Please try again.')
    }
    setLoading(false)
  }

  function _fmtErr(err) {
    if (!err) return 'Signup failed. Please try again.'
    const raw = typeof err.message === 'string' ? err.message : ''
    if (!raw || raw === '{}' || raw === '[object Object]') {
      if (err.status === 429 || err.statusCode === 429) return 'Too many attempts — please wait a few minutes.'
      return 'Signup failed. Please check your details and try again.'
    }
    const lo = raw.toLowerCase()
    if (lo.includes('already registered') || lo.includes('email already')) return 'This email is already registered. Please sign in instead.'
    if (lo.includes('rate limit') || lo.includes('too many')) return 'Too many attempts — please wait a few minutes.'
    return raw
  }

  const pwColors = ['#e74c3c','#e67e22','#f1c40f','#27ae60']
  const pwLabels = ['Weak','Fair','Good','Strong']

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.header}>
          <div className={s.logo}>A</div>
          <h1>Create Account</h1>
          <p>Join Anaar — Advertise or Earn</p>
        </div>

        <div className={s.dots}>
          {[1,2,3,4].map(i => (
            <div key={i} className={`${s.dot} ${i < step ? s.done : i === step ? s.active : ''}`} />
          ))}
        </div>

        <div className={s.body}>
          {alert.msg && <div className={`${s.alert} ${s[alert.type]}`}>{alert.msg}</div>}

          {step === 1 && <>
            <div className={s.stepTitle}>Your account details</div>
            <div className={s.stepSub}>Use a valid email — you'll verify it after signup.</div>
            <div className={s.field}><label>Full Name</label>
              <div className={s.inputWrap}><span className={s.icon}>👤</span>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" autoComplete="name"/>
              </div>
            </div>
            <div className={s.field}><label>Email Address</label>
              <div className={s.inputWrap}><span className={s.icon}>✉️</span>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/>
              </div>
            </div>
            <div className={s.field}><label>Password</label>
              <div className={s.inputWrap}><span className={s.icon}>🔒</span>
                <input type={showPw?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);checkStrength(e.target.value)}} placeholder="Min. 8 characters" autoComplete="new-password"/>
                <span className={s.eye} onClick={()=>setShowPw(p=>!p)}>👁️</span>
              </div>
              {password && <><div className={s.pwBar}><div className={s.pwFill} style={{width:`${pwScore*25}%`,background:pwColors[pwScore-1]}}/></div>
              <div className={s.pwHint} style={{color:pwColors[pwScore-1]}}>{pwLabels[pwScore-1]||'Too short'}</div></>}
            </div>
            <div className={s.field}><label>Confirm Password</label>
              <div className={s.inputWrap}><span className={s.icon}>🔒</span>
                <input type={showPw?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter password"/>
              </div>
            </div>
            <div className={s.field}><label>Referral Code <span style={{fontWeight:400,color:'#aaa'}}>(optional)</span></label>
              <div className={s.inputWrap}><span className={s.icon}>🎟</span>
                <input id="ref-code-input" type="text" value={refCode}
                  onChange={e=>{const v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');setRefCode(v);validateRefCode(v)}}
                  placeholder="Enter referral code" maxLength={8}
                  style={{letterSpacing:'.1em',fontWeight:700}}/>
                <span className={s.eye}>{refStatus}</span>
              </div>
              {refHint && <div className={s.pwHint}>{refHint}</div>}
            </div>
            <label className={s.checkRow}>
              <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} />
              I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </label>
            <button className={s.btn} onClick={submitStep1}>Continue</button>
            <p className={s.foot}>Already have an account? <button className={s.link} onClick={()=>nav('/login')}>Sign In</button></p>
          </>}

          {step === 2 && <>
            <div className={s.stepTitle}>Your profile details</div>
            <div className={s.stepSub}>Pincode is required. Other fields are optional.</div>
            <div className={s.twoCol}>
              <div className={s.field}><label>Mobile Number</label>
                <div className={s.inputWrap}><span className={s.icon}>📱</span>
                  <input type="tel" value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,''))} placeholder="10-digit number" maxLength={10}/>
                </div>
              </div>
              <div className={s.field}><label>Date of Birth</label>
                <div className={s.inputWrap}><span className={s.icon}>🎂</span>
                  <input type="date" value={dob} onChange={e=>setDob(e.target.value)}/>
                </div>
              </div>
            </div>
            <div className={s.field}><label>Gender</label>
              <div className={s.inputWrap}><span className={s.icon}>👤</span>
                <select value={gender} onChange={e=>setGender(e.target.value)} className={s.select}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option><option value="female">Female</option>
                  <option value="other">Other</option><option value="prefer_not">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className={s.field}><label>Pincode <span style={{color:'#e74c3c'}}>*</span></label>
              <div className={s.inputWrap}><span className={s.icon}>📍</span>
                <input type="text" value={pincode} maxLength={6}
                  onChange={e=>{const v=e.target.value.replace(/\D/g,'');setPincode(v);if(v.length===6)autoFillLocation(v);else{setStateName('');setDistricts([]);setDistrict('');setPinStatus('');setPinHint('')}}}
                  placeholder="Enter 6-digit pincode"/>
                <span className={s.eye}>{pinStatus}</span>
              </div>
              {pinHint && <div className={s.pwHint}>{pinHint}</div>}
            </div>
            {stateName && <div className={s.field}><label>State</label>
              <div className={s.inputWrap}><span className={s.icon}>🗺️</span>
                <input value={stateName} readOnly style={{background:'#f0fff4',borderColor:'#27ae60'}}/>
              </div>
            </div>}
            {districts.length > 0 && <div className={s.field}><label>District <span style={{color:'#e74c3c'}}>*</span></label>
              <div className={s.inputWrap}><span className={s.icon}>🏘️</span>
                <select value={district} onChange={e=>setDistrict(e.target.value)} className={s.select}>
                  <option value="">Select your district</option>
                  {districts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>}
            <button className={s.btn} onClick={submitStep2}>Continue →</button>
            <button className={s.btnSkip} onClick={()=>setStep(3)}>Skip for now</button>
          </>}

          {step === 3 && <>
            <div className={s.stepTitle}>Choose your role</div>
            <div className={s.stepSub}>How will you use Anaar?</div>
            <div className={s.roleGrid}>
              {[
                {id:'viewer',    icon:'👁️', title:'Viewer',     sub:'Watch ads & earn coins'},
                {id:'advertiser',icon:'📢', title:'Advertiser', sub:'Run ads & get results'},
                {id:'both',      icon:'⭐', title:'Both',       sub:'Earn coins & run ads'},
              ].map(r=>(
                <div key={r.id} className={`${s.roleCard} ${role===r.id?s.selected:''}`} onClick={()=>setRole(r.id)}>
                  <div className={s.rIcon}>{r.icon}</div>
                  <h3>{r.title}</h3>
                  <p>{r.sub}</p>
                </div>
              ))}
            </div>
            <button className={s.btn} disabled={loading} onClick={submitStep3}>
              {loading ? <><span className="spinner"/>Creating…</> : 'Create Account'}
            </button>
          </>}

          {step === 4 && (
            <div className={s.successState}>
              <div className={s.successIcon}>🎉</div>
              <h2>{successTitle}</h2>
              <div className={s.verifyNote}>
                📧 A verification email has been sent to <strong>{verifyEmail}</strong>. Please click the link to activate your account.
              </div>
              <p>{successMsg}</p>
              <button className={s.btnGold} onClick={()=>nav('/login')}>Go to Login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
