# 🥕 당근과 채찍

친구들과 일주일에 3번씩 유산소운동을 하면서 운동 기록, 벌금 관리를 하는 웹 애플리케이션

---

## 📋 프로젝트 개요

**목적**: 친구들과의 운동 약속을 기록하고 통계내서 더 효과적으로 운동 계획을 세우기

**규칙**:
- 주 3회 유산소 운동 완료가 목표
- 서비스 시작 첫 주(2026-04-09~04-12)는 예외적으로 주 1회 목표
- 목표 미달 시 회당 벌금 부과 (금액은 기간별 변경 가능)
- **주간 목표 초과분은 다음 주로 이월** (2026년 9월 정산 기간부터 적용, 이월분은 정산 기간이 바뀌면 소멸)
- 면제 주간에 한 운동도 전부 다음 주로 이월

---

## 🛠️ 기술 스택

### 프론트엔드
- **Framework**: Next.js 16.2.3
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x

### 백엔드
- **Server**: Next.js API Routes
- **Runtime**: Node.js 24.14
- **Package Manager**: npm 10.8.2

### 데이터베이스
- **DB**: PostgreSQL (Vercel 배포 대응, 2026-09-23 SQLite에서 전환)
  - `DATABASE_URL="postgresql://..."` (.env / Vercel 환경변수)
  - 기존 SQLite 데이터 이관: `scripts/sqlite-to-postgres.mjs` (INSERT SQL 생성 → `prisma db execute`)
- **ORM**: Prisma 6.19.3
  - 클라이언트 위치: `app/generated/prisma/client.ts`
  - 싱글톤 래퍼: `lib/prisma.ts` (`engineType = "client"` + `@prisma/adapter-pg` 드라이버 어댑터, Query Engine 바이너리 없음)

### 개발 환경
- **OS**: Windows 11 Pro
- **IDE**: VS Code
- **Shell**: Git Bash (PowerShell은 스크립트 실행 정책 이슈)

---

## 🌐 포트 설정

| 항목 | 값 |
|------|-----|
| **개발 서버 포트** | 33001 |
| **로컬 접속** | http://localhost:33001 |
| **외부 접속** | http://10.10.70.16:33001 |
| **바인딩** | 0.0.0.0 (모든 인터페이스) |

**설정 파일**: `package.json`
```json
"dev": "next dev -p 33001 -H 0.0.0.0",
"deploy": "next build && next start -p 33001 -H 0.0.0.0"
```

> ⚠️ PowerShell에서 `npm run dev` 실행 시 보안 정책 오류 발생 → **Git Bash** 사용 권장

---

## 📊 데이터 모델 (Prisma Schema)

### User (사용자)
```
- id: Integer (PK, auto increment)
- name: String
- createdAt: DateTime (기본값: now)
- updatedAt: DateTime
- Relations: ExerciseRecord[], UserPenalty[]
```

### ExerciseRecord (운동 기록)
```
- id: Integer (PK, auto increment)
- userId: Integer (FK → User)
- date: DateTime
- completed: Boolean (기본값: true)
- createdAt: DateTime (기본값: now)
- updatedAt: DateTime
- Unique Constraint: (userId, date)
```

### PenaltyRule (벌금 규칙)
```
- id: Integer (PK, auto increment)
- startDate: DateTime (규칙 시작 날짜)
- amount: Integer (벌금 금액, 기본값: 1000)
- createdAt: DateTime (기본값: now)
- updatedAt: DateTime
```

### UserPenalty (누적 벌금 - 현재 미사용, 실시간 계산으로 대체)
```
- id: Integer (PK, auto increment)
- userId: Integer (FK → User)
- totalAmount: Integer (누적 벌금, 기본값: 0)
- createdAt / updatedAt: DateTime
- Unique Constraint: userId
```

### Expense (회비 지출 내역)
```
- id: Integer (PK, auto increment)
- date: DateTime (사용 날짜)
- amount: Integer (사용 금액)
- memo: String (용도, 예: "7월 회식")
- createdAt / updatedAt: DateTime
```

---

## 📄 구현된 기능

### 페이지

#### 1. 메인 대시보드 (`/`)
- 요약 카드: 전체 멤버 수 / 이번주 목표 / **이달의 누적 벌금** (해당 월 완료된 주차만 집계)
- **이월 표시**: 이전 주 초과분이 있으면 주간 달성률 옆 `이월 N` 배지 / 멤버별 달성률 이번주 항목에 `(이월 N)` 표기
- **이번주 주간 달력**: 멤버별 요일 체크 표 (✓/-)
- **멤버별 달성률**: 월간 달성률 내림차순 정렬, 동률 시 초과 횟수 내림차순, 메달 표시 (🥇🥈🥉), 목표 초과분 `+N` 별도 표시
- **누적 벌금 테이블**: 순위별 정렬, 총합 표시
- **네비게이션**: 이모지 + 텍스트, 항목별 컬러 호버 (멤버 파랑 / 달력 초록 / 벌금 빨강 / 규칙 앰버)

#### 5. 규칙 (`/rules`)
- 모임 운영 규칙 9개 표시 (번호 / 제목 / 내용)
- 2번 규칙은 "초과 운동 이월 불가" 폐지 → **"초과 운동 이월"** 로 교체 (2026-09-14). 8번 면제 규칙에도 면제 주간 운동 이월 문구 추가
- 규칙 본문은 `whitespace-pre-line` 적용 — 본문 문자열의 `
` 기준으로 문장별 줄바꿈 (2·8번 적용)
- 앰버 계열 디자인

#### 7. 면제 관리 (`/exemptions`)
- 면제 추가 폼: 멤버 선택, 시작일/종료일, 사유 (입원/출장/부상/해외여행/기타 datalist 제공)
- 현재 면제 중인 멤버 배너 (오렌지 테마)
- 면제 이력 리스트 + 삭제 버튼, 진행 중 배지
- 면제 기간 내 해당 주는 벌금/달성률 계산에서 제외 (주 단위 면제)
- 면제 주간에 한 운동은 **전부 다음 주 이월분으로 인정** (이월 적용 기간 한정)
- 메인 대시보드: 주간 테이블 달성률 셀에 "면제" 배지 표시, 멤버별 달성률에 "사유 면제 중" 배지 표시
- 오렌지(orange) 계열 디자인

#### 6. 월말 정산 (`/monthly`)
- **정산 기간 기준**: 매월 말일이 포함된 주의 일요일까지가 해당 월 정산 기간
  - 예: 2026년 4월 → 04.09(서비스 시작) ~ 05.03(일), 5월 → 05.04 ~ 05.31(일)
- 기간 표시 (YY.MM.DD ~ YY.MM.DD 형식)
- 진행 중 / 마감(기간 종료) 상태 배지
- 이전·다음 달 네비게이션 (이미 시작된 기간만 이동 가능)
- 개인별 누적 벌금 순위표 (최다 벌금자 "최다 벌금" 배지, 최소 벌금자 "이달의 1등" 배지)
- 총 합계
- `📋 리스트` / `📊 상세` 토글 버튼: 리스트 뷰에서 전체 기간을 날짜 내림차순으로 일괄 표시
- **회비 통장(원장) 관리** — 리스트 뷰:
  - 상단 요약 카드: **회비 잔액 = 누적 벌금 − 사용액** (누적 벌금은 진행 중인 달 포함 전체 기간 실시간 합산)
  - **회비 사용 내역**: 지출 추가 폼(날짜/용도/금액) + 사용 내역 리스트(삭제 가능). 회식 등 부분 사용·여러 번 사용 기록 가능 (`Expense`에 저장)
- 보라(violet) 계열 디자인

#### 2. 멤버 관리 (`/users`)
- 새 멤버 추가 (이름 입력)
- 멤버 삭제 (확인 팝업)
- 멤버 목록 (아바타 + 가입일 표시)

#### 3. 운동 달력 (`/calendar`)
- 월별 달력 뷰 (이전/다음 달 이동)
- 멤버 이름 클릭 → 운동 완료 체크 (초록색)
- 다시 클릭 → 취소 (토글)
- 오늘 날짜 강조, 주말 색상 구분, 범례 표시

#### 4. 벌금 관리 (`/penalties`)
- 현재 적용 중인 벌금 규칙 배너
- 새 규칙 추가 (시작 날짜 + 금액)
- 규칙 이력 (기간별 표시)
- 누적 벌금 현황 (순위별 + 합계)

---

## 🖼️ 정적 파일

- `public/logo.png` — 모임 로고 이미지 (2048×2048, 원형). 모든 페이지 헤더에 40×40으로 표시
- `app/icon.svg` — 브라우저 탭 파비콘 (당근 SVG)

---

## 🔌 API 엔드포인트

### Users (사용자)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/users` | 모든 사용자 조회 |
| POST | `/api/users` | 새 사용자 추가 |
| DELETE | `/api/users/[id]` | 사용자 삭제 |

### Exercises (운동 기록)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/exercises` | 운동 기록 조회 (필터: userId, startDate, endDate) |
| POST | `/api/exercises` | 운동 기록 추가 |
| DELETE | `/api/exercises?userId=&date=` | 특정 날짜 운동 기록 삭제 (달력 토글용) |

### Penalty Rules (벌금 규칙)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/penalty-rules` | 벌금 규칙 조회 |
| POST | `/api/penalty-rules` | 벌금 규칙 추가 |

### Stats (통계)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/stats` | 멤버별 주간/월간 달성률 + 누적 벌금 + 이번주 일별 기록 |

### Monthly Stats (월말 정산)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/monthly-stats` | 현재 정산 기간의 개인별 벌금 + 순위 |
| GET | `/api/monthly-stats?year=2026&month=4` | 특정 월(1-indexed) 정산 데이터 조회 |
| GET | `/api/monthly-stats?all=true` | 전체 기간 목록 (날짜 내림차순) |

### Expenses (회비 지출)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/expenses` | 회비 사용 내역 조회 (최신순) + 합계 `{ expenses, total }` |
| POST | `/api/expenses` | 회비 지출 추가 (amount, memo, date) |
| DELETE | `/api/expenses/[id]` | 회비 지출 삭제 |

### Exemptions (면제)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/exemptions` | 면제 이력 조회 (user 정보 포함, startDate 내림차순) |
| POST | `/api/exemptions` | 면제 추가 (userId, startDate, endDate, reason) |
| DELETE | `/api/exemptions/[id]` | 면제 삭제 |

**Monthly Stats API 반환 구조:**
```json
{
  "period": {
    "year": 2026, "month": 4, "label": "2026년 4월",
    "start": "ISO날짜", "end": "ISO날짜",
    "isSettled": false,
    "hasPrev": false, "hasNext": false,
    "prevYear": null, "prevMonth": null,
    "nextYear": null, "nextMonth": null
  },
  "userStats": [{ "id", "name", "penalty", "rank" }],
  "totalPenalty": 5000
}
```

**Stats API 반환 구조:**
```json
{
  "userStats": [{ "id", "name", "weeklyCount", "weeklyExtra", "weeklyCarryIn", "monthlyCount", "monthlyExtra", "monthlyTarget", "weeklyRate", "monthlyRate", "cumulativePenalty", "monthlyPenalty", "isThisWeekExempt", "activeExemption" }],
  "weeklyTarget": 1,
  "monthlyTarget": 10,
  "weekStart": "ISO날짜",
  "weekEnd": "ISO날짜",
  "thisWeekExercises": [{ "userId", "date" }]
}
```
- `weeklyCount` / `monthlyCount`: 목표 달성분만 (초과분 제외, 최대 target)
- `weeklyExtra` / `monthlyExtra`: 목표 초과분 (달성률 계산에 미포함). 이월 적용 기간에는 **아직 쓰이지 않고 남은 이월분**을 의미
- `weeklyCarryIn`: 이전 주에서 이번 주로 넘어온 이월 횟수 (이월 미적용 기간은 항상 0)
- `monthlyTarget`: 면제 주차를 제외한 유효 목표 횟수 (사용자별 상이)
- `isThisWeekExempt`: 이번 주 면제 여부 (true면 weeklyRate=100)
- `activeExemption`: 현재 진행 중인 면제 정보 (없으면 null)
- `monthlyPenalty`: 이달 정산 기간 내 완료된 주차에서 발생한 벌금 합계
- `periodStart` / `periodEnd`: 현재 정산 기간 시작·종료일 (ISO 문자열)
- `periodYear` / `periodMonth`: 정산 기간의 명목 연/월 (1-indexed)

---

## 📐 벌금 자동 계산 로직

### 초과 운동 이월 (2026년 9월 정산 기간부터)
`lib/period.ts`의 `resolveWeek()` / `isCarryoverPeriod()`

- 적용 시작: **2026년 9월 정산 기간(2026-09-07 ~ 2026-10-04)** — `CARRYOVER_START_YEAR/MONTH0`
- 이미 정산이 끝난 2026년 8월 이전 기간은 기존 "이월 불가" 방식으로 계산 (과거 벌금 변동 없음)
- 계산: `이번 주 가용 횟수 = 실제 운동 횟수 + 이월분` → 달성 `min(가용, 목표)`, 남은 `max(0, 가용 - 목표)`는 다음 주로 이월
- 벌금은 `max(0, 목표 - 가용) × 규칙 금액`
- 이월분은 **정산 기간 단위로 초기화** (다음 달로 넘어가지 않음 — 규칙 "벌금 초기화"와 동일 주기)
- **면제 주차**: 목표·달성률·벌금에서는 제외하되, 그 주에 한 운동 횟수는 전부 이월분에 더해짐 (`carry += count`). 이전 이월분도 소멸하지 않고 그대로 통과
  - 이월 미적용 기간(2026년 8월 이전)의 면제 주는 기존대로 완전히 무시

### 누적 벌금 (전체 기간)
`app/api/stats/route.ts`의 `calculateCumulativePenalty()` 함수

- 서비스 시작일(`2026-04-09`)부터 **이번 주 이전까지** 주차별 계산
- 각 주차: `(목표 - 완료 횟수) × 해당 시점 벌금 규칙 금액`
- 시작 주(4/9~4/13) 목표 = **1회**, 이후 = **3회**
- 벌금 규칙이 없으면 기본 **1,000원** 적용

### 정산 기간 계산 (`lib/period.ts`)

| 기간 | 시작일 | 종료일 (말일 포함 주의 일요일) |
|------|--------|-------------------------------|
| 2026년 4월 | 04.09 (서비스 시작) | 05.03 (일) |
| 2026년 5월 | 05.04 | 05.31 (일) |
| 2026년 6월 | 06.01 | 07.05 (일) |

- `getMonthSettlementEnd(year, month)`: 해당 월 말일이 포함된 주의 일요일 반환
- `getMonthPeriod(year, month)`: 정산 기간 `{start, end}` 반환
- `getCurrentPeriod()`: 현재 날짜가 속하는 정산 기간 반환

### 월별 기간 내 벌금 (정산 화면)
`app/api/monthly-stats/route.ts`의 `calculatePeriodPenalty()` 함수

- 해당 정산 기간에 속하는 주차만 계산 (기간 밖 주차 제외)
- 현재 진행 중인 주차는 계산에서 제외 (아직 끝나지 않았으므로)

---

## 🎨 디자인 시스템

- **배경**: `bg-gray-50`
- **카드**: `bg-white rounded-2xl border border-gray-200`
- **로고**: `public/logo.png` (2048×2048 원형 이미지, 헤더에 40×40 `rounded-full` 표시)
- **완료 체크**: `bg-emerald-500` (초록)
- **벌금/경고**: `text-red-500`, `bg-red-50`
- **달성률 배지**: 100% → 초록 / 50~99% → 노랑 / 0~49% → 빨강

---

## 📁 프로젝트 구조

```
99.carrot/
├── app/
│   ├── api/
│   │   ├── users/
│   │   │   ├── route.ts          (GET, POST)
│   │   │   └── [id]/route.ts     (DELETE)
│   │   ├── exercises/route.ts    (GET, POST, DELETE)
│   │   ├── penalty-rules/route.ts(GET, POST)
│   │   ├── stats/route.ts        (GET - 달성률 + 벌금 계산)
│   │   ├── monthly-stats/route.ts(GET - 월별 정산 기간 벌금)
│   │   ├── exemptions/
│   │   │   ├── route.ts          (GET, POST)
│   │   │   └── [id]/route.ts     (DELETE)
│   │   └── expenses/
│   │       ├── route.ts          (GET, POST - 회비 지출)
│   │       └── [id]/route.ts     (DELETE)
│   ├── components/
│   │   └── NavMenu.tsx           (전체 페이지 공통 ☰ 드롭다운 네비게이션)
│   ├── generated/prisma/         (Prisma 자동 생성)
│   │   └── client.ts             (← import 대상)
│   ├── users/page.tsx            (멤버 관리)
│   ├── calendar/page.tsx         (운동 달력)
│   ├── penalties/page.tsx        (벌금 관리)
│   ├── rules/page.tsx            (모임 규칙)
│   ├── monthly/page.tsx          (월말 정산)
│   ├── exemptions/page.tsx       (면제 관리)
│   ├── page.tsx                  (메인 대시보드)
│   ├── layout.tsx                (루트 레이아웃)
│   └── globals.css
├── lib/
│   ├── prisma.ts                 (PrismaClient 싱글톤, 절대경로 DB)
│   └── period.ts                 (정산 기간 계산 유틸: getWeekStart/End, getMonthPeriod, isWeekExempt, getPeriodOfDate, isCarryoverPeriod, resolveWeek 등)
├── prisma/
│   ├── schema.prisma             (데이터 스키마)
│   ├── dev.db                    (SQLite DB 파일)
│   ├── config.ts                 (Prisma 설정)
│   └── migrations/
├── package.json
├── .env                          (DATABASE_URL="file:./prisma/dev.db")
└── PROJECT.md
```

---

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# DB 마이그레이션
npx prisma migrate dev

# 개발 서버 (Git Bash 권장)
npm run dev
# → http://localhost:33001
```

---

## 🔄 개발 흐름

1. **스키마 변경 시**: `prisma/schema.prisma` 수정 → `npx prisma migrate dev --name <이름>` → `npx prisma generate`
2. **API 추가 시**: `app/api/<경로>/route.ts` 작성, `lib/prisma.ts`에서 prisma 임포트
3. **페이지 추가 시**: `app/<경로>/page.tsx` 작성 ('use client' 필요 시 추가)

---

## 📋 향후 개선 예정

### ✅ 완료됨
- [x] 월말 정산 조회 화면 (`/monthly`) — 기간별 개인 벌금 + 순위
- [x] 면제 기능 (`/exemptions`) — 기간 지정 벌금/달성률 제외 *(2026-04-28)*
- [x] 회비 지출(원장) 관리 — 누적 벌금에서 회식 등 사용 내역 기록 (`Expense`/`/api/expenses`) *(2026-07-22)*
- [x] 전체 페이지 공통 드롭다운 네비게이션 (`NavMenu`) *(2026-07-23)*
- [~] 벌금 납부 기록 (실제 납부 완료 처리) → **회비 원장(지출) 방식으로 대체.** 단, 개인별 납부 여부 추적은 미구현

### ⏳ 미구현
- [ ] 상세 통계 페이지 (개인별 완료율, 연속 주 streak, 월별 차트)
- [ ] 운동 타입 기록 (러닝, 자전거, 수영 등)
- [ ] 거리/시간/메모 기록
- [ ] **벌금 규칙 수정/삭제** (현재 추가만 가능 — 잘못 입력한 규칙 정정 불가)
- [ ] **메인 대시보드에 회비 잔액 요약 카드** (현재 `/monthly` 리스트 뷰에서만 확인 가능)
- [ ] 데이터 내보내기 (CSV, Excel)
- [ ] 알림/리마인더
- [ ] 사용자 인증 (로그인)
- [x] PostgreSQL 마이그레이션 (2026-09-23)

---

## 📝 주의사항

- SQLite는 개발용 → 프로덕션 배포 시 PostgreSQL 등으로 전환 필요
- Prisma import 경로: `@prisma/client` ❌ → `lib/prisma.ts` ✅
- `.env` 파일은 `.gitignore`에 포함됨 (커밋 금지)
- `node_modules` 재설치 시 `package-lock.json`도 함께 삭제 후 재설치 (`@tailwindcss/oxide` 네이티브 바인딩 이슈)

---

## 📅 업데이트 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-13 | 규칙 페이지 추가, 로고 이미지 적용, 파비콘 SVG, deploy 스크립트, 네비 디자인 개선 |
| 2026-04-27 | 월말 정산 기능 추가 — `/monthly` 페이지, `/api/monthly-stats`, `lib/period.ts` 정산 기간 계산 유틸 |
| 2026-04-27 | 월말 정산 리스트 뷰 추가 — `📋 리스트` 토글로 전체 기간 일괄 조회, `/api/monthly-stats?all=true` |
| 2026-04-28 | 면제 기능 추가 — `/exemptions` 페이지, `/api/exemptions` CRUD, 주 단위 면제 로직, `lib/period.ts` isWeekExempt, 메인 화면 면제 배지 표시 |
| 2026-04-28 | 규칙 페이지에 면제 규칙 추가 (8번) — 전원 동의 시 정해진 기간 동안 면제 가능 |
| 2026-05-04 | 메인 대시보드 요약 카드 "총 누적 벌금" → "이달의 누적 벌금"으로 변경, API에 `monthlyPenalty` 필드 추가 |
| 2026-05-04 | 대시보드 "이번달" 달성률·벌금을 달력 기준 → 정산 기간 기준으로 변경 (5월: 05.04 ~), API에 `periodStart/End/Year/Month` 추가 |
| 2026-05-04 | 월말정산 페이지에 "이달의 1등" 배지 추가 (달성률→초과횟수 순 대시보드 동일 로직, 현재 면제자 제외) |
| 2026-06-29 | 규칙 페이지 1번 운동 인증에 "하루 15,000보 이상 = 유산소 운동 간주" 내용 추가 |
| 2026-07-22 | 월말정산 정산 완료 체크박스 기능 추가 — `MonthlySettlement` 모델, `/api/settlements` API, 기간별 정산 완료 표시, 기존 기간종료 배지 라벨 "정산 완료→마감"으로 변경 |
| 2026-07-22 | 정산 방식을 체크박스 → **회비 원장(지출 내역)** 으로 개편 — `MonthlySettlement` 제거하고 `Expense` 모델/`/api/expenses` 추가, 리스트 뷰에 "회비 잔액(누적 벌금−사용액)" 요약 + 사용 내역 추가/삭제. 부분 사용 기록 가능 |
| 2026-07-22 | 월말정산 진입 시 기본 뷰를 상세(single) → 리스트(list)로 변경 |
| 2026-07-23 | 운동 달력에 면제 표시 추가 — 면제 기간의 미완료 멤버 버튼을 회색 대신 주황색으로 표시, 범례에 "면제 기간" 추가 (`/api/exemptions` 조회) |
| 2026-07-23 | 전체 페이지 공통 네비게이션 추가 — `app/components/NavMenu.tsx` ☰ 드롭다운 메뉴로 모든 서브페이지 헤더의 "🏠 홈" 버튼 대체, 어느 페이지에서든 전체 메뉴 이동 가능 (현재 페이지 표시) |
| 2026-09-14 | **"초과 운동 이월 불가"(구 2번) 규칙 폐지** — 2026년 9월 정산 기간부터 주간 초과분이 다음 주로 이월(정산 기간 내), 8월 이전 정산 완료분은 기존 계산 유지. `lib/period.ts` `resolveWeek/isCarryoverPeriod/getPeriodOfDate` 추가, stats·monthly-stats 계산 반영, 대시보드 이월 배지 추가, 규칙 페이지에서 해당 규칙 삭제 후 번호 재정렬 |
| 2026-09-14 | 면제 주간에 한 운동을 **초과분으로 인정해 다음 주로 이월**하도록 변경 (이월 적용 기간 한정), 규칙 페이지 2번 "초과 운동 이월" 신설 + 8번 면제 규칙에 이월 문구 추가 |
| 2026-09-14 | 규칙 페이지 본문 문장별 줄바꿈 — `whitespace-pre-line` 적용, 2번(초과 운동 이월)·8번(면제) 규칙을 문장 단위로 개행 |
| 2026-09-23 | **SQLite → PostgreSQL 전환** (Vercel 배포 준비) — schema provider 변경 및 Postgres용 init 마이그레이션 재생성, `scripts/sqlite-to-postgres.mjs` 데이터 이관 스크립트 추가, `postinstall: prisma generate`·`db:deploy` 스크립트 추가, Vercel 환경에서 접속 로그는 파일 대신 `console.log` |
| 2026-09-23 | `prisma.config.ts` — `DATABASE_URL` 미설정 시에도 `prisma generate` 가 실패하지 않도록 수정 (Vercel 빌드 오류 대응) |
| 2026-09-23 | Vercel 런타임 Prisma Query Engine 누락 오류 수정 — `binaryTargets` 에 `rhel-openssl-3.0.x` 추가, `next.config.ts` `outputFileTracingIncludes` 로 엔진 바이너리 강제 포함 |
| 2026-09-23 | Prisma 를 엔진 없는 방식으로 전환 — `engineType = "client"` + `@prisma/adapter-pg`, Vercel 에서 Query Engine 바이너리를 찾지 못하던 문제 근본 해결 (직전 `binaryTargets`/`outputFileTracingIncludes` 방식은 되돌림) |
| 2026-09-23 | `vercel.json` 추가 — 서버리스 함수 리전을 싱가포르(`sin1`)로 고정해 Neon DB(ap-southeast-1)와 같은 지역에 배치 |
