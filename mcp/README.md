# SDM Guard - MCP Server

웨딩 플래닝 서비스 **SDM Guard**의 MCP(Model Context Protocol) 서버입니다.
Claude Desktop, Claude Code 등 AI 클라이언트에서 웨딩 관련 기능을 자연어로 사용할 수 있게 해줍니다.

---

## 사용자 연동 가이드

### 1단계: Claude Desktop 설치

[Claude Desktop 다운로드](https://claude.ai/download)에서 설치하세요.

### 2단계: MCP 토큰 발급

SDM Guard 앱의 **마이페이지 > AI 어시스턴트 연동**에서 [토큰 발급] 버튼을 누르세요.

```
내 MCP 연동 URL:
https://j14a105.p.ssafy.io/mcp/?token=sdm_mcp_xxxx...
                                              [📋 복사]
```

> 토큰은 본인만 사용할 수 있는 고유 키입니다. 다른 사람에게 공유하지 마세요!
> 토큰이 유출된 경우 [재발급] 버튼으로 새 토큰을 발급받을 수 있습니다.

### 3단계: Claude Desktop에 연결

1. Claude Desktop 실행
2. **설정** > **커넥터** > **커스텀 커넥터 추가** 클릭
3. 아래 정보 입력:
   - **이름**: `SDM Guard`
   - **원격 MCP 서버 URL**: 2단계에서 복사한 URL 붙여넣기
4. **추가** 클릭

### 4단계: 사용 시작!

Claude Desktop 채팅에서 바로 사용하세요:

```
"내 예약 보여줘"
"메이크업 업체 검색해줘"
"제니하우스 청담힐 3월 28일 12시에 예약해줘"
"이 업체 커플에게 공유해줘"
"총 예산 5000만원으로 설정해줘"
```

### 사용 가능한 기능

| 기능 | 예시 |
|------|------|
| 업체 검색 | "강남 스튜디오 검색해줘" |
| 업체 상세 조회 | "제니하우스 청담힐 정보 알려줘" |
| 예약 가능 시간 확인 | "3월 28일 예약 가능한 시간 알려줘" |
| 예약 생성 | "3월 28일 12시로 예약해줘" |
| 예약 수정/취소 | "예약 날짜를 29일로 변경해줘" |
| 예약 조회 | "내 예약 보여줘" |
| 결제 안내 | "계약금 얼마야?" |
| 업체 공유 | "이 업체 커플에게 공유해줘" |
| 찜 추가/삭제 | "이 업체 찜해줘" |
| 일정 관리 | "3월 26일에 드레스 피팅 일정 추가해줘" |
| 예산 관리 | "총 예산 5000만원으로 설정해줘" |
| 결제 내역 조회 | "결제 내역 보여줘" |

### 주의사항

- **결제**는 앱에서 직접 진행해주세요 (Claude에서 결제 정보 안내만 제공)
- 예약 시 **패키지를 선택**해야 합니다 (Claude가 패키지 목록을 보여주고 물어봅니다)
- 토큰은 **본인만 사용** 가능합니다. 유출 시 마이페이지에서 재발급하세요.

### 문제 해결

| 문제 | 해결 방법 |
|------|----------|
| "서버에 연결할 수 없습니다" | URL이 정확한지 확인. 토큰이 만료됐으면 재발급 |
| "Server disconnected" | Claude Desktop 재시작 |
| 검색 결과가 안 나옴 | 업체명을 정확히 입력해보세요 |
| 예약이 안 됨 | 예약 가능 시간인지 확인 ("예약 가능 시간 알려줘") |

---

## 아키텍처

```
┌─────────────────┐    Streamable HTTP    ┌─────────────────┐      REST API      ┌─────────────────┐
│  Claude Desktop │ ◄──────────────────► │   MCP Server    │ ◄────────────────► │  Spring Boot    │
│  Claude Code    │                      │  (Node.js/TS)   │                    │  Backend        │
└─────────────────┘                      └─────────────────┘                    └─────────────────┘
                                               │                                       │
                                         tools 등록                              MySQL / 토스페이먼츠
                                         (21개 도구)
```

### 통신 방식

| 방식 | 파일 | 용도 | 포트 |
|------|------|------|------|
| **stdio** | `src/index.ts` | Claude Code 로컬 연동 | - |
| **Streamable HTTP** | `src/http-server.ts` | Claude Desktop 원격 연동 (토큰 인증) | 3100 |

### 인증 흐름

```
1. 사용자가 앱에 카카오 로그인
2. 마이페이지 > AI 어시스턴트 연동 > [토큰 발급]
   → POST /api/mcp/token → "sdm_mcp_xxxx..." 발급
3. Claude Desktop > 커스텀 커넥터 > URL 붙여넣기
4. MCP 서버가 토큰으로 유저 인증
   → POST /api/mcp/auth → JWT 발급 → 해당 유저로 모든 기능 사용
```

---

## 기술 스택

- **Runtime**: Node.js (ES Module)
- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` v1.17.0
- **Transport**: Streamable HTTP (원격) / stdio (로컬)
- **Validation**: `zod` v3.24.2
- **Backend API**: Spring Boot (REST)

---

## 프로젝트 구조

```
mcp/
├── package.json
├── tsconfig.json
├── Dockerfile
├── README.md
└── src/
    ├── index.ts              # stdio 서버 (Claude Code용)
    ├── http-server.ts        # Streamable HTTP 서버 (Claude Desktop 원격 연동)
    ├── api-client.ts         # 백엔드 REST API 클라이언트
    └── tools/
        ├── schedule-tools.ts     # 일정 관리 (2개)
        ├── reservation-tools.ts  # 예약 관리 (4개)
        ├── vendor-tools.ts       # 업체 검색/공유 (5개)
        ├── payment-tools.ts      # 결제 관리 (3개)
        ├── budget-tools.ts       # 예산 관리 (5개)
        └── favorite-tools.ts     # 찜 관리 (3개)
```

---

## 구현된 도구 목록 (21개)

### 일정 관리 (`schedule-tools.ts`)

| 도구명 | 설명 | API |
|--------|------|-----|
| `get_schedules` | 일정 목록 조회 | `GET /api/schedules` |
| `create_schedule` | 일정 등록 (카테고리: STUDIO/DRESS/MAKEUP/HALL) | `POST /api/schedules` |

### 예약 관리 (`reservation-tools.ts`)

| 도구명 | 설명 | API |
|--------|------|-----|
| `create_reservation` | 업체 예약 생성 (시간 검증 + 패키지 확인 + 일정 자동 추가) | `POST /api/reservations` |
| `update_reservation` | 예약 수정 (날짜/시간/메모) | `PUT /api/reservations/{id}` |
| `cancel_reservation` | 예약 취소 (결제/일정 함께 취소) | `DELETE /api/reservations/{id}` |
| `get_reservations` | 예약 목록 조회 | `GET /api/reservations` |

### 업체 관리 (`vendor-tools.ts`)

| 도구명 | 설명 | API |
|--------|------|-----|
| `search_vendors` | 업체 검색 (카테고리/키워드) | `GET /api/vendors?category=&keyword=` |
| `get_vendor_detail` | 업체 상세 정보 (패키지/가격/리뷰) | `GET /api/vendors/{id}` |
| `get_vendor_booked_times` | 업체별 예약 가능 시간 조회 (크롤링 데이터 기반) | `GET /api/vendors/{id}` + `GET /api/vendors/{id}/reservations?date=` |
| `share_vendor` | 업체를 커플에게 공유 + 채팅 메시지 전송 | `POST /api/vendors/{id}/share` + `POST /api/chat/couple/messages` |
| `get_shared_vendors` | 공유된 업체 목록 조회 | `GET /api/vendors/shared` |

### 결제 관리 (`payment-tools.ts`)

| 도구명 | 설명 | API |
|--------|------|-----|
| `get_payment_info` | 결제 정보 안내 (금액/카드 확인, 실제 결제는 앱에서) | `GET /api/cards` |
| `get_cards` | 등록된 카드 목록 조회 | `GET /api/cards` |
| `get_payments` | 결제 내역 조회 | `GET /api/payments` |

### 예산 관리 (`budget-tools.ts`)

| 도구명 | 설명 | API |
|--------|------|-----|
| `get_budget` | 예산 현황 조회 (총예산/지출/잔액) | `GET /api/budgets` |
| `update_total_budget` | 총 예산 수정 | `PUT /api/budgets/total` |
| `add_budget_item` | 예산 항목 추가 | `POST /api/budgets/category/items` |
| `update_budget_item` | 예산 항목 수정 | `PUT /api/budgets/category/{id}` |
| `delete_budget_item` | 예산 항목 삭제 | `DELETE /api/budgets/category/{id}` |

### 찜 관리 (`favorite-tools.ts`)

| 도구명 | 설명 | API |
|--------|------|-----|
| `get_favorites` | 커플 찜 목록 조회 | `GET /api/couple/favorites/all` |
| `add_favorite` | 업체 찜 추가 | `POST /api/personal/favorites/{id}` |
| `remove_favorite` | 업체 찜 삭제 | `DELETE /api/personal/favorites/{id}` |

---

## 핵심 구현 상세

### 1. API Client (`api-client.ts`)

백엔드와 통신하는 HTTP 클라이언트입니다.

```typescript
export class ApiClient {
  private baseUrl: string
  private token: string

  async get<T>(path: string): Promise<T>     // GET 요청
  async post<T>(path: string, body?): Promise<T>  // POST 요청
  async put<T>(path: string, body?): Promise<T>   // PUT 요청
  async delete<T>(path: string): Promise<T>  // DELETE 요청
  async refreshToken(userId: number): Promise<string>  // 토큰 발급
}
```

**인증 방식 (로컬 stdio)**: 서버 시작 시 `POST /api/auth/test-login/{userId}`로 JWT 토큰을 발급받습니다.

**인증 방식 (원격 Streamable HTTP)**: 사용자의 MCP 토큰으로 `POST /api/mcp/auth`를 호출해 JWT를 발급받습니다. 사용자별로 독립된 인증이 이루어집니다.

**응답 처리**: 백엔드 응답은 `{ status, message, data }` 형태이며, `json.data ?? json`으로 data 필드를 자동 추출합니다.

### 2. 업체 검색 (`vendor-tools.ts`)

```typescript
// 카테고리는 대문자로 변환 (DB에 HALL, STUDIO 등으로 저장)
if (params.category) queryParts.push(`category=${params.category.toUpperCase()}`)

// 한글 키워드는 URL 인코딩
if (params.keyword) queryParts.push(`keyword=${encodeURIComponent(params.keyword)}`)

// 응답에서 items 필드 파싱 (API 응답: { data: { items: [...] } })
const vendors = data.items ?? data.vendors ?? data.content ?? data
```

### 3. 업체 공유 + 채팅 연동 (`vendor-tools.ts`)

업체 공유 시 `vendor_share` 테이블 저장 + 커플 채팅방에 메시지를 동시에 전송합니다.

```typescript
// 1. 업체 공유 저장
const data = await api.post(`/vendors/${vendorId}/share`, { message })

// 2. 채팅방에 공유 메시지 전송 (REST API)
await api.post("/chat/couple/messages", {
  senderId: userId,
  coupleId: data.coupleId,
  content: message,
  messageType: "vendor_share",  // 프론트엔드에서 업체 카드로 렌더링
  vendorId,
})
```

### 4. 예약 생성 시 3단계 검증 (`reservation-tools.ts`)

예약 생성 전 안전 검증을 수행합니다:

```typescript
// 1단계: 업체 상세에서 예약 가능 시간 추출
//   - 크롤링 데이터(studioExtra/dressExtra/makeupExtra)에서 "스케줄"/"촬영시간" 라벨 파싱
//   - 예: "10시, 12시, 15시" → ["10:00", "12:00", "15:00"]
//   - 크롤링 데이터가 없으면 카테고리별 기본값 사용

// 2단계: 요청한 시간이 예약 가능 시간인지 검증
if (!allTimes.includes(reservationTime)) {
  return "❌ 해당 시간은 예약 불가. 가능 시간: ..."
}

// 3단계: 이미 예약된 시간인지 확인
if (bookedTimes.includes(reservationTime)) {
  return "❌ 이미 예약된 시간. 가능 시간: ..."
}

// 통과 시 예약 생성
```

**카테고리별 기본 예약 시간:**

| 카테고리 | 기본 시간 |
|---------|----------|
| 웨딩홀 (HALL) | 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00 |
| 스튜디오 (STUDIO) | 09:00, 12:00, 15:00 (크롤링 데이터 우선) |
| 드레스 (DRESS) | 10:00, 12:00, 14:00, 16:00, 18:00 |
| 메이크업 (MAKEUP) | 10:00, 12:00, 14:00, 16:00, 18:00 |

> 스튜디오/드레스/메이크업은 크롤링한 상세 데이터에 예약 시간이 있으면 그것을 우선 사용합니다.

### 5. 예약 생성 시 패키지 확인

예약 전 반드시 `get_vendor_detail`로 패키지 목록을 확인하고 사용자에게 선택을 요청합니다. 선택한 패키지명은 memo에 기록됩니다.

### 6. 결제는 안내만, 실행은 앱에서

`get_payment_info`는 결제 금액과 카드 정보를 안내만 하고, **실제 결제는 앱에서 직접 진행**하도록 합니다. 실제 돈이 나가는 작업이므로 MCP에서 자동 실행하지 않습니다.

### 7. 예약 생성 → 일정 자동 추가

`create_reservation` 호출 시 백엔드에서 자동으로:
1. `reservation` 테이블에 예약 생성
2. `schedule` 테이블에 일정 자동 추가 (reservationId 연결)

### 8. 예약 취소 → 결제/일정 연쇄 취소

`cancel_reservation` 호출 시 백엔드에서 자동으로:
1. 예약 상태를 `CANCELLED`로 변경
2. 연결된 결제를 모두 취소
3. 연결된 일정을 모두 삭제

---

## 안전 설계

### 결제 보호
- MCP에서 직접 결제를 실행하지 않음
- 결제 정보(금액, 카드)만 안내하고 앱에서 직접 결제 유도

### 예약 시간 검증
- 크롤링 데이터 기반 실제 예약 가능 시간만 허용
- 이미 예약된 시간 중복 방지
- 불가능 시 예약 가능 시간 목록 안내

### 패키지 확인
- 예약 전 업체 패키지 목록을 사용자에게 먼저 보여주고 선택 요청
- 사용자가 패키지를 명시하지 않으면 목록을 보여주고 확인

### 토큰 인증
- 사용자별 고유 MCP 토큰 발급 (추측 불가한 UUID 기반)
- 토큰 유출 시 마이페이지에서 재발급으로 무효화 가능
- 각 요청마다 토큰 → JWT 변환으로 사용자 식별

---

## 설치 및 실행

### 의존성 설치

```bash
cd mcp
npm install
```

### 실행 방법

```bash
# stdio 모드 (Claude Code용)
npm start

# HTTP 모드 (Claude Desktop 원격 연동용)
npm run serve

# 개발 모드 (watch)
npm run dev
```

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `API_URL` | `http://localhost:8080` | 백엔드 API 서버 주소 |
| `USER_ID` | `9` | 로그인 유저 ID (stdio 모드) |
| `MCP_PORT` | `3100` | HTTP 서버 포트 |

### Docker 배포

```bash
docker compose build mcp
docker compose up -d mcp
```

nginx에서 `/mcp/` 경로로 프록시됩니다.

---

## 개발자용: Claude Code 로컬 연동

### 설정 파일 위치

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

### 설정 예시

```json
{
  "mcpServers": {
    "sdm-guard-local": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["-y", "tsx", "C:/Users/SSAFY/S14P21A105/mcp/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:8080",
        "USER_ID": "9"
      }
    }
  }
}
```

> **다른 유저로 사용하려면** `USER_ID`를 자기 유저 ID로 변경하면 됩니다.

---

## 백엔드에 추가한 API

MCP 연동을 위해 백엔드에 추가/수정한 엔드포인트:

| 엔드포인트 | 설명 | 파일 |
|-----------|------|------|
| `POST /api/reservations` | 예약 생성 | `ReservationController.java` |
| `POST /api/chat/couple/messages` | REST로 채팅 메시지 전송 | `CoupleChatController.java` |
| `POST /api/mcp/token` | MCP 토큰 발급/조회 | `McpTokenController.java` |
| `POST /api/mcp/token/refresh` | MCP 토큰 재발급 | `McpTokenController.java` |
| `POST /api/mcp/auth` | MCP 토큰으로 JWT 인증 | `McpTokenController.java` |

`VendorShareResponse.java`에 `coupleId` 필드를 추가하여 공유 시 채팅 연동이 가능하도록 했습니다.

---

## 사용 예시 (Claude Desktop)

```
사용자: 메이크업 업체 검색해줘
Claude: search_vendors(category: "makeup") → 검색 결과 표시

사용자: 제니하우스 청담힐 3월 28일 12시로 예약해줘
Claude: 1. search_vendors(keyword: "제니하우스") → ID 확인
        2. get_vendor_detail(vendorId: 2288) → 패키지 목록 확인
        3. "어떤 패키지로 예약하시겠어요?" → 사용자에게 선택 요청
        4. get_vendor_booked_times(vendorId: 2288, date: "2026-03-28") → 12시 가능 확인
        5. create_reservation(vendorId: 2288, date: "2026-03-28", time: "12:00",
           memo: "[촬영] 신부신랑 헤어메이크업(실장)") → 예약 생성

사용자: 계약금 결제해줘
Claude: get_payment_info(reservationId: X, vendorPrice: 535000)
        → "계약금 53,500원, 앱에서 직접 결제해주세요!"

사용자: 이 업체 커플에게 공유해줘
Claude: share_vendor(vendorId: 2288, message: "여기 괜찮아 보여!") → 공유 + 채팅 전송

사용자: 총 예산 5000만원으로 설정해줘
Claude: update_total_budget(totalBudget: 50000000) → 예산 수정
```
