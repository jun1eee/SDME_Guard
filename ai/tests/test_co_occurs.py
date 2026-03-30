"""CO_OCCURS + Few-shot 검증 테스트 (Phase 4)"""

import importlib
from unittest.mock import MagicMock


# ── FEWSHOT_EXAMPLES 검증 ──────────────────────────────────────


def _load_examples():
    from sdm.prompts import FEWSHOT_EXAMPLES
    return FEWSHOT_EXAMPLES


def test_fewshot_count_at_least_18():
    examples = _load_examples()
    assert len(examples) >= 18, f"FEWSHOT_EXAMPLES 길이가 {len(examples)}개, 18개 이상이어야 합니다"


def test_fewshot_has_co_occurs_keyword():
    examples = _load_examples()
    has_co = any("CO_OCCURS" in ex for ex in examples)
    assert has_co, "FEWSHOT_EXAMPLES에 CO_OCCURS 키워드가 포함된 예시가 없습니다"


def test_fewshot_has_part_of_keyword():
    examples = _load_examples()
    has_part = any("PART_OF" in ex for ex in examples)
    assert has_part, "FEWSHOT_EXAMPLES에 PART_OF 키워드가 포함된 예시가 없습니다"


def test_fewshot_has_cross_category_pattern():
    """cross-category 패턴: 한 카테고리 업체에서 다른 카테고리를 찾는 쿼리"""
    examples = _load_examples()
    has_cross = any(
        # 서로 다른 카테고리 간 탐색 패턴
        ("category:'studio'" in ex and "category:'dress'" in ex)
        or ("category:'studio'" in ex and "category:'makeup'" in ex)
        or ("category:'dress'" in ex and "category:'makeup'" in ex)
        or ("category:'dress'" in ex and "category:'studio'" in ex)
        or ("category:'makeup'" in ex and "category:'studio'" in ex)
        or ("category:'makeup'" in ex and "category:'dress'" in ex)
        # 또는 v1 -> v2 패턴으로 다른 카테고리
        or ("v1:Vendor" in ex and "v2:Vendor" in ex)
        for ex in examples
    )
    assert has_cross, "FEWSHOT_EXAMPLES에 cross-category 패턴이 없습니다"


def test_fewshot_original_14_preserved():
    """기존 14개 예시의 핵심 키워드가 여전히 존재하는지 확인"""
    examples = _load_examples()
    combined = "\n".join(examples)
    original_keywords = [
        "스튜디오 추천해줘",
        "200만원 이하 스튜디오",
        "야외씬 잘 찍는곳",
        "강남 스튜디오 150만원 이하",
        "줄리의정원 가격이랑 패키지",
        "줄리의정원과 비슷한 스타일",
        "리뷰 좋은 강남 스튜디오",
        "드레스 추천해줘",
        "촬영+본식 드레스 4벌 이상",
        "메이크업 추천해줘",
        "내추럴 메이크업 추천",
        "스튜디오 15개 추천해줘",
        "청담 드레스샵 추천해줘",
        "논현동 메이크업샵",
    ]
    for kw in original_keywords:
        assert kw in combined, f"기존 예시 '{kw}'가 삭제되었습니다"


# ── create_cross_category_co_occurs 함수 검증 ──────────────────


def test_function_exists():
    from scripts.db_load import create_cross_category_co_occurs
    assert callable(create_cross_category_co_occurs)


def test_function_runs_co_occurs_cross_cypher():
    """mock session으로 CO_OCCURS_CROSS Cypher가 실행되는지 확인"""
    from scripts.db_load import create_cross_category_co_occurs

    mock_session = MagicMock()
    # session.run().single()["cnt"] 를 위한 mock 체인
    mock_result = MagicMock()
    mock_result.single.return_value = {"cnt": 5}
    mock_session.run.return_value = mock_result

    create_cross_category_co_occurs(mock_session)

    # session.run이 2번 호출됨 (MERGE + COUNT)
    assert mock_session.run.call_count == 2

    # 첫 번째 호출: CO_OCCURS_CROSS MERGE
    first_call_cypher = mock_session.run.call_args_list[0][0][0]
    assert "CO_OCCURS_CROSS" in first_call_cypher, "첫 번째 쿼리에 CO_OCCURS_CROSS가 없습니다"
    assert "category" in first_call_cypher, "카테고리 필터가 없습니다"
    assert "cnt >= 2" in first_call_cypher, "cnt >= 2 조건이 없습니다"

    # 두 번째 호출: COUNT 쿼리
    second_call_cypher = mock_session.run.call_args_list[1][0][0]
    assert "count" in second_call_cypher.lower(), "두 번째 쿼리에 count가 없습니다"
