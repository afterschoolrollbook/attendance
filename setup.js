/**
 * 방과후 출석부 — 백엔드 자동 설정
 * 실행: node setup.js
 * (Windows / Mac / Linux 공통)
 */

const { execSync, spawnSync } = require('child_process')
const fs   = require('fs')
const path = require('path')
const os   = require('os')

const G = '\x1b[32m'  // 초록
const Y = '\x1b[33m'  // 노랑
const R = '\x1b[31m'  // 빨강
const N = '\x1b[0m'   // 리셋

function log(msg)   { console.log(msg) }
function ok(msg)    { console.log(`${G}[OK]${N} ${msg}`) }
function warn(msg)  { console.log(`${Y}[!!]${N} ${msg}`) }
function fail(msg)  { console.log(`${R}[XX]${N} ${msg}`) }

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf8', ...opts })
}

function runSafe(cmd) {
  try { run(cmd); return true } catch { return false }
}

// ── .env 파일 파싱
function loadEnv(file) {
  if (!fs.existsSync(file)) return {}
  const env = {}
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return
    const idx = line.indexOf('=')
    if (idx < 0) return
    const k = line.slice(0, idx).trim()
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[k] = v
  })
  return env
}

// ── Project ref 추출
function extractRef(url) {
  return (url || '').replace('https://', '').split('.')[0]
}

// ── CLI 명령 실행 (에러 무시)
function cli(args) {
  const isWin = os.platform() === 'win32'
  const cmd   = isWin ? 'supabase.exe' : 'supabase'
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  return result.status === 0
}

// ════════════════════════════════════════
log('')
log('====================================================')
log('   AFTERSCHOOL ATTENDANCE - Backend Setup')
log('====================================================')
log('')

// 1. .env 확인
const envPath = path.join(__dirname, '.env')
if (!fs.existsSync(envPath)) {
  fail('.env 파일이 없습니다.')
  log('')
  log('  .env.example 을 복사해서 .env 를 만드세요:')
  log('  Windows: copy .env.example .env')
  log('  Mac:     cp .env.example .env')
  log('  그 후 메모장으로 열어 값을 입력하세요.')
  process.exit(1)
}

const env = loadEnv(envPath)

if (!env.VITE_SUPABASE_URL) {
  fail('.env 에 VITE_SUPABASE_URL 이 없습니다.')
  process.exit(1)
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  fail('.env 에 SUPABASE_SERVICE_ROLE_KEY 가 없습니다.')
  process.exit(1)
}

const projectRef = extractRef(env.VITE_SUPABASE_URL)
ok(`프로젝트 감지: ${projectRef}`)
log('')

// 2. Node.js / npm 확인
try {
  const ver = run('node --version', { silent: true }).trim()
  ok(`Node.js ${ver}`)
} catch {
  fail('Node.js 가 설치되어 있지 않습니다.')
  process.exit(1)
}

// 3. Supabase CLI 설치 확인
let supabaseOk = false
try {
  run('supabase --version', { silent: true })
  ok('Supabase CLI 이미 설치됨')
  supabaseOk = true
} catch {
  warn('Supabase CLI 설치 중...')
  try {
    run('npm install -g supabase')
    ok('Supabase CLI 설치 완료')
    supabaseOk = true
  } catch {
    fail('Supabase CLI 설치 실패. 아래 명령을 직접 실행해주세요:')
    log('  npm install -g supabase')
    process.exit(1)
  }
}

// 4. Supabase 로그인
log('')
log('[ 로그인 ] 브라우저가 열립니다. 로그인 후 돌아오세요...')
const loginOk = cli(['login'])
if (!loginOk) {
  warn('로그인 과정에서 오류가 발생했을 수 있습니다. 계속 진행합니다.')
}

// 5. 프로젝트 연결
log('')
log(`[ 연결 ] 프로젝트 연결 중: ${projectRef}`)
const linkOk = cli(['link', '--project-ref', projectRef])
if (linkOk) {
  ok('프로젝트 연결 완료')
} else {
  warn('연결 중 오류. 계속 진행합니다.')
}

// 6. Service Role Key 등록 (이것만 — 나머지는 관리자 페이지)
log('')
log('[ SECRETS ] Service Role Key 등록 중...')
const secretOk = cli(['secrets', 'set', `SUPABASE_SERVICE_ROLE_KEY=${env.SUPABASE_SERVICE_ROLE_KEY}`])
if (secretOk) {
  ok('SUPABASE_SERVICE_ROLE_KEY 등록완료')
} else {
  warn('Secret 등록 실패. 나중에 수동으로 등록하세요.')
}
log(`  (이메일/SMS/소셜 키는 관리자 페이지에서 입력하세요)`)

// 7. Edge Functions 배포
log('')
log('[ DEPLOY ] Edge Functions 배포 중...')

const functions = ['db-api', 'send-email', 'send-sms', 'naver-oauth']
const results = {}

functions.forEach(fn => {
  process.stdout.write(`  배포 중: ${fn} ... `)
  const ok_ = cli(['functions', 'deploy', fn])
  results[fn] = ok_
  console.log(ok_ ? `${G}완료${N}` : `${R}실패${N}`)
})

// 8. 완료 요약
log('')
log('====================================================')
const allOk = Object.values(results).every(Boolean)
if (allOk) {
  ok('백엔드 설정 완료!')
} else {
  warn('일부 항목이 실패했습니다. 위 메시지를 확인하세요.')
}
log('')
log('다음 단계:')
log('  1. npm run dev     -> 로컬 테스트')
log('  2. GitHub push     -> Vercel 자동 배포')
log('  3. Vercel 환경변수 추가:')
log(`     VITE_SUPABASE_URL      = ${env.VITE_SUPABASE_URL}`)
log(`     VITE_SUPABASE_ANON_KEY = ${(env.VITE_SUPABASE_ANON_KEY || '').slice(0,30)}...`)
log('  4. 관리자 로그인 -> 서비스 설정')
log('     -> 이메일/SMS/소셜 키 입력')
log('====================================================')
log('')
