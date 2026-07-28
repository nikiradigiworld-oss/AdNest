import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, REST, restHeaders } from '../lib/supabase'
import s from './AdvertiserDashboard.module.css'

const RATES = { national:2.5, state:3.5, district:5.0 }

export default function AdvertiserDashboard() {
  const nav = useNavigate()
  const [user,    setUser]    = useState(null)
  const [tab,     setTab]     = useState('myads')
  const [walBal,  setWalBal]  = useState(0)
  const [myAds,   setMyAds]   = useState([])
  const [stats,   setStats]   = useState({})
  const [unread,  setUnread]  = useState(false)
  const [alertMsg,setAlertMsg]= useState({ msg:'', type:'' })
  const fileRef = useRef(null)
  const imgRef  = useRef(null)

  // Post Ad form state
  const [adType,     setAdType]    = useState('image')
  const [title,      setTitle]     = useState('')
  const [fileUrl,    setFileUrl]   = useState('')
  const [targetArea, setTargetArea]= useState('national')
  const [targetVal,  setTargetVal] = useState('')
  const [views,      setViews]     = useState(1000)
  const [whatsapp,   setWhatsapp]  = useState('')
  const [uploading,  setUploading] = useState(false)
  const [submitting, setSubmitting]= useState(false)

  // Profile
  const [profile, setProfile]   = useState({})
  const [profMsg,  setProfMsg]  = useState('')

  // Chat
  const [chatMsgs,  setChatMsgs]  = useState([])
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef(null)

  useEffect(() => {
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') nav('/login', { replace: true })
    })
  }, [nav])

  useEffect(() => {
    db.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { nav('/login', { replace: true }); return }
      const role = u.user_metadata?.role || 'viewer'
      if (role === 'viewer') { nav('/viewer-dashboard', { replace: true }); return }
      setUser(u)
    })
  }, [nav])

  useEffect(() => {
    if (!user) return
    loadStats()
    loadMyAds()
    checkUnread()
    const t = setInterval(checkUnread, 30000)
    return () => clearInterval(t)
  }, [user])

  async function loadStats() {
    if (!user) return
    try {
      const H = await restHeaders()
      const advRes = await fetch(REST + 'advertisers?select=id,wallet_balance&user_id=eq.' + user.id + '&limit=1', { headers: H })
      const advArr = advRes.ok ? await advRes.json() : []
      const adv    = advArr[0]
      if (!adv) return
      setWalBal(parseFloat(adv.wallet_balance) || 0)
      const adsRes = await fetch(REST + 'ads?select=id,status,views_ordered&advertiser_id=eq.' + adv.id, { headers: H })
      const adsArr = adsRes.ok ? await adsRes.json() : []
      setStats({
        total_ads:  adsArr.length,
        active_ads: adsArr.filter(a=>a.status==='active').length,
      })
    } catch(e) { console.error('loadStats', e) }
  }

  async function loadMyAds() {
    if (!user) return
    try {
      const H = await restHeaders()
      const advRes = await fetch(REST + 'advertisers?select=id&user_id=eq.' + user.id + '&limit=1', { headers: H })
      const advArr = advRes.ok ? await advRes.json() : []
      const adv    = advArr[0]
      if (!adv) { setMyAds([]); return }
      const adsRes = await fetch(REST + 'ads?select=id,title,ad_type,status,views_ordered,budget_total,created_at&advertiser_id=eq.' + adv.id + '&order=created_at.desc', { headers: H })
      if (adsRes.ok) setMyAds(await adsRes.json())
    } catch(e) { console.error('loadMyAds', e) }
  }

  async function checkUnread() {
    if (!user) return
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'support_messages?select=id&sender=eq.admin&is_read=eq.false&user_id=eq.' + user.id, {
        method:'HEAD', headers:{...H,'Prefer':'count=exact'}
      })
      const cnt = parseInt((res.headers.get('content-range')||'').split('/')[1]||'0', 10) || 0
      setUnread(cnt > 0)
    } catch(e) {}
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setAlertMsg({ msg:'', type:'' })
    try {
      const ext  = file.name.split('.').pop()
      const path = `ads/${user.id}/${Date.now()}.${ext}`
      const { error } = await db.storage.from('ad-media').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = db.storage.from('ad-media').getPublicUrl(path)
      setFileUrl(publicUrl)
      if (imgRef.current) { imgRef.current.src = publicUrl; imgRef.current.style.display = 'block' }
    } catch(err) {
      setAlertMsg({ msg: 'Upload failed: ' + err.message, type: 'error' })
    }
    setUploading(false)
  }

  async function submitAd() {
    setAlertMsg({ msg:'', type:'' })
    if (!title.trim()) { setAlertMsg({ msg:'Enter ad title.', type:'error' }); return }
    if (!fileUrl)      { setAlertMsg({ msg:'Please upload an image or video.', type:'error' }); return }
    if (targetArea !== 'national' && !targetVal.trim()) { setAlertMsg({ msg:'Enter the target value (state/district name).', type:'error' }); return }

    const rate = RATES[targetArea] || 2.5
    const budgetBase  = (views / 1000) * rate
    const budgetGst   = budgetBase * 0.18
    const budgetTotal = budgetBase + budgetGst

    setSubmitting(true)
    const { error } = await db.rpc('submit_ad_with_wallet', {
      p_title:        title.trim(),
      p_ad_type:      adType,
      p_content_url:  fileUrl,
      p_target_area:  targetArea,
      p_target_value: targetVal.trim() || targetArea,
      p_whatsapp:     whatsapp.trim(),
      p_views:        views,
      p_rate:         rate,
      p_base:         budgetBase,
      p_gst:          budgetGst,
      p_total:        budgetTotal,
    })
    setSubmitting(false)

    if (error) {
      setAlertMsg({ msg: 'Error: ' + error.message, type:'error' })
    } else {
      setAlertMsg({ msg: '✅ Ad submitted for review! You will be notified once approved.', type:'success' })
      setTitle(''); setFileUrl(''); setViews(1000); setWhatsapp(''); setTargetVal('')
      if (imgRef.current) { imgRef.current.src=''; imgRef.current.style.display='none' }
      loadStats()
    }
  }

  async function loadProfile() {
    try {
      const H = await restHeaders()
      const [userRes, advRes] = await Promise.all([
        fetch(REST + 'users?select=name,email,mobile&id=eq.' + user.id + '&limit=1', { headers: H }),
        fetch(REST + 'advertisers?select=business_name,whatsapp_number&user_id=eq.' + user.id + '&limit=1', { headers: H }),
      ])
      const userData = userRes.ok ? (await userRes.json())[0] : {}
      const advData  = advRes.ok  ? (await advRes.json())[0]  : {}
      setProfile({ ...userData, ...advData })
    } catch(e) {}
  }

  async function saveProfile() {
    setProfMsg('')
    const { error } = await db.from('users').update({ name: profile.name, mobile: profile.mobile }).eq('id', user.id)
    if (!error && profile.business_name) {
      await db.from('advertisers').update({ business_name: profile.business_name, whatsapp_number: profile.whatsapp_number }).eq('user_id', user.id)
    }
    setProfMsg(error ? '❌ ' + error.message : '✅ Profile saved!')
    setTimeout(() => setProfMsg(''), 3000)
  }

  async function loadChat() {
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'support_messages?select=message,sender,created_at&user_id=eq.' + user.id + '&order=created_at.asc&limit=50', { headers: H })
      if (res.ok) setChatMsgs(await res.json())
      await db.from('support_messages').update({ is_read: true }).eq('user_id', user.id).eq('sender', 'admin').eq('is_read', false)
      setUnread(false)
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, 100)
    } catch(e) {}
  }

  async function sendChat() {
    if (!chatInput.trim()) return
    await db.from('support_messages').insert({ user_id: user.id, message: chatInput.trim(), sender: 'user' })
    setChatInput('')
    loadChat()
  }

  const uname = user?.user_metadata?.name || user?.email || 'User'
  const rate  = RATES[targetArea] || 2.5
  const budgetBase  = ((views || 0) / 1000) * rate
  const budgetTotal = budgetBase * 1.18

  if (!user) return <div className={s.loading}>Loading…</div>

  return (
    <div className={s.app}>
      {/* Top Nav */}
      <nav className={s.topnav}>
        <div className={s.brand}>
          <div className={s.logo}>A</div>
          <span className={s.brandName}>Anaar</span>
        </div>
        <div className={s.navRight}>
          <div className={s.walBadge}>₹{walBal.toFixed(2)}</div>
          <div className={s.userChip}>
            <div className={s.av}>{uname.charAt(0).toUpperCase()}</div>
            <span>{uname.split(' ')[0]}</span>
          </div>
          {user?.user_metadata?.role === 'admin' && (
            <button className={s.navLink} onClick={() => nav('/admin')}>Admin</button>
          )}
          <button className={s.logoutBtn} onClick={() => db.auth.signOut().then(() => nav('/login', { replace: true }))}>Sign Out</button>
        </div>
      </nav>

      <div className={s.layout}>
        {/* Sidebar (desktop) */}
        <aside className={s.sidebar}>
          {[
            { id:'post',    icon:'📤', label:'Post Ad', onClick: () => nav('/post-ad') },
            { id:'myads',   icon:'📋', label:'My Ads',  onClick: () => { setTab('myads'); loadMyAds() } },
            { id:'profile', icon:'👤', label:'Profile',  onClick: () => { setTab('profile'); loadProfile() } },
            { id:'chat',    icon:'💬', label:'Support',  onClick: () => { setTab('chat'); loadChat() } },
          ].map(item => (
            <div key={item.id}
              className={`${s.sideItem} ${tab===item.id?s.sideActive:''}`}
              onClick={() => { if (item.onClick) item.onClick(); else setTab(item.id) }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.id==='chat' && unread && <span className={s.badge}/>}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className={s.main}>

          {/* Post Ad */}
          {tab === 'post' && (
            <div>
              <div className={s.pageTitle}>Post New Ad</div>
              <div className={s.panel}>
                <div className={s.panelHead}><h3>📤 Ad Details</h3></div>
                <div className={s.panelBody}>
                  {alertMsg.msg && <div className={`${s.alert} ${s[alertMsg.type]}`}>{alertMsg.msg}</div>}

                  <div className={s.formRow}>
                    <div className={s.formGroup}>
                      <label>Ad Type</label>
                      <select value={adType} onChange={e=>setAdType(e.target.value)}>
                        <option value="image">🖼️ Image Ad</option>
                        <option value="video">🎬 Video Ad</option>
                      </select>
                    </div>
                    <div className={s.formGroup}>
                      <label>Ad Title</label>
                      <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter ad title" />
                    </div>
                  </div>

                  <div className={s.uploadArea} onClick={() => fileRef.current?.click()}>
                    <div className={s.uIcon}>{adType==='video'?'🎬':'🖼️'}</div>
                    <p>Click to upload {adType==='video'?'video':'image'}</p>
                    {fileUrl && <img ref={imgRef} src={fileUrl} alt="preview" className={s.previewImg} />}
                    <input ref={fileRef} type="file" accept={adType==='video'?'video/*':'image/*'} style={{display:'none'}} onChange={handleFileUpload} />
                  </div>
                  {uploading && <div style={{textAlign:'center',color:'#888',fontSize:'.83rem',marginBottom:'.75rem'}}>⏳ Uploading…</div>}

                  <div className={s.formRow}>
                    <div className={s.formGroup}>
                      <label>Target Area</label>
                      <select value={targetArea} onChange={e=>setTargetArea(e.target.value)}>
                        <option value="national">🇮🇳 National (₹2.5/K)</option>
                        <option value="state">🗺️ State (₹3.5/K)</option>
                        <option value="district">📍 District (₹5.0/K)</option>
                      </select>
                    </div>
                    {targetArea !== 'national' && <div className={s.formGroup}>
                      <label>{targetArea === 'state' ? 'State Name' : 'District Name'}</label>
                      <input type="text" value={targetVal} onChange={e=>setTargetVal(e.target.value)} placeholder="e.g. Tamil Nadu" />
                    </div>}
                  </div>

                  <div className={s.formRow}>
                    <div className={s.formGroup}>
                      <label>Views Ordered</label>
                      <select value={views} onChange={e=>setViews(Number(e.target.value))}>
                        {[1000,2000,5000,10000,25000,50000].map(v=><option key={v} value={v}>{v.toLocaleString()} views</option>)}
                      </select>
                    </div>
                    <div className={s.formGroup}>
                      <label>WhatsApp Number (optional)</label>
                      <input type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+91..." />
                    </div>
                  </div>

                  <div className={s.costBox}>
                    <span>Budget (incl. 18% GST)</span>
                    <span>₹{budgetTotal.toFixed(2)}</span>
                  </div>

                  <button className={s.btnSubmit} disabled={submitting} onClick={submitAd}>
                    {submitting ? '⏳ Submitting…' : '🚀 Submit Ad for Review'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* My Ads */}
          {tab === 'myads' && (
            <div>
              <div className={s.pageTitle}>My Ads</div>
              <div className={s.statsRow}>
                <div className={s.statCard}><div className={s.sLabel}>Total Ads</div><div className={s.sValue}>{stats.total_ads||0}</div></div>
                <div className={s.statCard}><div className={s.sLabel}>Active</div><div className={s.sValue}>{stats.active_ads||0}</div></div>
                <div className={s.statCard}><div className={s.sLabel}>Wallet</div><div className={s.sValue}>₹{walBal.toFixed(2)}</div></div>
              </div>
              <div className={s.panel}>
                <div className={s.panelHead}><h3>📋 All Ads</h3></div>
                <div style={{overflowX:'auto'}}>
                  <table className={s.adsTable}>
                    <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Views</th><th>Budget</th><th>Date</th></tr></thead>
                    <tbody>
                      {myAds.length === 0 ? (
                        <tr><td colSpan={6} style={{textAlign:'center',color:'#aaa',padding:'2rem'}}>No ads yet. Post your first ad!</td></tr>
                      ) : myAds.map(ad => (
                        <tr key={ad.id}>
                          <td style={{fontWeight:600}}>{ad.title}</td>
                          <td>{ad.ad_type}</td>
                          <td><span className={`${s.statusBadge} ${s['s_'+ad.status]}`}>{ad.status}</span></td>
                          <td>{Number(ad.views_ordered||0).toLocaleString()}</td>
                          <td>₹{parseFloat(ad.budget_total||0).toFixed(2)}</td>
                          <td style={{color:'#888',fontSize:'.8rem'}}>{new Date(ad.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Profile */}
          {tab === 'profile' && (
            <div>
              <div className={s.pageTitle}>Profile</div>
              <div className={s.panel}>
                <div className={s.panelHead}><h3>👤 Account Details</h3></div>
                <div className={s.panelBody}>
                  {[['Full Name','name','text'],['Mobile','mobile','tel'],['Business Name','business_name','text'],['WhatsApp','whatsapp_number','tel']].map(([label,field,type])=>(
                    <div className={s.formGroup} key={field} style={{marginBottom:'.9rem'}}>
                      <label>{label}</label>
                      <input type={type} value={profile[field]||''} onChange={e=>setProfile(p=>({...p,[field]:e.target.value}))} />
                    </div>
                  ))}
                  {profMsg && <div className={`${s.alert} ${profMsg.startsWith('✅')?s.success:s.error}`}>{profMsg}</div>}
                  <button className={s.btnSubmit} onClick={saveProfile}>💾 Save Profile</button>
                </div>
              </div>
            </div>
          )}

          {/* Chat */}
          {tab === 'chat' && (
            <div>
              <div className={s.pageTitle}>Support</div>
              <div className={s.panel} style={{height:'calc(100vh - 220px)',display:'flex',flexDirection:'column'}}>
                <div className={s.panelHead}><h3>💬 Chat with Support</h3></div>
                <div style={{flex:1,overflowY:'auto',padding:'1rem',display:'flex',flexDirection:'column',gap:'.5rem'}} ref={chatRef}>
                  {chatMsgs.length===0 && <div style={{color:'#aaa',textAlign:'center',padding:'2rem'}}>No messages yet.</div>}
                  {chatMsgs.map((m,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:m.sender==='admin'?'flex-start':'flex-end'}}>
                      <div style={{background:m.sender==='admin'?'#f0f0f0':'#8B1A1A',color:m.sender==='admin'?'#333':'#fff',padding:'.6rem .9rem',borderRadius:12,fontSize:'.87rem',maxWidth:'75%'}}>{m.message}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:'.5rem',padding:'.75rem',borderTop:'1px solid #eee'}}>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Type a message…"
                    style={{flex:1,padding:'.6rem .9rem',border:'1.5px solid #e0e0e0',borderRadius:8,fontSize:'.87rem',outline:'none'}}
                    onKeyDown={e=>e.key==='Enter'&&sendChat()} />
                  <button onClick={sendChat} style={{padding:'.6rem 1.2rem',background:'#8B1A1A',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer'}}>Send</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={s.mobileNav}>
        {[
          { id:'post',    icon:'📤', label:'Post',  onClick: () => nav('/post-ad') },
          { id:'myads',   icon:'📋', label:'My Ads',  onClick:()=>{setTab('myads');loadMyAds()} },
          { id:'profile', icon:'👤', label:'Profile',  onClick:()=>{setTab('profile');loadProfile()} },
          { id:'chat',    icon:'💬', label:'Support',  onClick:()=>{setTab('chat');loadChat()} },
        ].map(item => (
          <button key={item.id} className={`${s.mNavItem} ${tab===item.id?s.mNavActive:''}`}
            onClick={() => { if (item.onClick) item.onClick(); else setTab(item.id) }}>
            <span style={{fontSize:'1.2rem'}}>{item.icon}</span>
            <span style={{fontSize:'.65rem',fontWeight:700}}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
