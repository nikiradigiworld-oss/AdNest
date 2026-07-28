import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/supabase'

export default function Home() {
  const nav = useNavigate()

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (!session) { nav('/login', { replace: true }); return }
      const role = session.user?.user_metadata?.role
      if (role === 'admin')        nav('/admin',                { replace: true })
      else if (role === 'advertiser') nav('/advertiser-dashboard', { replace: true })
      else                         nav('/viewer-dashboard',     { replace: true })
    })
  }, [nav])

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d0d0d', color:'#fff' }}>
      Loading…
    </div>
  )
}
