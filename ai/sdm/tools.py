import json
from dataclasses import dataclass
from typing import Any

from sdm.graphrag import SdmGraphRagEngine


@dataclass
class ToolResult:
    result_type: str
    data: str
    vendors: list[str]


TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_structured",
            "description": "가격, 지역, 태그 같은 구조적 조건으로 스드메 업체를 검색합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
                },
                "required": ["query", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_semantic",
            "description": "스타일, 분위기, 느낌 같은 추상 조건으로 스드메 업체를 검색합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "category": {"type": "string", "enum": ["studio", "dress", "makeup"]},
                    "region": {"type": "string"},
                    "max_price": {"type": "integer"},
                    "min_price": {"type": "integer"},
                },
                "required": ["query", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_vendors",
            "description": "이전에 언급된 업체들을 비교합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_names": {"type": "array", "items": {"type": "string"}},
                    "criteria": {"type": "string"},
                },
                "required": ["vendor_names"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "filter_previous",
            "description": "이전 추천 결과에서 재정렬하거나 필터링합니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_names": {"type": "array", "items": {"type": "string"}},
                    "condition": {"type": "string"},
                    "count": {"type": "integer"},
                },
                "required": ["vendor_names", "condition"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_vendor_detail",
            "description": "특정 업체의 상세 정보를 조회합니다.",
            "parameters": {
                "type": "object",
                "properties": {"vendor_name": {"type": "string"}},
                "required": ["vendor_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_preference",
            "description": "사용자 선호도를 조회합니다.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_likes",
            "description": "사용자 찜 목록을 조회합니다.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


class SdmToolRegistry:
    def __init__(self, engine: SdmGraphRagEngine) -> None:
        self.engine = engine
        self.tool_map = {
            "search_structured": self.search_structured,
            "search_semantic": self.search_semantic,
            "compare_vendors": self.compare_vendors,
            "filter_previous": self.filter_previous,
            "get_vendor_detail": self.get_vendor_detail,
            "get_user_preference": self.get_user_preference,
            "get_user_likes": self.get_user_likes,
        }

    def execute(self, tool_name: str, couple_id: int, **kwargs: Any) -> ToolResult:
        return self.tool_map[tool_name](couple_id=couple_id, **kwargs)

    def search_structured(self, query: str, category: str, couple_id: int, **_: Any) -> ToolResult:
        answer, vendors = self.engine.search_structured(query=query, category=category)
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def search_semantic(
        self,
        query: str,
        category: str,
        couple_id: int,
        region: str | None = None,
        max_price: int | None = None,
        min_price: int | None = None,
        **_: Any,
    ) -> ToolResult:
        answer, vendors = self.engine.search_semantic(
            query=query,
            category=category,
            region=region,
            max_price=max_price,
            min_price=min_price,
        )
        return ToolResult(result_type="graphrag", data=answer, vendors=vendors)

    def compare_vendors(
        self,
        vendor_names: list[str],
        couple_id: int,
        criteria: str | None = None,
        **_: Any,
    ) -> ToolResult:
        records = self.engine.query_vendors_by_names(vendor_names)
        return ToolResult(
            result_type="raw",
            data=json.dumps(records, ensure_ascii=False, default=str),
            vendors=list(dict.fromkeys(record["name"] for record in records)),
        )

    def filter_previous(
        self,
        vendor_names: list[str],
        condition: str,
        couple_id: int,
        count: int | None = None,
        **_: Any,
    ) -> ToolResult:
        records = self.engine.query_vendors_by_names(vendor_names)
        return ToolResult(
            result_type="raw",
            data=json.dumps(records, ensure_ascii=False, default=str),
            vendors=list(dict.fromkeys(record["name"] for record in records)),
        )

    def get_vendor_detail(self, vendor_name: str, couple_id: int, **_: Any) -> ToolResult:
        records = self.engine.query_vendors_by_names([vendor_name])
        return ToolResult(
            result_type="raw",
            data=json.dumps(records, ensure_ascii=False, default=str),
            vendors=[vendor_name],
        )

    def get_user_preference(self, couple_id: int, **_: Any) -> ToolResult:
        preference = self.engine.get_user_preference(couple_id)
        lines = [f"- {key}: {value}" for key, value in preference.items() if key != "couple_id" and value]
        return ToolResult(
            result_type="direct",
            data="현재 저장된 취향 정보입니다.\n" + "\n".join(lines),
            vendors=[],
        )

    def get_user_likes(self, couple_id: int, **_: Any) -> ToolResult:
        likes = self.engine.get_user_likes(couple_id)
        if likes:
            lines = [f"- {item.get('name', '알 수 없음')} ({item.get('category', '')})" for item in likes]
            message = f"좋아요한 업체가 {len(likes)}건 있습니다.\n" + "\n".join(lines)
        else:
            message = "좋아요한 업체가 없습니다."
        return ToolResult(result_type="direct", data=message, vendors=[])
