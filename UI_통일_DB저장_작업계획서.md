# UI 통일 작업 계획서

## 작업 배경

현재 페이지별로 팝업 알림, 삭제 확인, 삭제 버튼 표기, 저장 방식, 정렬 방향이 제각각.
이를 일관된 방식으로 통일하는 것이 목표.

---

## 통일 기준 (전체 공통)

| 항목 | 통일 후 |
|---|---|
| 유효성 오류 알림 | `alert()` → `toastError('메시지')` |
| 성공/완료 알림 | `alert()` / 인라인 텍스트 → `success('메시지')` |
| 삭제 확인 | `window.confirm()` → `useConfirm()` |
| 삭제 버튼 표기 | 텍스트 `삭제` 버튼 (`×`는 모달 닫기 전용으로만) |
| 모달 닫기 버튼 | 인라인 `×` → `<Modal>` 컴포넌트로 교체 |
| 수정 완료 메시지 | `success('수정이 완료되었습니다.')` |
| 등록 완료 메시지 | `success('등록이 완료되었습니다.')` |
| 파일 저장 메시지 | `success('파일이 저장되었습니다.')` |
| 다운로드 완료 메시지 | `success('다운로드가 완료되었습니다.')` |
| 저장 버튼 없는 곳 | 저장 버튼 신규 추가 후 완료 메시지 통일 |
| 날짜 정렬 | 오래된것 → 최신 (오름차순) `a.localeCompare(b)` |
| 연도 목록 | 오래된것 → 최신 `.sort()` (`.reverse()` 제거) |
| 숫자 정렬 | 낮은수 → 높은수 `a - b` |

### 수정 플로우 통일

```
수정 버튼 클릭 → 내용 수정 → 저장 버튼 클릭 → 토스트 완료 메시지
```

> 저장 버튼이 없는 곳은 저장 버튼을 새로 만든다. 저장 로직은 그대로.

### 학생 리스트 정렬 기준

`Students.jsx`, `Attendance.jsx` 모두 동일하게 통일.

```
1학년 → 6학년  (parseInt 숫자 오름차순)
1반   → 높은반  (parseInt 숫자 오름차순)
1번   → 높은번호 (parseInt 숫자 오름차순)
이름  → ㄱㄴㄷ순  (localeCompare 'ko')
```

```js
// Before (잘못된 문자열 비교)
const gradeCmp = (a.grade || '').localeCompare(b.grade || '', 'ko')

// After (올바른 숫자 비교)
const gradeCmp = parseInt(a.grade || '0') - parseInt(b.grade || '0')
```

---

## 작업 진행 방식 (1파일씩)

> 파일 1개를 끝내고 확인 후 다음 파일로 이동한다.
> 오류가 나면 방금 수정한 파일 1개만 보면 원인을 즉시 찾을 수 있다.

### ① 사용자가 할 일

```
1. 해당 파일을 Claude한테 첨부
2. Claude가 수정된 파일 전달하면 GitHub에 업로드
3. Vercel 빌드 에러 없는지 확인
   → 에러 있으면: 에러 메시지 전체 복사해서 Claude한테 전달 → 재수정 → 다시 업로드
4. Supabase 확인 필요한 파일만:
   F12 → Network 탭 → Fetch/XHR 필터
   Claude가 안내한 버튼/기능 클릭 → 200 확인
   → 실패하면: 에러 메시지 전체 복사해서 Claude한테 전달 → 재수정 → 다시 업로드
5. 이상 없으면 "다음" 이라고 답변
```

> ⚠️ 빌드 또는 Supabase 에러 나면 즉시 멈추고 Claude한테 알려준다.
> 다른 파일 절대 먼저 건드리지 않는다.

### ② Claude가 할 일 (파일 받으면)

```
1. 아래 파일별 수정 항목에서 해당 파일 찾기
2. 수정 항목에 따라 코드에서 아래 내용을 빠짐없이 수정:
   - alert() → toastError() 또는 success() 로 교체
   - window.confirm() → useConfirm() 으로 교체
   - 삭제 × 버튼 → 텍스트 삭제 버튼으로 교체
   - 모달 닫기 인라인 × → <Modal> 컴포넌트로 교체
   - 완료 메시지 문구 통일 (수정됐어요 → 수정이 완료되었습니다. 등)
   - .sort().reverse() → .sort() 로 교체
   - 학년 정렬 localeCompare → parseInt 로 교체
   - 저장 버튼 없는 곳에 저장 버튼 신규 추가
   - useToast / useConfirm import 추가
   - 로컬 toast/confirm 있는 파일은 전역으로 교체 후 로컬 코드 전부 제거
3. 수정된 파일 전달
4. 파일명, 빌드 확인 요청, Supabase 확인 필요 여부와 확인 항목 안내
```

---

## 전체 작업 순서


| 순서 | 파일 | 담당 페이지 | 접근 계정 | Supabase | 완료 |
|---|---|---|---|---|---|
| 0-1 | `Atoms.jsx` | 공통 컴포넌트 (버튼·모달·토스트 등) | — | ❌ | [ ] |
| 0-2 | `App.jsx` | 앱 루트 · 라우팅 | — | ❌ | [ ] |
| 1 | `Attendance.jsx` | 출석체크 · 메모 | 🟡 선생님 | ✅ | [ ] |
| 2 | `Awards.jsx` | 수상 이력 관리 | 🟡 선생님 | ✅ | [ ] |
| 3 | `Career.jsx` | 강사 활동 이력 관리 | 🟡 선생님 | ✅ | [ ] |
| 4 | `Certificates.jsx` | 자격증 관리 | 🟡 선생님 | ✅ | [ ] |
| 5 | `Classes.jsx` | 수업 등록·수정·삭제 | 🟡 선생님 | ✅ | [ ] |
| 6 | `Dashboard.jsx` | 대시보드 홈 · 노트 | 🟡 선생님 | ✅ | [ ] |
| 7 | `Jobs.jsx` | 구인 공고 구독·조회 | 🟡 선생님 | ✅ | [ ] |
| 8 | `PrintSetup.jsx` | 출석부 출력 설정 | 🟡 선생님 | ❌ | [ ] |
| 9 | `Reports.jsx` | 출석 리포트 · 엑셀 다운로드 | 🟡 선생님 | ❌ | [ ] |
| 10 | `Revenue.jsx` | 수강료·입금 내역 관리 | 🟡 선생님 | ✅ | [ ] |
| 11 | `StudentConfirm.jsx` | 학생 추첨·확정 | 🟡 선생님 | ✅ | [ ] |
| 12 | `Students.jsx` | 학생 등록·수정·삭제 | 🟡 선생님 | ✅ | [ ] |
| 13 | `Supplies.jsx` | 교구·업체·파일 관리 | 🟡 선생님 | ✅ | [ ] |
| 14 | `Training.jsx` | 의무연수 이수 기록 | 🟡 선생님 | ✅ | [ ] |
| 15 | `Admin.jsx` | 관리자 — 선생님 인증·권한·지사 관리 | 🔴 관리자 | ✅ | [ ] |
| 16 | `AdminSettings.jsx` | 서비스 설정 — 소셜로그인·지역/학교·강사서비스 | 🔴 관리자 | ✅ | [ ] |
| 17 | `Adsense.jsx` | 광고 슬롯 관리 | 🔴 관리자 | ✅ | [ ] |
| 18 | `Templates.jsx` | 출석부 양식 관리 | 🔴 관리자 | ✅ | [ ] |
| 19 | `Auth.jsx` | 로그인·회원가입·소셜로그인 (마지막) | 🟢 로그인 전 | ❌ | [ ] |

---

## 파일별 수정 항목

---

### 0-1. `Atoms.jsx` — ConfirmDialog 컴포넌트 추가

- [ ] `<ConfirmDialog>` 컴포넌트 작성 (기존 코드 수정 없이 추가만)

---

### 0-2. `App.jsx` — ConfirmDialog 연결

- [ ] `useConfirmDialog` import 후 `<ConfirmDialog />` 마운트 (ToastContainer 옆에)

---

### 1. `Attendance.jsx` — 수정 10건

- [ ] `alert('학부모 전화번호가 없습니다.')` × 2 → `toastError()`
- [ ] `alert('메시지가 복사되었습니다.')` → `success('메시지가 복사되었습니다.')`
- [ ] `alert('복사되었습니다.')` → `success('복사되었습니다.')`
- [ ] 메모/노트 저장 버튼 이미 있음 → `success('수정이 완료되었습니다.')` 완료 메시지 추가
- [ ] 메모 삭제 `×` 버튼 (line 785) → 텍스트 `삭제` 버튼으로 교체
- [ ] 모달 닫기 `×` 버튼들 (line 177, 224, 923) → `Modal` 컴포넌트로 교체
- [ ] 연도 목록 `.sort().reverse()` (line 958) → `.sort()`
- [ ] 학년 정렬 `localeCompare` (line 516, 1026) → `parseInt(a.grade||'0') - parseInt(b.grade||'0')`
- [ ] `useToast` import 추가

**Supabase 확인 항목:**
- 메모 입력 후 저장 버튼
- 메모 삭제 → 확인
- 출석/결석/지각 버튼 클릭

---

### 2. `Awards.jsx` — 수정 6건

- [ ] 모달 닫기 `×` 버튼들 (line 291, 406) → `Modal` 컴포넌트로 교체
- [ ] 인라인 div 모달들 → `Modal` 컴포넌트로 교체
- [ ] `'수정됐어요'` → `'수정이 완료되었습니다.'`
- [ ] `'등록됐어요 ✅'` → `'등록이 완료되었습니다.'`
- [ ] `'파일이 저장됐어요 📎'` → `'파일이 저장되었습니다.'`
- [ ] `'엑셀 다운로드 완료 📊'` → `'다운로드가 완료되었습니다.'`

**Supabase 확인 항목:**
- 수상 등록 → 저장
- 수상 수정 → 저장
- 수상 삭제 → 확인
- 파일 첨부 → Storage 요청 200

---

### 3. `Career.jsx` — 수정 8건

- [ ] 모달 닫기 `×` 버튼들 (line 437, 595, 692) → `Modal` 컴포넌트로 교체
- [ ] 인라인 div 모달들 → `Modal` 컴포넌트로 교체
- [ ] `'수정됐어요'` / `'등록됐어요 ✅'` × 2 (line 158, 229) → `'수정이 완료되었습니다.'` / `'등록이 완료되었습니다.'`
- [ ] `'파일이 저장됐어요 📎'` × 2 (line 179, 669) → `'파일이 저장되었습니다.'`
- [ ] `'엑셀 다운로드 완료 📊'` (line 303) → `'다운로드가 완료되었습니다.'`

**Supabase 확인 항목:**
- 이력 등록 → 저장
- 이력 수정 → 저장
- 이력 삭제 → 확인
- 파일 첨부 → Storage 요청 200

---

### 4. `Certificates.jsx` — 수정 6건

- [ ] 모달 닫기 `×` 버튼들 (line 434, 560) → `Modal` 컴포넌트로 교체
- [ ] 인라인 div 모달들 → `Modal` 컴포넌트로 교체
- [ ] `'수정됐어요'` → `'수정이 완료되었습니다.'`
- [ ] `'등록됐어요 ✅'` → `'등록이 완료되었습니다.'`
- [ ] `'파일이 저장됐어요 📎'` → `'파일이 저장되었습니다.'`
- [ ] `'엑셀 다운로드 완료 📊'` → `'다운로드가 완료되었습니다.'`

**Supabase 확인 항목:**
- 자격증 등록 → 저장
- 자격증 수정 → 저장
- 자격증 삭제 → 확인
- 파일 첨부 → Storage 요청 200

---

### 5. `Classes.jsx` — 수정 12건

- [ ] `alert('필수 항목을 입력하세요')` → `toastError()`
- [ ] `alert('최대 2장까지 등록 가능합니다.')` → `toastError()`
- [ ] `alert('업로드 실패: ...')` × 3 → `toastError()`
- [ ] `alert('최대 ${MAX}개까지 등록 가능합니다.')` → `toastError()`
- [ ] `alert('jpg, png, pdf 파일만...')` → `toastError()`
- [ ] `alert('이미 추가된 날짜입니다.')` → `toastError()`
- [ ] 수업 저장/등록 후 완료 메시지 없음 → `success('수정이 완료되었습니다.')` / `success('등록이 완료되었습니다.')` 추가
- [ ] 삭제 `×` 버튼 (line 745) → 텍스트 `삭제` 버튼으로 교체
- [ ] 모달 닫기 `×` 버튼들 (line 286, 557, 780) → `Modal` 컴포넌트로 교체
- [ ] 연도 목록 `.sort().reverse()` (line 70) → `.sort()`
- [ ] `useToast` import 추가

**Supabase 확인 항목:**
- 수업 등록 → 저장
- 수업 수정 → 저장
- 수업 삭제 → 확인
- 파일 업로드 → Storage 요청 200

---

### 6. `Dashboard.jsx` — 수정 2건

- [ ] 노트/메모 저장 버튼 이미 있음 → `success('수정이 완료되었습니다.')` 완료 메시지 추가
- [ ] `useToast` import 추가

**Supabase 확인 항목:**
- 노트 입력 후 저장 버튼

---

### 7. `Jobs.jsx` — 수정 3건

- [ ] `alert('과목을 입력하세요')` → `toastError()`
- [ ] `if(confirm('삭제할까요?'))` → `useConfirm()`
- [ ] 모달 닫기 `×` 버튼 → `Modal` 컴포넌트로 교체
- [ ] `useToast`, `useConfirm` import 추가

**Supabase 확인 항목:**
- 공고 등록 → 저장
- 공고 삭제 → 확인

---

### 8. `PrintSetup.jsx` — 수정 1건

- [ ] `alert('엑셀 생성 중 오류가 발생했습니다.')` → `toastError()`
- [ ] `useToast` import 추가

---

### 9. `Reports.jsx` — 수정 1건

- [ ] `alert('엑셀 다운로드 중 오류가 발생했습니다.')` → `toastError()`
- [ ] `useToast` import 추가

---

### 10. `Revenue.jsx` — 수정 11건

- [ ] `alert('금액을 입력하세요')` × 2 (line 281, 291) → `toastError()`
- [ ] `alert('수업을 선택하세요')` (line 290) → `toastError()`
- [ ] `alert('텀을 선택해주세요')` (line 938) → `toastError()`
- [ ] `alert('수업을 선택해주세요')` (line 935) → `toastError()`
- [ ] 삭제 `×` 버튼 + `window.confirm` 조합 × 3 (line 572, 735, 824) → `useConfirm()` + 텍스트 `삭제` 버튼으로 교체
- [ ] 모달 닫기 `×` 버튼들 (line 854, 962, 1128) → `Modal` 컴포넌트로 교체
- [ ] ⚠️ **line 639 `.sort().reverse()[0]`는 건드리지 말 것** — termEnd 최댓값 구하는 로직, 정렬 통일 대상 아님
- [ ] `useToast`, `useConfirm` import 추가

**Supabase 확인 항목:**
- 수강료 등록 → 저장
- 입금 내역 등록 → 저장
- 입금 내역 삭제 → 확인

---

### 11. `StudentConfirm.jsx` — 수정 4건

- [ ] `alert('추첨 인원을 입력하세요.')` → `toastError()`
- [ ] `alert('추첨 대상보다 많은 인원...')` → `toastError()`
- [ ] `alert('${selected.size}명이 최종 확정되었습니다.')` → `success()`
- [ ] `alert('추첨 완료! 선발 ${winners.length}명...')` → `success()`
- [ ] `useToast` import 추가

**Supabase 확인 항목:**
- 개별 학생 확정 버튼
- 전체 확정 버튼

---

### 12. `Students.jsx` — 수정 10건

> ⚠️ 상태 저장 버튼 추가 후 버튼 클릭 전에는 Network 요청이 없어야 정상

- [ ] `alert('이름과 학년은 필수입니다.')` → `toastError()`
- [ ] `alert('수업을 선택하거나 수업명을 입력해주세요.')` → `toastError()`
- [ ] `alert('등록할 학생 데이터가 없습니다.')` → `toastError()`
- [ ] `alert('파일을 읽을 수 없습니다.')` → `toastError()`
- [ ] `alert('먼저 수업을 선택해주세요.')` → `toastError()`
- [ ] `alert(msg)` (엑셀 가져오기 결과) → 성공이면 `success()`, 실패면 `toastError()` 분기
- [ ] 학생 상태 select onChange 즉시 저장 → **저장 버튼 신규 추가** + `success('수정이 완료되었습니다.')`
- [ ] 학년 정렬 `localeCompare` (line 117) → `parseInt(a.grade||'0') - parseInt(b.grade||'0')`
- [ ] 연도 목록 `.sort().reverse()` (line 83) → `.sort()`
- [ ] ⚠️ `Students.js` 패치 스니펫에도 `alert(msg)` 있음 — 같이 `success()` / `toastError()` 분기로 교체
- [ ] `useToast` import 확인

**Supabase 확인 항목:**
- 학생 등록 → 저장
- 학생 상태 변경 → 저장 버튼 클릭 **전** Network 요청 없는지 확인
- 저장 버튼 클릭 → 200 확인
- 학생 삭제 → 확인
- 엑셀 업로드

---

### 13. `Supplies.jsx` — 수정 20건

> ⚠️ 이 파일은 전역 `useToast()` 대신 자체 로컬 `showToast` 함수를 쓰고 있고,
> confirm도 `deleteConfirm` state 기반 로컬 다이얼로그를 쓰고 있다. 둘 다 전역으로 교체.

**alert → toastError (9건)**
- [ ] `alert('교구명을 입력하거나 교구를 선택하세요')` → `toastError()`
- [ ] `alert('업체명을 입력하세요')` → `toastError()`
- [ ] `alert('오류가 발생했습니다: ...')` → `toastError()`
- [ ] `alert('교구명을 입력하세요')` → `toastError()`
- [ ] `alert('저장 실패: ...')` → `toastError()`
- [ ] `alert('교구를 선택하세요')` → `toastError()`
- [ ] `alert('단계를 선택하세요')` → `toastError()`
- [ ] `alert('업로드 실패: ...')` → `toastError()`
- [ ] `alert('이미 있는 과목이에요')` → `toastError()`

**로컬 showToast → 전역 success (11건)**
- [ ] `showToast('교구 설정이 저장되었습니다.')` → `success('수정이 완료되었습니다.')`
- [ ] `showToast('업체가 등록되었습니다.')` → `success('등록이 완료되었습니다.')`
- [ ] `showToast('삭제가 완료되었습니다.', 'info')` × 여러 곳 → `success('삭제가 완료되었습니다.')`
- [ ] `showToast('교구가 수정되었습니다.')` → `success('수정이 완료되었습니다.')`
- [ ] `showToast('교구가 등록되었습니다.')` → `success('등록이 완료되었습니다.')`
- [ ] `showToast('저장되었습니다.')` → `success('수정이 완료되었습니다.')`
- [ ] `showToast(fileEditId ? '수정이 완료되었습니다.' : '저장이 완료되었습니다.')` → `success(fileEditId ? '수정이 완료되었습니다.' : '등록이 완료되었습니다.')`
- [ ] 로컬 `toast` state, `setToast`, `showToast` 함수 및 로컬 토스트 렌더링 UI 전부 제거

**로컬 deleteConfirm → 전역 useConfirm (4건)**
- [ ] `setDeleteConfirm({ msg:'이 업체를 삭제하시겠습니까?...', onOk: ... })` → `confirm()`
- [ ] `setDeleteConfirm({ msg:'이 교구를 삭제하시겠습니까?', onOk: ... })` → `confirm()`
- [ ] `setDeleteConfirm({ msg:'이 파일을 삭제하시겠습니까?', onOk: ... })` → `confirm()`
- [ ] `setDeleteConfirm({ msg:'... 과목을 삭제하시겠습니까?', onOk: ... })` → `confirm()`
- [ ] `deleteConfirm` state, `setDeleteConfirm`, 로컬 confirm 다이얼로그 렌더링 UI 전부 제거

**× 버튼 정리**
- [ ] 삭제 `×` 버튼 (line 1528, 1617) → 텍스트 `삭제` 버튼으로 교체
- [ ] 모달 닫기 `×` 버튼들 (line 1146, 1280, 1385, 1574, 1674, 1768, 1806, 1842) → `Modal` 컴포넌트로 교체
- [ ] `useToast`, `useConfirm` import 추가

**Supabase 확인 항목:**
- 교구 등록 → 저장
- 교구 수정 → 저장
- 교구 삭제 → 확인
- 업체 등록 → 저장
- 업체 삭제 → 확인
- 파일 업로드 → Storage 요청 200
- 파일 삭제 → 확인

---

### 14. `Training.jsx` — 수정 8건

- [ ] 모달 닫기 `×` 버튼들 (line 415, 491) → `Modal` 컴포넌트로 교체
- [ ] 인라인 div 모달들 → `Modal` 컴포넌트로 교체
- [ ] `'수정됐어요'` → `'수정이 완료되었습니다.'`
- [ ] `'등록됐어요 ✅'` → `'등록이 완료되었습니다.'`
- [ ] `'파일이 저장됐어요 📎'` → `'파일이 저장되었습니다.'`
- [ ] `'엑셀 다운로드 완료 📊'` → `'다운로드가 완료되었습니다.'`
- [ ] line 136 날짜 정렬 역순 → 오름차순
  ```js
  // Before
  .sort((a,b) => (b.completedAt||'').localeCompare(a.completedAt||''))
  // After
  .sort((a,b) => (a.completedAt||'').localeCompare(b.completedAt||''))
  ```
- [ ] 연도 목록 `.sort().reverse()` (line 134) → `.sort()`

**Supabase 확인 항목:**
- 연수 등록 → 저장
- 연수 수정 → 저장
- 연수 삭제 → 확인
- 파일 첨부 → Storage 요청 200

---

### 15. `Admin.jsx` — 수정 7건

- [ ] `alert('등록된 핸드폰 번호가 없어...')` → `toastError()`
- [ ] `alert('비밀번호가 초기화되었습니다.')` → `success('비밀번호가 초기화되었습니다.')`
- [ ] `window.confirm('삭제하시겠습니까?')` (line 774) → `useConfirm()`
- [ ] `window.confirm('${name} 선생님을 삭제하시겠습니까?...')` (line 989) → `useConfirm()`
- [ ] `window.confirm('비밀번호를 초기화하시겠습니까?')` (line 1008) → `useConfirm()`
- [ ] 지사 저장 후 완료 메시지 없음 → `success('수정이 완료되었습니다.')` / `success('등록이 완료되었습니다.')` 추가
- [ ] `useToast`, `useConfirm` import 추가

**Supabase 확인 항목:**
- 지사 추가 → 저장
- 지사 수정 → 저장
- 지사 삭제 → 확인
- 선생님 권한 설정 → 저장
- 선생님 삭제 → 확인
- 비밀번호 초기화 → 확인

---

### 16. `AdminSettings.jsx` — 수정 11건

- [ ] `alert('교육지원청명을 입력하세요.')` → `toastError()`
- [ ] `alert('기관명을 입력하세요')` × 2 → `toastError()`
- [ ] `alert('공고 제목을 입력하세요')` → `toastError()`
- [ ] `window.confirm('삭제하시겠습니까?')` (line 552) → `useConfirm()`
- [ ] `confirm('삭제할까요?')` × 3 (line 894, 915, 932) → `useConfirm()`
- [ ] `SaveMsg` 인라인 텍스트 피드백 전부 → `success('수정이 완료되었습니다.')` 토스트로 교체
- [ ] `SaveMsg` 컴포넌트 및 `msg` state 제거 (파일 내 28곳 관련 코드 전부 제거)
- [ ] line 745 학교 삭제 `×` 버튼 → 텍스트 `삭제` 버튼으로 교체
- [ ] 모달 닫기 `×` 버튼들 (line 1142, 1166, 1196) → `Modal` 컴포넌트로 교체
- [ ] `useToast`, `useConfirm` import 추가

**Supabase 확인 항목:**
- 교육지원청 추가 → 저장
- 교육지원청 삭제 → 확인
- 연수기관 추가 → 저장
- 연수기관 삭제 → 확인
- 자격증 제휴처 추가 → 저장
- 공고 등록 → 저장
- 공고 삭제 → 확인

---

### 17. `Adsense.jsx` — 수정 2건

> ⚠️ Toggle 저장 버튼 추가 후 버튼 클릭 전에는 Network 요청이 없어야 정상

- [ ] Toggle onChange 즉시 저장 → **저장 버튼 신규 추가** + `success('수정이 완료되었습니다.')`
- [ ] `useToast` import 추가

**Supabase 확인 항목:**
- Toggle 변경 후 저장 버튼 클릭 **전** → Network 요청 없는지 확인
- 저장 버튼 클릭 → 200 확인
- 광고 코드 입력 후 저장 → 200 확인

---

### 18. `Templates.jsx` — 수정 4건

> ⚠️ Toggle 저장 버튼 추가 후 버튼 클릭 전에는 Network 요청이 없어야 정상

- [ ] `alert('학교명과 양식 이름을 입력하세요.')` → `toastError()`
- [ ] `if (!confirm('삭제하시겠습니까?'))` → `useConfirm()`
- [ ] Toggle onChange 즉시 저장 (line 100) → **저장 버튼 신규 추가** + `success('수정이 완료되었습니다.')`
- [ ] `useToast`, `useConfirm` import 추가

**Supabase 확인 항목:**
- Toggle 변경 후 저장 버튼 클릭 **전** → Network 요청 없는지 확인
- 저장 버튼 클릭 → 200 확인
- 양식 삭제 → 확인

---

### 19. `Auth.jsx` — 수정 11건 ← 마지막

> 데이터 저장 로직은 건드리지 않음. Supabase 확인 불필요.
> 빌드 후 실제 로그인 테스트 필수.

- [ ] 카카오 앱키 미설정 `alert()` (line 125) → `toastError()`
- [ ] 카카오 로그인 실패 `alert()` × 2 (line 137, 154) → `toastError()`
- [ ] 네이버 클라이언트ID 미설정 `alert()` (line 166) → `toastError()`
- [ ] 네이버 로그인 실패 `alert()` (line 182) → `toastError()`
- [ ] 소셜 로그인 미설정 안내 `alert()` × 6 (line 812, 815, 817, 841, 844, 846) → `toastError()`
- [ ] `useToast` import 추가
