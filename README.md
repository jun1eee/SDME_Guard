# 💍 SDM의 문단속

![SDM 타이틀](docs/images/title.png)

> **웨딩플래너 없이, AI로 스드메를 준비하는 직거래 플랫폼**

---

## 📅 프로젝트 기간

- **개발 기간** : 2026.02.19 ~ 2026.03.29 **(7주)**
- **개발 인원** : 5명

---

## 💡 기획 의도: 결혼 준비, 왜 이렇게 복잡하고 비쌀까?

> **"스드메 견적 받으러 갔다가, 웨딩플래너가 왜 필요한지도 모르고 계약서에 도장 찍었습니다."**

결혼을 앞둔 예비부부들이 가장 많이 지출하는 항목인 **스드메(스튜디오·드레스·메이크업)** 는 평균 **520만 원**에 달합니다. 그러나 실제로는 웨딩플래너의 중간 수수료(30~40%)와 불투명한 추가금 구조로 인해 최종 비용은 훨씬 높아집니다.

### Pain Point

| 문제 | 현황 |
|------|------|
| 🔒 불투명한 가격 | 기본 패키지 외 추가금이 계약 후 발생, 최종 금액 예측 불가 |
| 💸 높은 중간 수수료 | 웨딩플래너가 업체 비용의 30~40%를 수수료로 수취 |
| 📊 정보 비대칭 | 예비부부에게 가격 비교 수단이 없고 업체 정보에 종속 |
| 📈 소비자 피해 급증 | 관련 피해 상담 건수 2021년 790건 → 2023년 1,293건 |

### Solution

**웨딩플래너를 AI로 대체**하고, 예비부부와 업체가 **직접 거래**할 수 있는 플랫폼을 만듭니다.
- AI가 예산·지역·취향 기반으로 업체를 추천하고
- 커플이 함께 채팅·투표로 의사결정하며
- 예약·결제·예산·일정을 한 곳에서 관리합니다

---

## ✨ 주요 기능

### 🤖 AI 웨딩 어시스턴트

업체 데이터를 **Neo4j GraphRAG**로 구축하여, 자연어로 묻기만 하면 조건에 맞는 업체를 추천합니다.

- 예산·지역·카테고리 기반 맞춤 업체 추천
- 업체 패키지·추가금 사전 안내
- 채팅 기록 저장 및 세션 관리

---

### 🔗 커플 매칭

초대 코드 한 장으로 파트너와 연결합니다. 연결 즉시 **WebSocket 실시간 Push**로 양쪽 화면이 동기화됩니다.

| 초대 코드 발급 | 매칭 후 실시간 프로필 표시 |
|:-:|:-:|
| ![초대코드](docs/images/invite_code.png) | ![커플매칭](docs/images/couple_matched.png) |

---

### 🏢 업체 탐색

스튜디오·드레스·메이크업·웨딩홀 업체를 카테고리·지역별로 검색하고, 패키지 가격과 포트폴리오를 투명하게 비교합니다.

- 카테고리 / 지역 필터 검색
- 패키지·옵션 상세 정보 제공
- 예약 가능 날짜·시간 실시간 조회
- 인증 리뷰 (결제 기반 검증)

---

### 💬 커플 채팅 & 업체 공유

관심 업체를 커플 채팅방으로 바로 공유하고, 함께 이야기하며 결정할 수 있습니다.

- **STOMP WebSocket** 기반 실시간 채팅
- 업체 카드를 채팅으로 공유 (사진·가격·링크 포함)
- AI 커플 채팅 (공동 AI 어시스턴트)

---

### 🗳️ 비밀 투표

마음에 드는 업체를 투표함에 올리고, 파트너와 **독립적으로 점수**를 매깁니다. 둘 다 투표하기 전까지 상대 점수는 보이지 않습니다.

---

### 📅 일정 관리

드레스 피팅, 스튜디오 촬영 등 결혼 준비 일정을 카테고리별로 등록·관리합니다.

- D-day 카운트다운
- 카테고리별 일정 분류 (스튜디오 / 드레스 / 메이크업 / 웨딩홀 / 기타)
- 날짜·시간·장소·메모 관리

---

### 💰 예산 관리

총 예산을 설정하고, 카테고리별 배정 금액을 관리합니다. 결제 연동으로 **확정/미확정 지출이 자동 반영**됩니다.

- 계약금 결제 시 → 미확정 항목으로 자동 추가
- 잔금 결제 시 → 확정 항목으로 자동 전환
- 카테고리별 남은 예산 실시간 확인

---

### 🗓️ 예약

업체 상세 페이지에서 날짜·시간을 선택해 바로 예약합니다.

- 예약된 시간은 자동 비활성화 (중복 방지)
- 예약 목록 조회 / 수정 / 취소

---

### 💳 결제 (TossPayments)

TossPayments 자동결제(빌링키)를 사용해 카드를 한 번 등록하면 이후 계약금·잔금을 앱 내에서 간편 결제합니다.

- 카드 등록 (빌링키 발급)
- 계약금 / 잔금 분리 결제
- 결제 내역 조회

---

### 🔌 MCP (Model Context Protocol)

Claude AI에 **SDM MCP 서버**를 연결하면, 말 한 마디로 앱의 모든 기능을 제어할 수 있습니다.

```
"드레스 피팅 일정 4월 5일 오후 2시 청담동으로 추가해줘"
→ ✅ SDM 앱 일정에 즉시 반영

"지금 예산 현황 보여줘"
→ 카테고리별 배정액 / 확정 지출 / 잔여 예산 표시

"메이크업 업체 강남 예산 100만원 이하로 추천해줘"
→ 업체 카드 목록 반환
```

**지원 도구 목록**

| 도구 | 설명 |
|------|------|
| `get_wedding_date` | 결혼 날짜 · D-day 조회 |
| `get_my_info` | 내 이름 · 역할 · 커플 상태 조회 |
| `get_schedules` | 전체 일정 + 결혼식 날짜 조회 |
| `create_schedule` | 일정 등록 |
| `update_schedule` | 일정 수정 |
| `delete_schedule` | 일정 삭제 |
| `get_budget` | 예산 현황 (카테고리별 확정/미확정) |
| `update_total_budget` | 총 예산 수정 |
| `add_budget_item` | 예산 항목 추가 |
| `search_vendors` | 업체 검색 |
| `get_vendor_detail` | 업체 상세 조회 |
| `get_reservations` | 예약 목록 조회 |
| `get_payments` | 결제 내역 조회 |
| `add_favorite` | 찜 추가 |
| `get_vote_items` | 투표 목록 조회 |

---

## 🛠️ 기술 스택

### Back-end

<img src="https://img.shields.io/badge/Java%2021-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white">
<img src="https://img.shields.io/badge/Spring%20Boot%204.0-6DB33F?style=for-the-badge&logo=springboot&logoColor=white">
<img src="https://img.shields.io/badge/Spring%20JPA-6DB33F?style=for-the-badge&logo=spring&logoColor=white">
<img src="https://img.shields.io/badge/Gradle-02303A?style=for-the-badge&logo=gradle&logoColor=white">

<img src="https://img.shields.io/badge/Spring%20Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white">
<img src="https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens">
<img src="https://img.shields.io/badge/WebSocket%20STOMP-010101?style=for-the-badge&logo=socket.io&logoColor=white">

<img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white">
<img src="https://img.shields.io/badge/Flyway-CC0200?style=for-the-badge&logo=flyway&logoColor=white">
<img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black">

### Front-end

<img src="https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white">
<img src="https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black">
<img src="https://img.shields.io/badge/TypeScript%205.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white">

<img src="https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white">
<img src="https://img.shields.io/badge/Radix%20UI-161618?style=for-the-badge&logo=radix-ui&logoColor=white">
<img src="https://img.shields.io/badge/SockJS-010101?style=for-the-badge&logo=socket.io&logoColor=white">
<img src="https://img.shields.io/badge/TossPayments-0064FF?style=for-the-badge&logo=tosspayments&logoColor=white">

### AI

<img src="https://img.shields.io/badge/Python%203.12-3776AB?style=for-the-badge&logo=python&logoColor=white">
<img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white">
<img src="https://img.shields.io/badge/Neo4j%20GraphRAG-008CC1?style=for-the-badge&logo=neo4j&logoColor=white">
<img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white">

### MCP

<img src="https://img.shields.io/badge/MCP%20Server-CC785C?style=for-the-badge&logo=anthropic&logoColor=white">
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white">

### Infra

<img src="https://img.shields.io/badge/Amazon%20EC2-FF9900?style=for-the-badge&logo=amazonec2&logoColor=white">
<img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white">
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white">
<img src="https://img.shields.io/badge/Jenkins-D24939?style=for-the-badge&logo=jenkins&logoColor=white">

### Tools

<img src="https://img.shields.io/badge/GitLab-FC6D26?style=for-the-badge&logo=gitlab&logoColor=white">
<img src="https://img.shields.io/badge/Jira-0052CC?style=for-the-badge&logo=jira&logoColor=white">
<img src="https://img.shields.io/badge/Notion-000000?style=for-the-badge&logo=notion&logoColor=white">
<img src="https://img.shields.io/badge/Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white">

---

## 🌐 시스템 아키텍처

![시스템 아키텍처](docs/images/architecture.png)

---

## 💾 ERD

![ERD](docs/images/erd.png)

---

## 📂 프로젝트 폴더 구조

<details>
<summary>Back-end</summary>

```
📦be/src/main/java/com/ssafy/sdme
├── 📂_global
│   ├── 📂common
│   │   ├── 📂constant
│   │   ├── 📂entity          # BaseTimeEntity
│   │   └── 📂util
│   ├── 📂config              # SecurityConfig, WebSocketConfig, CorsConfig 등
│   └── 📂exception           # GlobalExceptionHandler, NotFoundException 등
├── 📂auth                    # 카카오 소셜 로그인, JWT, 토큰 재발급, MCP 토큰
├── 📂budget                  # 예산 / 카테고리 / 항목 관리
├── 📂chat
│   ├── AiChatController      # GraphRAG AI 채팅
│   └── CoupleChatController  # 커플 채팅 (WebSocket)
├── 📂couple                  # 커플 매칭 / 초대코드 / 해제
├── 📂favorite                # 개인 찜 / 커플 찜
├── 📂payment                 # TossPayments 자동결제 (계약금/잔금)
├── 📂reservation             # 예약 생성 / 수정 / 취소
├── 📂schedule                # 일정 CRUD
├── 📂user                    # 회원 정보 / 취향 선호도
├── 📂vendor                  # 업체 검색 / 상세 / 패키지 / 리뷰 / 신고
└── 📂vote                    # 비밀 투표
```

</details>

<details>
<summary>Front-end</summary>

```
📦fe
├── 📂app
│   ├── 📂main                # 메인 페이지 (AI 채팅 + 패널 레이아웃)
│   ├── 📂login               # 카카오 로그인
│   ├── 📂signup              # 회원가입
│   ├── 📂cards               # 카드 등록 (TossPayments)
│   ├── 📂budget              # 예산 관리
│   ├── 📂reservation         # 예약 목록
│   ├── 📂payment             # 결제 내역
│   ├── 📂wishlist            # 찜 목록
│   ├── 📂vote                # 비밀 투표
│   ├── 📂reviews             # 내 리뷰
│   ├── 📂couple-chat         # 커플 채팅
│   └── 📂vendor              # 업체 상세
├── 📂components
│   ├── 📂views               # 각 기능별 뷰 컴포넌트
│   └── 📂ui                  # shadcn/ui 기반 공통 컴포넌트
├── 📂lib
│   └── api.ts                # REST API 호출 함수 모음
└── 📂hooks                   # 커스텀 훅
```

</details>

<details>
<summary>AI</summary>

```
📦ai
├── 📂sdm
│   ├── graphrag.py           # Neo4j GraphRAG 기반 업체 추천
│   ├── service.py            # AI 채팅 서비스 로직
│   ├── router.py             # FastAPI 라우터
│   ├── tools.py              # AI 도구 정의
│   ├── knowledge.py          # 지식 그래프 구축
│   ├── prompts.py            # 프롬프트 템플릿
│   └── budget.py             # 예산 관련 AI 로직
├── 📂data                    # 업체 데이터 (JSON)
├── 📂scripts                 # 데이터 크롤링 / 전처리 스크립트
└── main.py                   # FastAPI 앱 엔트리포인트
```

</details>

<details>
<summary>MCP</summary>

```
📦mcp/src
├── 📂tools
│   ├── schedule-tools.ts     # 일정 CRUD, D-day, 내 정보 조회
│   ├── budget-tools.ts       # 예산 현황 / 항목 관리
│   ├── vendor-tools.ts       # 업체 검색 / 상세
│   ├── reservation-tools.ts  # 예약 조회
│   ├── payment-tools.ts      # 결제 내역
│   ├── favorite-tools.ts     # 찜 관리
│   ├── vote-tools.ts         # 투표
│   └── review-tools.ts       # 리뷰
├── api-client.ts             # Backend REST 호출 클라이언트
├── http-server.ts            # HTTP 모드 MCP 서버
└── index.ts                  # STDIO 모드 MCP 서버 엔트리포인트
```

</details>

---

## 🚀 로컬 실행 가이드

### 사전 준비

- Node.js 20+
- Java 21
- Docker & Docker Compose

### 환경 변수 설정

**`be/.env`**
```env
DB_URL=jdbc:mysql://localhost:3306/sdme
DB_USERNAME=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
KAKAO_CLIENT_ID=your_kakao_client_id
TOSS_SECRET_KEY=your_toss_secret_key
```

**`ai/.env`**
```env
OPENAI_API_KEY=your_openai_api_key
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PW=password123
```

**`fe/.env`**
```env
NEXT_PUBLIC_API_URL=
BACKEND_URL=http://localhost:8080
```

### 빌드 & 실행

```bash
# 1. 백엔드 빌드
cd be
./gradlew clean build -x test
cd ..

# 2. 전체 실행 (Docker Compose)
docker compose up -d

# 3. 종료
docker compose down
```

### 접속 정보

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3000 |
| 백엔드 API | http://localhost:8080 |
| AI 서버 | http://localhost:8000 |
| MCP 서버 | http://localhost:3100 |
| 전체 (Nginx) | http://localhost |
| Swagger UI | http://localhost:8080/swagger-ui/index.html |

---

## 🔌 MCP 연결 방법 (Claude Desktop)

`claude_desktop_config.json`에 아래 내용 추가:

```json
{
  "mcpServers": {
    "wedding-planner": {
      "command": "node",
      "args": ["/path/to/mcp/dist/index.js"],
      "env": {
        "API_URL": "http://localhost:8080",
        "MCP_TOKEN": "발급받은_토큰"
      }
    }
  }
}
```

> MCP 토큰은 앱 로그인 후 마이페이지 → MCP 토큰 발급에서 확인할 수 있습니다.

---

## 👥 팀원 소개

| 이름  | 역할           |
|-----|--------------|
| 정대철 | AI           |
| 김건희 | AI           |
| 신현성 | Backend      |
| 이준원 | Frontend, AI |
| 최민경 | Backend      |

---

## ⚠️ 주의사항

- `.env` 파일은 절대 GitLab에 올리지 마세요
- **8080, 3000, 8000, 3100, 80 포트**가 다른 프로그램과 충돌하지 않아야 합니다
- TossPayments 테스트 키는 실제 결제가 발생하지 않습니다
