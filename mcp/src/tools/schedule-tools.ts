import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerScheduleTools(server: McpServer, api: ApiClient) {
  server.tool(
    "get_wedding_date",
    "결혼 날짜와 D-day를 조회합니다. '결혼날짜', '결혼일', 'D-day', '웨딩 날짜' 등을 물어볼 때 사용하세요.",
    {},
    async () => {
      try {
        const pref = await api.get("/users/preference")
        const weddingDate = pref?.weddingDate

        if (!weddingDate) {
          return { content: [{ type: "text", text: "아직 결혼 예정일이 등록되지 않았어요. 마이페이지 > 추가 정보에서 설정할 수 있어요." }] }
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const wedding = new Date(weddingDate + "T00:00:00")
        const dDay = Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const dDayText = dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day" : `D+${Math.abs(dDay)}`

        return {
          content: [{
            type: "text",
            text: `💍 결혼 예정일: ${weddingDate} (${dDayText})`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `결혼 날짜 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_schedules",
    "커플의 전체 일정을 조회합니다. 결혼식 날짜, D-day 정보도 포함됩니다.",
    {},
    async () => {
      try {
        const [data, pref] = await Promise.allSettled([
          api.get("/schedules"),
          api.get("/users/preference"),
        ])

        const schedules = data.status === "fulfilled" ? data.value : []
        const weddingDate = pref.status === "fulfilled" ? pref.value?.weddingDate : null

        let text = ""

        // 결혼식 날짜 & D-day
        if (weddingDate) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const wedding = new Date(weddingDate + "T00:00:00")
          const dDay = Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          const dDayText = dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day" : `D+${Math.abs(dDay)}`
          text += `💍 결혼식 날짜: ${weddingDate} (${dDayText})\n\n`
        }

        if (!schedules || (Array.isArray(schedules) && schedules.length === 0)) {
          text += "등록된 일정이 없습니다."
        } else {
          const list = schedules.map((s: any) =>
            `- [ID:${s.id}] ${s.title} | ${s.date ?? "미정"}${s.time ? " " + s.time : ""}${s.location ? " | " + s.location : ""} | ${s.category ?? ""} | ${s.status ?? ""}`
          ).join("\n")
          text += `📅 일정 목록:\n${list}`
        }

        return { content: [{ type: "text", text }] }
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
      location: z.string().optional().describe("장소 (선택)"),
      category: z.enum(["STUDIO", "DRESS", "MAKEUP", "HALL", "ETC"]).describe("카테고리. 스튜디오→STUDIO, 드레스→DRESS, 메이크업→MAKEUP, 웨딩홀→HALL, 그 외→ETC"),
      memo: z.string().optional().describe("메모 (선택)"),
    },
    async (params) => {
      try {
        const data = await api.post("/schedules", {
          title: params.title,
          date: params.date,
          time: params.time ?? null,
          location: params.location ?? null,
          category: params.category,
          memo: params.memo ?? null,
        })
        return {
          content: [{
            type: "text",
            text: `✅ 일정이 등록되었습니다!\n- 제목: ${params.title}\n- 날짜: ${params.date}${params.time ? " " + params.time : ""}${params.location ? "\n- 장소: " + params.location : ""}\n- 카테고리: ${params.category}`,
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
      location: z.string().optional().describe("변경할 장소"),
      category: z.enum(["STUDIO", "DRESS", "MAKEUP", "HALL", "ETC"]).optional().describe("변경할 카테고리"),
      memo: z.string().optional().describe("변경할 메모"),
    },
    async ({ scheduleId, title, date, time, location, category, memo }) => {
      try {
        const body: any = {}
        if (title) body.title = title
        if (date) body.date = date
        if (time) body.time = time
        if (location) body.location = location
        if (category) body.category = category
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

  server.tool(
    "get_my_info",
    "내 정보를 조회합니다. 이름, 닉네임, 역할(신랑/신부), 커플 연결 여부 등을 확인할 수 있습니다. '내 이름', '내 닉네임', '나는 누구', '내 정보' 등을 물어볼 때 사용하세요.",
    {},
    async () => {
      try {
        const data = await api.get("/users/me")
        const role = data.role === "g" ? "신랑" : data.role === "b" ? "신부" : "미설정"
        const coupled = data.coupleId ? "커플 연결됨" : "커플 미연결"
        return {
          content: [{
            type: "text",
            text: `👤 내 정보:\n- 이름: ${data.name ?? "미설정"}\n- 닉네임: ${data.nickname ?? "미설정"}\n- 역할: ${role}\n- 상태: ${coupled}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `내 정보 조회 실패: ${e.message}` }] }
      }
    }
  )
}
