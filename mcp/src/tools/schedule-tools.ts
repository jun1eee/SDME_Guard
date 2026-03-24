import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerScheduleTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_schedules",
    "커플의 전체 일정을 조회합니다",
    {},
    async () => {
      try {
        const data = await api.get("/schedules")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "등록된 일정이 없습니다." }] }
        }
        const list = data.map((s: any) =>
          `- [ID:${s.id}] ${s.title} | ${s.date ?? "미정"}${s.time ? " " + s.time : ""} | ${s.category ?? ""} | ${s.status ?? ""}`
        ).join("\n")
        return { content: [{ type: "text", text: `📅 일정 목록:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `일정 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "create_schedule",
    "커플 일정을 추가합니다. 예: 드레스 피팅, 스튜디오 촬영 등",
    {
      title: z.string().describe("일정 제목 (예: 셀린아뜰리에 드레스 피팅)"),
      date: z.string().describe("날짜 (YYYY-MM-DD 형식)"),
      time: z.string().optional().describe("시간 (HH:mm 형식, 선택)"),
      category: z.enum(["STUDIO", "DRESS", "MAKEUP", "HALL"]).describe("카테고리"),
    },
    async (params) => {
      try {
        const data = await api.post("/schedules", {
          title: params.title,
          date: params.date,
          time: params.time ?? null,
          category: params.category,
        })
        return {
          content: [{
            type: "text",
            text: `✅ 일정이 등록되었습니다!\n- 제목: ${params.title}\n- 날짜: ${params.date}${params.time ? " " + params.time : ""}\n- 카테고리: ${params.category}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `일정 등록 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "update_schedule",
    "일정을 수정합니다.",
    {
      scheduleId: z.number().describe("일정 ID"),
      title: z.string().optional().describe("변경할 제목"),
      date: z.string().optional().describe("변경할 날짜 (YYYY-MM-DD)"),
      time: z.string().optional().describe("변경할 시간 (HH:mm)"),
      memo: z.string().optional().describe("변경할 메모"),
    },
    async ({ scheduleId, title, date, time, memo }) => {
      try {
        const body: any = {}
        if (title) body.title = title
        if (date) body.date = date
        if (time) body.time = time
        if (memo) body.memo = memo
        await api.patch(`/schedules/${scheduleId}`, body)
        return {
          content: [{
            type: "text",
            text: `✅ 일정(ID: ${scheduleId})이 수정되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `일정 수정 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "delete_schedule",
    "일정을 삭제합니다.",
    {
      scheduleId: z.number().describe("일정 ID"),
    },
    async ({ scheduleId }) => {
      try {
        await api.delete(`/schedules/${scheduleId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 일정(ID: ${scheduleId})이 삭제되었습니다!`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `일정 삭제 실패: ${e.message}` }] }
      }
    }
  )
}
