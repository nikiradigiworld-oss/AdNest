import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, SUPABASE_URL, SUPABASE_ANON, restHeaders, REST } from '../lib/supabase'
import s from './ViewerDashboard.module.css'

export default function ViewerDashboard() {
  const nav = useNavigate()
  const [user,      setUser]      = useState(null)
  const [tab,       setTab]       = useState('ads')
  const [coins,     setCoins]     = useState(0)
  const [cash,      setCash]      = useState(0)
  const [watchCount,setWatchCount]= useState(0)
  const [refCount,  setRefCount]  = useState(0)
  const [refCoins,  setRefCoins]  = useState(0)
  const [refCash,   setRefCash]   = useState(0)
  const [ads,       setAds]       = useState([])
  const [watchedAds,setWatchedAds]= useState(new Set())
  const [clickedAds,setClickedAds]= useState(new Set())
  const [unread,    setUnread]    = useState(false)
  const [adModal,   setAdModal]   = useState(null)
  const [vidModal,  setVidModal]  = useState(null)
  const [smModal,   setSmModal]   = useState(null)
  const [adCache,   setAdCache]   = useState({})

  // Profile state
  const [profile,   setProfile]   = useState({})
  const [refCode,   setRefCode]   = useState('')
  const [saveMsg,   setSaveMsg]   = useState('')
  const [wdAmount,  setWdAmount]  = useState('')
  const [wdMsg,     setWdMsg]     = useState({ msg:'',ok:false })
  const [wdHistory, setWdHistory] = useState([])
  const [copied,    setCopied]    = useState(false)

  // Chat
  const [chatMsgs,  setChatMsgs]  = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading,setChatLoading]=useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') nav('/login', { replace: true })
    })
  }, [nav])

  useEffect(() => {
    if (!user) return
    loadWallet()
    loadAds()
    checkUnread()
    const t = setInterval(checkUnread, 30000)
    return () => clearInterval(t)
  }, [user])

  useEffect(() => {
    db.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { nav('/login', { replace: true }); return }
      setUser(u)
    })
  }, [nav])

  async function loadWallet() {
    try {
      const H = await restHeaders()
      const uid = user.id
      const [walletRes, watchRes, refRes] = await Promise.all([
        fetch(REST + 'coin_wallets?select=coins,cash_value&user_id=eq.' + uid + '&limit=1', { headers: H }),
        fetch(REST + 'ad_views?select=id&viewer_id=eq.' + uid, { method:'HEAD', headers:{...H,'Prefer':'count=exact'} }),
        fetch(REST + 'referral_earnings?select=referred_user_id,coins_earned,cash_earned&referrer_id=eq.' + uid, { headers: H }),
      ])
      const walletArr = walletRes.ok ? await walletRes.json() : []
      const wallet    = Array.isArray(walletArr) ? walletArr[0] : walletArr
      const rangeStr  = watchRes.headers.get('content-range') || ''
      const wc        = parseInt(rangeStr.split('/')[1] || '0', 10) || 0
      const refRows   = refRes.ok ? await refRes.json() : []
      const refArr    = Array.isArray(refRows) ? refRows : []
      const rc  = new Set(refArr.map(r => r.referred_user_id).filter(Boolean)).size
      const rco = refArr.reduce((a, r) => a + (r.coins_earned || 0), 0)
      const rca = refArr.reduce((a, r) => a + (Number(r.cash_earned) || 0), 0)
      setCoins(wallet?.coins || 0)
      setCash(wallet?.cash_value || 0)
      setWatchCount(wc)
      setRefCount(rc); setRefCoins(rco); setRefCash(rca)
    } catch(e) { console.error('loadWallet', e) }
  }

  async function loadAds() {
    const CACHE_KEY = 'anaar_ads_cache_' + user.id
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (cached) {
        setWatchedAds(new Set(cached.watched || []))
        setClickedAds(new Set(cached.clicked || []))
        setAds(cached.ads || [])
        const newCache = {}; (cached.ads||[]).forEach(a => newCache[a.id]=a)
        setAdCache(newCache)
      }
    } catch(e) {}

    try {
      const H   = await restHeaders()
      const uid = user.id
      const [adsRes, viewsRes, clicksRes] = await Promise.all([
        fetch(REST + 'ads?select=id,title,ad_type,content_url,target_area,target_value,whatsapp_number,views_ordered,budget_total,rate_per_1k&status=eq.active', { headers: H }),
        fetch(REST + 'ad_views?select=ad_id&viewer_id=eq.'  + uid, { headers: H }),
        fetch(REST + 'ad_clicks?select=ad_id&viewer_id=eq.' + uid, { headers: H }),
      ])
      if (!adsRes.ok) throw new Error('ads ' + adsRes.status)
      const [adsData, viewsData, clicksData] = await Promise.all([adsRes.json(), viewsRes.json(), clicksRes.json()])
      const wa = new Set((viewsData  || []).map(r => r.ad_id).filter(Boolean))
      const ca = new Set((clicksData || []).map(r => r.ad_id).filter(Boolean))
      const list = Array.isArray(adsData) ? adsData : []
      setWatchedAds(wa); setClickedAds(ca); setAds(list)
      const newCache = {}; list.forEach(a => newCache[a.id]=a)
      setAdCache(newCache)
      try {
        if (list.length === 0) localStorage.removeItem(CACHE_KEY)
        else localStorage.setItem(CACHE_KEY, JSON.stringify({ ads: list, watched:[...wa], clicked:[...ca], ts:Date.now() }))
      } catch(e) {}
    } catch(err) { console.error('loadAds', err) }
  }

  async function checkUnread() {
    if (!user) return
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'support_messages?select=id&sender=eq.admin&is_read=eq.false&user_id=eq.' + user.id, {
        method: 'HEAD', headers: { ...H, 'Prefer': 'count=exact' }
      })
      const cnt = parseInt((res.headers.get('content-range')||'').split('/')[1]||'0', 10) || 0
      setUnread(cnt > 0)
    } catch(e) {}
  }

  async function loadProfile() {
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'users?select=name,mobile,gender,dob,state,district,pincode,bank_holder_name,bank_name,bank_account_no,bank_ifsc,bank_branch,bank_account_type,referral_code&id=eq.' + user.id + '&limit=1', { headers: H })
      const arr = res.ok ? await res.json() : []
      const data = arr[0] || {}
      setProfile(data)
      let code = data.referral_code || ''
      if (!code) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        code = Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('')
        await db.from('users').update({ referral_code: code }).eq('id', user.id)
      }
      setRefCode(code)
      // Load withdrawal history
      const wRes = await fetch(REST + 'withdrawal_requests?select=amount_rupees,status,requested_at&user_id=eq.' + user.id + '&order=requested_at.desc&limit=5', { headers: H })
      if (wRes.ok) setWdHistory(await wRes.json())
    } catch(e) { console.error('loadProfile', e) }
  }

  async function saveProfile() {
    setSaveMsg('')
    const { error } = await db.from('users').update({
      name: profile.name, mobile: profile.mobile, gender: profile.gender,
      dob: profile.dob, state: profile.state, district: profile.district,
      pincode: profile.pincode, bank_holder_name: profile.bank_holder_name,
      bank_name: profile.bank_name, bank_account_no: profile.bank_account_no,
      bank_ifsc: profile.bank_ifsc, bank_branch: profile.bank_branch,
      bank_account_type: profile.bank_account_type,
    }).eq('id', user.id)
    setSaveMsg(error ? '❌ ' + error.message : '✅ Profile saved!')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function requestWithdrawal() {
    setWdMsg({ msg:'', ok:false })
    const amt = parseFloat(wdAmount)
    if (!amt || amt < 1000) { setWdMsg({ msg:'Minimum withdrawal is ₹1,000', ok:false }); return }
    if (amt > parseFloat(cash)) { setWdMsg({ msg:`Insufficient balance. Available: ₹${parseFloat(cash).toFixed(2)}`, ok:false }); return }
    if (!profile.bank_account_no) { setWdMsg({ msg:'Please save your bank details in Profile first', ok:false }); return }
    const { error } = await db.rpc('request_withdrawal', { p_user_id: user.id, p_rupees: amt })
    if (error) { setWdMsg({ msg:'Error: ' + error.message, ok:false }); return }
    setWdMsg({ msg:`✅ Withdrawal of ₹${amt.toFixed(2)} requested!`, ok:true })
    setWdAmount('')
    loadWallet()
    loadProfile()
  }

  async function watchAd(ad, btn) {
    btn.disabled = true; btn.textContent = 'Processing…'
    const coins = ad.ad_type === 'video' ? 10 : 5
    const { data, error } = await db.rpc('earn_coins_for_view', { p_viewer_id: user.id, p_ad_id: ad.id, p_coins: coins })
    btn.disabled = false
    if (error || !data?.success) {
      btn.textContent = error?.message?.includes('already') ? '✅ Already watched' : '❌ Error'
      setTimeout(() => { btn.textContent = '👁️ Watch'; btn.disabled = false }, 2000)
      return
    }
    btn.className = s.btnWatched; btn.textContent = '✅ Watched'
    setWatchedAds(prev => new Set([...prev, ad.id]))
    showToast('🪙 +' + coins + ' coins earned!')
    loadWallet()
    db.rpc('credit_referral_bonus', { p_viewer_id: user.id, p_ad_id: ad.id })
  }

  async function clickAd(ad, btn) {
    btn.disabled = true; btn.textContent = 'Processing…'
    const { data, error } = await db.rpc('record_ad_click', { p_viewer_id: user.id, p_ad_id: ad.id })
    btn.disabled = false
    if (error || !data?.success) {
      btn.textContent = error?.message?.includes('already') ? '✅ Done' : '❌ Error'
      setTimeout(() => { btn.textContent = '👆 Interact'; btn.disabled = false }, 2000)
      return
    }
    btn.className = s.btnWatched; btn.textContent = '✅ Done'
    setClickedAds(prev => new Set([...prev, ad.id]))
    const earned = data.coins_earned || 0
    const cash   = data.cash_earned  || 0
    showToast(`✅ +₹${Number(cash).toFixed(2)} earned! (${earned} coins)`)
    loadWallet()
    db.rpc('credit_referral_bonus', { p_viewer_id: user.id, p_ad_id: ad.id })
  }

  async function loadChat() {
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'support_messages?select=message,sender,created_at&user_id=eq.' + user.id + '&order=created_at.asc&limit=50', { headers: H })
      if (res.ok) setChatMsgs(await res.json())
      // Mark admin messages as read
      await db.from('support_messages').update({ is_read: true }).eq('user_id', user.id).eq('sender', 'admin').eq('is_read', false)
      setUnread(false)
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, 100)
    } catch(e) {}
  }

  async function sendChat() {
    const msg = chatInput.trim()
    if (!msg || !user) return
    setChatLoading(true)
    const { error } = await db.from('support_messages').insert({ user_id: user.id, message: msg, sender: 'user' })
    setChatLoading(false)
    if (error) { showToast('Send failed: ' + error.message, 'error'); return }
    setChatInput('')
    loadChat()
  }

  async function deleteAccount() {
    const confirmEmail = window.prompt('Type your email to confirm account deletion:')
    if (confirmEmail !== user.email) { showToast('Email did not match.', 'error'); return }
    const { error } = await db.rpc('delete_own_account')
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    await db.auth.signOut()
    nav('/login', { replace: true })
  }

  function showToast(msg, type) { window.showToast && window.showToast(msg, type) }

  function refLink() { return `https://anaar.fun/signup?ref=${refCode}` }
  function refMsg()  { return `Join Anaar and earn real money watching ads! Use my referral code ${refCode}: ${refLink()}` }

  function copyRefLink() {
    navigator.clipboard.writeText(refLink()).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareVia(platform) {
    const link = refLink()
    const msg  = encodeURIComponent(refMsg())
    const url  = encodeURIComponent(link)
    const urls = {
      whatsapp: `https://wa.me/?text=${msg}`,
      telegram: `https://t.me/share/url?url=${url}&text=${encodeURIComponent(`Join Anaar — earn money watching ads! Code: ${refCode}`)}`,
      twitter:  `https://twitter.com/intent/tweet?text=${msg}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    }
    window.open(urls[platform], '_blank', 'noopener,noreferrer')
  }

  const uname = user?.user_metadata?.name || user?.email || 'User'
  const avLetter = uname.charAt(0).toUpperCase()
  const availCount = ads.filter(a => a.ad_type === 'video' ? !watchedAds.has(a.id) : !clickedAds.has(a.id)).length

  if (!user) return <div className={s.loading}>Loading…</div>

  return (
    <div className={s.app}>
      {/* Top Nav */}
      <nav className={s.topnav}>
        <div className={s.brand}>
          <div className={s.navLogo}>A</div>
          <span className={s.brandName}>Anaar</span>
        </div>
        <div className={s.navRight}>
          <button className={s.notifBtn} onClick={() => { setTab('chat'); loadChat() }}>
            🔔{unread && <span className={s.dot} />}
          </button>
          <div className={s.userChip}>
            <div className={s.av}>{avLetter}</div>
            <span className={s.navName}>{uname.split(' ')[0]}</span>
          </div>
          {user?.user_metadata?.role === 'admin' && (
            <button className={s.navLink} onClick={() => nav('/admin')}>Admin</button>
          )}
          {(user?.user_metadata?.role === 'both') && (
            <button className={s.navLink} onClick={() => nav('/post-ad')}>📢 Post Ad</button>
          )}
          <button className={s.logoutBtn} onClick={() => db.auth.signOut().then(() => nav('/login', { replace: true }))}>Sign Out</button>
        </div>
      </nav>

      {/* Body: sidebar + content */}
      <div className={s.body}>

        {/* Left Sidebar */}
        <aside className={s.sidebar}>
          {[
            { id:'wallet',  icon:'🪙', label:'Wallet' },
            { id:'ads',     icon:'📢', label:'Ads' },
            { id:'profile', icon:'👤', label:'Profile', onClick: () => { setTab('profile'); loadProfile() } },
            { id:'chat',    icon:'💬', label:'Support', onClick: () => { setTab('chat'); loadChat() } },
          ].map(item => (
            <button key={item.id}
              className={`${s.sideItem} ${tab===item.id?s.sideActive:''}`}
              onClick={() => { if (item.onClick) item.onClick(); else setTab(item.id) }}>
              <span className={s.sideIcon}>
                {item.icon}
                {item.id==='chat' && unread && <span className={s.sideDot}/>}
              </span>
              <span className={s.sideLabel}>{item.label}</span>
            </button>
          ))}
          {user?.user_metadata?.role === 'both' && (
            <button className={s.sideItem} onClick={() => nav('/post-ad')}>
              <span className={s.sideIcon}>📤</span>
              <span className={s.sideLabel}>Post Ad</span>
            </button>
          )}
        </aside>

        {/* Main content */}
        <main className={s.main}>

        {/* Wallet Tab */}
        {tab === 'wallet' && (
          <div className={s.walletTab}>
            {user?.user_metadata?.role === 'both' && (
              <div className={s.postAdBanner} onClick={() => nav('/post-ad')}>
                <span>📢</span>
                <div>
                  <div style={{fontWeight:800,fontSize:'.95rem'}}>Post an Ad</div>
                  <div style={{fontSize:'.75rem',opacity:.8}}>Advertise your business to viewers</div>
                </div>
                <span style={{marginLeft:'auto',fontSize:'1.2rem'}}>→</span>
              </div>
            )}
            <div className={s.statsGrid}>
              <div className={s.statCard}><div className={s.sIcon}>🪙</div><div className={s.sLabel}>Total Coins</div><div className={s.sValue}>{Number(coins).toLocaleString()}</div></div>
              <div className={s.statCard}><div className={s.sIcon}>₹</div><div className={s.sLabel}>Cash Value</div><div className={s.sValue}>₹{parseFloat(cash).toFixed(2)}</div></div>
              <div className={s.statCard}><div className={s.sIcon}>👁️</div><div className={s.sLabel}>Ads Watched</div><div className={s.sValue}>{watchCount}</div></div>
              <div className={s.statCard}><div className={s.sIcon}>📢</div><div className={s.sLabel}>Available Ads</div><div className={s.sValue}>{availCount}</div></div>
              <div className={s.statCard}><div className={s.sIcon}>👥</div><div className={s.sLabel}>Referrals</div><div className={s.sValue}>{refCount}</div></div>
              <div className={s.statCard}><div className={s.sIcon}>🎁</div><div className={s.sLabel}>Ref. Earnings</div><div className={s.sValue}>₹{Number(refCash).toFixed(2)}</div></div>
            </div>

            {/* Withdrawal */}
            <div className={s.panel}>
              <div className={s.panelTitle}>💸 Request Withdrawal</div>
              <div className={s.panelBody}>
                <div style={{marginBottom:'.75rem',fontSize:'.85rem',color:'rgba(255,255,255,.6)'}}>
                  Available: <strong style={{color:'#FFD700'}}>₹{parseFloat(cash).toFixed(2)}</strong>
                </div>
                <input type="number" value={wdAmount} onChange={e=>setWdAmount(e.target.value)}
                  placeholder="Amount (min ₹1000)" className={s.input}
                  style={{marginBottom:'.75rem'}} />
                {wdMsg.msg && <div style={{padding:'.6rem .9rem',borderRadius:8,marginBottom:'.75rem',
                  background:wdMsg.ok?'rgba(39,174,96,.15)':'rgba(231,76,60,.15)',
                  color:wdMsg.ok?'#2ecc71':'#e74c3c',fontSize:'.83rem',fontWeight:600}}>{wdMsg.msg}</div>}
                <button className={s.btnPrimary} onClick={requestWithdrawal}>💸 Request Withdrawal</button>
                {wdHistory.length > 0 && <div style={{marginTop:'1rem'}}>
                  <div style={{fontSize:'.75rem',fontWeight:700,color:'#aaa',marginBottom:'.5rem',textTransform:'uppercase',letterSpacing:'.05em'}}>Recent Requests</div>
                  {wdHistory.map((r,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'.45rem 0',borderBottom:'1px solid rgba(255,255,255,.06)',fontSize:'.82rem'}}>
                      <span>₹{parseFloat(r.amount_rupees).toFixed(2)}</span>
                      <span style={{color:r.status==='completed'?'#27ae60':r.status==='rejected'?'#e74c3c':r.status==='processing'?'#f39c12':'#888',fontWeight:700,textTransform:'capitalize'}}>{r.status}</span>
                      <span style={{color:'#666',fontSize:'.74rem'}}>{new Date(r.requested_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          </div>
        )}

        {/* Ads Tab */}
        {tab === 'ads' && (
          <div className={s.adsTab}>
            <div className={s.adsHeader}>
              <h2>Available Ads</h2>
              <button className={s.refreshBtn} onClick={loadAds}>↻ Refresh</button>
            </div>
            {ads.length === 0 ? (
              <div className={s.empty}>
                <div className={s.eIcon}>📭</div>
                <p>No active ads right now. Check back soon!</p>
                <button className={s.btnPrimary} onClick={loadAds} style={{marginTop:'1rem'}}>↻ Refresh</button>
              </div>
            ) : (
              <div className={s.adsGrid}>
                {ads.map(ad => {
                  const watched = watchedAds.has(ad.id)
                  const clicked = clickedAds.has(ad.id)
                  const done    = ad.ad_type === 'video' ? watched : clicked
                  return (
                    <div key={ad.id} className={`${s.adCard} ${done?s.adDone:''}`}>
                      <div className={s.adTag}>{ad.ad_type === 'video' ? '🎬 Video' : '🖼️ Image'}</div>
                      <div className={s.adTitle}>{ad.title}</div>
                      {ad.target_area && <div className={s.adArea}>📍 {ad.target_area}: {ad.target_value}</div>}
                      <div className={s.adEarn}>
                        {ad.ad_type === 'video' ? '🪙 +10 coins for watching' : '🪙 +5 coins for clicking'}
                      </div>
                      {done ? (
                        <button className={s.btnWatched} disabled>✅ {ad.ad_type === 'video' ? 'Watched' : 'Done'}</button>
                      ) : (
                        <button className={s.btnWatch}
                          onClick={e => ad.ad_type === 'video' ? setVidModal(ad) : setAdModal(ad)}>
                          {ad.ad_type === 'video' ? '▶️ Watch' : '👆 View Ad'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className={s.profileTab}>
            {/* Referral section */}
            <div className={s.panel}>
              <div className={s.panelTitle}>🎟️ Your Referral Code</div>
              <div className={s.panelBody}>
                <div className={s.refCodeBox}>{refCode || '…'}</div>
                <div style={{fontSize:'.82rem',color:'rgba(255,255,255,.6)',marginBottom:'1rem',wordBreak:'break-all'}}>
                  🔗 <span style={{color:'#FFD700'}}>anaar.fun/signup?ref={refCode}</span>
                </div>

                {/* Share buttons */}
                <div className={s.shareGrid}>
                  <button className={`${s.shareBtn} ${s.shareWhatsapp}`} onClick={() => shareVia('whatsapp')}>
                    <span className={s.shareIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </span>
                    WhatsApp
                  </button>
                  <button className={`${s.shareBtn} ${s.shareTelegram}`} onClick={() => shareVia('telegram')}>
                    <span className={s.shareIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    </span>
                    Telegram
                  </button>
                  <button className={`${s.shareBtn} ${s.shareTwitter}`} onClick={() => shareVia('twitter')}>
                    <span className={s.shareIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </span>
                    Twitter/X
                  </button>
                  <button className={`${s.shareBtn} ${s.shareFacebook}`} onClick={() => shareVia('facebook')}>
                    <span className={s.shareIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </span>
                    Facebook
                  </button>
                  <button className={`${s.shareBtn} ${s.shareCopy} ${copied?s.shareCopied:''}`} onClick={copyRefLink}>
                    <span className={s.shareIcon}>{copied ? '✅' : '📋'}</span>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>

                <div className={s.statsGrid} style={{gridTemplateColumns:'1fr 1fr 1fr',gap:'.5rem',marginBottom:0,marginTop:'1rem'}}>
                  <div className={s.statCard}><div className={s.sLabel}>Referrals</div><div className={s.sValue}>{refCount}</div></div>
                  <div className={s.statCard}><div className={s.sLabel}>Coins Earned</div><div className={s.sValue}>{Number(refCoins).toLocaleString()}</div></div>
                  <div className={s.statCard}><div className={s.sLabel}>Cash Earned</div><div className={s.sValue}>₹{Number(refCash).toFixed(2)}</div></div>
                </div>
              </div>
            </div>

            {/* Profile form */}
            <div className={s.panel}>
              <div className={s.panelTitle}>👤 Edit Profile</div>
              <div className={s.panelBody}>
                {[
                  ['Full Name','name','text'],['Mobile Number','mobile','tel'],
                  ['Date of Birth','dob','date'],['Pincode','pincode','text'],
                  ['State','state','text'],['District','district','text'],
                ].map(([label, field, type]) => (
                  <div className={s.formField} key={field}>
                    <label>{label}</label>
                    <input type={type} value={profile[field]||''} className={s.input}
                      onChange={e=>setProfile(p=>({...p,[field]:e.target.value}))} />
                  </div>
                ))}
                <div className={s.formField}><label>Gender</label>
                  <select value={profile.gender||''} className={s.input} onChange={e=>setProfile(p=>({...p,gender:e.target.value}))}>
                    <option value="">Select</option>
                    <option value="male">Male</option><option value="female">Female</option>
                    <option value="other">Other</option><option value="prefer_not">Prefer not to say</option>
                  </select>
                </div>
                {saveMsg && <div style={{padding:'.5rem .75rem',borderRadius:8,marginBottom:'.5rem',background:saveMsg.startsWith('✅')?'rgba(39,174,96,.15)':'rgba(231,76,60,.15)',color:saveMsg.startsWith('✅')?'#2ecc71':'#e74c3c',fontSize:'.83rem',fontWeight:600}}>{saveMsg}</div>}
                <button className={s.btnPrimary} onClick={saveProfile}>💾 Save Profile</button>
              </div>
            </div>

            {/* Bank Details */}
            <div className={s.panel}>
              <div className={s.panelTitle}>🏦 Bank Details</div>
              <div className={s.panelBody}>
                {[
                  ['Account Holder Name','bank_holder_name'],['Bank Name','bank_name'],
                  ['Account Number','bank_account_no'],['IFSC Code','bank_ifsc'],
                  ['Branch','bank_branch'],
                ].map(([label, field]) => (
                  <div className={s.formField} key={field}>
                    <label>{label}</label>
                    <input type="text" value={profile[field]||''} className={s.input}
                      onChange={e=>setProfile(p=>({...p,[field]:e.target.value}))} />
                  </div>
                ))}
                <div className={s.formField}><label>Account Type</label>
                  <select value={profile.bank_account_type||'savings'} className={s.input} onChange={e=>setProfile(p=>({...p,bank_account_type:e.target.value}))}>
                    <option value="savings">Savings</option><option value="current">Current</option>
                  </select>
                </div>
                {saveMsg && <div style={{padding:'.5rem .75rem',borderRadius:8,marginBottom:'.5rem',background:saveMsg.startsWith('✅')?'rgba(39,174,96,.15)':'rgba(231,76,60,.15)',color:saveMsg.startsWith('✅')?'#2ecc71':'#e74c3c',fontSize:'.83rem',fontWeight:600}}>{saveMsg}</div>}
                <button className={s.btnPrimary} onClick={saveProfile}>💾 Save Bank Details</button>
              </div>
            </div>

            {/* Danger Zone */}
            <div className={s.panel} style={{borderColor:'rgba(239,68,68,.3)'}}>
              <div className={s.panelTitle}>⚠️ Danger Zone</div>
              <div className={s.panelBody}>
                <p style={{fontSize:'.85rem',color:'rgba(255,255,255,.5)',marginBottom:'1rem',lineHeight:1.5}}>Permanently delete your account and all your data. This cannot be undone.</p>
                <button onClick={deleteAccount} style={{background:'rgba(239,68,68,.12)',border:'1.5px solid rgba(239,68,68,.5)',color:'#ef4444',padding:'.7rem 1.4rem',borderRadius:9,fontSize:'.9rem',fontWeight:700,cursor:'pointer',width:'100%'}}>
                  🗑️ Delete My Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {tab === 'chat' && (
          <div className={s.chatTab}>
            <div className={s.chatTitle}>Support Chat</div>
            <div className={s.chatMsgs} ref={chatRef}>
              {chatMsgs.length === 0 && <div className={s.chatEmpty}>No messages yet. Send us a message!</div>}
              {chatMsgs.map((m, i) => (
                <div key={i} className={m.sender === 'admin' ? s.chatAdmin : s.chatUser}>
                  <div className={s.chatBubble}>{m.message}</div>
                  <div className={s.chatTime}>{new Date(m.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              ))}
            </div>
            <div className={s.chatInput}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Type a message…"
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendChat()} />
              <button disabled={chatLoading} onClick={sendChat}>Send</button>
            </div>
          </div>
        )}
        </main>
      </div>

      {/* Image Ad Modal */}
      {adModal && (
        <div className={s.modalOverlay} onClick={()=>setAdModal(null)}>
          <div className={s.modal} onClick={e=>e.stopPropagation()}>
            <button className={s.modalClose} onClick={()=>setAdModal(null)}>✕</button>
            <h3 className={s.modalTitle}>{adModal.title}</h3>
            {adModal.content_url && <img src={adModal.content_url} alt={adModal.title} className={s.adImg} />}
            {adModal.whatsapp_number && (
              <a href={`https://wa.me/${adModal.whatsapp_number}`} target="_blank" rel="noreferrer" className={s.waBtn}>
                💬 WhatsApp
              </a>
            )}
            <button className={s.btnPrimary} style={{marginTop:'.75rem'}}
              onClick={e => { clickAd(adModal, e.currentTarget); setAdModal(null) }}>
              👆 Interact & Earn 🪙
            </button>
          </div>
        </div>
      )}

      {/* Video Ad Modal */}
      {vidModal && (
        <div className={s.modalOverlay} onClick={()=>setVidModal(null)}>
          <div className={s.modal} onClick={e=>e.stopPropagation()}>
            <button className={s.modalClose} onClick={()=>setVidModal(null)}>✕</button>
            <h3 className={s.modalTitle}>{vidModal.title}</h3>
            {vidModal.content_url && (
              <video src={vidModal.content_url} controls autoPlay className={s.adVideo}
                onEnded={e => { watchAd(vidModal, e.currentTarget); setVidModal(null) }} />
            )}
            <p style={{fontSize:'.82rem',color:'rgba(255,255,255,.6)',textAlign:'center',marginTop:'.5rem'}}>Watch the full video to earn coins</p>
          </div>
        </div>
      )}
    </div>
  )
}
