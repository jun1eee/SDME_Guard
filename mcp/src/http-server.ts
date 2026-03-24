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
const USER_ID = parseInt(process.env.USER_ID || "9")
const PORT = parseInt(process.env.MCP_PORT || "3100")

async function main() {
  const api = new ApiClient(API_URL, "")
  await api.refreshToken(USER_ID)

  const server = new McpServer({
    name: "wedding-planner",
    version: "1.0.0",
  })

  registerScheduleTools(server, api)
  registerReservationTools(server, api)
  registerBudgetTools(server, api)
  registerVendorTools(server, api, USER_ID)
  registerPaymentTools(server, api)
  registerFavoriteTools(server, api)

  const transports: Record<string, SSEServerTransport> = {}

  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
      res.writeHead(200)
      res.end()
      return
    }

    const url = new URL(req.url!, `http://localhost:${PORT}`)

    if (url.pathname === "/sse") {
      const transport = new SSEServerTransport("/messages", res)
      transports[transport.sessionId] = transport

      res.on("close", () => {
        delete transports[transport.sessionId]
      })

      await server.connect(transport)
    } else if (url.pathname === "/messages") {
      const sessionId = url.searchParams.get("sessionId")
      if (sessionId && transports[sessionId]) {
        let body = ""
        req.on("data", (chunk) => { body += chunk })
        req.on("end", async () => {
          try {
            await transports[sessionId].handlePostMessage(req, res, body)
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
      res.end(JSON.stringify({ name: "wedding-planner", status: "running" }))
    }
  })

  httpServer.listen(PORT, () => {
    console.log(`🚀 Wedding Planner MCP Server running at http://localhost:${PORT}`)
    console.log(`   SSE endpoint: http://localhost:${PORT}/sse`)
  })
}

main().catch(console.error)
