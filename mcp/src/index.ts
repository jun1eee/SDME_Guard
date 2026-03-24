import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ApiClient } from "./api-client.js"
import { registerScheduleTools } from "./tools/schedule-tools.js"
import { registerReservationTools } from "./tools/reservation-tools.js"
import { registerBudgetTools } from "./tools/budget-tools.js"
import { registerVendorTools } from "./tools/vendor-tools.js"
import { registerPaymentTools } from "./tools/payment-tools.js"
import { registerFavoriteTools } from "./tools/favorite-tools.js"
import { registerVoteTools } from "./tools/vote-tools.js"
import { registerReviewTools } from "./tools/review-tools.js"

const API_URL = process.env.API_URL || "http://localhost:8080"
const USER_ID = parseInt(process.env.USER_ID || "9")

async function main() {
  // API 클라이언트 생성 및 토큰 발급
  const api = new ApiClient(API_URL, "")
  await api.refreshToken(USER_ID)

  // MCP 서버 생성
  const server = new McpServer({
    name: "wedding-planner",
    version: "1.0.0",
  })

  // 도구 등록
  registerScheduleTools(server, api)
  registerReservationTools(server, api)
  registerBudgetTools(server, api)
  registerVendorTools(server, api, USER_ID)
  registerPaymentTools(server, api)
  registerFavoriteTools(server, api)
  registerVoteTools(server, api)
  registerReviewTools(server, api)

  // stdio 트랜스포트로 시작
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
