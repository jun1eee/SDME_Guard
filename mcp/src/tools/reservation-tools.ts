import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerReservationTools(server: McpServer, api: ApiClient) {
  server.tool(
    "update_reservation",
    "예약 정보를 변경합니다. 날짜, 시간, 메모를 수정할 수 있습니다.",
    {
      reservationId: z.number().describe("예약 ID"),
      reservationDate: z.string().optional().describe("변경할 날짜 (YYYY-MM-DD 형식)"),
      reservationTime: z.string().optional().describe("변경할 시간 (HH:mm 형식)"),
      memo: z.string().optional().describe("변경할 메모"),
    },
    async ({ reservationId, reservationDate, reservationTime, memo }) => {
      try {
        const body: any = {}
        if (reservationDate) body.reservationDate = reservationDate
        if (reservationTime) body.reservationTime = reservationTime + ":00"
        if (memo) body.memo = memo
        await api.put(`/reservations/${reservationId}`, body)
        return {
          content: [{
            type: "text",
            text: `✅ 예약이 수정되었습니다!\n- 예약 ID: ${reservationId}${reservationDate ? `\n- 날짜: ${reservationDate}` : ""}${reservationTime ? `\n- 시간: ${reservationTime}` : ""}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예약 수정 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "cancel_reservation",
    "예약을 취소합니다. 연결된 결제와 일정도 함께 취소됩니다.",
    {
      reservationId: z.number().describe("예약 ID"),
    },
    async ({ reservationId }) => {
      try {
        await api.delete(`/reservations/${reservationId}`)
        return {
          content: [{
            type: "text",
            text: `✅ 예약이 취소되었습니다! (예약 ID: ${reservationId})\n- 연결된 결제와 일정도 함께 취소되었습니다.`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예약 취소 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "create_reservation",
    "업체에 예약을 생성합니다. 예약 생성 시 일정도 자동으로 추가됩니다. 중요: 예약 전에 반드시 get_vendor_detail로 업체 정보를 확인하고, 스드메(스튜디오/드레스/메이크업) 업체는 어떤 패키지를 원하는지, 웨딩홀은 어떤 홀을 원하는지 사용자에게 물어본 후 memo에 선택한 패키지명 또는 홀 이름을 기록해야 합니다. 사용자가 명시하지 않았다면 목록을 보여주고 선택을 요청하세요.",
    {
      vendorId: z.number().describe("업체 ID"),
      reservationDate: z.string().describe("예약 날짜 (YYYY-MM-DD 형식)"),
      reservationTime: z.string().describe("예약 시간 (HH:mm 형식)"),
      memo: z.string().optional().describe("메모 - 선택한 패키지명 또는 홀 이름을 반드시 포함 (예: '[촬영] 신부신랑 헤어메이크업(실장)' 또는 '모던홀 (2층)')"),
    },
    async ({ vendorId, reservationDate, reservationTime, memo }) => {
      try {
        // 1. 업체 상세에서 예약 가능 시간 확인
        const detail = await api.get(`/vendors/${vendorId}`)
        const category = (detail.category ?? "").toUpperCase()
        const extra = detail.studioExtra ?? detail.dressExtra ?? detail.makeupExtra
        let scheduleSlots: string[] | null = null
        if (extra?.details) {
          const scheduleItem = extra.details.find((d: any) =>
            d.label?.includes("스케줄") || d.label?.includes("예약 시간") || d.label?.includes("촬영시간")
          )
          if (scheduleItem?.value) {
            const parsed = scheduleItem.value
              .split(/[,，]/)
              .map((s: string) => s.replace(/\(.*\)/g, "").trim())
              .map((s: string) => {
                const m = s.match(/(\d{1,2})시\s*(\d{1,2})?분?/)
                if (m) return `${m[1].padStart(2, "0")}:${(m[2] ?? "0").padStart(2, "0")}`
                return null
              })
              .filter(Boolean) as string[]
            if (parsed.length > 0) scheduleSlots = parsed.sort()
          }
        }
        const defaultSlots: Record<string, string[]> = {
          HALL: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
          STUDIO: ["09:00", "12:00", "15:00"],
          DRESS: ["10:00", "12:00", "14:00", "16:00", "18:00"],
          MAKEUP: ["10:00", "12:00", "14:00", "16:00", "18:00"],
        }
        const allTimes = scheduleSlots ?? defaultSlots[category] ?? defaultSlots.HALL

        // 2. 패키지/홀 선택 필수 검증
        const hasPackages = (detail.packageTabs ?? []).length > 0
        const hasHalls = (detail.halls ?? []).length > 0
        if ((hasPackages || hasHalls) && !memo) {
          const options = hasPackages
            ? (detail.packageTabs ?? []).map((p: any, i: number) => `${i + 1}. ${p.tabName}: ${p.price?.toLocaleString() ?? "가격 문의"}원`).join("\n")
            : (detail.halls ?? []).map((h: any, i: number) => `${i + 1}. ${h.name} | 식대 ${h.mealPrice?.toLocaleString() ?? "?"}원 | 대관 ${h.rentalPrice?.toLocaleString() ?? "?"}원`).join("\n")
          const total = hasPackages ? (detail.packageTabs ?? []).length : (detail.halls ?? []).length
          return {
            content: [{
              type: "text",
              text: `❌ ${hasPackages ? "패키지" : "홀"}를 선택해주세요! (총 ${total}개)\n\n${hasPackages ? "📦 전체 패키지 목록" : "🏛️ 전체 홀 목록"}:\n${options}\n\n위 목록을 사용자에게 모두 보여주고 번호 또는 이름으로 선택하게 해주세요.`,
            }],
          }
        }

        // 3. 오늘이면 지나간 시간 체크 (KST 기준)
        const nowKST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }))
        const today = `${nowKST.getFullYear()}-${String(nowKST.getMonth() + 1).padStart(2, "0")}-${String(nowKST.getDate()).padStart(2, "0")}`
        const currentTime = `${String(nowKST.getHours()).padStart(2, "0")}:${String(nowKST.getMinutes()).padStart(2, "0")}`
        if (reservationDate === today && reservationTime <= currentTime) {
          const futureTimes = allTimes.filter(t => t > currentTime)
          return {
            content: [{
              type: "text",
              text: `❌ ${reservationTime}은 이미 지난 시간입니다. (현재 ${currentTime})\n- 오늘 예약 가능 시간: ${futureTimes.length > 0 ? futureTimes.join(", ") : "오늘은 예약 가능한 시간이 없습니다"}`,
            }],
          }
        }

        // 4. 요청한 시간이 예약 가능한 시간인지 검증
        if (!allTimes.includes(reservationTime)) {
          return {
            content: [{
              type: "text",
              text: `❌ ${reservationTime}은 예약 가능한 시간이 아닙니다.\n- 예약 가능 시간: ${allTimes.join(", ")}`,
            }],
          }
        }

        // 3. 이미 예약된 시간인지 확인
        const bookedData = await api.get(`/vendors/${vendorId}/reservations?date=${reservationDate}`)
        const bookedTimes: string[] = Array.isArray(bookedData) ? bookedData : []
        if (bookedTimes.includes(reservationTime)) {
          const availableTimes = allTimes.filter(t => !bookedTimes.includes(t))
          return {
            content: [{
              type: "text",
              text: `❌ ${reservationDate} ${reservationTime}은 이미 예약된 시간입니다.\n- 예약 가능 시간: ${availableTimes.length > 0 ? availableTimes.join(", ") : "모두 예약됨"}`,
            }],
          }
        }

        // 4. 예약 생성
        const data = await api.post("/reservations", {
          vendorId,
          reservationDate,
          reservationTime: reservationTime + ":00",
          memo: memo ?? "",
        })
        return {
          content: [{
            type: "text",
            text: `✅ 예약이 생성되었습니다!\n- 예약 ID: ${data.id}\n- 업체: ${detail.name ?? vendorId}\n- 날짜: ${reservationDate} ${reservationTime}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예약 생성 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_reservations",
    "커플의 예약 목록을 조회합니다. 예약 상태, 업체명, 날짜 등을 확인할 수 있습니다.",
    {},
    async () => {
      try {
        const data = await api.get("/reservations")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "등록된 예약이 없습니다." }] }
        }
        const list = data.map((r: any) =>
          `- [예약ID:${r.id}] ${r.vendorName ?? "업체"} | ${r.reservationDate ?? "미정"}${r.reservationTime ? " " + r.reservationTime : ""} | ${r.status} | ${r.progress ?? ""}`
        ).join("\n")
        return { content: [{ type: "text", text: `📋 예약 목록:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예약 조회 실패: ${e.message}` }] }
      }
    }
  )
}
