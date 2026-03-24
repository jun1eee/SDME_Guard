import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createServer } from "http"
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
const PORT = parseInt(process.env.MCP_PORT || "3100")

function createMcpServer(api: ApiClient) {
  const server = new McpServer({
    name: "wedding-planner",
    version: "1.0.0",
  }, {
    instructions: `SDM Guard - AI 웨딩 플래너입니다.

사용 가능한 기능:
- 업체 검색: "메이크업 업체 검색해줘"
- 업체 상세 조회: "제니하우스 청담힐 정보 알려줘"
- 예약 가능 시간 확인: "3월 28일 예약 가능한 시간 알려줘"
- 예약 생성: "3월 28일 12시로 예약해줘"
- 예약 수정/취소: "예약 날짜를 29일로 변경해줘"
- 예약 조회: "내 예약 보여줘"
- 결제 안내: "계약금 얼마야?"
- 업체 공유: "이 업체 커플에게 공유해줘"
- 찜 추가/삭제: "이 업체 찜해줘"
- 일정 관리: "3월 26일에 드레스 피팅 일정 추가해줘"
- 예산 관리: "총 예산 5000만원으로 설정해줘"
- 결제 내역 조회: "결제 내역 보여줘"

주의사항:
- 결제는 앱에서 직접 진행해주세요
- 예약 시 패키지를 먼저 확인하고 사용자에게 선택을 요청하세요
- 예약 가능 시간이 아닌 시간은 예약할 수 없습니다`,
  })

  registerScheduleTools(server, api)
  registerReservationTools(server, api)
  registerBudgetTools(server, api)
  registerVendorTools(server, api)
  registerPaymentTools(server, api)
  registerFavoriteTools(server, api)
  registerVoteTools(server, api)
  registerReviewTools(server, api)

  return server
}

async function authenticateByToken(token: string): Promise<ApiClient> {
  const res = await fetch(`${API_URL}/api/mcp/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error("MCP 토큰 인증 실패")
  const json = await res.json()
  const accessToken = json.data?.accessToken ?? json.accessToken
  return new ApiClient(API_URL, accessToken)
}

async function main() {
  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if (req.method === "OPTIONS") {
      res.writeHead(200)
      res.end()
      return
    }

    const url = new URL(req.url!, `http://localhost:${PORT}`)

    // MCP endpoint (Streamable HTTP) - POST handles MCP, GET handles health check
    if (url.pathname === "/") {
      if (req.method === "GET" && !url.searchParams.get("token")) {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ name: "sdm-guard-mcp", status: "running" }))
        return
      }
      const token = url.searchParams.get("token")
      if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "MCP 토큰이 필요합니다." }))
        return
      }

      // Read request body
      let body = ""
      req.on("data", (chunk) => { body += chunk })
      req.on("end", async () => {
        try {
          const api = await authenticateByToken(token)
          const server = createMcpServer(api)
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

          await server.connect(transport)
          await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined)

          res.on("close", () => {
            transport.close()
            server.close()
          })
        } catch (e: any) {
          if (!res.headersSent) {
            res.writeHead(401, { "Content-Type": "application/json" })
            res.end(JSON.stringify({ error: e.message }))
          }
        }
      })
      return
    }

    res.writeHead(404)
    res.end("Not found")
  })

  httpServer.listen(PORT, () => {
    console.log(`🚀 SDM Guard MCP Server running at http://localhost:${PORT}`)
    console.log(`   MCP endpoint: http://localhost:${PORT}/mcp?token=YOUR_MCP_TOKEN`)
  })
}

main().catch(console.error)
