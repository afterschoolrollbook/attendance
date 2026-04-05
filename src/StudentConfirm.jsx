import React, { useState, useRef, useEffect } from 'react'
import { Classes as ClassesDB, Students as StudentsDB } from '../lib/db.js'
import { now } from '../lib/utils.js'
import { Card, PageHeader, EmptyState } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

const COLORS = ['#f97316','#3b82f6','#16a34a','#8b5cf6','#ef4444','#f59e0b','#06b6d4','#ec4899','#14b8a6','#6366f1','#84cc16','#f43f5e']
const DAY_ORDER = ['월','화','수','목','금','토','일']

// ─── 캡처 유틸
async function captureElement(el, filename) {
  try {
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
    }
    const canvas = await window.html2canvas(el, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false })
    const a = document.createElement('a')
    a.download = filename
    a.href = canvas.toDataURL('image/png')
    a.click()
  } catch(e) { console.warn('캡처 실패:', e) }
}

// ─── 소리
function playSpinSound(duration = 3.8) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const tickCount = Math.floor(duration * 12)
    for (let i = 0; i < tickCount; i++) {
      const t = ctx.currentTime + i * (duration / tickCount) * (1 + i / tickCount * 1.8)
      if (t > ctx.currentTime + duration) break
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = 880
      g.gain.setValueAtTime(0.18, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      osc.start(t); osc.stop(t + 0.04)
    }
    setTimeout(() => {
      try {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = 'sine'
        o.frequency.setValueAtTime(523, ctx.currentTime)
        o.frequency.setValueAtTime(659, ctx.currentTime + 0.1)
        o.frequency.setValueAtTime(784, ctx.currentTime + 0.2)
        o.frequency.setValueAtTime(1047, ctx.currentTime + 0.3)
        g.gain.setValueAtTime(0.3, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.6)
      } catch(e) {}
    }, duration * 1000)
  } catch(e) {}
}

function playLadderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (let i = 0; i < 18; i++) {
      const t = ctx.currentTime + i * 0.13
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = 300 + Math.random() * 200
      osc.type = 'square'
      g.gain.setValueAtTime(0.06, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
      osc.start(t); osc.stop(t + 0.08)
    }
    ;[523,659,784,1047].forEach((freq, i) => {
      const t = ctx.currentTime + 2.4 + i * 0.1
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      g.gain.setValueAtTime(0.25, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      o.start(t); o.stop(t + 0.15)
    })
  } catch(e) {}
}

function playCardSound(students, wIds) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    students.forEach((s, i) => {
      const t = ctx.currentTime + (300 + i * 320) / 1000
      const isWin = wIds.has(s.id)
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = isWin ? 880 : 440
      osc.type = isWin ? 'sine' : 'triangle'
      g.gain.setValueAtTime(0.15, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      osc.start(t); osc.stop(t + 0.12)
      if (isWin) {
        [523,659,784].forEach((freq, j) => {
          const t2 = t + 0.08 + j * 0.07
          const o2 = ctx.createOscillator(), g2 = ctx.createGain()
          o2.connect(g2); g2.connect(ctx.destination)
          o2.frequency.value = freq
          g2.gain.setValueAtTime(0.12, t2)
          g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1)
          o2.start(t2); o2.stop(t2 + 0.1)
        })
      }
    })
  } catch(e) {}
}

// ─── 폭죽 캔버스
function ConfettiCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const colors = ['#f97316','#3b82f6','#16a34a','#8b5cf6','#ef4444','#f59e0b','#ec4899','#06b6d4']
    const pieces = Array.from({length:150}, () => ({
      x: Math.random()*canvas.width, y:-20-Math.random()*200,
      w:8+Math.random()*8, h:4+Math.random()*4,
      color: colors[Math.floor(Math.random()*colors.length)],
      rot: Math.random()*Math.PI*2, vx:(Math.random()-0.5)*6,
      vy:2+Math.random()*5, vrot:(Math.random()-0.5)*0.2, opacity:1,
    }))
    let frame
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      let alive = false
      pieces.forEach(p => {
        p.x+=p.vx; p.y+=p.vy; p.rot+=p.vrot; p.vy+=0.12
        if (p.y > canvas.height*0.7) p.opacity -= 0.02
        if (p.opacity > 0) alive = true
        ctx.save(); ctx.globalAlpha=Math.max(0,p.opacity)
        ctx.translate(p.x,p.y); ctx.rotate(p.rot)
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h)
        ctx.restore()
      })
      if (alive) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:9998 }}/>
}

// ════════════════════════════════════════
// 돌림판
// ════════════════════════════════════════
function Roulette({ students, winnerCount, onDone, onCapture }) {
  const [totalRot, setTotalRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [pool, setPool] = useState([...students])
  const [winners, setWinners] = useState([])
  const [popped, setPopped] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const timerRef = useRef(null)
  const totalRotRef = useRef(0)
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const cx = 180, cy = 180, r = 155
  const polar = deg => {
    const rad = (deg-90)*Math.PI/180
    return { x: cx+r*Math.cos(rad), y: cy+r*Math.sin(rad) }
  }
  const slicePath = (i, n) => {
    const sa=(360/n)*i, e=polar(sa+360/n), s=polar(sa)
    return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${360/n>180?1:0} 1 ${e.x},${e.y} Z`
  }
  const labelPos = (i, n) => {
    const angle=(360/n)*i+(360/n)/2, rad=(angle-90)*Math.PI/180, lr=r*0.66
    return { x:cx+lr*Math.cos(rad), y:cy+lr*Math.sin(rad), rot:angle }
  }

  const spin = () => {
    if (spinning || popped || pool.length===0) return
    setSpinning(true)
    const idx = Math.floor(Math.random()*pool.length)
    const sliceAngle = 360/pool.length
    const targetAngle = sliceAngle*idx + sliceAngle/2
    const current = totalRotRef.current % 360
    const needed = (360 - targetAngle%360 + 360) % 360
    const diff = ((needed-current)%360+360)%360
    const delta = (diff===0?360:diff) + 6*360
    totalRotRef.current += delta
    setTotalRot(totalRotRef.current)
    playSpinSound(3.8)
    timerRef.current = setTimeout(() => {
      setSpinning(false)
      setPopped(pool[idx])
      setShowConfetti(true)
    }, 3800)
  }

  const handleConfirm = () => {
    // 캡처 먼저
    onCapture(popped.name, winners.length+1)
    setShowConfetti(false)
    const newWinners = [...winners, popped]
    const newPool = pool.filter(s => s.id !== popped.id)
    setWinners(newWinners)
    setPool(newPool)
    setPopped(null)
    if (newWinners.length >= winnerCount) onDone(newWinners)
  }

  const n = pool.length
  if (n===0) return null

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'20px' }}>
      {/* 당첨 슬롯 */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
        {Array.from({length:winnerCount}, (_,i) => (
          <div key={i} style={{ minWidth:'72px', padding:'7px 14px', borderRadius:'10px', border:`2px solid ${winners[i]?'#16a34a':'#e5e7eb'}`, background:winners[i]?'#f0fdf4':'#f9fafb', textAlign:'center', fontSize:'13px', fontWeight:700, color:winners[i]?'#16a34a':'#9ca3af' }}>
            {winners[i]?winners[i].name:`${i+1}번`}
          </div>
        ))}
      </div>
      {/* 휠 */}
      <div style={{ position:'relative', width:'360px', height:'360px' }}>
        <div style={{ position:'absolute', top:'-4px', left:'50%', transform:'translateX(-50%)', zIndex:10, color:'#f97316', fontSize:'32px', lineHeight:1, filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}>▼</div>
        <svg width="360" height="360" style={{ transform:`rotate(${totalRot}deg)`, transition:spinning?'transform 3.8s cubic-bezier(0.17,0.67,0.06,1.0)':'none', borderRadius:'50%', boxShadow:'0 6px 28px rgba(0,0,0,0.18)' }}>
          {pool.map((s,i) => {
            const lp = labelPos(i,n)
            return (
              <g key={s.id}>
                <path d={slicePath(i,n)} fill={COLORS[i%COLORS.length]} stroke="#fff" strokeWidth="2.5"/>
                <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${lp.rot},${lp.x},${lp.y})`}
                  style={{ fontSize:n>10?'9px':n>6?'11px':'13px', fontWeight:700, fill:'#fff', fontFamily:'Noto Sans KR, sans-serif', pointerEvents:'none' }}>
                  {s.name.slice(0,4)}
                </text>
              </g>
            )
          })}
          <circle cx={cx} cy={cy} r="24" fill="#fff" stroke="#f3f4f6" strokeWidth="2"/>
          <circle cx={cx} cy={cy} r="9" fill="#f97316"/>
        </svg>
      </div>
      {!popped && !spinning && (
        <button onClick={spin} style={{ padding:'14px 56px', borderRadius:'16px', border:'none', background:'#f97316', color:'#fff', fontSize:'17px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 4px 16px rgba(249,115,22,0.4)' }}>
          🎡 돌리기!
        </button>
      )}
      {spinning && <div style={{ fontSize:'15px', color:'#6b7280', fontWeight:600 }}>두근두근...</div>}
      {/* 폭죽 + 당첨 팝업 */}
      {showConfetti && popped && (
        <>
          <ConfettiCanvas/>
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'rgba(255,255,255,0.97)', borderRadius:'28px', padding:'36px 56px', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', border:'3px solid #f97316', animation:'celebIn .45s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ fontSize:'52px', marginBottom:'8px' }}>🎉</div>
              <div style={{ fontSize:'15px', color:'#9ca3af', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'6px' }}>축하합니다!</div>
              <div style={{ fontSize:'42px', fontWeight:900, color:'#f97316', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'6px' }}>{popped.name}</div>
              <div style={{ fontSize:'14px', color:'#d1d5db', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'20px' }}>{winners.length+1}번째 당첨</div>
              <div style={{ fontSize:'12px', color:'#9ca3af', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'12px' }}>📸 확인하면 추첨 화면이 저장됩니다</div>
              <button onClick={handleConfirm} style={{ padding:'12px 40px', borderRadius:'14px', border:'none', background:'#f97316', color:'#fff', fontSize:'16px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 4px 14px rgba(249,115,22,0.4)' }}>
                📸 확인 & 저장 {winners.length+1>=winnerCount?'✅':'→'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// 사다리타기
// ════════════════════════════════════════
function Ladder({ students, winnerCount, onDone, onCapture }) {
  const [started, setStarted] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const n = students.length
  const W = Math.max(360, n*72)
  const H = 420
  const PAD=40, TOP=72, BOT=H-64
  const colX = i => PAD + i*((W-PAD*2)/Math.max(n-1,1))
  const barsRef = useRef(null)
  const resultsRef = useRef(null)

  if (!barsRef.current) {
    const b = []
    for (let row=0; row<10; row++) {
      const y = TOP+(row+1)*((BOT-TOP)/11)
      let last=-2
      for (let col=0; col<n-1; col++) {
        if (col>last+1 && Math.random()>0.42) { b.push({x1:colX(col),x2:colX(col+1),y,col}); last=col }
      }
    }
    barsRef.current = b
    const dests = students.map((_,i) => {
      let col=i
      for (const bar of [...b].sort((a,x)=>a.y-x.y)) {
        if (col===bar.col) col=bar.col+1
        else if (col===bar.col+1) col=bar.col
      }
      return col
    })
    const winDests = new Set([...Array(n).keys()].sort(()=>Math.random()-0.5).slice(0,winnerCount))
    resultsRef.current = dests.map(d => winDests.has(d))
  }

  const run = () => {
    setStarted(true)
    playLadderSound()
    setTimeout(() => {
      setRevealed(true)
      setShowConfetti(true)
      onDone(students.filter((_,i) => resultsRef.current[i]))
    }, 2400)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'20px', width:'100%' }}>
      <div style={{ overflowX:'auto', width:'100%' }}>
        <svg width={W} height={H} style={{ background:'#f9fafb', borderRadius:'16px', border:'1px solid #e5e7eb', display:'block', margin:'0 auto' }}>
          {students.map((s,i) => (
            <text key={s.id} x={colX(i)} y={TOP-18} textAnchor="middle"
              style={{ fontSize:'12px', fontWeight:700, fontFamily:'Noto Sans KR, sans-serif', fill:'#111827' }}>
              {s.name.slice(0,3)}
            </text>
          ))}
          {students.map((s,i) => (
            <line key={s.id} x1={colX(i)} y1={TOP} x2={colX(i)} y2={BOT} stroke="#374151" strokeWidth="3" strokeLinecap="round"/>
          ))}
          {barsRef.current.map((bar,i) => (
            <line key={i} x1={bar.x1} y1={bar.y} x2={bar.x2} y2={bar.y} stroke="#374151" strokeWidth="3" strokeLinecap="round"/>
          ))}
          {started && students.map((s,i) => (
            <circle key={s.id} r="9" fill={COLORS[i%COLORS.length]} stroke="#fff" strokeWidth="2">
              <animateMotion dur="2.4s" fill="freeze" path={`M${colX(i)},${TOP} L${colX(i)},${BOT}`}/>
            </circle>
          ))}
          {revealed && students.map((s,i) => (
            <g key={`r-${s.id}`}>
              <rect x={colX(i)-22} y={BOT+8} width="44" height="26" rx="8"
                fill={resultsRef.current[i]?'#f0fdf4':'#f9fafb'}
                stroke={resultsRef.current[i]?'#16a34a':'#e5e7eb'} strokeWidth="1.5"/>
              <text x={colX(i)} y={BOT+24} textAnchor="middle"
                style={{ fontSize:'11px', fontWeight:800, fontFamily:'Noto Sans KR, sans-serif', fill:resultsRef.current[i]?'#16a34a':'#9ca3af' }}>
                {resultsRef.current[i]?'당첨':'탈락'}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {!started && (
        <button onClick={run} style={{ padding:'14px 52px', borderRadius:'16px', border:'none', background:'#8b5cf6', color:'#fff', fontSize:'17px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 4px 16px rgba(139,92,246,0.4)' }}>
          🪜 출발!
        </button>
      )}
      {started && !revealed && <div style={{ fontSize:'15px', color:'#6b7280', fontWeight:600 }}>내려가는 중...</div>}
      {showConfetti && (
        <>
          <ConfettiCanvas/>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
            {students.filter((_,i) => resultsRef.current[i]).map(s => (
              <div key={s.id} style={{ padding:'9px 20px', borderRadius:'12px', background:'#f0fdf4', border:'2px solid #16a34a', fontSize:'14px', fontWeight:700, color:'#16a34a' }}>
                🎉 {s.name}
              </div>
            ))}
          </div>
          <button onClick={()=>{ setShowConfetti(false); onCapture('결과', 0) }} style={{ padding:'10px 32px', borderRadius:'12px', border:'none', background:'#8b5cf6', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            📸 화면 저장
          </button>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// 카드 뒤집기
// ════════════════════════════════════════
function CardFlip({ students, winnerCount, onDone, onCapture }) {
  const [flipped, setFlipped] = useState(new Set())
  const [winnerIds, setWinnerIds] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const pendingWinnersRef = useRef([])

  const start = () => {
    setAnimating(true)
    const wIds = new Set([...students].sort(()=>Math.random()-0.5).slice(0,winnerCount).map(s=>s.id))
    setWinnerIds(wIds)
    playCardSound(students, wIds)
    students.forEach((s,i) => {
      setTimeout(() => {
        setFlipped(prev => new Set([...prev, s.id]))
        if (i===students.length-1) {
          setAnimating(false)
          pendingWinnersRef.current = students.filter(x => wIds.has(x.id))
          setShowConfetti(true)
        }
      }, 300+i*320)
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'24px' }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', justifyContent:'center', maxWidth:'560px' }}>
        {students.map(s => {
          const isFlipped = flipped.has(s.id)
          const isWinner = winnerIds?.has(s.id)
          return (
            <div key={s.id} style={{ width:'82px', height:'112px', perspective:'800px' }}>
              <div style={{ width:'100%', height:'100%', position:'relative', transformStyle:'preserve-3d', transition:'transform 0.65s ease', transform:isFlipped?'rotateY(180deg)':'none' }}>
                <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', borderRadius:'12px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'30px', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>🎴</div>
                <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', borderRadius:'12px', background:isWinner?'linear-gradient(135deg,#f0fdf4,#dcfce7)':'#f9fafb', border:`2px solid ${isWinner?'#16a34a':'#e5e7eb'}`, transform:'rotateY(180deg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'5px', boxShadow:isWinner?'0 4px 14px rgba(22,163,74,0.28)':'none' }}>
                  <span style={{ fontSize:'22px' }}>{isWinner?'🎉':'😢'}</span>
                  <span style={{ fontSize:'12px', fontWeight:700, color:isWinner?'#16a34a':'#9ca3af', fontFamily:'Noto Sans KR, sans-serif', textAlign:'center', padding:'0 6px' }}>{s.name}</span>
                  <span style={{ fontSize:'11px', fontWeight:600, color:isWinner?'#16a34a':'#d1d5db', fontFamily:'Noto Sans KR, sans-serif' }}>{winnerIds?(isWinner?'당첨!':'탈락'):''}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {!winnerIds && !animating && (
        <button onClick={start} style={{ padding:'14px 52px', borderRadius:'16px', border:'none', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', fontSize:'17px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 4px 16px rgba(99,102,241,0.4)' }}>
          🃏 카드 뒤집기!
        </button>
      )}
      {animating && <div style={{ fontSize:'15px', color:'#6b7280', fontWeight:600 }}>카드 공개 중...</div>}
      {showConfetti && (
        <>
          <ConfettiCanvas/>
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'rgba(255,255,255,0.97)', borderRadius:'28px', padding:'36px 56px', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', border:'3px solid #f97316', animation:'celebIn .45s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ fontSize:'48px', marginBottom:'8px' }}>🎊</div>
              <div style={{ fontSize:'15px', color:'#9ca3af', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'10px' }}>축하합니다!</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center', marginBottom:'20px' }}>
                {pendingWinnersRef.current.map(s => (
                  <span key={s.id} style={{ padding:'8px 18px', borderRadius:'10px', background:'#fff7ed', border:'2px solid #f97316', fontSize:'18px', fontWeight:800, color:'#f97316', fontFamily:'Noto Sans KR, sans-serif' }}>{s.name}</span>
                ))}
              </div>
              <div style={{ fontSize:'12px', color:'#9ca3af', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'12px' }}>📸 확인하면 추첨 화면이 저장됩니다</div>
              <button onClick={()=>{ setShowConfetti(false); onCapture('결과',0); onDone(pendingWinnersRef.current) }}
                style={{ padding:'12px 40px', borderRadius:'14px', border:'none', background:'#f97316', color:'#fff', fontSize:'16px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                📸 확인 & 저장
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════
// 메인
// ════════════════════════════════════════
export function StudentConfirm({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [checked, setChecked] = useState(new Set())
  const [winCount, setWinCount] = useState('')
  const [method, setMethod] = useState(null)
  const [phase, setPhase] = useState('setup')
  const [lotteryWinners, setLotteryWinners] = useState([])
  const lotteryAreaRef = useRef(null)
  const { success, error: toastError } = useToast()

  const classes = ClassesDB.byTeacher(user.id).slice().sort((a,b) => {
    const aDay=DAY_ORDER.indexOf(a.days?.[0]??''), bDay=DAY_ORDER.indexOf(b.days?.[0]??'')
    const d=(aDay===-1?99:aDay)-(bDay===-1?99:bDay)
    if (d!==0) return d
    return (a.section||'').localeCompare(b.section||'','ko')
  })
  const cls = classes.find(c => c.id===selectedClass)

  const allStudents = selectedClass
    ? StudentsDB.byClass(selectedClass).filter(s => s.status!=='cancelled')
    : []

  const toggleCheck = id => setChecked(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleAll = () => checked.size===allStudents.length ? setChecked(new Set()) : setChecked(new Set(allStudents.map(s=>s.id)))
  const checkedStudents = allStudents.filter(s => checked.has(s.id))

  const startLottery = () => {
    const n = parseInt(winCount)
    if (!n||n<=0) { toastError('추첨 인원을 입력하세요.'); return }
    if (checkedStudents.length<2) { toastError('추첨 대상을 2명 이상 선택하세요.'); return }
    if (n>=checkedStudents.length) { toastError('추첨 인원은 대상 인원보다 적어야 합니다.'); return }
    if (!method) { toastError('추첨 방식을 선택하세요.'); return }
    setPhase('lottery')
  }

  const handleCapture = (name, round) => {
    const prefix = cls?.organization || '추첨'
    const filename = round > 0
      ? `${prefix}_추첨_${name}_${round}번째.png`
      : `${prefix}_추첨_결과_${new Date().toLocaleDateString('ko-KR')}.png`
    // 폭죽+팝업이 position:fixed라 body 전체 캡처해야 함
    setTimeout(() => captureElement(document.body, filename), 150)
  }

  const doConfirm = () => {
    lotteryWinners.forEach(s => {
      StudentsDB.update(s.id, {
        status: 'confirmed',
        statusHistory: [...(s.statusHistory||[]), { status:'confirmed', changedAt:now(), memo:'추첨 확정' }],
      })
    })
    success(`${lotteryWinners.length}명이 최종 확정되었습니다.`)
    setPhase('setup'); setLotteryWinners([]); setWinCount(''); setMethod(null); setChecked(new Set())
  }

  const reset = () => { setPhase('setup'); setLotteryWinners([]) }
  const btnOk = checked.size>=2 && winCount && method && parseInt(winCount)>0 && parseInt(winCount)<checkedStudents.length

  return (
    <div style={{ padding:'28px', maxWidth:'900px' }}>
      <PageHeader title="인원 확정 및 추첨" sub="추첨 대상을 체크하고 방식을 선택하세요." />

      <Card style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <div style={{ fontSize:'14px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>수업 선택</div>
          <select value={selectedClass} onChange={e=>{ setSelectedClass(e.target.value); setChecked(new Set()); setPhase('setup') }}
            style={{ flex:1, maxWidth:'360px', padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', cursor:'pointer' }}>
            <option value="">-- 수업을 선택하세요 --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section?' '+c.section+'반':''}</option>
            ))}
          </select>
        </div>
      </Card>

      {!selectedClass ? (
        <EmptyState icon="📋" title="수업을 선택하세요" desc="수업을 선택하면 학생 목록이 표시됩니다." />
      ) : allStudents.length===0 ? (
        <EmptyState icon="👥" title="등록된 학생이 없습니다" desc="학생 관리에서 학생을 먼저 등록하세요." />
      ) : phase==='setup' ? (
        <>
          <Card style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <div style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>
                추첨 대상 선택&nbsp;<span style={{ fontSize:'13px', color:'#f97316', fontWeight:600 }}>({checked.size}명)</span>
              </div>
              <button onClick={toggleAll} style={{ padding:'6px 14px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#374151' }}>
                {checked.size===allStudents.length?'전체 해제':'전체 선택'}
              </button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
              {allStudents.map(s => (
                <div key={s.id} onClick={()=>toggleCheck(s.id)}
                  style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 14px', borderRadius:'10px', border:`2px solid ${checked.has(s.id)?'#f97316':'#e5e7eb'}`, background:checked.has(s.id)?'#fff7ed':'#fff', cursor:'pointer', transition:'all .15s', userSelect:'none' }}>
                  <input type="checkbox" checked={checked.has(s.id)} onChange={()=>{}} style={{ accentColor:'#f97316', width:'15px', height:'15px', pointerEvents:'none' }}/>
                  <span style={{ fontSize:'14px', fontWeight:checked.has(s.id)?700:400, color:checked.has(s.id)?'#f97316':'#374151', fontFamily:'Noto Sans KR, sans-serif' }}>{s.name}</span>
                  <span style={{ fontSize:'11px', color:'#9ca3af' }}>{s.grade}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#111827', marginBottom:'16px' }}>추첨 설정</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
              <label style={{ fontSize:'14px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>선발 인원</label>
              <input type="number" value={winCount} onChange={e=>setWinCount(e.target.value)}
                min={1} max={Math.max(0,checkedStudents.length-1)}
                placeholder={`최대 ${Math.max(0,checkedStudents.length-1)}`}
                style={{ width:'110px', padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'15px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', fontWeight:700 }}/>
              <span style={{ fontSize:'14px', color:'#6b7280' }}>명</span>
            </div>
            <div style={{ fontSize:'14px', fontWeight:600, color:'#374151', marginBottom:'10px' }}>추첨 방식</div>
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
              {[
                { key:'roulette', icon:'🎡', label:'돌림판',    color:'#f97316', bg:'#fff7ed', border:'#fed7aa' },
                { key:'ladder',   icon:'🪜', label:'사다리타기', color:'#8b5cf6', bg:'#f5f3ff', border:'#ddd6fe' },
                { key:'card',     icon:'🃏', label:'카드 뒤집기', color:'#6366f1', bg:'#eef2ff', border:'#c7d2fe' },
              ].map(m => (
                <div key={m.key} onClick={()=>setMethod(m.key)}
                  style={{ flex:1, minWidth:'110px', padding:'16px 12px', borderRadius:'14px', border:`2px solid ${method===m.key?m.color:m.border}`, background:method===m.key?m.bg:'#fff', cursor:'pointer', textAlign:'center', transition:'all .15s', boxShadow:method===m.key?`0 4px 14px ${m.color}30`:'none' }}>
                  <div style={{ fontSize:'28px', marginBottom:'7px' }}>{m.icon}</div>
                  <div style={{ fontSize:'13px', fontWeight:700, color:method===m.key?m.color:'#374151', fontFamily:'Noto Sans KR, sans-serif' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={startLottery} disabled={!btnOk}
              style={{ padding:'13px 40px', borderRadius:'14px', border:'none', background:btnOk?'#f97316':'#e5e7eb', color:btnOk?'#fff':'#9ca3af', fontSize:'16px', fontWeight:700, cursor:btnOk?'pointer':'not-allowed', fontFamily:'Noto Sans KR, sans-serif', boxShadow:btnOk?'0 4px 14px rgba(249,115,22,0.35)':'none' }}>
              🎲 추첨 시작
            </button>
          </div>
        </>

      ) : phase==='lottery' ? (
        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>
              {method==='roulette'?'🎡 돌림판':method==='ladder'?'🪜 사다리타기':'🃏 카드 뒤집기'}
              <span style={{ fontSize:'13px', color:'#6b7280', fontWeight:400, marginLeft:'8px' }}>{checkedStudents.length}명 중 {parseInt(winCount)}명 선발</span>
            </div>
            <button onClick={reset} style={{ padding:'6px 14px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'#f9fafb', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>
              ← 다시 설정
            </button>
          </div>
          <div ref={lotteryAreaRef}>
            {method==='roulette' && <Roulette students={checkedStudents} winnerCount={parseInt(winCount)} organization={cls?.organization||''} onCapture={handleCapture} onDone={ws=>{setLotteryWinners(ws);setPhase('result')}}/>}
            {method==='ladder'   && <Ladder   students={checkedStudents} winnerCount={parseInt(winCount)} onCapture={handleCapture} onDone={ws=>{setLotteryWinners(ws);setPhase('result')}}/>}
            {method==='card'     && <CardFlip students={checkedStudents} winnerCount={parseInt(winCount)} onCapture={handleCapture} onDone={ws=>{setLotteryWinners(ws);setPhase('result')}}/>}
          </div>
        </Card>

      ) : phase==='result' ? (
        <Card>
          <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'16px' }}>🎉 추첨 결과</div>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'24px' }}>
            {lotteryWinners.map(s => (
              <div key={s.id} style={{ padding:'10px 22px', borderRadius:'12px', background:'#f0fdf4', border:'2px solid #16a34a', fontSize:'15px', fontWeight:700, color:'#16a34a' }}>
                🎉 {s.name}
              </div>
            ))}
          </div>
          <div style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px', lineHeight:1.6 }}>
            위 학생들을 최종 확정하시겠습니까? 확정 후에는 출석부에 표시됩니다.
          </div>
          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <button onClick={reset} style={{ padding:'11px 24px', borderRadius:'12px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280' }}>
              다시 추첨
            </button>
            <button onClick={doConfirm} style={{ padding:'11px 28px', borderRadius:'12px', border:'none', background:'#16a34a', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 4px 12px rgba(22,163,74,0.3)' }}>
              ✅ 최종 확정
            </button>
          </div>
        </Card>
      ) : null}

      <style>{`
        @keyframes popIn { from { transform:scale(0.8); opacity:0 } to { transform:scale(1); opacity:1 } }
        @keyframes celebIn { from { transform:scale(0.5); opacity:0 } to { transform:scale(1); opacity:1 } }
      `}</style>
    </div>
  )
}
