import React from 'react'
import { BlogKeywordPanel } from './BlogKeywordPanel.jsx'

export function BlogKeywordPage({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10

  return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>🔍 키워드 관리</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
          네이버 검색량 데이터와 찜한 키워드를 관리합니다. Claude MCP를 통해 수집된 데이터가 여기에 쌓입니다.
        </p>
      </div>
      <BlogKeywordPanel isAdmin={isAdmin} />
    </div>
  )
}
