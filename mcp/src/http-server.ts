import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { createServer } from "http"
import { ApiClient } from "./api-client.js"
import { registerScheduleTools } from "./tools/schedule-tools.js"
import { registerReservationTools } from "./tools/reservation-tools.js"
import { registerBudgetTools } from "./tools/budget-tools.js"
import { registerVendorTools } from "./tools/vendor-tools.js"
import { registerPaymentTools } from "./tools/payment-tools.js"
import { registerFavoriteTools } from "./tools/favorite-tools.js"

const API_URL = process.env.API_URL || "http://localhost:8080"
const PORT = parseInt(process.env.MCP_PORT || "3100")

async function createMcpServer(api: ApiClient) {
  const server = new McpServer({
    name: "wedding-planner",
    version: "1.0.0",
  })

  registerScheduleTools(server, api)
  registerReservationTools(server, api)
  registerBudgetTools(server, api)
  registerVendorTools(server, api)
  registerPaymentTools(server, api)
  registerFavoriteTools(server, api)

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
  const sessions: Record<string, { transport: SSEServerTransport; server: McpServer }> = {}

  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if (req.method === "OPTIONS") {
      res.writeHead(200)
      res.end()
      return
    }

    const url = new URL(req.url!, `http://localhost:${PORT}`)

    if (url.pathname === "/sse") {
      const token = url.searchParams.get("token")
      if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "MCP 토큰이 필요합니다. URL에 ?token=YOUR_TOKEN을 추가하세요." }))
        return
      }

      try {
        const api = await authenticateByToken(token)
        const server = await createMcpServer(api)
        const transport = new SSEServerTransport("/messages", res)

        sessions[transport.sessionId] = { transport, server }

        res.on("close", () => {
          delete sessions[transport.sessionId]
        })

        await server.connect(transport)
      } catch (e: any) {
        res.writeHead(401, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: e.message }))
      }
    } else if (url.pathname === "/messages") {
      const sessionId = url.searchParams.get("sessionId")
      if (sessionId && sessions[sessionId]) {
        let body = ""
        req.on("data", (chunk) => { body += chunk })
        req.on("end", async () => {
          try {
            await sessions[sessionId].transport.handlePostMessage(req, res, body)
          } catch {
            res.writeHead(500)
            res.end("Error")
          }
        })
      } else {
        res.writeHead(404)
        res.end("Session not found")
      }
    } else {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ name: "sdm-guard-mcp", status: "running" }))
    }
  })

  httpServer.listen(PORT, () => {
    console.log(`🚀 SDM Guard MCP Server running at http://localhost:${PORT}`)
    console.log(`   SSE endpoint: http://localhost:${PORT}/sse?token=YOUR_MCP_TOKEN`)
  })
}

main().catch(console.error)
