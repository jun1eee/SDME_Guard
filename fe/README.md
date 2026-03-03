# A105 | FE

Next.js 기반 프론트엔드 프로젝트입니다.

## 기술 스택
- Next.js
- React
- TypeScript
- Tailwind CSS

## 시작하기
아래 명령은 `fe` 폴더에서 실행합니다.

```bash
cd fe
npm install
npm run dev
```

기본 개발 서버는 `http://localhost:3000`에서 실행됩니다.

## 스크립트
- `npm run dev`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run start`: 프로덕션 서버 실행
- `npm run lint`: 린트 실행

## 환경 변수
`.env` 또는 `.env.local` 파일을 사용합니다. 필요한 키는 팀 규약에 맞게 추가하세요.

## 폴더 구조
- `app/`: 라우팅 및 페이지
- `components/`: 공통 UI 컴포넌트
- `hooks/`: 커스텀 훅
- `lib/`: 유틸리티/공용 모듈
- `public/`: 정적 파일
- `styles/`: 전역 스타일

## 노트
- `node_modules`, `.next` 등은 Git에 커밋하지 않습니다.
