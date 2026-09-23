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
- **StudyLog**: userId, studyDate(@db.Date), durationSec, photoUrl, photoPath, memo

---

## 📄 구현된 기능

### 인증 (그룹 비밀번호)
- `proxy.ts`: 쿠키 없으면 페이지는 `/login?next=` 리다이렉트, API는 401
- `/login`: 비밀번호 입력 → `POST /api/auth` → httpOnly 쿠키(90일). 쿠키 값은 `GROUP_PASSWORD` HMAC이라 비밀번호 변경 시 전원 재로그인
- `lib/auth.ts`

### 벌금/날짜 로직
- `lib/date.ts`: KST 오늘, 주 시작/끝, 요일, D-day
- `lib/penalty.ts`: `weekTarget`(첫 주·D-day 주 규칙), `goalWeeks`(주차별 목표/인증일/확정 벌금), `goalPenalty`
- `lib/rules.ts`: 규칙 상수

### API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST / DELETE | `/api/auth` | 로그인 / 로그아웃 |
| GET | `/api/health` | DB 연결 확인 (활성 멤버 수) |

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
| 2026-09-23 | P0 세팅 — Next.js 16 + Tailwind 4 + Prisma 6(adapter-pg) 스캐폴드, 스키마(User/Goal/StudyLog), `lib/date·penalty·rules` + 단위 테스트 19개, 그룹 비밀번호 인증(`proxy.ts`, `/login`, `/api/auth`), `/api/health`, `vercel.json`(sin1) |
