import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ApiClient } from "../api-client.js"

export function registerVendorTools(server: McpServer, api: ApiClient, userId?: number) {
  server.tool(
    "search_vendors",
    "웨딩 업체를 검색합니다. 업체 이름이나 키워드로 검색합니다. 업체를 찾을 때 반드시 이 도구를 먼저 사용하세요. 검색 결과가 없으면 카테고리 없이 키워드만으로 다시 시도하세요. 공유 목록이나 찜 목록에서 찾지 마세요.",
    {
      category: z.enum(["studio", "dress", "makeup", "hall"]).optional().describe("카테고리 (studio, dress, makeup, hall)"),
      keyword: z.string().optional().describe("검색 키워드"),
      size: z.number().optional().describe("결과 개수 (기본 10)"),
    },
    async (params) => {
      try {
        const queryParts: string[] = []
        if (params.category) queryParts.push(`category=${params.category.toUpperCase()}`)
        if (params.keyword) queryParts.push(`keyword=${encodeURIComponent(params.keyword)}`)
        queryParts.push(`size=${params.size ?? 10}`)
        const query = queryParts.join("&")

        const data = await api.get(`/vendors?${query}`)
        const vendors = data.items ?? data.vendors ?? data.content ?? data
        if (!vendors || (Array.isArray(vendors) && vendors.length === 0)) {
          return { content: [{ type: "text", text: "검색 결과가 없습니다." }] }
        }

        const list = (Array.isArray(vendors) ? vendors : []).map((v: any) =>
          `- [ID:${v.id}] ${v.name} | ⭐${v.rating ?? "-"} | ${v.price?.toLocaleString() ?? "가격 문의"}원 | ${v.category ?? ""}`
        ).join("\n")

        return { content: [{ type: "text", text: `🏪 업체 검색 결과:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `업체 검색 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "share_vendor",
    "업체를 커플에게 공유합니다. 메시지를 함께 보낼 수 있습니다.",
    {
      vendorId: z.number().describe("업체 ID"),
      message: z.string().optional().describe("공유 메시지 (선택)"),
    },
    async ({ vendorId, message }) => {
      try {
        const data = await api.post(`/vendors/${vendorId}/share`, { message: message ?? "" })

        // 채팅방에도 공유 메시지 전송
        try {
          const coupleId = data.coupleId
          if (coupleId) {
            await api.post("/chat/couple/messages", {
              senderId: userId ?? 9,
              coupleId,
              content: message ?? "",
              messageType: "vendor_share",
              vendorId,
            })
          }
        } catch {}

        return {
          content: [{
            type: "text",
            text: `✅ 업체가 커플에게 공유되었습니다!\n- 업체 ID: ${vendorId}${message ? `\n- 메시지: ${message}` : ""}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `업체 공유 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_shared_vendors",
    "커플이 공유한 업체 목록을 조회합니다.",
    {},
    async () => {
      try {
        const data = await api.get("/vendors/shared")
        if (!data || (Array.isArray(data) && data.length === 0)) {
          return { content: [{ type: "text", text: "공유된 업체가 없습니다." }] }
        }
        const list = (Array.isArray(data) ? data : []).map((v: any) =>
          `- [ID:${v.vendorId}] ${v.vendorName ?? "업체"} | ${v.message ?? ""} | ${v.sharedAt?.substring(0, 10) ?? ""}`
        ).join("\n")
        return { content: [{ type: "text", text: `📤 공유된 업체:\n${list}` }] }
      } catch (e: any) {
        return { content: [{ type: "text", text: `공유 업체 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_vendor_booked_times",
    "특정 업체의 특정 날짜에 이미 예약된 시간을 조회합니다. 업체별 크롤링 데이터에서 실제 예약 가능 시간을 가져옵니다.",
    {
      vendorId: z.number().describe("업체 ID"),
      date: z.string().describe("조회할 날짜 (YYYY-MM-DD 형식)"),
    },
    async ({ vendorId, date }) => {
      try {
        // 1. 업체 상세에서 scheduleSlots 추출
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

        // 2. scheduleSlots가 없으면 카테고리별 기본값
        const defaultSlots: Record<string, string[]> = {
          HALL: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
          STUDIO: ["09:00", "12:00", "15:00"],
          DRESS: ["10:00", "12:00", "14:00", "16:00", "18:00"],
          MAKEUP: ["10:00", "12:00", "14:00", "16:00", "18:00"],
        }
        const allTimes = scheduleSlots ?? defaultSlots[category] ?? defaultSlots.HALL
        const source = scheduleSlots ? "크롤링 데이터" : "카테고리 기본값"

        // 3. 예약된 시간 조회
        const bookedData = await api.get(`/vendors/${vendorId}/reservations?date=${date}`)
        const bookedTimes: string[] = Array.isArray(bookedData) ? bookedData : []

        // 4. 오늘 날짜면 지나간 시간 필터링
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
        const isToday = date === today

        const availableTimes = allTimes.filter(t => {
          if (bookedTimes.includes(t)) return false
          if (isToday && t <= currentTime) return false
          return true
        })

        return {
          content: [{
            type: "text",
            text: `📅 ${date} 예약 현황 (${detail.name ?? vendorId}, ${category}):\n- 시간 출처: ${source}\n- 전체 시간: ${allTimes.join(", ")}\n- 예약된 시간: ${bookedTimes.length > 0 ? bookedTimes.join(", ") : "없음"}${isToday ? `\n- 현재 시간: ${currentTime} (지나간 시간 제외)` : ""}\n- 예약 가능 시간: ${availableTimes.length > 0 ? availableTimes.join(", ") : "모두 예약됨"}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `예약 시간 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "get_vendor_detail",
    "특정 업체의 상세 정보를 조회합니다. 패키지, 가격, 리뷰 등을 확인할 수 있습니다. 주의: 여기서 보여주는 시간은 전체 스케줄이며, 실제 예약 가능 시간은 반드시 get_vendor_booked_times로 확인해야 합니다. 오늘 날짜는 지나간 시간이 제외될 수 있습니다.",
    {
      vendorId: z.number().describe("업체 ID"),
    },
    async (params) => {
      try {
        const data = await api.get(`/vendors/${params.vendorId}`)
        const packages = (data.packageTabs ?? []).map((p: any) => {
          const includes = (p.includes ?? []).map((i: any) => `    - ${i.label}: ${i.value}`).join("\n")
          return `  · ${p.tabName}: ${p.price?.toLocaleString() ?? "가격 문의"}원${includes ? "\n" + includes : ""}`
        }).join("\n")

        const halls = (data.halls ?? []).map((h: any) =>
          `  · [홀ID:${h.id}] ${h.name} | ${h.hallType ?? ""} | ${h.style ?? ""} | 식대 ${h.mealPrice?.toLocaleString() ?? "?"}원 | 대관 ${h.rentalPrice?.toLocaleString() ?? "?"}원 | ${h.guestMin ?? "?"}~${h.guestMax ?? "?"}명`
        ).join("\n")

        let detail = `🏪 ${data.name}\n- 카테고리: ${data.category}\n- 평점: ⭐${data.rating ?? "-"}\n- 가격: ${data.price?.toLocaleString() ?? "가격 문의"}원`
        if (packages) detail += `\n\n📦 패키지:\n${packages}`
        if (halls) detail += `\n\n🏛️ 홀 정보:\n${halls}`

        return {
          content: [{
            type: "text",
            text: detail,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `업체 상세 조회 실패: ${e.message}` }] }
      }
    }
  )

  server.tool(
    "report_vendor",
    "업체를 신고합니다.",
    {
      vendorId: z.number().describe("업체 ID"),
      reason: z.string().describe("신고 사유"),
    },
    async ({ vendorId, reason }) => {
      try {
        await api.post(`/vendors/${vendorId}/report`, { reason })
        return {
          content: [{
            type: "text",
            text: `✅ 업체(ID: ${vendorId})가 신고되었습니다.\n- 사유: ${reason}`,
          }],
        }
      } catch (e: any) {
        return { content: [{ type: "text", text: `업체 신고 실패: ${e.message}` }] }
      }
    }
  )
}
