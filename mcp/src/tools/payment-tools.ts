import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { exec } from "child_process"
import { ApiClient } from "../api-client.js"

const SITE_URL = process.env.SITE_URL ?? "https://j14a105.p.ssafy.io"

function openBrowser(url: string) {
  const cmd = process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`
  exec(cmd)
}

export function registerPaymentTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_payment_info",
    "예약에 대한 결제 정보를 안내합니다. 계약금(DEPOSIT)은 업체 가격의 10%입니다. 실제 결제는 앱에서 직접 진행해야 합니다.",
    {
      reservationId: z.number().describe("예약 ID"),
      vendorPrice: z.number().optional().describe("업체 가격 (원)"),
    },
    async ({ reservationId, vendorPrice }) => {
      try {
        const cards = await api.get("/cards")
        const cardList = (Array.isArray(cards) && cards.length > 0)
          ? cards.map((c: any) => `  · ${c.cardCompany ?? ""} ${c.cardNumber ?? ""}`).join("\n")
          : "  · 등록된 카드 없음 (앱에서 카드 등록 필요)"

        const depositAmount = vendorPrice ? Math.round(vendorPrice * 0.1) : null

        openBrowser(SITE_URL)

        return {
          content: [{
            type: "text",
            text: `💳 결제 안내\n- 예약 ID: ${reservationId}${depositAmount ? `\n- 계약금 (10%): ${depositAmount.toLocaleString()}원` : ""}\n- 등록된 카드:\n${cardList}\n\n🌐 브라우저에서 사이트를 열었습니다!\n👉 앱 > 예약 내역 > 해당 예약 > 결제하기`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `결제 정보 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_cards",
    "등록된 카드 목록을 조회합니다.",
    {},
    async () => {
      try {
        const data = await api.get("/cards")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "등록된 카드가 없습니다." }] }
        }
        const list = data.map((c: any) =>
          `- 카드 ID: ${c.id} | ${c.cardCompany ?? ""} ${c.cardNumber ?? ""}`
        ).join("\n")
        return { content: [{ type: "text", text: `💳 등록된 카드:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `카드 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_payments",
    "결제 내역을 조회합니다. 계약금/잔금 결제 상태를 확인할 수 있습니다.",
    {},
    async () => {
      try {
        const data = await api.get("/payments")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "결제 내역이 없습니다." }] }
        }
        const list = data.map((p: any) => {
          const type = p.type === "DEPOSIT" ? "계약금" : "잔금"
          const status = p.status === "DONE" ? "완료" : p.status === "CANCELED" ? "취소" : "대기"
          return `- ${p.vendorName ?? "업체"} | ${type} ${p.amount?.toLocaleString()}원 | ${status} | ${p.requestedAt?.substring(0, 10) ?? ""}`
        }).join("\n")
        return { content: [{ type: "text", text: `💳 결제 내역:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `결제 내역 조회 실패: ${e.message}` }] }
      }
    }
  )
}
