import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/supabase'
import s from './Home.module.css'

export default function Home() {
  const nav = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const role = session.user?.user_metadata?.role
        if (role === 'admin')        nav('/admin',                { replace: true })
        else if (role === 'advertiser') nav('/advertiser-dashboard', { replace: true })
        else                         nav('/viewer-dashboard',     { replace: true })
      } else {
        setChecking(false)
      }
    })
  }, [nav])

  if (checking) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d0d0d', color:'#fff' }}>
      Loading…
    </div>
  )

  return (
    <div className={s.page}>
      {/* Hero */}
      <div className={s.hero}>
        <div className={s.logo}>A</div>
        <h1 className={s.heroTitle}>Anaar</h1>
        <p className={s.heroSub}>Watch ads, earn real rewards.<br />Advertise smarter, reach better.</p>
      </div>

      {/* Role cards */}
      <div className={s.section}>
        <div className={s.sectionTitle}>How do you want to use Anaar?</div>
        <div className={s.roleGrid}>
          <div className={s.roleCard} onClick={() => nav('/signup?role=viewer')}>
            <div className={s.roleIcon}>👁️</div>
            <h3>Viewer</h3>
            <p>Watch short ads and earn coins &amp; cash rewards daily.</p>
            <ul className={s.featureList}>
              <li>✅ Earn coins per view</li>
              <li>✅ Refer friends &amp; earn more</li>
              <li>✅ Withdraw to bank account</li>
            </ul>
            <div className={s.roleBtn}>Join as Viewer</div>
          </div>

          <div className={`${s.roleCard} ${s.roleCardFeatured}`} onClick={() => nav('/signup?role=both')}>
            <div className={s.featuredBadge}>⭐ Best Value</div>
            <div className={s.roleIcon}>🚀</div>
            <h3>Viewer + Advertiser</h3>
            <p>Earn coins by watching AND run your own ad campaigns.</p>
            <ul className={s.featureList}>
              <li>✅ Everything in Viewer</li>
              <li>✅ Post ads for your business</li>
              <li>✅ Track ad performance</li>
            </ul>
            <div className={`${s.roleBtn} ${s.roleBtnGold}`}>Join as Both</div>
          </div>

          <div className={s.roleCard} onClick={() => nav('/signup?role=advertiser')}>
            <div className={s.roleIcon}>📢</div>
            <h3>Advertiser</h3>
            <p>Promote your business to targeted local audiences.</p>
            <ul className={s.featureList}>
              <li>✅ National / State / District targeting</li>
              <li>✅ Image &amp; video ads</li>
              <li>✅ Pay per 1000 views (CPM)</li>
            </ul>
            <div className={s.roleBtn}>Join as Advertiser</div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className={s.statsStrip}>
        {[['👥','10,000+','Active Users'],['📢','500+','Ads Running'],['🪙','₹2L+','Coins Issued'],['📍','Pan India','Coverage']].map(([icon,val,label])=>(
          <div key={label} className={s.stripStat}>
            <span className={s.stripIcon}>{icon}</span>
            <span className={s.stripVal}>{val}</span>
            <span className={s.stripLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Login link */}
      <div className={s.footer}>
        Already have an account?{' '}
        <button className={s.loginLink} onClick={() => nav('/login')}>Sign In</button>
      </div>
    </div>
  )
}
