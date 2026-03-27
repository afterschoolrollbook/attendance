export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8F6F3',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{
        width: 72,
        height: 72,
        background: '#F97316',
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(249,115,22,0.3)',
      }}>
        📋
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1917', marginBottom: 8 }}>
        방과후 출석부
      </h1>
      <p style={{ fontSize: 15, color: '#78716C', marginBottom: 4 }}>
        AfterSchool Attendance
      </p>
      <p style={{ fontSize: 13, color: '#A8A29E' }}>
        🚀 배포 성공! 개발 진행 중입니다.
      </p>
    </div>
  )
}
