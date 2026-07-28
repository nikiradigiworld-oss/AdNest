import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/supabase'
import s from './PostAd.module.css'

const RATES = { national: 2.5, state: 3.5, district: 5.0 }
const VIEWS_OPTIONS = [1000, 2000, 5000, 10000, 25000, 50000, 100000]

export default function PostAd() {
  const nav = useNavigate()
  const [user,       setUser]       = useState(null)
  const [advId,      setAdvId]      = useState(null)
  const [step,       setStep]       = useState(1) // 1=upload, 2=details, 3=review
  const [adType,     setAdType]     = useState('image')
  const [fileUrl,    setFileUrl]    = useState('')
  const [fileName,   setFileName]   = useState('')
  const [dragging,   setDragging]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [uploadPct,  setUploadPct]  = useState(0)
  const [title,      setTitle]      = useState('')
  const [targetArea, setTargetArea] = useState('national')
  const [targetVal,  setTargetVal]  = useState('')
  const [views,      setViews]      = useState(1000)
  const [whatsapp,   setWhatsapp]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [err,        setErr]        = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    db.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { nav('/login', { replace: true }); return }
      const role = u.user_metadata?.role
      if (role !== 'advertiser' && role !== 'both' && role !== 'admin') {
        nav('/', { replace: true }); return
      }
      setUser(u)
      // fetch advertiser record, auto-create if 'both' role doesn't have one
      let { data: adv } = await db.from('advertisers').select('id').eq('user_id', u.id).single()
      if (!adv) {
        const { data: created } = await db.from('advertisers')
          .insert({ user_id: u.id, business_name: u.user_metadata?.name || 'My Business', wallet_balance: 0 })
          .select('id').single()
        adv = created
      }
      if (adv) setAdvId(adv.id)
    })
  }, [nav])

  const rate        = RATES[targetArea] || 2.5
  const budgetBase  = (views / 1000) * rate
  const budgetGst   = budgetBase * 0.18
  const budgetTotal = budgetBase + budgetGst

  async function handleFile(file) {
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) { setErr('Only image or video files allowed.'); return }
    if (isVideo && file.size > 50 * 1024 * 1024) { setErr('Video must be under 50 MB.'); return }
    if (isImage && file.size > 10 * 1024 * 1024) { setErr('Image must be under 10 MB.'); return }
    setErr('')
    setAdType(isVideo ? 'video' : 'image')
    setUploading(true)
    setUploadPct(0)

    const ext  = file.name.split('.').pop()
    const path = `ads/${user.id}/${Date.now()}.${ext}`

    // Simulate progress (Supabase JS doesn't expose upload progress)
    const tick = setInterval(() => setUploadPct(p => Math.min(p + 12, 88)), 300)
    const { data, error } = await db.storage.from('ad-media').upload(path, file, { upsert: true })
    clearInterval(tick)
    setUploadPct(100)

    if (error) { setErr('Upload failed: ' + error.message); setUploading(false); return }
    const { data: { publicUrl } } = db.storage.from('ad-media').getPublicUrl(path)
    setFileUrl(publicUrl)
    setFileName(file.name)
    setUploading(false)
    setStep(2)
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function submitAd() {
    setErr('')
    if (!title.trim()) { setErr('Enter an ad title.'); return }
    if (!fileUrl)      { setErr('Upload a file first.'); return }
    if (targetArea !== 'national' && !targetVal.trim()) { setErr('Enter the target location name.'); return }
    if (!advId) { setErr('Advertiser profile not found. Contact support.'); return }

    setSubmitting(true)
    const { error } = await db.rpc('submit_ad_with_wallet', {
      p_user_id:       user.id,
      p_advertiser_id: advId,
      p_title:         title.trim(),
      p_ad_type:       adType,
      p_content_url:   fileUrl,
      p_target_area:   targetArea,
      p_target_value:  targetVal.trim() || targetArea,
      p_views_ordered: views,
      p_rate_per_1k:   rate,
      p_pricing_model: 'cpm',
      p_budget_base:   budgetBase,
      p_budget_gst:    budgetGst,
      p_budget_total:  budgetTotal,
      p_whatsapp:      whatsapp.trim() || null,
    })
    setSubmitting(false)
    if (error) { setErr('Submission failed: ' + error.message); return }
    setDone(true)
  }

  if (!user) return <div className={s.loading}>Loading…</div>

  if (done) return (
    <div className={s.page}>
      <div className={s.successCard}>
        <div className={s.successIcon}>🎉</div>
        <h2>Ad Submitted!</h2>
        <p>Your ad is under review. Once approved it will go live and viewers will start watching.</p>
        <div className={s.successActions}>
          <button className={s.btnPrimary} onClick={() => { setDone(false); setStep(1); setFileUrl(''); setTitle(''); setTargetVal(''); setWhatsapp('') }}>Post Another Ad</button>
          <button className={s.btnSecondary} onClick={() => nav('/advertiser-dashboard')}>My Dashboard</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <button className={s.back} onClick={() => step > 1 ? setStep(step - 1) : nav('/advertiser-dashboard')}>← Back</button>
        <div className={s.headerTitle}>Post New Ad</div>
        <div style={{width:60}} />
      </div>

      {/* Step indicator */}
      <div className={s.steps}>
        {['Upload', 'Details', 'Review'].map((label, i) => (
          <div key={label} className={s.stepItem}>
            <div className={`${s.stepDot} ${step > i+1 ? s.stepDone : step === i+1 ? s.stepActive : ''}`}>
              {step > i+1 ? '✓' : i+1}
            </div>
            <div className={`${s.stepLabel} ${step === i+1 ? s.stepLabelActive : ''}`}>{label}</div>
            {i < 2 && <div className={`${s.stepLine} ${step > i+1 ? s.stepLineDone : ''}`} />}
          </div>
        ))}
      </div>

      <div className={s.content}>

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div className={s.card}>
            <h2 className={s.cardTitle}>Upload Your Ad Media</h2>
            <p className={s.cardSub}>Supports JPG, PNG, GIF (max 10MB) or MP4, MOV (max 50MB)</p>

            {err && <div className={s.errBox}>{err}</div>}

            <div className={s.typeRow}>
              {[['image','🖼️','Image Ad'],['video','🎬','Video Ad']].map(([t,icon,label])=>(
                <button key={t} className={`${s.typeBtn} ${adType===t?s.typeBtnActive:''}`} onClick={() => setAdType(t)}>
                  <span style={{fontSize:'1.5rem'}}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div
              className={`${s.dropZone} ${dragging ? s.dropping : ''} ${uploading ? s.uploadingZone : ''}`}
              onClick={() => !uploading && fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {uploading ? (
                <div className={s.progressWrap}>
                  <div className={s.progressIcon}>{adType==='video'?'🎬':'🖼️'}</div>
                  <div className={s.progressLabel}>Uploading… {uploadPct}%</div>
                  <div className={s.progressBar}><div className={s.progressFill} style={{width:uploadPct+'%'}} /></div>
                </div>
              ) : fileUrl ? (
                <div className={s.previewWrap}>
                  {adType === 'image'
                    ? <img src={fileUrl} alt="preview" className={s.previewImg} />
                    : <video src={fileUrl} className={s.previewVideo} controls />
                  }
                  <div className={s.fileName}>{fileName}</div>
                  <div className={s.reupload}>Click to replace</div>
                </div>
              ) : (
                <div className={s.dropPrompt}>
                  <div className={s.dropIcon}>{adType==='video'?'🎬':'🖼️'}</div>
                  <div className={s.dropTitle}>Drop your {adType} here</div>
                  <div className={s.dropSub}>or click to browse files</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept={adType==='video'?'video/*':'image/*'} style={{display:'none'}} onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            {fileUrl && !uploading && (
              <button className={s.btnPrimary} onClick={() => setStep(2)}>Continue →</button>
            )}
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {step === 2 && (
          <div className={s.card}>
            <h2 className={s.cardTitle}>Ad Details & Targeting</h2>
            <p className={s.cardSub}>Set your title, audience, and budget</p>

            {err && <div className={s.errBox}>{err}</div>}

            <div className={s.field}>
              <label>Ad Title *</label>
              <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Summer Sale — 50% off" maxLength={80} />
              <span className={s.charCount}>{title.length}/80</span>
            </div>

            <div className={s.field}>
              <label>Target Area *</label>
              <div className={s.areaGrid}>
                {[['national','🇮🇳','National','Reach all of India','₹2.5/1K'],['state','🗺️','State','Target one state','₹3.5/1K'],['district','📍','District','Target one district','₹5.0/1K']].map(([val,icon,name,desc,price])=>(
                  <div key={val} className={`${s.areaCard} ${targetArea===val?s.areaActive:''}`} onClick={()=>setTargetArea(val)}>
                    <div className={s.areaIcon}>{icon}</div>
                    <div className={s.areaName}>{name}</div>
                    <div className={s.areaDesc}>{desc}</div>
                    <div className={s.areaPrice}>{price}</div>
                  </div>
                ))}
              </div>
            </div>

            {targetArea !== 'national' && (
              <div className={s.field}>
                <label>{targetArea === 'state' ? 'State Name' : 'District Name'} *</label>
                <input type="text" value={targetVal} onChange={e=>setTargetVal(e.target.value)} placeholder={targetArea === 'state' ? 'e.g. Tamil Nadu' : 'e.g. Coimbatore'} />
              </div>
            )}

            <div className={s.field}>
              <label>Views to Order *</label>
              <div className={s.viewsGrid}>
                {VIEWS_OPTIONS.map(v => (
                  <button key={v} className={`${s.viewsBtn} ${views===v?s.viewsBtnActive:''}`} onClick={()=>setViews(v)}>
                    {v >= 1000 ? (v/1000)+'K' : v}
                  </button>
                ))}
              </div>
            </div>

            <div className={s.field}>
              <label>WhatsApp Number (optional)</label>
              <input type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+91 9876543210" />
              <span className={s.hint}>Viewers can message you directly after watching</span>
            </div>

            <button className={s.btnPrimary} onClick={() => {
              if (!title.trim()) { setErr('Enter an ad title.'); return }
              if (targetArea !== 'national' && !targetVal.trim()) { setErr('Enter the target location.'); return }
              setErr(''); setStep(3)
            }}>Review Order →</button>
          </div>
        )}

        {/* ── STEP 3: Review ── */}
        {step === 3 && (
          <div className={s.card}>
            <h2 className={s.cardTitle}>Review & Submit</h2>
            <p className={s.cardSub}>Confirm your ad details before submitting</p>

            {err && <div className={s.errBox}>{err}</div>}

            {/* Preview */}
            <div className={s.reviewPreview}>
              {adType === 'image'
                ? <img src={fileUrl} alt="ad" className={s.reviewImg} />
                : <video src={fileUrl} className={s.reviewVideo} controls />
              }
            </div>

            <div className={s.reviewRows}>
              {[
                ['Ad Title',   title],
                ['Ad Type',    adType === 'image' ? '🖼️ Image' : '🎬 Video'],
                ['Target',     targetArea === 'national' ? '🇮🇳 National' : targetArea === 'state' ? `🗺️ State — ${targetVal}` : `📍 District — ${targetVal}`],
                ['Views',      Number(views).toLocaleString() + ' views'],
                ['WhatsApp',   whatsapp || '—'],
              ].map(([k,v]) => (
                <div key={k} className={s.reviewRow}>
                  <span className={s.reviewKey}>{k}</span>
                  <span className={s.reviewVal}>{v}</span>
                </div>
              ))}
            </div>

            <div className={s.costBreakdown}>
              <div className={s.costTitle}>💰 Cost Breakdown</div>
              <div className={s.costRow}><span>Base ({views/1000}K × ₹{rate})</span><span>₹{budgetBase.toFixed(2)}</span></div>
              <div className={s.costRow}><span>GST (18%)</span><span>₹{budgetGst.toFixed(2)}</span></div>
              <div className={`${s.costRow} ${s.costTotal}`}><span>Total</span><span>₹{budgetTotal.toFixed(2)}</span></div>
            </div>

            <div className={s.submitNote}>
              ℹ️ Amount will be deducted from your advertiser wallet. Your ad goes live after admin approval (usually within a few hours).
            </div>

            <button className={s.btnSubmit} disabled={submitting} onClick={submitAd}>
              {submitting ? '⏳ Submitting…' : '🚀 Submit Ad — ₹' + budgetTotal.toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
