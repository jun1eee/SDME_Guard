---
paths: "**"
---

# Git 규칙

## 커밋
- 형식: `type: 한국어 요약` (feat, fix, refactor, docs, chore)
- 자동 커밋 금지 — 커밋 메시지 제시 후 사용자 확인
- Co-Authored-By 불필요

## 브랜치
- 부모 브랜치: `ai`
- 기능 브랜치: `feature/ai/{기능}` → MR → `ai`
- ai에서 기능 브랜치 생성
- 머지 후 ai로 돌아와서 pull, 새 기능 브랜치 생성
- 배포: ai → MR → dev

## MR
- GitLab MR URL 제공
- Source: feature/ai/xxx → Target: ai

## 금지
- force push
