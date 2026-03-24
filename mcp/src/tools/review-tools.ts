import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerReviewTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_vendor_reviews",
    "특정 업체의 리뷰를 조회합니다.",
    {
      vendorId: z.number().describe("업체 ID"),
    },
    async ({ vendorId }) => {
      try {
        const data = await api.get(`/vendors/${vendorId}/reviews`)
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "리뷰가 없습니다." }] }
        }
        const list = (Array.isArray(data) ? data : []).map((r: any) =>
          `- ⭐${r.rating ?? "-"} | ${r.authorName ?? "익명"} | ${r.content ?? ""}${r.reviewedAt ? ` | ${r.reviewedAt.substring(0, 10)}` : ""}`
        ).join("\n")
        return { content: [{ type: "text", text: `📝 리뷰 목록:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `리뷰 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_my_reviews",
    "내가 작성한 리뷰 목록을 조회합니다.",
    {},
    async () => {
      try {
        const data = await api.get("/vendors/my")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "작성한 리뷰가 없습니다." }] }
        }
        const list = (Array.isArray(data) ? data : []).map((r: any) =>
          `- [ID:${r.id}] ${r.vendorName ?? "업체"} | ⭐${r.rating ?? "-"} | ${r.content ?? ""}`
        ).join("\n")
        return { content: [{ type: "text", text: `📝 내 리뷰:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `내 리뷰 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "create_review",
    "업체에 리뷰를 작성합니다.",
    {
      vendorId: z.number().describe("업체 ID"),
      rating: z.number().describe("평점 (1~5)"),
      content: z.string().describe("리뷰 내용"),
    },
    async ({ vendorId, rating, content }) => {
      try {
        await api.post(`/vendors/${vendorId}/reviews`, { rating, content })
        return {
          content: [{
            type: "text",
            text: `✅ 리뷰가 등록되었습니다!\n- 업체 ID: ${vendorId}\n- 평점: ⭐${rating}\n- 내용: ${content}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `리뷰 등록 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "update_review",
    "리뷰를 수정합니다.",
    {
      reviewId: z.number().describe("리뷰 ID"),
      rating: z.number().optional().describe("변경할 평점 (1~5)"),
      content: z.string().optional().describe("변경할 리뷰 내용"),
    },
    async ({ reviewId, rating, content }) => {
      try {
        const body: any = {}
        if (rating) body.rating = rating
        if (content) body.content = content
        await api.put(`/reviews/${reviewId}`, body)
        return {
          content: [{
            type: "text",
            text: `✅ 리뷰(ID: ${reviewId})가 수정되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `리뷰 수정 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "delete_review",
    "리뷰를 삭제합니다.",
    {
      reviewId: z.number().describe("리뷰 ID"),
    },
    async ({ reviewId }) => {
      try {
        await api.delete(`/reviews/${reviewId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 리뷰(ID: ${reviewId})가 삭제되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `리뷰 삭제 실패: ${e.message}` }] }
      }
    }
  )
}
