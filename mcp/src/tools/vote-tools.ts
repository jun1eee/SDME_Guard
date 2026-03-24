import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerVoteTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_vote_items",
    "커플의 투표 항목 목록을 조회합니다. 업체에 대한 투표 현황을 확인할 수 있습니다.",
    {},
    async () => {
      try {
        const data = await api.get("/votes/items")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "투표 항목이 없습니다." }] }
        }
        const list = (Array.isArray(data) ? data : []).map((v: any) =>
          `- [ID:${v.id}] ${v.vendorName ?? "업체"} | ${v.category ?? ""} | 투표: ${v.votes?.length ?? 0}건`
        ).join("\n")
        return { content: [{ type: "text", text: `🗳️ 투표 항목:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `투표 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "create_vote_item",
    "공유된 업체를 투표 항목으로 추가합니다.",
    {
      vendorId: z.number().describe("업체 ID"),
      sourceType: z.enum(["ai", "my_wish", "partner_share"]).optional().describe("출처 (ai/my_wish/partner_share)"),
    },
    async ({ vendorId, sourceType }) => {
      try {
        const data = await api.post("/votes/items", {
          vendorId,
          sourceType: sourceType ?? "my_wish",
        })
        return {
          content: [{
            type: "text",
            text: `✅ 투표 항목이 추가되었습니다! (업체 ID: ${vendorId})`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `투표 항목 추가 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "vote",
    "투표 항목에 투표합니다.",
    {
      voteItemId: z.number().describe("투표 항목 ID"),
      score: z.enum(["great", "good", "neutral", "bad", "notinterested"]).describe("점수 (great/good/neutral/bad/notinterested)"),
      reason: z.string().optional().describe("투표 사유 (선택)"),
    },
    async ({ voteItemId, score, reason }) => {
      try {
        await api.post(`/votes/${voteItemId}/votes`, { score, reason: reason ?? "" })
        const scoreMap: Record<string, string> = {
          great: "최고", good: "좋아요", neutral: "보통", bad: "별로", notinterested: "관심없음"
        }
        return {
          content: [{
            type: "text",
            text: `✅ 투표 완료! (${scoreMap[score] ?? score})${reason ? ` - ${reason}` : ""}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `투표 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "delete_vote",
    "투표를 취소합니다.",
    {
      voteItemId: z.number().describe("투표 항목 ID"),
    },
    async ({ voteItemId }) => {
      try {
        await api.delete(`/votes/${voteItemId}/votes`)
        return {
          content: [{
            type: "text",
            text: `✅ 투표가 취소되었습니다! (항목 ID: ${voteItemId})`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `투표 취소 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "delete_vote_item",
    "투표 항목을 삭제합니다.",
    {
      voteItemId: z.number().describe("투표 항목 ID"),
    },
    async ({ voteItemId }) => {
      try {
        await api.delete(`/votes/items/${voteItemId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 투표 항목이 삭제되었습니다! (항목 ID: ${voteItemId})`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `투표 항목 삭제 실패: ${e.message}` }] }
      }
    }
  )
}
