import { useState } from 'react'
import s from './RoleSwitchModal.module.css'

const ROLES = [
  { id: 'viewer',     icon: '👁️',  name: 'Viewer',          desc: 'Watch ads and earn coins' },
  { id: 'advertiser', icon: '📢',  name: 'Advertiser',      desc: 'Post ads and reach viewers' },
  { id: 'both',       icon: '⚡',  name: 'Both',            desc: 'Watch ads and post ads' },
]

export default function RoleSwitchModal({ currentRole, onSwitch, onClose }) {
  const [busy, setBusy] = useState(false)

  async function handleSwitch(roleId) {
    if (roleId === currentRole || busy) return
    setBusy(true)
    await onSwitch(roleId)
    setBusy(false)
  }

  return (
    <div className={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={s.modal}>
        <div className={s.title}>Switch Role</div>
        <div className={s.sub}>Choose how you want to use Anaar</div>

        {busy && <div className={s.switching}>Switching role…</div>}

        <div className={s.roles}>
          {ROLES.map(r => {
            const isCurrent = r.id === currentRole
            return (
              <div
                key={r.id}
                className={`${s.roleCard} ${isCurrent ? s.current : ''} ${busy ? s.loading : ''}`}
                onClick={() => handleSwitch(r.id)}
              >
                <div className={s.roleIcon}>{r.icon}</div>
                <div className={s.roleInfo}>
                  <div className={s.roleName}>{r.name}</div>
                  <div className={s.roleDesc}>{r.desc}</div>
                </div>
                {isCurrent
                  ? <span className={s.currentBadge}>Current</span>
                  : <span className={s.checkIcon}>→</span>
                }
              </div>
            )
          })}
        </div>

        <button className={s.cancel} onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}
