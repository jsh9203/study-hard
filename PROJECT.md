# 📚 스터디 인증

친구들과 매일 공부 인증샷과 공부시간을 올리고, 주 5회 목표 미달 시 벌금을 쌓는 웹 애플리케이션.
기획서: `PLAN.md`

---

## 📋 규칙 요약
- 하루 공부시간 합계 **1시간 이상** = 인증일, 주(월~일) **5인증일** 목표
- 미달 1회당 **1,000원** (주 종료 후 확정)
- 벌금은 **목표 기간(시작일 ~ D-day)** 안에서만 발생
- 첫 주 목표: 시작 요일~금요일 평일 수 (월5 화4 수3 목2 금1), D-day 주: `min(5, 월요일~D-day 일수)`
- 목표 달성 → 자동 정산(벌금 면제) / 미달성 → 정산 체크로 정산
- 서비스 시작일 2026-09-21(월)

---

## 🛠️ 기술 스택
- Next.js 16.3 (App Router, `proxy.ts`) · React 19.2 · TypeScript 5 · Tailwind CSS 4
- Prisma 6.19 — `prisma-client` 생성기 + `engineType = "client"` + `@prisma/adapter-pg` (Query Engine 바이너리 없음)
  - 클라이언트: `app/generated/prisma/client.ts` (gitignore, `postinstall`에서 생성)
  - 싱글톤: `lib/prisma.ts`
- DB: Neon Postgres (Free) — `DATABASE_URL`(pooled), `DATABASE_URL_UNPOOLED`(마이그레이션용)
- 사진: Vercel Blob (client upload, 브라우저 압축 후 업로드)
- 배포: Vercel Hobby, `vercel.json` 리전 `sin1`
- 테스트: Vitest (`npm test`)

## 🌐 포트
- 개발 서버: `33002` (`next dev -p 33002 -H 0.0.0.0`) — Git Bash 권장

## 🔐 환경변수 (`.env.example` 참고)
| 이름 | 용도 |
|------|------|
| `DATABASE_URL` | Neon pooled 연결 (런타임) |
| `DATABASE_URL_UNPOOLED` | Neon direct 연결 (`prisma migrate`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `GROUP_PASSWORD` | 그룹 공용 비밀번호 |

---

## 📊 데이터 모델 (`prisma/schema.prisma`)
- **User**: name, color, deletedAt(소프트 삭제)
- **Goal**: userId, examName, target, startDate(평일), examDate(D-day), resultDate, status(ACTIVE/ACHIEVED/FAILED/CANCELLED), finalPenalty(스냅샷), penaltyWaived, closedAt, settledAt
- **StudyLog**: userId, studyDate(@db.Date), durationSec, photoUrl?, photoPath?(사진 선택), memo

---

## 📄 구현된 기능

### 페이지
#### 메인 대시보드 (`/`)
- 인트로 스플래시 (`app/components/Splash.tsx`, 세션당 1회 — `sessionStorage.splashShown`)
- 헤더: 로고 + "📸 인증하기" 버튼
- 요약 타일: 총 누적 벌금 / 이번 주 그룹 공부시간 / 멤버 수
- 멤버 카드(→ `/users/[id]`): D-day·시험명(결과 대기/목표 없음 배지), 이번 주 인증 `N/목표` + 7칸 진행 표시, 이번 주·누적 공부시간, 누적 인증일수, 벌금(미정산 배지), 이번 주 예상 벌금(회색)
- 이번 주 현황 표: 멤버 × 월~일, ✓+시간(1시간 이상) / 회색 시간(미달) / -, 오늘 강조, 목표 기간 밖 날짜는 흐리게
- 서버 컴포넌트 (`connection()`으로 요청마다 계산), 집계 `lib/dashboard.ts` `buildDashboard` + 로더 `app/dashboard-ui/load.ts`

#### 로그인 (`/login`)
- 인트로(큰 로고) 1200ms 후 로고 축소(w-24) + **PIN 키패드**(숫자 최대 8자리, 물리 키보드 지원, 오입력 시 흔들림) 등장, 로그인 성공 시 `splashShown` 설정 → 홈 스플래시 생략
- `GROUP_PASSWORD`는 숫자 PIN으로 설정
- `proxy.ts`: 쿠키 없으면 페이지는 `/login?next=` 리다이렉트, API는 401 (`/login`, `/api/auth`, 정적 파일, `/logo.png` 예외)
- 쿠키 **1년** 유지 — 하단 탭바 **🔒 잠금** 버튼(`DELETE /api/auth`)으로 해당 기기 잠금. 쿠키 값은 `GROUP_PASSWORD` HMAC → 비밀번호 변경 시 전원 재로그인 (`lib/auth.ts`)

#### 공부 인증 (`/upload`)
- 멤버 칩 선택(마지막 선택·저장한 멤버를 localStorage 에 기억 → 다시 들어오면 자동 선택) → 사진(**선택 사항**, 갤러리/카메라) 브라우저 압축(1280px, JPEG, ≤0.4MB) → 날짜(2026-09-21 ~ 오늘) → 시/분/초 (1시간 이상 ✓ 표시) → 메모
- **진행 중(ACTIVE) 목표가 없는 멤버는 인증 불가** — 칩에 "목표 없음" 표시, 선택 시 안내 + 목표 생성 링크, 저장 버튼 비활성 (서버도 409 거부)
- 사진이 있으면 Vercel Blob client upload (`/api/upload` 토큰) 후 `POST /api/logs`, 없으면 바로 저장, 완료 시 그날 합계·인증 여부 표시
- 최근 인증 10건 목록 (썸네일 → 원본 새 탭, 사진 없으면 "사진 없음", 삭제)

#### 멤버 (`/users`, `/users/[id]`)
- 목록: 추가(이름 1~20자, 색 자동 배정) / 소프트 삭제. 이름 오른쪽에 진행 중 목표가 없으면 **🎯 목표 생성** 버튼, 있으면 시험명 + D-day
- 상세: 진행 중 목표 카드(D-day, 진행 중/결과 대기, 현재 벌금, 주차별 인증·벌금), 목표 생성·수정 폼(시작일 평일만·첫 주 규칙 안내), 결과 체크(D-day 다음 날부터 달성/미달성), 목표 취소(벌금 없음), 미정산 목표 정산 완료, 과거 목표 이력

### 로직 (`lib/`)
- `date.ts`: KST 오늘, 주 시작/끝, 요일, D-day, `YYYY-MM-DD` ↔ `@db.Date`
- `penalty.ts`: `weekTarget`(첫 주·D-day 주 규칙), `goalWeeks`(주차별 목표/인증일/확정 벌금), `goalPenalty`
- `goal.ts`: `summarizeGoal`(phase·실시간/스냅샷 벌금·미정산), `closeGoalFields`(달성=자동 정산, 미달성=미정산, 취소=벌금 없음), `canClose`, `validateGoalDates`
- `dashboard.ts`: 대시보드 집계 (순수 함수)
- `queries.ts`: `serializeGoal`, `loadDailySeconds` / `http.ts`: API 응답 헬퍼 / `format.ts`: 시간·금액·D-day 표시
- 테스트: `penalty.test.ts`, `goal.test.ts`, `dashboard.test.ts` (38개)

### API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST / DELETE | `/api/auth` | 로그인 / 로그아웃 |
| GET | `/api/health` | DB 연결 확인 (활성 멤버 수) |
| GET / POST | `/api/users` | 활성 멤버 목록(`activeGoal` 포함) / 추가 (201) |
| GET / DELETE | `/api/users/[id]` | 멤버 + 목표 요약 목록 / 소프트 삭제 |
| GET / POST | `/api/users/[id]/goals` | 목표 목록 / 생성 (ACTIVE 중복 409) |
| PATCH | `/api/goals/[id]` | 수정(ACTIVE만) 또는 `{status}` 종료 (거부 시 409) |
| POST | `/api/goals/[id]/settle` | 미달성 목표 정산 완료 |
| GET / POST | `/api/upload` | 진단(`tokenConfigured`, `lastError`) / Blob client upload 토큰 (`logs/` 경로, jpeg/png/webp, 5MB) |
| GET / POST | `/api/logs` | 기록 조회(userId, from, to, limit) / 생성 (진행 중 목표 없으면 409) |
| PATCH / DELETE | `/api/logs/[id]` | 기록 수정 / 삭제(Blob 사진 함께 삭제) |
| GET | `/api/dashboard` | 대시보드 집계 |

## 🖼️ 정적 파일
- `public/logo.png` — 원형 로고 (768×768, 원 밖 투명). `public/study-hard_origin.png`(원본, 회색 배경, **gitignore**)에서 원을 검출해 생성
- `app/icon.svg` — 파비콘

---

## 🚀 시작하기
```bash
npm install            # postinstall 로 prisma generate
cp .env.example .env   # 값 채우기
npx prisma migrate dev --name init
npm run dev            # http://localhost:33002
npm test
```

## 🔄 개발 흐름
1. 스키마 변경: `prisma/schema.prisma` → `npx prisma migrate dev --name <이름>`
2. API: `app/api/<경로>/route.ts`, `params`는 `await ctx.params` (Next 16)
3. Prisma import는 `@/lib/prisma` 만 사용

---

## 📅 업데이트 이력
| 날짜 | 내용 |
|------|------|
| 2026-09-23 | 기획 확정 (`PLAN.md`) |
| 2026-09-23 | 서비스명 "Study Hard" 확정 — 페이지 타이틀·로그인·헤더·패키지명 반영 |
| 2026-09-23 | P0 세팅 — Next.js 16 + Tailwind 4 + Prisma 6(adapter-pg) 스캐폴드, 스키마(User/Goal/StudyLog), `lib/date·penalty·rules` + 단위 테스트 19개, 그룹 비밀번호 인증(`proxy.ts`, `/login`, `/api/auth`), `/api/health`, `vercel.json`(sin1) |
| 2026-09-23 | Neon(ap-southeast-1) 연결, 초기 마이그레이션 `init` 적용, `/api/health` DB 연결 확인 |
| 2026-09-23 | P1 MVP — 멤버·목표(생성/수정/결과 체크/취소/정산), 공부 인증 업로드(브라우저 압축 + Vercel Blob), 메인 대시보드, 하단 탭바. 에이전트 3개 병렬 구현 후 통합, 실제 DB·Blob E2E 25항목 통과 |
| 2026-09-23 | 인트로 스플래시(홈, 세션당 1회) + 로그인 인트로 변형, 원형 투명 로고 `logo.png` 생성, `proxy.ts`에서 `/logo.png` 인증 예외 |
| 2026-09-23 | 로그인을 PIN 키패드 UI로 변경, 로그인 유지 90일 → 1년, 하단 탭바 🔒 잠금 버튼 추가, 로고 원본 gitignore |
| 2026-09-23 | 업로드 토큰 발급 실패 진단 — `GET /api/upload`(토큰 설정 여부·마지막 에러), 업로드 화면에서 실패 원인 안내, 서버 로그 출력 |
| 2026-09-23 | 공부 인증 사진을 선택 사항으로 변경 — `StudyLog.photoUrl/photoPath` nullable 마이그레이션(`optional_photo`), API·업로드 화면 반영. 저장 성공 시에도 마지막 멤버 기억 |
| 2026-09-23 | 멤버 목록에 🎯 목표 생성 버튼(목표 있으면 시험명·D-day), 진행 중 목표 없는 멤버는 공부 인증 불가(화면 안내 + API 409), `/api/users`에 `activeGoal` 추가 |
| 2026-09-23 | iOS Safari 날짜 입력칸 보정 — 칸 밖으로 넘침·빈 값일 때 높이 줄어듦 수정(`globals.css` base 레이어), 목표 폼 날짜 그리드 `min-w-0`, 모바일 입력칸 16px(포커스 확대 방지) |
