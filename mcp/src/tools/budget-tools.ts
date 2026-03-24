import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerBudgetTools(server: McpServer, api: ApiClient) {
  server.tool(
    "update_total_budget",
    "총 예산을 수정합니다.",
    {
      totalBudget: z.number().describe("총 예산 금액 (원)"),
    },
    async ({ totalBudget }) => {
      try {
        await api.put("/budgets/total", { totalBudget })
        return {
          content: [{
            type: "text",
            text: `✅ 총 예산이 ${totalBudget.toLocaleString()}원으로 수정되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `총 예산 수정 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "add_budget_item",
    "예산 항목을 추가합니다.",
    {
      category: z.string().describe("카테고리 (예: 웨딩홀, 스튜디오, 드레스, 메이크업)"),
      name: z.string().describe("항목명 (예: 업체명)"),
      amount: z.number().describe("금액 (원)"),
      vendorId: z.number().optional().describe("업체 ID (선택)"),
    },
    async ({ category, name, amount, vendorId }) => {
      try {
        await api.post("/budgets/category/items", { category, name, amount, vendorId: vendorId ?? null })
        return {
          content: [{
            type: "text",
            text: `✅ 예산 항목 추가!\n- 카테고리: ${category}\n- 항목: ${name}\n- 금액: ${amount.toLocaleString()}원`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예산 항목 추가 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "update_budget_item",
    "예산 항목을 수정합니다.",
    {
      itemId: z.number().describe("항목 ID"),
      name: z.string().optional().describe("변경할 항목명"),
      amount: z.number().optional().describe("변경할 금액 (원)"),
    },
    async ({ itemId, name, amount }) => {
      try {
        const body: any = {}
        if (name) body.name = name
        if (amount) body.amount = amount
        await api.put(`/budgets/category/${itemId}`, body)
        return {
          content: [{
            type: "text",
            text: `✅ 예산 항목(ID: ${itemId})이 수정되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예산 항목 수정 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "delete_budget_item",
    "예산 항목을 삭제합니다.",
    {
      itemId: z.number().describe("항목 ID"),
    },
    async ({ itemId }) => {
      try {
        await api.delete(`/budgets/category/${itemId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 예산 항목(ID: ${itemId})이 삭제되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예산 항목 삭제 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_budget",
    "커플의 예산 현황을 조회합니다. 총 예산, 카테고리별 지출, 남은 예산 등을 확인할 수 있습니다.",
    {},
    async () => {
      try {
        const data = await api.get("/budgets")

        const categoryList = (data.categories ?? [])
          .filter((c: any) => c.items && c.items.length > 0)
          .map((c: any) => {
            const items = c.items.map((i: any) =>
              `    · ${i.name}: ${i.amount?.toLocaleString()}원 ${i.isPaid ? "✅" : "⬜"}`
            ).join("\n")
            return `  📁 ${c.name}\n${items}`
          }).join("\n")

        const totalBudget = data.totalBudget?.toLocaleString() ?? "0"
        const totalSpent = data.totalSpent?.toLocaleString() ?? "0"
        const totalRemaining = data.totalRemaining?.toLocaleString() ?? "0"

        return {
          content: [{
            type: "text",
            text: `💰 예산 현황:\n- 총 예산: ${totalBudget}원\n- 확정 지출: ${totalSpent}원\n- 남은 예산: ${totalRemaining}원\n\n${categoryList || "등록된 항목이 없습니다."}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예산 조회 실패: ${e.message}` }] }
      }
    }
  )
}
