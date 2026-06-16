/**
 * parseMarkdown.js — 공통 마크다운 파서
 *
 * Blog.jsx / BlogAdmin.jsx / BlogWrite.jsx / 칼럼 작성기(HTML) 모두 동일한 로직 사용
 *
 * 지원:
 *  - 헤딩 (h1~h3)
 *  - 굵게 / 이탤릭
 *  - 링크 / 이미지 (max-width:100% + 모바일 대응)
 *  - 목록 (ul / ol)
 *  - blockquote
 *  - 코드블록 / 인라인 코드
 *  - 수평선 (---)
 *  - 마크다운 표 (thead/tbody 구분, 테두리 포함)
 *  - SVG 인라인 (코드블록 없이 태그 그대로, width=100% 자동 보장)
 */

export function sanitizeHtml(html) {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p','br','b','strong','i','em','u','h1','h2','h3',
        'ul','ol','li','blockquote','code','pre','hr','a','img',
        'table','thead','tbody','tr','th','td',
        'svg','g','rect','circle','ellipse','line','polyline','polygon',
        'path','text','tspan','defs','linearGradient','stop','clipPath',
        'marker','title','desc',
      ],
      ALLOWED_ATTR: [
        'href','src','alt','target','rel','style','class',
        'viewBox','xmlns','width','height','fill','stroke','stroke-width','d',
        'x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','points',
        'transform','text-anchor','font-size','font-weight','font-family',
        'id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform',
        'preserveAspectRatio','dominant-baseline','opacity','font-family',
      ],
      ALLOW_DATA_ATTR: false,
    })
  }
  // DOMPurify 없을 때 — script/iframe/이벤트핸들러만 제거
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
}

export function parseMarkdown(md) {
  if (!md) return ''

  // 1) SVG 블록 분리 보존 (변환 중 깨지지 않게)
  const svgPlaceholders = []
  let html = md.replace(/<svg[\s\S]*?<\/svg>/gi, (match) => {
    // SVG에 width="100%" 없으면 자동 추가 (모바일 대응)
    const fixed = match.includes('width=')
      ? match
      : match.replace('<svg', '<svg width="100%"')
    svgPlaceholders.push(fixed)
    return `%%SVG${svgPlaceholders.length - 1}%%`
  })

  // 2) 코드블록 보존
  const codeBlocks = []
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(`<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
    return `%%CODE${codeBlocks.length - 1}%%`
  })

  // 3) 마크다운 표 변환 (헤더행 | 구분선 | 데이터행)
  html = html.replace(
    /^(\|.+\|\n)([ \t]*\|[-| :\t]+\|\n)((?:\|.+\|\n?)*)/gm,
    (_, header, _sep, rows) => {
      const thCells = header
        .split('|').filter(c => c.trim())
        .map(c => `<th>${c.trim()}</th>`).join('')
      const trRows = rows.trim().split('\n').filter(r => r.trim()).map(row => {
        const cells = row.split('|').filter(c => c.trim())
          .map(c => `<td>${c.trim()}</td>`).join('')
        return `<tr>${cells}</tr>`
      }).join('')
      return `<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>\n`
    }
  )

  // 4) 나머지 마크다운 변환
  html = html
    .replace(/^---$/gm, '<hr>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%;width:100%;border-radius:8px;margin:8px 0">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // 5) 문단 처리
  html = html.split(/\n{2,}/).map(block => {
    block = block.trim()
    if (!block) return ''
    if (/^<(h[1-3]|ul|ol|blockquote|hr|table|pre|img)/.test(block)) return block
    if (/%%SVG\d+%%/.test(block)) return block
    if (/%%CODE\d+%%/.test(block)) return block
    return `<p>${block.replace(/\n/g, '<br>')}</p>`
  }).join('\n')

  // 6) 코드블록 복원
  html = html.replace(/%%CODE(\d+)%%/g, (_, i) => codeBlocks[i])

  // 7) SVG 복원
  html = html.replace(/%%SVG(\d+)%%/g, (_, i) => svgPlaceholders[i])

  return sanitizeHtml(html)
}

/**
 * 공통 미리보기 CSS 스타일
 * Blog.jsx globalStyles / BlogWrite mdStyles / BlogAdmin previewStyles 통일
 */
export const markdownPreviewStyles = `
  .md-body, .md-preview {
    line-height: 1.8;
    color: #1f2937;
    font-size: 16px;
    font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
    word-break: keep-all;
  }
  .md-body h1, .md-preview h1 { font-size: 26px; font-weight: 800; margin: 28px 0 14px; color: #111827; }
  .md-body h2, .md-preview h2 { font-size: 20px; font-weight: 700; margin: 24px 0 10px; color: #1f2937; border-bottom: 2px solid #fed7aa; padding-bottom: 6px; }
  .md-body h3, .md-preview h3 { font-size: 16px; font-weight: 700; margin: 18px 0 8px; color: #374151; }
  .md-body p,  .md-preview p  { margin: 10px 0; }
  .md-body ul, .md-preview ul,
  .md-body ol, .md-preview ol  { padding-left: 24px; margin: 10px 0; }
  .md-body li, .md-preview li  { margin: 5px 0; line-height: 1.7; }
  .md-body strong, .md-preview strong { font-weight: 700; color: #111827; }
  .md-body em,     .md-preview em     { font-style: italic; }
  .md-body code,   .md-preview code   { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; color: #e11d48; }
  .md-body pre,    .md-preview pre    { background: #1f2937; color: #f9fafb; padding: 14px 18px; border-radius: 8px; overflow-x: auto; margin: 14px 0; }
  .md-body pre code, .md-preview pre code { background: none; color: inherit; padding: 0; }
  .md-body blockquote, .md-preview blockquote { border-left: 4px solid #f97316; padding: 10px 16px; background: #fff7ed; margin: 14px 0; border-radius: 0 8px 8px 0; color: #92400e; font-style: italic; }
  .md-body a,  .md-preview a  { color: #f97316; text-decoration: underline; }
  .md-body hr, .md-preview hr { border: none; border-top: 2px solid #f3f4f6; margin: 20px 0; }
  .md-body img, .md-preview img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
  .md-body svg, .md-preview svg { max-width: 100%; display: block; margin: 16px 0; }
  .md-body table, .md-preview table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; border: 2px solid #f97316; border-radius: 8px; overflow: hidden; }
  .md-body thead th, .md-preview thead th { background: #f97316; color: #fff; padding: 10px 14px; text-align: left; border: 1px solid #ea6c0a; font-weight: 700; }
  .md-body tbody td, .md-preview tbody td { padding: 10px 14px; border: 1px solid #e5e7eb; background: #fff; }
  .md-body tbody tr:nth-child(even) td, .md-preview tbody tr:nth-child(even) td { background: #fff7ed; }
  @media (max-width: 600px) {
    .md-body, .md-preview { font-size: 15px; }
    .md-body h1, .md-preview h1 { font-size: 22px; }
    .md-body h2, .md-preview h2 { font-size: 18px; }
    .md-body table, .md-preview table { font-size: 13px; display: block; overflow-x: auto; }
  }
`
