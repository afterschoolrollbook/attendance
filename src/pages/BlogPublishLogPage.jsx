import React from 'react'
import { BlogPublishLogPanel } from './BlogPublishLogPanel.jsx'

export function BlogPublishLogPage({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10

  return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>🗂️ 블로그 발행 기록</h1>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
          Claude가 작성한 블로그 글의 시리즈·각도·키워드 기록을 관리합니다. 중복 없이 다음 글을 기획하는 데 활용됩니다.
        </p>
      </div>
      <BlogPublishLogPanel isAdmin={isAdmin} />
    </div>
  )
}
