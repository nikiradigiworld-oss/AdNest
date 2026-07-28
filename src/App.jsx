import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { db } from './lib/supabase'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ViewerDashboard from './pages/ViewerDashboard'
import AdvertiserDashboard from './pages/AdvertiserDashboard'
import Admin from './pages/Admin'

function ProtectedRoute({ element, requireAdmin }) {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setStatus('unauth'); return }
      if (requireAdmin) {
        setStatus(session.user?.user_metadata?.role === 'admin' ? 'ok' : 'forbidden')
      } else {
        setStatus('ok')
      }
    })
  }, [requireAdmin])

  if (status === 'loading') return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0d0d0d',color:'#fff',fontSize:'1rem' }}>
      Loading…
    </div>
  )
  if (status === 'unauth') return <Navigate to="/login" replace />
  if (status === 'forbidden') return <Navigate to="/" replace />
  return element
}

export default function App() {
  return (
    <Routes>
      <Route path="/"                    element={<Home />} />
      <Route path="/login"               element={<Login />} />
      <Route path="/signup"              element={<Signup />} />
      <Route path="/viewer-dashboard"    element={<ProtectedRoute element={<ViewerDashboard />} />} />
      <Route path="/advertiser-dashboard" element={<ProtectedRoute element={<AdvertiserDashboard />} />} />
      <Route path="/admin"               element={<ProtectedRoute element={<Admin />} requireAdmin />} />
      <Route path="*"                    element={<Navigate to="/" replace />} />
    </Routes>
  )
}
