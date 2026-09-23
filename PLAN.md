# 📚 스터디 인증 웹앱 — 기획서 / 개발 방향

> 작성일: 2026-09-23 · 상태: **확정 (2026-09-23 결정사항 반영)**
> 서비스 시작일: **2026-09-21(월)**
> 참고: `PROJECT_ref.md`(당근과 채찍 운동 앱), `CLAUDE_ref.md`

친구들이 매일 공부한 인증샷(스톱워치 사진)과 실제 공부시간을 올리고, 주간 목표 미달 시 벌금이 쌓이며, 각자의 시험 D-day·목표를 관리하는 웹앱.

---

## 1. 요구사항 정리

| # | 요구사항 | 해석 / 구체화 |
|---|---------|---------------|
| 1 | 주 5회, 1시간 이상 공부 인증샷 업로드 | 하루에 **공부시간 합계가 1시간 이상**인 날 = "인증일". 주(월~일) 5인증일이 목표 |
| 2 | 업로드 시 공부시간(시/분/초) 입력 → 누적 공부시간 (일/주별) | 기록 단위 = `StudyLog`(사진 1장 + 시간). 하루 여러 번 업로드 가능, 일별 합산 |
| 3 | 1시간 미달 시 벌금 1,000원 누적 | 주 마감 시 `max(0, 목표일수 − 인증일수) × 1,000원` |
| 4 | 시험 D-day·목표 설정, D-day 이후 벌금 없음, 결과 발표 후 목표 달성 체크 → 벌금 초기화 | 벌금은 **목표(Goal) 기간에 종속** (아래 3장) |
| 5 | 대시보드: 누적 공부시간 / 누적 공부일수(주 5회 중 N회) / 누적 벌금 | 멤버별 카드 + 이번 주 현황 표 |
| 6 | 사용자 추가/삭제, 사용자별 목표 설정 | 사용자 삭제는 **소프트 삭제** 권장 (기록·사진 보존) |

---

## 2. 사진 업로드 — Neon 무료 플랜에서 가능한가?

### 결론: DB(BLOB/bytea)에 사진을 넣는 건 **비추천**. 사진은 **Vercel Blob**에, DB에는 **URL만** 저장.

| 항목 | DB에 bytea 저장 | Vercel Blob 저장 (권장) |
|------|----------------|------------------------|
| 저장 용량 | Neon Free **0.5GB/프로젝트** — 사진이 금방 잡아먹음 | Hobby 무료 약 **1GB** (+ DB 용량은 텍스트만 쓰므로 거의 무한) |
| 업로드 경로 | 서버 함수 경유 → Vercel 함수 요청 본문 **4.5MB 제한**에 걸림 | 브라우저 → Blob **직접 업로드** (client upload) 가능 |
| 조회 성능 | 매 조회마다 DB에서 바이너리 읽음, Neon 컴퓨트·전송량 소모 | CDN에서 바로 서빙, DB 부하 없음 |
| 운영 | 백업·마이그레이션 무거워짐 | DB는 가볍게 유지 |

> ⚠️ 무료 한도 수치는 정책 변경이 잦으니 배포 전 Vercel/Neon 대시보드에서 재확인.

### 용량 추정 (클라이언트 압축 전제)

- 업로드 전 브라우저에서 **긴 변 1280px, WebP/JPEG 품질 0.7** 수준으로 압축 → 장당 약 **150~300KB**
- 5명 × 주 5~7장 × 52주 ≈ 1,500~1,800장/년 → **약 250~500MB/년**
- → Vercel Blob 무료 1GB로 **1~2년 운영 가능**. 부족해지면:
  - 오래된 사진 자동 삭제(예: 목표 종료 후 N개월) 또는 썸네일만 보관
  - Cloudflare R2(무료 10GB)로 이전 — URL만 저장하는 구조라 교체 쉬움

### 구현 방식
- `@vercel/blob` 의 client upload (`upload()` + `/api/upload` 토큰 발급 라우트)
- 압축: `browser-image-compression` 라이브러리
- DB의 `StudyLog.photoUrl`, `photoPath` 저장. 기록 삭제 시 `del()`로 Blob도 함께 삭제

---

## 3. 벌금은 목표(Goal)에 종속시키는 게 좋은가? → **예**

### 핵심 설계
- **공부 기록(StudyLog)은 사용자에 종속** — 목표와 무관하게 계속 쌓임 (누적 공부시간은 목표가 바뀌어도 이어짐)
- **벌금은 목표 기간 안에서만 계산** — "벌금이 발생하는 창(window)" = `[목표 시작일, 시험일(D-day)]`
- 벌금은 레퍼런스 앱처럼 **DB에 쌓지 않고 기록으로부터 실시간 계산**, 목표를 종료할 때만 최종 금액을 **스냅샷** 저장
  - 장점: 기록 수정/삭제 시 벌금이 자동으로 맞게 재계산됨, 초기화 = 목표 종료이므로 데이터 삭제가 필요 없음

### 목표 상태 흐름

```
[진행 중 ACTIVE] ──(D-day 지남, 자동)──▶ [결과 대기] ──(결과 체크)──┬▶ [달성 ACHIEVED] → 자동 정산 (벌금 면제·초기화)
  벌금 발생 O                              벌금 발생 X               └▶ [미달성 FAILED] → 미정산 → [정산 체크] → 정산 완료
                                           기록은 계속 가능
```

- "결과 대기"는 DB 상태가 아니라 `오늘 > examDate && status = ACTIVE`로 **파생** 계산
- D-day ~ 결과 발표 사이: **벌금만 없고 공부 기록은 계속 가능**
- 결과 체크 시 `finalPenalty`(그 목표 기간 벌금 합계) 스냅샷 저장
  - **달성**: 즉시 `settledAt = now`, `penaltyWaived = true` → 벌금 0원 처리 (자동 정산)
  - **미달성**: `settledAt = null` (미정산) → 멤버 상세에서 **"정산 완료" 체크** 시 `settledAt` 기록 (벌금 납부 완료 의미)
- 대시보드 "누적 벌금" = **진행 중 목표 벌금 + 미정산(FAILED) 목표 벌금** (미정산분은 별도 배지로 구분)
- 목표가 없는 사용자 = 벌금 없음 (공부 기록은 가능)
- 한 사용자당 **동시에 ACTIVE 목표는 1개**로 제한. 미정산 FAILED 목표가 있어도 새 목표 생성은 가능

### 목표 시작일 & 첫 주 규칙
- 서비스 시작일 = **2026-09-21(월)**. 기존 멤버의 첫 목표는 이 날부터 시작 → 첫 주도 주 5회
- 신규 목표 생성 시 **목표 시작일 직접 설정**, **토/일은 선택 불가** (UI 비활성 + API 검증)
- **첫 주 목표 횟수 = 시작 요일부터 금요일까지의 평일 수**

  | 시작 요일 | 월 | 화 | 수 | 목 | 금 |
  |----------|----|----|----|----|----|
  | 첫 주 목표 | 5회 | 4회 | 3회 | 2회 | 1회 |

- 둘째 주부터는 주 5회
- **D-day가 있는 마지막 주**: `min(5, 그 주 월요일 ~ D-day 일수)` (예: D-day 수요일 → 3회, 토·일 → 5회) — 첫 주와 같은 비례 원칙

### 벌금 계산 규칙
- 주 기준: **월~일, KST(Asia/Seoul)**
- 인증일: 해당 날짜 `StudyLog.durationSec` 합계 ≥ 3,600초 (주말 공부도 인증일로 인정)
- 주 벌금 = `max(0, 주별 목표 횟수 − 인증일수) × 1,000원` (규칙 변경 없음 → 상수)
- **진행 중인 주는 확정하지 않음** (일요일 종료 후 확정) — 대시보드엔 "이번 주 N/목표" 진행 현황 표시
  - 옵션: "이번 주 예상 벌금"을 회색으로 미리 보여주기

### 업로드 날짜 규칙
- 공부 날짜는 **사용자가 직접 선택** (기본값 오늘, 새벽 공부 귀속도 사용자가 판단)
- 선택 범위: **서비스 시작일(2026-09-21) ~ 오늘**. 과거 날짜 제한 없음, 미래 날짜 불가
- 과거 날짜 업로드/수정으로 이미 끝난 주의 인증일이 늘면 벌금도 실시간 재계산됨 (정산 완료된 목표는 스냅샷 유지)

---

## 4. 기술 스택 & 배포 (레퍼런스 앱에서 검증된 구성 재사용)

| 구분 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) + React 19 + TypeScript | 레퍼런스와 동일 |
| 스타일 | Tailwind CSS 4 | 모바일 우선 (인증은 폰에서 함) |
| ORM | Prisma 6 + `engineType = "client"` + `@prisma/adapter-pg` | 레퍼런스에서 겪은 Vercel Query Engine 누락 문제를 처음부터 회피 |
| DB | Neon Postgres (Free) | 처음부터 Postgres로 시작 (SQLite 단계 생략) |
| 파일 저장 | Vercel Blob | 2장 참고 |
| 배포 | Vercel Hobby, `vercel.json` 리전 `sin1` | Neon 리전(ap-southeast-1)과 맞춤 |
| 날짜 처리 | `date-fns` + `date-fns-tz` (또는 직접 KST 유틸) | **Vercel 서버는 UTC** → 모든 날짜 계산을 KST 기준으로 명시 |

### 레퍼런스에서 가져올 교훈
- `postinstall: prisma generate`, `DATABASE_URL` 없어도 generate가 실패하지 않게 config 작성
- Prisma import는 `lib/prisma.ts` 싱글톤으로만
- `lib/period.ts` 같은 **기간/벌금 계산 유틸을 한 곳에** 모으고 API들은 이를 재사용
- `PROJECT.md` 를 살아있는 문서로 유지 (`CLAUDE.md` 규칙 동일 적용)
- 개발 서버는 Git Bash에서 실행

---

## 5. 데이터 모델 (Prisma 초안)

```prisma
model User {
  id        Int        @id @default(autoincrement())
  name      String
  color     String?    // 대시보드 아바타 색
  deletedAt DateTime?  // 소프트 삭제
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  goals     Goal[]
  logs      StudyLog[]
}

enum GoalStatus {
  ACTIVE     // 진행 중 (D-day 전이면 벌금 발생, 후면 결과 대기로 표시)
  ACHIEVED   // 목표 달성 → 벌금 면제
  FAILED     // 미달성
  CANCELLED  // 중도 취소
}

model Goal {
  id            Int        @id @default(autoincrement())
  userId        Int
  user          User       @relation(fields: [userId], references: [id])
  examName      String     // 시험명 (예: 정보처리기사 필기)
  target        String     // 목표 (예: 합격, 900점 이상)
  startDate     DateTime   @db.Date   // 벌금 계산 시작일 (평일만, >= 서비스 시작일)
  examDate      DateTime   @db.Date   // D-day (이날까지 벌금 발생)
  resultDate    DateTime?  @db.Date   // 결과 발표일 (선택, 안내용)
  status        GoalStatus @default(ACTIVE)
  finalPenalty  Int?       // 결과 체크 시점 스냅샷
  penaltyWaived Boolean    @default(false) // 달성 → true (자동 정산)
  closedAt      DateTime?  // 결과 체크 시각
  settledAt     DateTime?  // 정산 완료 시각 (달성: 자동 / 미달성: 정산 체크 시)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  @@index([userId, status])
}

model StudyLog {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  studyDate   DateTime @db.Date   // 공부한 날짜 (KST 기준 날짜)
  durationSec Int                 // 시/분/초 → 초로 저장
  photoUrl    String
  photoPath   String              // Blob 삭제용 pathname
  memo        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([userId, studyDate])
}
```

- 벌금 금액(1,000원)·주 목표(5회)·인정 기준(3,600초)·서비스 시작일은 `lib/rules.ts` 상수 (규칙 변경 없음 → 규칙 테이블 불필요)
- 공부 기록은 목표 FK를 갖지 않음 → 벌금 소속은 날짜로 판단

---

## 6. 화면 구성

| 경로 | 화면 | 주요 내용 |
|------|------|-----------|
| `/` | 메인 대시보드 | 멤버별 카드: **D-day 배지**, 이번 주 인증 `N/5`, 이번 주/전체 누적 공부시간, **현재 목표 누적 벌금**. 하단 이번 주 요일별 인증 표(✓ 시간 표시). 총 벌금 합계 |
| `/login` | 그룹 비밀번호 입력 | 공용 비밀번호 1개 입력 → 쿠키 발급, 이후 전체 페이지·API 접근 |
| `/upload` | 인증 업로드 | 멤버 선택(마지막 선택 기억) → 사진 촬영/선택(미리보기, 자동 압축) → 날짜(기본 오늘, 09-21~오늘) → 시/분/초 입력 → 메모(선택) → 업로드 |
| `/records` | 인증 기록 | 달력/갤러리 뷰, 날짜 클릭 시 그날 인증샷·시간 목록, 기록 수정/삭제 |
| `/stats` | 공부시간 통계 | 멤버별 **일별/주별** 공부시간 막대 차트, 주차별 인증일수·벌금 내역 |
| `/users` | 멤버 관리 | 추가 / (소프트)삭제 |
| `/users/[id]` | 멤버 상세 & 목표 | 현재 목표(시험명·목표·시작일(평일만)·D-day) 설정/수정, **결과 체크(달성/미달성)**, 미달성 목표 **정산 완료 체크**, 과거 목표 이력과 벌금 스냅샷 |
| `/rules` | 규칙 | 인증 규칙·벌금 규칙 안내 |

공통: 모바일 하단 탭 또는 레퍼런스의 `NavMenu` 드롭다운.

---

## 7. API 초안

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET/POST | `/api/users` | 멤버 조회/추가 |
| DELETE | `/api/users/[id]` | 멤버 소프트 삭제 |
| GET/POST | `/api/users/[id]/goals` | 목표 이력 조회 / 새 목표 생성 (ACTIVE 중복 방지) |
| PATCH | `/api/goals/[id]` | 목표 수정, 결과 체크(`status`) → `finalPenalty` 스냅샷 (달성 시 자동 정산) |
| POST | `/api/goals/[id]/settle` | 미달성 목표 정산 완료 체크 (`settledAt` 기록) |
| POST | `/api/auth` | 그룹 비밀번호 확인 → httpOnly 쿠키 발급 |
| POST | `/api/upload` | Vercel Blob client upload 토큰 발급 |
| GET/POST | `/api/logs` | 기록 조회(userId, from, to) / 기록 생성 |
| PATCH/DELETE | `/api/logs/[id]` | 기록 수정 / 삭제(Blob 동시 삭제) |
| GET | `/api/dashboard` | 대시보드 집계 (멤버별 주간 현황·누적시간·벌금·D-day) |
| GET | `/api/stats?userId=&unit=day\|week` | 일/주별 공부시간 집계 |

---

## 8. 개발 단계

| 단계 | 범위 | 완료 기준 |
|------|------|-----------|
| **P0 세팅** | Next.js + Tailwind + Prisma(adapter-pg) + Neon 연결, Vercel 배포 파이프라인, Blob 스토어 생성, `PROJECT.md`/`CLAUDE.md` | 빈 페이지가 Vercel에서 DB 조회 성공 |
| **P1 MVP** | 그룹 비밀번호 보호, 멤버 CRUD, 목표 설정(시작일 평일 제한), 인증 업로드(압축+Blob), `lib/period.ts`·`lib/penalty.ts`, 메인 대시보드 | 폰에서 업로드 → 대시보드에 시간·인증일·벌금 반영 |
| **P2 조회·정산** | 기록 달력/갤러리, 기록 수정·삭제, 일/주별 통계 차트, 목표 결과 체크(달성 자동 정산 / 미달성 정산 체크) | 목표 종료·정산 흐름 end-to-end |
| **P3 선택** | 오래된 사진 정리, 이번 주 예상 벌금 표시 등 | 필요 시 |

`lib/penalty.ts`는 경계 케이스(첫 주 화~금 시작, D-day 주, 하루 여러 업로드, 자정 근처 KST, 과거 날짜 소급 업로드)를 단위 테스트로 검증.

### 접근 보호 방식
- 환경변수 `GROUP_PASSWORD` 하나 (Vercel 환경변수에 설정)
- `/login`에서 일치하면 서명된 httpOnly 쿠키 발급 (유효기간 예: 90일)
- Next.js 16 `proxy.ts`(구 middleware)에서 쿠키 없는 요청은 `/login`으로 리다이렉트, API는 401. Blob 업로드 토큰 발급 라우트도 동일하게 보호

---

## 9. 확정된 결정사항 (2026-09-23)

| 항목 | 결정 |
|------|------|
| 목표 달성 시 벌금 | **자동 정산** (벌금 면제·초기화) |
| 목표 미달성 시 벌금 | 미정산으로 남음 → **정산 체크**로 정산 완료 처리 |
| D-day ~ 결과 발표 사이 | 벌금 없음, 기록은 계속 가능 |
| 새벽 공부 날짜 | 업로드 시 **날짜 직접 선택** |
| 과거 날짜 업로드 | 제한 없음 (단, 서비스 시작일 2026-09-21 이후, 미래 불가) |
| 접근 보호 | **그룹 공용 비밀번호 1개** |
| 벌금 규칙 변경 | 없음 → 상수로 관리 |
| 서비스 시작 | 2026-09-21(월)부터, 첫 주도 주 5회 |
| 신규 목표 시작일 | 직접 설정, **토/일 선택 불가**. 첫 주만 월 5 / 화 4 / 수 3 / 목 2 / 금 1회 |
| 면제·회비 사용 내역 | **구현 안 함** |
| D-day가 있는 마지막 주 | 목표 = `min(5, 월요일~D-day 일수)` (예: D-day 수요일 → 3회, 토·일 → 5회) |
