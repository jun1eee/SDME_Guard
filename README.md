# A105 | 정대철 고효석 김건희 신현성 이준원 최민경
---

> # Team Convention

## 1. Git Convention

### 브랜치 구조

```
main                              ← 배포 스냅샷 (직접 푸시 금지)
│
└── dev                           ← 통합 브랜치 (default)
    │
    ├── feature/be/기능명          ← dev에서 분기 → dev로 MR
    ├── feature/fe/기능명          ← dev에서 분기 → dev로 MR
    │
    └── ai                        ← dev에서 분기 (장기 브랜치)
        │                         ← 완성 단위로 dev에 MR
        └── feature/ai/기능명      ← ai에서 분기 → ai로 MR

study                             ← TIL / 회고록 (독립)
```

### 브랜치 권한

| 브랜치 | 직접 푸시 | MR 머지 |
|--------|----------|---------|
| **main** | ❌ 불가 | 메인테이너만 |
| **dev** | 메인테이너만 | 개발자 + 메인테이너 |
| **ai** | 메인테이너만 | 개발자 + 메인테이너 |
| **feature/*** | 작업자 본인 | 개발자 + 메인테이너 |
| **study** | 전원 | - |

### 브랜치 네이밍

```
{type}/{part}/{기능명}
```

- type: `feature`, `fix`, `refactor`, `hotfix`, `docs`
- part: `be`, `fe`, `ai`, `common`
- BE/FE는 dev에서 분기, AI는 ai에서 분기

### 작업 흐름

**BE / FE**

```bash
git checkout dev && git pull origin dev
git checkout -b feature/be/jwt-auth

# 작업 + 커밋
git add .
git commit -m "feat: JWT 로그인 구현"
git push origin feature/be/jwt-auth

# MR 생성 (dev ← feature/be/jwt-auth)
# → CI 자동 → 리뷰 → 수동 머지 → CD 자동 배포 → 브랜치 삭제
```

**AI**

```bash
git checkout ai && git pull origin ai
git checkout -b feature/ai/yolo-detect

# 작업 + 커밋
git add .
git commit -m "feat: YOLO 탐지 모델 구현"
git push origin feature/ai/yolo-detect

# MR 생성 (ai ← feature/ai/yolo-detect)
# → 리뷰 → 수동 머지 → 브랜치 삭제
```

기능들이 ai에 쌓이면, 완성된 단위로 `ai → dev` MR 생성 후 머지.

> **⚠️ ai 브랜치는 주기적으로 dev 당겨오기 필수**
> ```bash
> git checkout ai && git merge dev && git push origin ai
> ```

**dev → main**: 메인테이너만. 발표/배포 시점에 MR 생성 후 머지.

### CI/CD

| 이벤트 | 실행 | 내용 |
|--------|------|------|
| feature → dev 또는 ai **MR 생성** | CI (자동) | 빌드 + 테스트 |
| CI 통과 + 리뷰 완료 | **머지 (수동)** | 사람이 판단 |
| dev에 **머지 완료** | CD (자동) | 서버 배포 |

### 커밋 메시지

```
type: 제목
```

| type | 설명 |
|------|------|
| feat | 새로운 기능 |
| fix | 버그 수정 |
| refactor | 리팩토링 |
| docs | 문서 수정 |
| style | 포맷팅 (로직 변경 X) |
| test | 테스트 코드 |
| chore | 빌드, 설정 등 |

### Git 규칙

| ✅ 할 것 | ❌ 안 할 것 |
|---|---|
| dev/ai에서 feature 브랜치 생성 | main/dev에 직접 푸시 |
| MR로 머지 | force push |
| 커밋 전 pull | 민감정보 커밋 (.env, 키값) |

---

## 2. Coding Convention

### 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `UserService` |
| 메서드/변수 | camelCase | `findById()`, `userName` |
| 상수 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 패키지 | lowercase | `com.example.domain.user` |
| DB 테이블/컬럼 | snake_case | `user_group`, `created_at` |
| API URL | kebab-case | `/api/v1/user-groups` |

### 패키지 구조

```
com.example.project/
├─ domain/
│  └─ user/
│     ├─ controller/
│     ├─ service/
│     ├─ repository/
│     ├─ entity/
│     └─ dto/
├─ global/
│  ├─ config/
│  └─ exception/
└─ infra/
```

### 코드 규칙

- 중복 캡슐화
- 매직넘버 금지 → 상수 정의
- `Optional`은 `orElseThrow()`, `get()` 금지
- Entity에 `@Setter` 금지
- Controller에 비즈니스 로직 금지

---

## 3. API Convention

```
/api/v1/{리소스 복수형}

GET    /api/v1/users          # 목록
GET    /api/v1/users/{id}     # 단건
POST   /api/v1/users          # 생성
PUT    /api/v1/users/{id}     # 수정
DELETE /api/v1/users/{id}     # 삭제
```

**응답 형식**

```json
// 성공
{ "status": 200, "data": { }, "message": null }

// 에러
{ "status": 404, "data": null, "message": "사용자를 찾을 수 없습니다." }
```

---

## 프로젝트 운영

### 코드 리뷰

- MR 최소 1명 리뷰 후 머지, Approve 없이 머지 금지
- 리뷰어는 24시간 내 완료

### Jira 이슈

| 타입 | 용도 |
|------|------|
| Epic | 큰 기능 묶음 |
| Story | 사용자 관점 기능 |
| Task | 개발/환경 작업 |
| Bug | 버그 |

### 소통

- 일일 스탠드업: 매일 오전
- 주간 회고: 매주 금요일
- 긴급 이슈: 팀 채널 즉시 공유