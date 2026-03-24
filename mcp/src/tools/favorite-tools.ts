import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerFavoriteTools(server: McpServer, api: ApiClient) {
  server.tool(
    "add_favorite",
    "업체를 찜 목록에 추가합니다.",
    {
      vendorId: z.number().describe("업체 ID"),
    },
    async ({ vendorId }) => {
      try {
        await api.post(`/personal/favorites/${vendorId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 업체(ID: ${vendorId})를 찜 목록에 추가했습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `찜 추가 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "remove_favorite",
    "업체를 찜 목록에서 삭제합니다.",
    {
      vendorId: z.number().describe("업체 ID"),
    },
    async ({ vendorId }) => {
      try {
        await api.delete(`/personal/favorites/${vendorId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 업체(ID: ${vendorId})를 찜 목록에서 삭제했습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `찜 삭제 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_favorites",
    "커플의 찜 목록을 조회합니다. 신랑/신부 각각 찜한 업체를 확인할 수 있습니다.",
    {},
    async () => {
      try {
        const data = await api.get("/couple/favorites/all")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "찜한 업체가 없습니다." }] }
        }
        const list = data.map((f: any) =>
          `- ${f.name ?? "업체"} | ${f.category ?? ""} | ${f.price?.toLocaleString() ?? "가격 문의"}원 | ⭐${f.rating ?? "-"}`
        ).join("\n")
        return { content: [{ type: "text", text: `❤️ 찜 목록:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `찜 목록 조회 실패: ${e.message}` }] }
      }
    }
  )
}
