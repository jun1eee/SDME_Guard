# AI 챗봇 프로젝트

## 현재 상태
- 스드메 챗봇: OpenAI Function Calling + Neo4j GraphRAG (Text2Cypher + VectorCypher)
- FastAPI 전환 중 (진행 상황은 `.claude/docs/fastapi-roadmap.md` 참조)
- 웨딩홀: 팀원 담당 - hall/ 코드 수정 금지

## 구조
```
ai/
├── main.py, config.py, deps.py, session_store.py  <- FastAPI 서버
├── gradio_ui.py        <- 개발 테스트 UI (채팅 + 디버그 + 그래프)
├── schemas/            <- 요청/응답 모델
├── chat/               <- 공통 파이프라인
├── sdm/                <- 스드메 도메인
├── hall/               <- 웨딩홀 도메인 (팀원)
├── card/               <- 카드 도메인
├── scripts/            <- 유틸 스크립트 (db_load.py 등)
├── data/json/          <- 크롤링 데이터
├── notebooks/          <- 노트북 (보관용)
└── mydocs/             <- 기술 문서 (git 미추적)
```

## 규칙
1. 커밋: `type: 한국어 요약` - 자동 커밋 금지, 사용자 확인 후
2. 브랜치: `feature/ai/{기능}` -> MR -> `ai-dc` (부모 브랜치)
3. Neo4j 쓰기: scripts/db_load.py만. 서버/노트북에서 삭제/삽입 금지
4. hall/ 수정 금지
5. `.claude/rules/` 자동 적용됨

## 실행
```bash
uvicorn main:app --reload --port 8000          # FastAPI
python gradio_ui.py                            # 개발 테스트 UI
python scripts/db_load.py                      # 데이터 적재
```

## 참조
- `.claude/rules/` - 코드 규칙 (자동)
- `.claude/docs/` - 아키텍처 문서
- `.claude/skills/` - 워크플로우
- `mydocs/` - 상세 기술 문서 (로컬)
