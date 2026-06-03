import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// ─── 빌드할 때마다 sw.js에 버전(시각) 자동 삽입 플러그인
function injectSwVersion() {
  return {
    name: 'inject-sw-version',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'sw.js')
      if (!fs.existsSync(swPath)) return

      const version = new Date().toISOString()
      const content = fs.readFileSync(swPath, 'utf8')

      // 이미 버전 줄이 있으면 교체, 없으면 맨 위에 추가
      const versionLine = `// @version ${version}\n`
      const updated = content.startsWith('// @version')
        ? content.replace(/^\/\/ @version .+\n/, versionLine)
        : versionLine + content

      fs.writeFileSync(swPath, updated)
      console.log(`[vite] sw.js 버전 삽입 완료: ${version}`)
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    injectSwVersion(),
  ],
})
