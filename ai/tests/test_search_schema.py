"""search tool 스키마 확장 검증 테스트"""
import sys
import os
from unittest.mock import MagicMock, patch, call

import pytest

# ai/ 디렉토리를 sys.path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sdm.tools import TOOLS_SCHEMA, ToolRegistry, ToolResult


# ============================================================
# Helper: TOOLS_SCHEMA에서 tool 찾기
# ============================================================

def _find_tool(name: str) -> dict | None:
    for t in TOOLS_SCHEMA:
        if t["type"] == "function" and t["function"]["name"] == name:
            return t["function"]
    return None


# ============================================================
# 1. TOOLS_SCHEMA 검증
# ============================================================

class TestToolsSchema:
    def test_search_has_region(self):
        tool = _find_tool("search")
        assert "region" in tool["parameters"]["properties"]

    def test_search_has_max_price(self):
        tool = _find_tool("search")
        assert "max_price" in tool["parameters"]["properties"]

    def test_search_has_min_price(self):
        tool = _find_tool("search")
        assert "min_price" in tool["parameters"]["properties"]

    def test_search_has_style_query(self):
        tool = _find_tool("search")
        assert "style_query" in tool["parameters"]["properties"]

    def test_search_has_tags(self):
        tool = _find_tool("search")
        assert "tags" in tool["parameters"]["properties"]

    def test_search_has_count(self):
        tool = _find_tool("search")
        assert "count" in tool["parameters"]["properties"]

    def test_search_required_fields(self):
        tool = _find_tool("search")
        assert tool["parameters"]["required"] == ["query", "category"]

    def test_search_style_schema_still_exists(self):
        tool = _find_tool("search_style")
        assert tool is not None, "search_style TOOLS_SCHEMA should still exist"

    def test_other_tools_unchanged(self):
        """search_nearby, compare, filter_sort, get_detail 등이 여전히 존재"""
        for name in ["search_nearby", "compare", "filter_sort", "get_detail",
                      "plan_tour", "modify_tour"]:
            assert _find_tool(name) is not None, f"{name} tool schema missing"


# ============================================================
# 2. search() 메서드 시그니처 검증
# ============================================================

class TestSearchSignature:
    def test_new_params_have_default_none(self):
        """새 파라미터가 모두 default None"""
        import inspect
        sig = inspect.signature(ToolRegistry.search)
        for param_name in ["region", "max_price", "min_price", "style_query", "tags", "count"]:
            param = sig.parameters[param_name]
            assert param.default is None, f"{param_name} default should be None, got {param.default}"


# ============================================================
# 3. search_style -> search 리다이렉트 검증
# ============================================================

class TestSearchStyleRedirect:
    def test_search_style_calls_search(self):
        engine = MagicMock()
        registry = ToolRegistry(engine=engine)
        # search를 mock
        registry.search = MagicMock(return_value=ToolResult(
            result_type="graphrag", data="test", vendors=["A"]
        ))
        result = registry.search_style(
            query="자연스러운 스튜디오", category="studio", couple_id=1
        )
        registry.search.assert_called_once_with(
            query="자연스러운 스튜디오",
            category="studio",
            couple_id=1,
            region=None,
            max_price=None,
            style_query="자연스러운 스튜디오",
        )

    def test_search_style_passes_region_and_max_price(self):
        engine = MagicMock()
        registry = ToolRegistry(engine=engine)
        registry.search = MagicMock(return_value=ToolResult(
            result_type="graphrag", data="test", vendors=[]
        ))
        registry.search_style(
            query="모던한 드레스", category="dress", couple_id=1,
            region="강남", max_price=2000000
        )
        registry.search.assert_called_once_with(
            query="모던한 드레스",
            category="dress",
            couple_id=1,
            region="강남",
            max_price=2000000,
            style_query="모던한 드레스",
        )


# ============================================================
# 4. search() 라우팅 검증 (style_query 유무)
# ============================================================

class TestSearchRouting:
    def _make_registry(self):
        engine = MagicMock()
        engine.search_semantic = MagicMock(return_value=("semantic result", ["V1"]))
        engine.search_structured = MagicMock(return_value=("structured result", ["V2"]))
        engine.query_vendors_by_names = MagicMock(return_value=[])
        engine.driver = None  # fallback 방지
        registry = ToolRegistry(engine=engine)
        # _build_vendor_list를 mock하여 간단한 결과 반환
        registry._build_vendor_list = MagicMock(
            side_effect=lambda vendors, cat, **kw: ToolResult(
                result_type="direct", data="built", vendors=vendors
            )
        )
        return registry, engine

    def test_style_query_routes_to_hybrid(self):
        registry, engine = self._make_registry()
        engine.search_hybrid = MagicMock(return_value=(
            [{"name": "V1", "category": "studio"}], "1개 업체를 찾았습니다."
        ))
        result = registry.search(
            query="자연스러운 스튜디오", category="studio", couple_id=1,
            style_query="자연스러운"
        )
        engine.search_hybrid.assert_called_once()
        engine.search_structured.assert_not_called()
        # style_query 값 확인
        call_kwargs = engine.search_hybrid.call_args
        assert call_kwargs.kwargs.get("style_query") == "자연스러운"

    def test_no_style_query_routes_to_structured(self):
        registry, engine = self._make_registry()
        result = registry.search(
            query="강남 스튜디오 추천", category="studio", couple_id=1
        )
        engine.search_structured.assert_called_once()
        engine.search_semantic.assert_not_called()

    def test_backward_compat_no_new_params(self):
        """기존 호출 형태 search(query, category, couple_id)도 동작"""
        registry, engine = self._make_registry()
        result = registry.search(query="스튜디오 추천", category="studio", couple_id=1)
        # 에러 없이 실행되면 통과
        assert result is not None


# ============================================================
# 5. category="hall" -> _search_hall 호출 검증
# ============================================================

class TestSearchHallRouting:
    def test_hall_category_calls_search_hall(self):
        engine = MagicMock()
        registry = ToolRegistry(engine=engine)
        registry._search_hall = MagicMock(return_value=ToolResult(
            result_type="direct", data="hall result", vendors=["H1"]
        ))
        result = registry.search(
            query="강남 웨딩홀", category="hall", couple_id=1
        )
        registry._search_hall.assert_called_once_with("강남 웨딩홀")
        assert result.data == "hall result"


# ============================================================
# 6. SYSTEM_PROMPT 검증
# ============================================================

class TestSystemPrompt:
    def test_has_condition_decomposition_examples(self):
        from sdm.prompts import SYSTEM_PROMPT
        assert "조건 분해 예시" in SYSTEM_PROMPT

    def test_has_search_with_style_query_example(self):
        from sdm.prompts import SYSTEM_PROMPT
        assert "style_query" in SYSTEM_PROMPT

    def test_has_search_with_region_example(self):
        from sdm.prompts import SYSTEM_PROMPT
        assert "region=" in SYSTEM_PROMPT

    def test_has_search_with_max_price_example(self):
        from sdm.prompts import SYSTEM_PROMPT
        assert "max_price=" in SYSTEM_PROMPT
