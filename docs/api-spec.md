# SDME API Specification Draft

`console.sql` 기준 초안이다. 구현 전 확정이 필요한 항목은 `TODO` 또는 `추가 정의 필요`로 표시했다.

## Common

- Base URL: `/api`
- Response wrapper

```json
{
  "status": 200,
  "message": "success",
  "data": {}
}
```

- Auth: `Authorization: Bearer {accessToken}`
- Pagination query convention: `page`, `size`, `sort`
- Soft delete 대상: `USER`, `REVIEW`, `SCHEDULE`, `CARD_INFORMATION`, `COUPLE_WISHLIST`, `COUPLE_WISHLIST_ITEM`, `VENDOR_SHARE`

## Domain Summary

- 회원/인증: `USER`, `COUPLE`, `COUPLE_INVITE`
- 커플: `COUPLE_PREFERENCES`
- 업체: `VENDOR`, `VENDOR_IMAGE`, `VENDOR_PACKAGE`, `VENDOR_PACKAGE_ITEM`, `VENDOR_HALL_DETAIL`, `VENDOR_CODE_GROUP`, `VENDOR_CODE`, `VENDOR_CODE_VALUE`
- 예약/결제: `RESERVATION`, `PAYMENT`, `CARD_INFORMATION`
- 리뷰/찜/신고: `REVIEW`, `FAVORITE`, `VENDOR_REPORT`, `AI_REVIEW_SUMMARY`
- 예산: `BUDGET`, `BUDGET_CATEGORY`, `BUDGET_ITEM`
- 일정: `SCHEDULE`
- 채팅/공유: `COUPLE_CHAT_ROOMS`, `COUPLE_CHAT_MESSAGES`, `VENDOR_SHARE`, `PERSONAL_CHAT_SESSIONS`, `PERSONAL_CHAT_MESSAGES`
- 위시/투표: `COUPLE_WISHLIST`, `COUPLE_WISHLIST_ITEM`, `VOTE_ITEMS`, `VOTES`

## API List

### 1. Auth / User

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 카카오 회원가입 | `POST` | `/auth/kakao/signup` | `kakaoAccessToken`, `phone`, `verificationCode`, `name`, `nickname`, `role`, `weddingDate` | `userId`, `coupleId`, `accessToken`, `refreshToken`, `isProfileCompleted` |
| 휴대폰 인증번호 발송 | `POST` | `/auth/phone/send-code` | `phone` | `requestId`, `expiredAt` |
| 휴대폰 인증번호 확인 | `POST` | `/auth/phone/verify-code` | `phone`, `code`, `requestId` | `verified`, `verificationToken` |
| 카카오 로그인 | `POST` | `/auth/kakao/login` | `kakaoAccessToken` | `registered`, `user`, `couple`, `accessToken`, `refreshToken` |
| 닉네임 중복 체크 | `GET` | `/users/check-nickname` | query: `nickname` | `available` |
| 로그아웃 | `POST` | `/auth/logout` | `refreshToken` or current token | `logoutAt` |
| 회원탈퇴 | `DELETE` | `/users/me` | optional `reason` | `deletedAt` |
| 내 정보 조회 | `GET` | `/users/me` | - | `id`, `name`, `nickname`, `profileImage`, `role`, `weddingDate`, `minBudget`, `maxBudget`, `couple` |
| 내 정보 수정 | `PATCH` | `/users/me` | `name`, `nickname`, `profileImage`, `weddingDate`, `minBudget`, `maxBudget` | 수정된 회원 정보 |

### 2. Couple / Matching

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 커플프로필 조회 | `GET` | `/couples/me` | - | `coupleId`, `status`, `weddingDate`, `totalBudget`, `connectedAt`, `groom`, `bride`, `preferences` |
| 커플프로필 수정 | `PATCH` | `/couples/me` | `weddingDate`, `totalBudget` | 수정된 커플 정보 |
| 커플프로필 사진 업로드 | `POST` | `/couples/me/image` | multipart `image` | `imageUrl` |
| 취향&선호도 수정 | `PUT` | `/couples/me/preferences` | `style`, `colors`, `mood`, `food`, `budget`, `guestCount`, `venue` | 수정된 선호도 |
| 상대방 초대 | `POST` | `/couples/invites` | optional `message` | `inviteId`, `inviteCode`, `expiredAt`, `status` |
| 초대 수락(매칭 완료) | `POST` | `/couples/invites/accept` | `inviteCode` | `coupleId`, `status`, `connectedAt` |
| 커플 매칭 해제 | `POST` | `/couples/me/disconnect` | optional `reason` | `coupleId`, `status` |

### 3. Vendor

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 업체 목록 조회 | `GET` | `/vendors` | query: `category`, `keyword`, `minPrice`, `maxPrice`, `rating`, `sort`, `page`, `size` | `items[]`, `pageInfo` |
| 업체 상세 조회 | `GET` | `/vendors/{vendorId}` | - | `vendor`, `images`, `packages`, `additionalProducts`, `hallDetail`, `codes`, `favorite` |
| 업체 예약 | `POST` | `/vendors/{vendorId}/reservations` | `serviceDate`, `reservationDate`, `reservationTime`, `hallDetailId`, `memo` | `reservationId`, `status`, `progress` |
| 업체 진행 상태 업데이트 | `PATCH` | `/reservations/{reservationId}/progress` | `progress`, optional `status` | 수정된 예약 정보 |
| 업체 신고 | `POST` | `/vendors/{vendorId}/reports` | `reason` | `reportId`, `status`, `createdAt` |

### 4. Favorite

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 찜 목록 조회 | `GET` | `/favorites` | query: `category`, `page`, `size` | `items[]`, `pageInfo` |
| 찜 추가 | `POST` | `/vendors/{vendorId}/favorites` | - | `favoriteId`, `createdAt` |
| 찜 해제 | `DELETE` | `/vendors/{vendorId}/favorites` | - | `deleted` |

### 5. Review

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 업체 리뷰 목록 조회 | `GET` | `/vendors/{vendorId}/reviews` | query: `sort`, `page`, `size` | `items[]`, `ratingSummary`, `pageInfo` |
| 업체 AI리뷰 요약 | `GET` | `/vendors/{vendorId}/reviews/ai-summary` | - | `summary`, `positiveKeywords`, `negativeKeywords`, `createdAt` |
| 리뷰 작성 | `POST` | `/reservations/{reservationId}/reviews` | `rating`, `content` | `reviewId`, `createdAt` |
| 내 리뷰 목록 조회 | `GET` | `/reviews/me` | query: `page`, `size` | `items[]`, `pageInfo` |
| 내 리뷰 수정 | `PATCH` | `/reviews/{reviewId}` | `rating`, `content` | 수정된 리뷰 |
| 내 리뷰 삭제 | `DELETE` | `/reviews/{reviewId}` | - | `deletedAt` |

### 6. Payment / Card

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 결제 내역 조회 | `GET` | `/payments` | query: `vendorId`, `status`, `type`, `page`, `size` | `items[]`, `pageInfo` |
| 결제 요청 | `POST` | `/reservations/{reservationId}/payments` | `cardInformationId`, `type`, `amount` | `paymentId`, `paymentKey`, `status`, `requestedAt` |
| 업체별 결제 진행상태 | `GET` | `/vendors/{vendorId}/payments/status` | - | `depositStatus`, `balanceStatus`, `latestPayment`, `reservationId` |
| 카드 추천 요청 | `POST` | `/cards/recommendations` | `vendorId`, `amount`, optional `paymentType` | `recommendedCards[]` |
| 등록된 카드 목록 | `GET` | `/cards` | - | `items[]` |
| 카드 등록 | `POST` | `/cards` | `pgProvider`, `customerKey`, `billingKey`, `methodProvider`, `cardBrand`, `cardLast4`, `ownerName` | `cardInformationId` |
| 등록된 카드 삭제 | `DELETE` | `/cards/{cardId}` | - | `deletedAt` |

### 7. Reservation

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 예약 내역 조회 | `GET` | `/reservations` | query: `status`, `progress`, `vendorId`, `page`, `size` | `items[]`, `pageInfo` |
| 예약 변경 | `PATCH` | `/reservations/{reservationId}` | `serviceDate`, `reservationDate`, `reservationTime`, `memo` | 수정된 예약 |
| 예약 취소 | `POST` | `/reservations/{reservationId}/cancel` | optional `reason` | `reservationId`, `status` |

### 8. Budget

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 예산 전체조회 | `GET` | `/budgets/me` | - | `totalBudget`, `categories`, `items`, `summary` |
| 총 예산 수정 | `PATCH` | `/budgets/me` | `totalBudget` | 수정된 예산 요약 |

### 9. Schedule

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 일정 전체 조회 | `GET` | `/schedules` | query: `from`, `to`, `status`, `category` | `items[]` |
| 일정 추가 | `POST` | `/schedules` | `title`, `date`, `time`, `location`, `memo`, `category`, `source` | `scheduleId` |
| 일정 수정 | `PATCH` | `/schedules/{scheduleId}` | `title`, `date`, `time`, `location`, `memo`, `category` | 수정된 일정 |
| 일정 삭제 | `DELETE` | `/schedules/{scheduleId}` | - | `deletedAt` |
| 일정 상태 변경 | `PATCH` | `/schedules/{scheduleId}/status` | `status` | 수정된 일정 |

### 10. Chat

| 기능 | Method | Path | Request 핵심 필드 | Response 핵심 필드 |
|---|---|---|---|---|
| 채팅 내역 조회(히스토리) | `GET` | `/couple-chat/messages` | query: `cursor`, `size` | `room`, `messages[]`, `nextCursor` |
| 메시지 전송 | `POST` | `/couple-chat/messages` | `content`, `messageType`, optional `vendorId`, `vendorShareId` | `messageId`, `createdAt` |

## 추가하면 좋은 API

현재 테이블까지 감안하면 아래 API도 같이 설계하는 편이 맞다.

- 초대 코드 조회: `GET /couples/invites/latest`
- 초대 만료/취소: `POST /couples/invites/{inviteId}/expire`
- 업체 공유: `POST /vendors/{vendorId}/share`
- 공유 업체 목록 조회: `GET /vendors/shared`
- 공유 업체 투표 항목 생성: `POST /votes/items`
- 공유 업체 투표: `POST /votes/items/{voteItemId}/votes`
- 커플 위시리스트 조회: `GET /wishlists`
- 커플 위시리스트 추가/삭제: `POST /wishlists/{category}/items`, `DELETE /wishlists/items/{itemId}`
- 예산 카테고리 수정: `PUT /budgets/me/categories`
- 예산 항목 CRUD: `POST /budget-categories/{categoryId}/items`, `PATCH /budget-items/{itemId}`, `DELETE /budget-items/{itemId}`
- 개인 AI 채팅 세션 조회/생성: `GET /personal-chat/sessions`, `POST /personal-chat/sessions`
- 개인 AI 채팅 메시지 조회/전송: `GET /personal-chat/sessions/{sessionId}/messages`, `POST /personal-chat/sessions/{sessionId}/messages`
- 업체 필터 코드 조회: `GET /vendor-codes/groups`
- 토큰 재발급: `POST /auth/refresh`

## 추가 정의 필요

### 1. DB 구조상 바로 안 맞는 부분

- `USER.couple_id`가 `NOT NULL`이라 회원가입 직후 미매칭 상태를 저장하기 어렵다.
- `COUPLE.groom_id`, `COUPLE.bride_id` 타입이 `VARCHAR(100)`인데 `USER.id(INT)`를 참조하고 있다.
- `COUPLE`와 `USER`가 서로 FK를 물고 있어 생성 순서가 꼬인다.
- `PERSONAL_CHAT_MESSAGES` FK가 뒤집혀 있다.
  - `user_id -> PERSONAL_CHAT_SESSIONS.id`
  - `personal_chat_sessions_id -> USER.id`
- `RESERVATION.hall_detail_id`가 `NOT NULL`이라 `STUDIO/DRESS/MAKEUP` 예약에 부적합하다.
- 커플 프로필 사진용 컬럼이 없다.
  - `COUPLE.profile_image` 또는 별도 `COUPLE_IMAGE` 필요

### 2. 기능은 있는데 테이블이 없는 부분

- 휴대폰 인증번호 발송/확인
  - `PHONE_VERIFICATION` 테이블 또는 Redis 저장소 필요
- 로그아웃/토큰 재발급
  - `REFRESH_TOKEN` 또는 Redis blacklist 정책 필요
- 회원탈퇴 사유
  - 필요 시 `USER_WITHDRAWAL_LOG` 권장
- 카드 추천 요청
  - 추천 결과를 저장하려면 `CARD_RECOMMENDATION_LOG` 필요
- 파일 업로드
  - 공통 파일 정책 필요
  - S3 key, content type, uploader, domain type 저장 여부 결정 필요

### 3. 상태값 확정 필요

- `SCHEDULE.status` 한글 enum이 깨져 있다. `WAITING/IN_PROGRESS/COMPLETED` 같은 영문 enum으로 재정의 권장
- `BUDGET_CATEGORY.name` 한글 enum이 깨져 있다. 코드성 enum으로 재정의 권장
- `VENDOR_HALL_DETAIL.style`, `meal_type`, `ceremony_type`, `entrance_type` 값이 깨져 있다
- `RESERVATION.progress`가 `VARCHAR(20)` 자유값이다. enum 또는 코드 테이블 권장

## 구현 전 결정 사항

- 인증 방식
  - 카카오 access token 직접 검증인지, authorization code flow인지
- JWT 정책
  - access/refresh 만료 시간
  - 다중 로그인 허용 여부
- 예약 정책
  - 예약 생성 즉시 `PENDING`인지
  - 예약 변경 가능 시점 제한 여부
- 리뷰 정책
  - 예약당 리뷰 1개 제한 여부
- 찜 정책
  - 커플 단위인지 사용자 단위인지
  - 현재 테이블은 둘 다 저장 중이라 기준 확정 필요
- 결제 정책
  - 계약금/잔금 분리 여부
  - 부분취소 허용 여부
- 채팅 정책
  - REST 조회 + WebSocket 송신 구조인지
  - AI 메시지와 사용자 메시지 구분 방식

## 추천 다음 작업

1. DB 타입/외래키 오류부터 수정
2. 인증, 예약, 결제 상태값 enum 확정
3. 이 문서를 바탕으로 Swagger DTO 초안 생성
4. 파일 업로드와 휴대폰 인증 저장소 방식 결정
