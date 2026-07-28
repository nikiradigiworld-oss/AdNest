import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, REST, restHeaders } from '../lib/supabase'
import s from './Admin.module.css'

export default function Admin() {
  const nav = useNavigate()
  const [user, setUser] = useState(null)
  const [tab,  setTab]  = useState('overview')

  // Overview state
  const [stats, setStats]       = useState({})
  const [pendingAds, setPending] = useState([])

  // Ads state
  const [allAds,    setAllAds]    = useState([])
  const [adsFilter, setAdsFilter] = useState('all')
  const [adsSearch, setAdsSearch] = useState('')

  // Users state
  const [allUsers,    setAllUsers]    = useState([])
  const [usersFilter, setUsersFilter] = useState('all')
  const [usersSearch, setUsersSearch] = useState('')
  const [selUser,     setSelUser]     = useState(null)
  const [walletData,  setWalletData]  = useState({})
  const [coinsAdj,    setCoinsAdj]    = useState('')
  const [cashAdj,     setCashAdj]     = useState('')
  const [userModal,   setUserModal]   = useState(false)

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState([])
  const [wdFilter,    setWdFilter]    = useState('pending')

  // Support state
  const [convos,       setConvos]      = useState([])
  const [selConvo,     setSelConvo]    = useState(null)
  const [chatMsgs,     setChatMsgs]    = useState([])
  const [replyInput,   setReplyInput]  = useState('')
  const chatRef = useRef(null)

  // Ad detail modal
  const [adModal,     setAdModal]  = useState(null)

  const [toast, setToast] = useState({ msg:'', type:'' })

  function showToast(msg, type='info') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'' }), 3000)
  }

  useEffect(() => {
    db.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { nav('/login', { replace: true }); return }
      const role = u.user_metadata?.role
      if (role !== 'admin') { nav('/', { replace: true }); return }
      setUser(u)
    })
  }, [nav])

  useEffect(() => {
    if (!user) return
    loadOverview()
  }, [user])

  // ── DATA LOADERS ─────────────────────────────────────────

  async function loadOverview() {
    try {
      const H = await restHeaders()
      const [usersRes, adsRes, viewsRes, coinsRes, advRes, refRes, wdRes] = await Promise.all([
        fetch(REST + 'users?select=id', { method:'HEAD', headers:{...H,'Prefer':'count=exact'} }),
        fetch(REST + 'ads?select=id,status', { headers: H }),
        fetch(REST + 'ad_views?select=id', { method:'HEAD', headers:{...H,'Prefer':'count=exact'} }),
        fetch(REST + 'coin_wallets?select=coins', { headers: H }),
        fetch(REST + 'advertisers?select=id', { method:'HEAD', headers:{...H,'Prefer':'count=exact'} }),
        fetch(REST + 'referral_earnings?select=coins_earned,cash_earned', { headers: H }),
        fetch(REST + 'ads?select=budget_total&status=neq.pending', { headers: H }),
      ])
      const ads = adsRes.ok ? await adsRes.json() : []
      const coins = coinsRes.ok ? await coinsRes.json() : []
      const ref = refRes.ok ? await refRes.json() : []
      const revenue = wdRes.ok ? (await wdRes.json()).reduce((s,a) => s + parseFloat(a.budget_total||0), 0) : 0
      const totalUsers  = parseInt((usersRes.headers.get('content-range')||'').split('/')[1]||'0',10)
      const totalViews  = parseInt((viewsRes.headers.get('content-range')||'').split('/')[1]||'0',10)
      const totalAdvs   = parseInt((advRes.headers.get('content-range')||'').split('/')[1]||'0',10)
      const totalCoins  = coins.reduce((s,w) => s + (w.coins||0), 0)
      const refCoins    = ref.reduce((s,r) => s + (r.coins_earned||0), 0)
      const refCash     = ref.reduce((s,r) => s + parseFloat(r.cash_earned||0), 0)

      setStats({
        users: totalUsers,
        total_ads: ads.length,
        pending: ads.filter(a=>a.status==='pending').length,
        active: ads.filter(a=>a.status==='active').length,
        views: totalViews,
        coins: totalCoins,
        revenue: revenue.toFixed(2),
        advertisers: totalAdvs,
        refCoins, refCash: refCash.toFixed(2),
      })

      const pendRes = await fetch(REST + 'ads?select=id,title,ad_type,target_area,target_value,budget_total,views_ordered,created_at&status=eq.pending&order=created_at.asc', { headers: H })
      if (pendRes.ok) setPending(await pendRes.json())
    } catch(e) { console.error('loadOverview', e) }
  }

  async function loadAllAds() {
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'ads?select=id,title,ad_type,status,target_area,target_value,budget_total,views_ordered,created_at&order=created_at.desc', { headers: H })
      if (res.ok) setAllAds(await res.json())
    } catch(e) {}
  }

  async function loadUsers() {
    try {
      const H = await restHeaders()
      const [uRes, wRes] = await Promise.all([
        fetch(REST + 'users?select=id,name,email,mobile,role,state,district,created_at&order=created_at.desc', { headers: H }),
        fetch(REST + 'coin_wallets?select=user_id,coins,cash_value', { headers: H }),
      ])
      const users  = uRes.ok ? await uRes.json() : []
      const wallets = wRes.ok ? await wRes.json() : []
      const wMap = {}
      wallets.forEach(w => { wMap[w.user_id] = w })
      setAllUsers(users.map(u => ({ ...u, wallet: wMap[u.id] || {} })))
    } catch(e) {}
  }

  async function loadWithdrawals() {
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'withdrawal_requests?select=id,user_id,amount_cash,status,created_at,bank_name,account_number,ifsc_code,account_holder_name&order=created_at.desc', { headers: H })
      if (res.ok) setWithdrawals(await res.json())
    } catch(e) {}
  }

  async function loadSupport() {
    try {
      const H = await restHeaders()
      const res = await fetch(REST + 'support_messages?select=user_id,created_at,message,is_admin,is_read&order=created_at.desc', { headers: H })
      if (!res.ok) return
      const msgs = await res.json()
      const map = {}
      msgs.forEach(m => {
        if (!map[m.user_id]) map[m.user_id] = { user_id: m.user_id, last: m.message, unread: 0, time: m.created_at }
        if (!m.is_admin && !m.is_read) map[m.user_id].unread++
      })
      setConvos(Object.values(map))
    } catch(e) {}
  }

  async function openConvo(userId) {
    setSelConvo(userId)
    try {
      const H = await restHeaders()
      const [msgsRes, userRes] = await Promise.all([
        fetch(REST + 'support_messages?select=message,is_admin,created_at&user_id=eq.' + userId + '&order=created_at.asc', { headers: H }),
        fetch(REST + 'users?select=name,email&id=eq.' + userId + '&limit=1', { headers: H }),
      ])
      if (msgsRes.ok) setChatMsgs(await msgsRes.json())
      const userArr = userRes.ok ? await userRes.json() : []
      setSelConvo({ id: userId, name: userArr[0]?.name || userArr[0]?.email || userId.slice(0,8) })
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, 100)
      await db.from('support_messages').update({ is_read: true }).eq('user_id', userId).eq('is_admin', false)
      loadSupport()
    } catch(e) {}
  }

  async function sendSupportReply() {
    if (!replyInput.trim() || !selConvo?.id) return
    await db.from('support_messages').insert({ user_id: selConvo.id, message: replyInput.trim(), is_admin: true })
    setReplyInput('')
    openConvo(selConvo.id)
  }

  // ── AD ACTIONS ───────────────────────────────────────────

  async function approveAd(id) {
    const H = await restHeaders()
    await fetch(REST + 'ads?id=eq.' + id, { method:'PATCH', headers:{...H,'Prefer':'return=minimal'}, body: JSON.stringify({ status:'active' }) })
    showToast('Ad approved', 'success')
    setAdModal(null)
    loadOverview(); if (tab==='ads') loadAllAds()
  }

  async function rejectAd(id) {
    const reason = window.prompt('Rejection reason (optional):') ?? ''
    const H = await restHeaders()
    await fetch(REST + 'ads?id=eq.' + id, { method:'PATCH', headers:{...H,'Prefer':'return=minimal'}, body: JSON.stringify({ status:'rejected', rejection_reason: reason }) })
    showToast('Ad rejected', 'info')
    setAdModal(null)
    loadOverview(); if (tab==='ads') loadAllAds()
  }

  // ── WITHDRAWAL ACTIONS ───────────────────────────────────

  async function approveWithdrawal(id) {
    const { error } = await db.rpc('approve_withdrawal', { p_request_id: id })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Withdrawal approved!', 'success'); loadWithdrawals() }
  }

  async function rejectWithdrawal(id) {
    const { error } = await db.rpc('reject_withdrawal', { p_request_id: id })
    if (error) showToast('Error: ' + error.message, 'error')
    else { showToast('Withdrawal rejected', 'info'); loadWithdrawals() }
  }

  // ── USER WALLET ───────────────────────────────────────────

  async function openUserModal(u) {
    setSelUser(u)
    setWalletData(u.wallet || {})
    setCoinsAdj(''); setCashAdj('')
    setUserModal(true)
  }

  async function adjustCoins(dir) {
    const amt = parseInt(coinsAdj)
    if (isNaN(amt) || amt <= 0) return
    const newCoins = Math.max(0, (walletData.coins||0) + dir * amt)
    const H = await restHeaders()
    await fetch(REST + 'coin_wallets?user_id=eq.' + selUser.id, { method:'PATCH', headers:{...H,'Prefer':'return=minimal'}, body: JSON.stringify({ coins: newCoins }) })
    setWalletData(p => ({ ...p, coins: newCoins }))
    showToast('Coins updated', 'success')
    setCoinsAdj('')
  }

  async function setCoinsExact() {
    const amt = parseInt(coinsAdj)
    if (isNaN(amt) || amt < 0) return
    const H = await restHeaders()
    await fetch(REST + 'coin_wallets?user_id=eq.' + selUser.id, { method:'PATCH', headers:{...H,'Prefer':'return=minimal'}, body: JSON.stringify({ coins: amt }) })
    setWalletData(p => ({ ...p, coins: amt }))
    showToast('Coins set', 'success')
    setCoinsAdj('')
  }

  async function adjustCash(dir) {
    const amt = parseFloat(cashAdj)
    if (isNaN(amt) || amt <= 0) return
    const newCash = Math.max(0, parseFloat(walletData.cash_value||0) + dir * amt)
    const H = await restHeaders()
    await fetch(REST + 'coin_wallets?user_id=eq.' + selUser.id, { method:'PATCH', headers:{...H,'Prefer':'return=minimal'}, body: JSON.stringify({ cash_value: newCash }) })
    setWalletData(p => ({ ...p, cash_value: newCash }))
    showToast('Cash updated', 'success')
    setCashAdj('')
  }

  async function setCashExact() {
    const amt = parseFloat(cashAdj)
    if (isNaN(amt) || amt < 0) return
    const H = await restHeaders()
    await fetch(REST + 'coin_wallets?user_id=eq.' + selUser.id, { method:'PATCH', headers:{...H,'Prefer':'return=minimal'}, body: JSON.stringify({ cash_value: amt }) })
    setWalletData(p => ({ ...p, cash_value: amt }))
    showToast('Cash set', 'success')
    setCashAdj('')
  }

  async function saveUserRole(role) {
    await db.from('users').update({ role }).eq('id', selUser.id)
    setSelUser(p => ({ ...p, role }))
    setAllUsers(prev => prev.map(u => u.id === selUser.id ? { ...u, role } : u))
    showToast('Role updated', 'success')
  }

  // ── FILTERS ──────────────────────────────────────────────

  const filteredAds = allAds.filter(a => {
    if (adsFilter !== 'all' && a.status !== adsFilter) return false
    if (adsSearch && !a.title?.toLowerCase().includes(adsSearch.toLowerCase())) return false
    return true
  })

  const filteredUsers = allUsers.filter(u => {
    if (usersFilter !== 'all' && u.role !== usersFilter) return false
    const q = usersSearch.toLowerCase()
    if (q && !u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    return true
  })

  const filteredWd = withdrawals.filter(w => wdFilter === 'all' || w.status === wdFilter)

  // ── TAB SWITCH ────────────────────────────────────────────

  function switchTab(t) {
    setTab(t)
    if (t === 'overview')     loadOverview()
    if (t === 'ads')          loadAllAds()
    if (t === 'users')        loadUsers()
    if (t === 'withdrawals')  loadWithdrawals()
    if (t === 'support')      loadSupport()
  }

  const STAT_ITEMS = [
    { icon:'👥', label:'Users',       val: stats.users },
    { icon:'📢', label:'Total Ads',   val: stats.total_ads },
    { icon:'⏳', label:'Pending',     val: stats.pending,     hi:'#e67e22' },
    { icon:'✅', label:'Active Ads',  val: stats.active,      hi:'#27ae60' },
    { icon:'👁️', label:'Total Views', val: stats.views },
    { icon:'🪙', label:'Coins Issued',val: stats.coins },
    { icon:'💰', label:'Revenue',     val: stats.revenue ? '₹'+stats.revenue : '—' },
    { icon:'🏪', label:'Advertisers', val: stats.advertisers },
  ]

  const TABS = [
    { id:'overview',    icon:'📊', label:'Overview' },
    { id:'ads',         icon:'📋', label:'Ads' },
    { id:'users',       icon:'👥', label:'Users' },
    { id:'withdrawals', icon:'💸', label:'Withdrawals' },
    { id:'support',     icon:'💬', label:'Support' },
  ]

  if (!user) return <div className={s.loading}>Loading…</div>

  return (
    <div className={s.app}>
      {/* Top bar */}
      <nav className={s.topnav}>
        <div className={s.brand}>
          <div className={s.logo}>A</div>
          <div>
            <div className={s.brandName}>Anaar Admin</div>
          </div>
        </div>
        <div className={s.navRight}>
          <span className={s.adminBadge}>🛡 Admin</span>
          <button className={s.logoutBtn} onClick={() => db.auth.signOut().then(() => nav('/login', { replace: true }))}>Sign Out</button>
        </div>
      </nav>

      <div className={s.layout}>
        {/* Sidebar */}
        <aside className={s.sidebar}>
          {TABS.map(t => (
            <div key={t.id} className={`${s.sbItem} ${tab===t.id?s.sbActive:''}`} onClick={() => switchTab(t.id)}>
              <span>{t.icon}</span><span>{t.label}</span>
            </div>
          ))}
          <div className={s.sbItem} onClick={() => nav('/')}><span>🏠</span><span>Back to Site</span></div>
        </aside>

        {/* Main */}
        <main className={s.main}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div>
              <div className={s.pageHead}><div className={s.pageTitle}>Platform Overview</div><button className={s.refreshBtn} onClick={loadOverview}>🔄 Refresh</button></div>
              <div className={s.statsGrid}>
                {STAT_ITEMS.map(item => (
                  <div className={s.statCard} key={item.label}>
                    <div className={s.stIcon}>{item.icon}</div>
                    <div className={s.stLabel}>{item.label}</div>
                    <div className={s.stVal} style={item.hi?{color:item.hi}:{}}>{item.val ?? '—'}</div>
                  </div>
                ))}
              </div>

              <div className={s.panel}>
                <div className={s.panelHead}><h3>⏳ Pending Ads</h3></div>
                <div style={{overflowX:'auto'}}>
                  <table className={s.tbl}>
                    <thead><tr><th>Title</th><th>Type</th><th>Target</th><th>Budget</th><th>Views</th><th>Action</th></tr></thead>
                    <tbody>
                      {pendingAds.length === 0
                        ? <tr><td colSpan={6} className={s.emptyCell}>No pending ads 🎉</td></tr>
                        : pendingAds.map(ad => (
                          <tr key={ad.id}>
                            <td style={{fontWeight:700}}>{ad.title}</td>
                            <td>{ad.ad_type}</td>
                            <td>{ad.target_area} {ad.target_value && `(${ad.target_value})`}</td>
                            <td>₹{parseFloat(ad.budget_total||0).toFixed(2)}</td>
                            <td>{Number(ad.views_ordered).toLocaleString()}</td>
                            <td>
                              <button className={`${s.actBtn} ${s.approve}`} onClick={() => approveAd(ad.id)}>✅</button>
                              <button className={`${s.actBtn} ${s.reject}`}  onClick={() => rejectAd(ad.id)}>❌</button>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ADS ── */}
          {tab === 'ads' && (
            <div>
              <div className={s.pageHead}><div className={s.pageTitle}>Manage Ads</div><button className={s.refreshBtn} onClick={loadAllAds}>🔄 Refresh</button></div>
              <div className={s.panel}>
                <div className={s.panelHead}>
                  <div className={s.filterRow}>
                    {['all','pending','active','completed','rejected'].map(f => (
                      <button key={f} className={`${s.ftab} ${adsFilter===f?s.ftabActive:''}`} onClick={() => setAdsFilter(f)}>{f}</button>
                    ))}
                  </div>
                  <input className={s.searchBar} value={adsSearch} onChange={e=>setAdsSearch(e.target.value)} placeholder="🔍 Search ads…" />
                </div>
                <div style={{overflowX:'auto'}}>
                  <table className={s.tbl}>
                    <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Target</th><th>Budget</th><th>Views</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredAds.length === 0 ? <tr><td colSpan={8} className={s.emptyCell}>No ads found</td></tr>
                        : filteredAds.map(ad => (
                          <tr key={ad.id}>
                            <td style={{fontWeight:700}}>{ad.title}</td>
                            <td>{ad.ad_type}</td>
                            <td><span className={`${s.stBadge} ${s['st_'+ad.status]}`}>{ad.status}</span></td>
                            <td>{ad.target_area}</td>
                            <td>₹{parseFloat(ad.budget_total||0).toFixed(2)}</td>
                            <td>{Number(ad.views_ordered).toLocaleString()}</td>
                            <td style={{color:'#999',fontSize:'.78rem'}}>{new Date(ad.created_at).toLocaleDateString('en-IN')}</td>
                            <td>
                              {ad.status === 'pending' && <>
                                <button className={`${s.actBtn} ${s.approve}`} onClick={() => approveAd(ad.id)}>✅</button>
                                <button className={`${s.actBtn} ${s.reject}`}  onClick={() => rejectAd(ad.id)}>❌</button>
                              </>}
                              {ad.status === 'active' && <button className={`${s.actBtn} ${s.reject}`} onClick={() => rejectAd(ad.id)}>⏸</button>}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div>
              <div className={s.pageHead}><div className={s.pageTitle}>All Users ({filteredUsers.length})</div><button className={s.refreshBtn} onClick={loadUsers}>🔄 Refresh</button></div>
              <div className={s.panel}>
                <div className={s.panelHead}>
                  <div className={s.filterRow}>
                    {['all','viewer','advertiser','both','admin'].map(f => (
                      <button key={f} className={`${s.ftab} ${usersFilter===f?s.ftabActive:''}`} onClick={() => setUsersFilter(f)}>{f}</button>
                    ))}
                  </div>
                  <input className={s.searchBar} value={usersSearch} onChange={e=>setUsersSearch(e.target.value)} placeholder="🔍 Search name/email…" />
                </div>
                <div style={{overflowX:'auto'}}>
                  <table className={s.tbl}>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Coins</th><th>Joined</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredUsers.length === 0 ? <tr><td colSpan={6} className={s.emptyCell}>No users found</td></tr>
                        : filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td style={{fontWeight:700}}>{u.name||'—'}</td>
                            <td style={{fontSize:'.82rem',color:'#555'}}>{u.email}</td>
                            <td><span className={`${s.stBadge} ${s['role_'+u.role]}`}>{u.role}</span></td>
                            <td>🪙 {Number(u.wallet.coins||0).toLocaleString()}</td>
                            <td style={{color:'#999',fontSize:'.78rem'}}>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                            <td><button className={`${s.actBtn} ${s.editBtn}`} onClick={() => openUserModal(u)}>✏️ Edit</button></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── WITHDRAWALS ── */}
          {tab === 'withdrawals' && (
            <div>
              <div className={s.pageHead}><div className={s.pageTitle}>Withdrawals</div><button className={s.refreshBtn} onClick={loadWithdrawals}>🔄 Refresh</button></div>
              <div className={s.panel}>
                <div className={s.panelHead}>
                  <div className={s.filterRow}>
                    {['pending','approved','rejected','all'].map(f => (
                      <button key={f} className={`${s.ftab} ${wdFilter===f?s.ftabActive:''}`} onClick={() => setWdFilter(f)}>{f}</button>
                    ))}
                  </div>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table className={s.tbl}>
                    <thead><tr><th>User</th><th>Amount</th><th>Bank</th><th>Account</th><th>IFSC</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                      {filteredWd.length === 0 ? <tr><td colSpan={8} className={s.emptyCell}>No withdrawals</td></tr>
                        : filteredWd.map(w => (
                          <tr key={w.id}>
                            <td style={{fontSize:'.78rem',color:'#555'}}>{w.user_id?.slice(0,8)}…</td>
                            <td style={{fontWeight:700}}>₹{parseFloat(w.amount_cash||0).toFixed(2)}</td>
                            <td>{w.bank_name||'—'}</td>
                            <td>{w.account_number||'—'}</td>
                            <td>{w.ifsc_code||'—'}</td>
                            <td><span className={`${s.stBadge} ${s['st_'+w.status]}`}>{w.status}</span></td>
                            <td style={{color:'#999',fontSize:'.78rem'}}>{new Date(w.created_at).toLocaleDateString('en-IN')}</td>
                            <td>
                              {w.status === 'pending' && <>
                                <button className={`${s.actBtn} ${s.approve}`} onClick={() => approveWithdrawal(w.id)}>✅</button>
                                <button className={`${s.actBtn} ${s.reject}`}  onClick={() => rejectWithdrawal(w.id)}>❌</button>
                              </>}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SUPPORT ── */}
          {tab === 'support' && (
            <div>
              <div className={s.pageHead}><div className={s.pageTitle}>Support Chats</div><button className={s.refreshBtn} onClick={loadSupport}>🔄 Refresh</button></div>
              <div className={s.supportLayout}>
                <div className={s.convoList}>
                  {convos.length === 0 && <div className={s.emptyCell}>No conversations</div>}
                  {convos.map(c => (
                    <div key={typeof c === 'string' ? c : c.user_id}
                      className={`${s.convoItem} ${selConvo?.id === (typeof c==='string'?c:c.user_id) ? s.convoActive : ''}`}
                      onClick={() => openConvo(typeof c === 'string' ? c : c.user_id)}>
                      <div className={s.convoAv}>{(c.user_id||'U').charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:'.85rem'}}>{c.user_id?.slice(0,12)}…</div>
                        <div style={{fontSize:'.75rem',color:'#999',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:140}}>{c.last}</div>
                      </div>
                      {c.unread > 0 && <span className={s.unreadBadge}>{c.unread}</span>}
                    </div>
                  ))}
                </div>
                <div className={s.chatArea}>
                  {!selConvo && <div className={s.chatPlaceholder}><div style={{fontSize:'3rem'}}>💬</div><p>Select a conversation</p></div>}
                  {selConvo && <>
                    <div className={s.chatHeader}>{selConvo.name}</div>
                    <div className={s.chatMsgs} ref={chatRef}>
                      {chatMsgs.map((m,i) => (
                        <div key={i} style={{display:'flex',justifyContent:m.is_admin?'flex-end':'flex-start'}}>
                          <div style={{background:m.is_admin?'#8B1A1A':'#f0f0f0',color:m.is_admin?'#fff':'#333',padding:'.6rem .9rem',borderRadius:12,fontSize:'.86rem',maxWidth:'75%'}}>{m.message}</div>
                        </div>
                      ))}
                    </div>
                    <div className={s.replyRow}>
                      <textarea value={replyInput} onChange={e=>setReplyInput(e.target.value)}
                        placeholder="Type reply… (Enter to send)"
                        className={s.replyInput}
                        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendSupportReply()}}}
                      />
                      <button className={s.replyBtn} onClick={sendSupportReply}>Reply</button>
                    </div>
                  </>}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className={s.mobileNav}>
        {TABS.map(t => (
          <button key={t.id} className={`${s.mNavItem} ${tab===t.id?s.mNavActive:''}`} onClick={() => switchTab(t.id)}>
            <span style={{fontSize:'1.1rem'}}>{t.icon}</span>
            <span style={{fontSize:'.6rem',fontWeight:700}}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* User edit modal */}
      {userModal && selUser && (
        <div className={s.overlay} onClick={() => setUserModal(false)}>
          <div className={s.modal} onClick={e=>e.stopPropagation()}>
            <button className={s.modalClose} onClick={() => setUserModal(false)}>✕</button>
            <h3 style={{marginBottom:'1rem'}}>✏️ Edit User</h3>
            <div style={{marginBottom:'.75rem'}}>
              <div style={{fontWeight:700}}>{selUser.name||'—'}</div>
              <div style={{fontSize:'.82rem',color:'#888'}}>{selUser.email}</div>
            </div>
            <div style={{marginBottom:'.85rem'}}>
              <label style={{fontSize:'.78rem',fontWeight:700,color:'#555',display:'block',marginBottom:'.3rem'}}>ROLE</label>
              <select value={selUser.role||'viewer'} onChange={e=>saveUserRole(e.target.value)} style={{width:'100%',padding:'.6rem',border:'1.5px solid #e0e0e0',borderRadius:8,fontSize:'.9rem'}}>
                {['viewer','advertiser','both','admin'].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{borderTop:'1px solid #eee',paddingTop:'.85rem',marginBottom:'.85rem'}}>
              <div style={{fontWeight:700,fontSize:'.87rem',marginBottom:'.5rem'}}>🪙 Coins: {Number(walletData.coins||0).toLocaleString()}</div>
              <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                <input type="number" value={coinsAdj} onChange={e=>setCoinsAdj(e.target.value)} placeholder="Amount" style={{flex:1,minWidth:70,padding:'.5rem',border:'1.5px solid #e0e0e0',borderRadius:8,fontSize:'.9rem'}} />
                <button className={s.adjBtn} style={{background:'#27ae60'}} onClick={() => adjustCoins(1)}>+ Add</button>
                <button className={s.adjBtn} style={{background:'#c0392b'}} onClick={() => adjustCoins(-1)}>− Sub</button>
                <button className={s.adjBtn} style={{background:'#888'}} onClick={setCoinsExact}>= Set</button>
              </div>
            </div>
            <div style={{borderTop:'1px solid #eee',paddingTop:'.85rem',marginBottom:'1rem'}}>
              <div style={{fontWeight:700,fontSize:'.87rem',marginBottom:'.5rem'}}>₹ Cash: ₹{parseFloat(walletData.cash_value||0).toFixed(2)}</div>
              <div style={{display:'flex',gap:'.4rem',flexWrap:'wrap'}}>
                <input type="number" value={cashAdj} onChange={e=>setCashAdj(e.target.value)} placeholder="₹ Amount" style={{flex:1,minWidth:70,padding:'.5rem',border:'1.5px solid #e0e0e0',borderRadius:8,fontSize:'.9rem'}} step="0.01" />
                <button className={s.adjBtn} style={{background:'#27ae60'}} onClick={() => adjustCash(1)}>+ Add</button>
                <button className={s.adjBtn} style={{background:'#c0392b'}} onClick={() => adjustCash(-1)}>− Sub</button>
                <button className={s.adjBtn} style={{background:'#888'}} onClick={setCashExact}>= Set</button>
              </div>
            </div>
            <button style={{width:'100%',padding:'.7rem',background:'#1a1a1a',color:'#fff',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer'}} onClick={() => setUserModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.msg && (
        <div className={`${s.toast} ${s['toast_'+toast.type]}`}>{toast.msg}</div>
      )}
    </div>
  )
}
