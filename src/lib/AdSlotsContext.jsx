import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase.js'

// 블로그 등 "정적 페이지"는 대시보드의 오프라인 동기화(_cache/IndexedDB)를 타지 않기 때문에
// AdSlots.all()(= db.get('adSlots'))이 항상 빈 배열을 반환한다. 그 경로에서도 광고 슬롯이
// 뜨도록, 로그인/동기화 여부와 무관하게 그 자리에서 바로 Supabase에서 슬롯을 읽어오는
// 독립적인 Context. fresh-season의 lib/AdSlotsContext.js와 동일한 역할.
const AdSlotsContext = createContext({ slots: {}, loading: true })

export function AdSlotsProvider({ children }) {
  const [slots, setSlots] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.from('ad_slots').select('*')
      .then(({ data, error }) => {
        if (!error && Array.isArray(data)) {
          const map = {}
          data.forEach(s => { map[s.id] = s })
          setSlots(map)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdSlotsContext.Provider value={{ slots, loading }}>
      {children}
    </AdSlotsContext.Provider>
  )
}

// 특정 슬롯 하나의 데이터만 필요할 때 사용 (예: useAdSlot('blog_left'))
export function useAdSlot(id) {
  const { slots } = useContext(AdSlotsContext)
  return slots[id] || null
}
