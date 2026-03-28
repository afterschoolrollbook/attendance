/**
 * 방과후 출석부 — 백엔드 자동 설정
 * Supabase CLI 없이 Management API 직접 사용
 * 실행: node setup.js
 */

const https  = require('https')
const http   = require('http')
const fs     = require('fs')
const path   = require('path')
const readline = require('readline')

const G = '\x1b[32m'; const Y = '\x1b[33m'; const R = '\x1b[31m'; const N = '\x1b[0m'
function ok(m)   { console.log(G+'[OK] '+N+m) }
function warn(m) { console.log(Y+'[!!] '+N+m) }
function fail(m) { console.log(R+'[XX] '+N+m) }

function loadEnv(file) {
  const env = {}
  fs.readFileSync(file,'utf8').split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return
    const idx = line.indexOf('=')
    if (idx < 0) return
    env[line.slice(0,idx).trim()] = line.slice(idx+1).trim().replace(/^["']|["']$/g,'')
  })
  return env
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

function apiCall(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const opts = {
      hostname: 'api.supabase.com',
      path,
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }
    const req = https.request(opts, res => {
      let buf = ''
      res.on('data', d => buf += d)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }) }
        catch { resolve({ status: res.statusCode, body: buf }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function main() {
  console.log('')
  console.log('====================================================')
  console.log('   AFTERSCHOOL ATTENDANCE - Backend Setup')
  console.log('====================================================')
  console.log('')

  // .env 확인
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) { fail('.env 파일 없음'); process.exit(1) }
  const env = loadEnv(envPath)
  if (!env.VITE_SUPABASE_URL) { fail('VITE_SUPABASE_URL 없음'); process.exit(1) }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) { fail('SUPABASE_SERVICE_ROLE_KEY 없음'); process.exit(1) }

  const projectRef = env.VITE_SUPABASE_URL.replace('https://','').split('.')[0]
  ok('프로젝트: ' + projectRef)

  // Access Token 안내
  console.log('')
  console.log('[ 인증 ] Supabase Access Token 필요')
  console.log('')
  console.log('  1. 브라우저에서 아래 주소 여세요:')
  console.log('     https://supabase.com/dashboard/account/tokens')
  console.log('')
  console.log('  2. "Generate new token" 클릭')
  console.log('  3. 이름: afterschool-setup')
  console.log('  4. 생성된 토큰 복사')
  console.log('')

  const token = await ask('  토큰 붙여넣기: ')
  if (!token) { fail('토큰 없음'); process.exit(1) }

  // 토큰 확인
  const me = await apiCall('GET', '/v1/projects', token)
  if (me.status !== 200) { fail('토큰 오류 (상태코드 '+me.status+'): ' + JSON.stringify(me.body).slice(0,100)); process.exit(1) }
  ok('토큰 확인 완료')

  // Secrets 등록
  console.log('')
  console.log('[ SECRETS ] 등록 중...')
  const secrets = [
    { name: 'SVC_ROLE_KEY', value: env.SUPABASE_SERVICE_ROLE_KEY }
  ]
  const secRes = await apiCall('POST', `/v1/projects/${projectRef}/secrets`, token, secrets)
  if (secRes.status === 200 || secRes.status === 201) {
    ok('SUPABASE_SERVICE_ROLE_KEY 등록 완료')
  } else {
    warn('Secrets 등록 오류: ' + JSON.stringify(secRes.body))
  }

  // Edge Functions 배포
  console.log('')
  console.log('[ DEPLOY ] Edge Functions 배포 중...')

  const functions = ['db-api', 'send-email', 'send-sms', 'naver-oauth']
  for (const fn of functions) {
    process.stdout.write('  ' + fn + ' ... ')
    const fnPath = path.join(__dirname, 'supabase', 'functions', fn, 'index.ts')
    if (!fs.existsSync(fnPath)) { console.log(R+'파일 없음'+N); continue }

    const code = fs.readFileSync(fnPath, 'utf8')

    // 기존 함수 확인
    const existing = await apiCall('GET', `/v1/projects/${projectRef}/functions/${fn}`, token)

    let res
    if (existing.status === 200) {
      // 업데이트
      res = await apiCall('PATCH', `/v1/projects/${projectRef}/functions/${fn}`, token, {
        body: Buffer.from(code).toString('base64'),
        verify_jwt: false
      })
    } else {
      // 신규 생성
      res = await apiCall('POST', `/v1/projects/${projectRef}/functions`, token, {
        slug: fn,
        name: fn,
        body: Buffer.from(code).toString('base64'),
        verify_jwt: false
      })
    }

    if (res.status === 200 || res.status === 201) {
      console.log(G+'완료'+N)
    } else {
      console.log(R+'실패 ('+res.status+')'+N)
      if (res.body) console.log('    ' + JSON.stringify(res.body).slice(0,100))
    }
  }

  console.log('')
  console.log('====================================================')
  ok('백엔드 설정 완료!')
  console.log('')
  console.log('Vercel 환경변수 추가:')
  console.log('  VITE_SUPABASE_URL      = ' + env.VITE_SUPABASE_URL)
  console.log('  VITE_SUPABASE_ANON_KEY = ' + (env.VITE_SUPABASE_ANON_KEY||'').slice(0,50)+'...')
  console.log('')
  warn('이메일/SMS/소셜 키는 관리자 페이지에서 입력하세요')
  console.log('====================================================')
}

main().catch(e => { fail(e.message); console.log(''); process.exit(1) })
