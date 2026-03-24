const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string) {
  accessToken = token
}

export function clearAccessToken() {
  accessToken = null
}

// 페이지 로드 시 refreshToken 쿠키로 accessToken 재발급 시도
export async function tryReissue(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/reissue`, {
      method: "POST",
      credentials: "include",
    })
    if (res.ok) {
      const data = await res.json()
      if (data.data?.accessToken) {
        accessToken = data.data.accessToken
        return true
      }
    }
  } catch {
    // 서버 연결 실패 등
  }
  return false
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; message: string; data: T }> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  })

  // 401이면 토큰 재발급 시도
  if (res.status === 401 && token) {
    const reissueRes = await fetch(`${API_BASE}/auth/reissue`, {
      method: "POST",
      credentials: "include",
    })

    if (reissueRes.ok) {
      const reissueData = await reissueRes.json()
      if (reissueData.data?.accessToken) {
        setAccessToken(reissueData.data.accessToken)
        headers["Authorization"] = `Bearer ${reissueData.data.accessToken}`
        const retryRes = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
          credentials: "include",
        })
        const retryData = await retryRes.json()
        if (!retryRes.ok) {
          throw new Error(retryData.message || `API Error: ${retryRes.status}`)
        }
        return retryData
      }
    }

    // 재발급 실패해도 토큰 유지 (폴링 등에서 반복 호출될 수 있음)
    throw new Error("인증이 만료되었습니다.")
  }

  // 204 No Content는 body가 없으므로 json 파싱 생략
  if (res.status === 204) {
    return { status: 204, message: "", data: undefined as T }
  }

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || `API Error: ${res.status}`)
  }
  return data
}

// Auth API
export async function kakaoLogin(authorizationCode: string) {
  return fetchApi<{
    isNewUser: boolean
    accessToken: string
    refreshToken: string
    kakaoNickname: string
    kakaoProfileImage: string
  }>("/auth/kakao", {
    method: "POST",
    body: JSON.stringify({ authorizationCode }),
  })
}

export async function signup(data: { name: string; role: string; nickname: string }) {
  return fetchApi<{
    userId: number
    name: string
    role: string
    nickname: string
    createdAt: string
  }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function logout() {
  return fetchApi<void>("/auth/logout", { method: "POST" })
}

// Test Login API
export async function testLogin(userId: number) {
  return fetchApi<{
    isNewUser: boolean
    accessToken: string
    refreshToken: string
    nickname: string
    profileImage: string
  }>(`/auth/test-login/${userId}`, {
    method: "POST",
  })
}

// User API
export async function getMyInfo() {
  return fetchApi<{
    id: number
    name: string
    role: string
    nickname: string
    profileImage: string
    coupleId: number | null
    createdAt: string
  }>("/user/me")
}

export async function getCoupleProfile() {
  return fetchApi<{
    coupleId: number
    weddingDate: string | null
    totalBudget: number | null
    connectedAt: string | null
    status: string
    groom: { id: number; name: string; nickname: string; profileImage: string | null } | null
    bride: { id: number; name: string; nickname: string; profileImage: string | null } | null
  }>("/couples/me")
}

export async function editUser(data: {
  name?: string
  nickname?: string
}) {
  return fetchApi("/user/edit", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

// Preference API
export async function savePreference(data: {
  weddingDate: string
  totalBudget: number
  sdmBudget: number
  hallBudget: number
  weddingHallReserved: boolean
  sdmReserved: boolean
  hallStyle?: string
  guestCount?: number
  preferredRegions?: { city: string; districts: string[] }[]
}) {
  return fetchApi("/user/preference", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getPreference() {
  return fetchApi<{
    surveyId: number
    weddingDate: string
    totalBudget: number
    sdmBudget: number
    hallBudget: number
    weddingHallReserved: boolean
    sdmReserved: boolean
    hallStyle: string
    guestCount: number
    preferredRegions: { city: string; districts: string[] }[]
    styles: string[] | null
    colors: string[] | null
    moods: string[] | null
    foods: string[] | null
  }>("/user/preference")
}

export async function getCouplePreferences() {
  return fetchApi<{
    groom: {
      styles: string[] | null; colors: string[] | null
      moods: string[] | null; foods: string[] | null
      weddingDate: string | null; totalBudget: number | null
      guestCount: number | null
      preferredRegions: { city: string; districts: string[] }[] | null
    }
    bride: {
      styles: string[] | null; colors: string[] | null
      moods: string[] | null; foods: string[] | null
      weddingDate: string | null; totalBudget: number | null
      guestCount: number | null
      preferredRegions: { city: string; districts: string[] }[] | null
    }
  }>("/couples/me/preferences")
}

export async function updateSharedInfo(data: {
  weddingDate: string
  totalBudget: number
  guestCount: number
  preferredRegions?: { city: string; districts: string[] }[]
}) {
  return fetchApi("/user/preference/shared-info", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function updateTastes(data: {
  styles: string[]
  colors: string[]
  moods: string[]
  foods: string[]
}) {
  return fetchApi("/user/preference/tastes", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

// Couple API
export async function createInviteCode() {
  return fetchApi<{ inviteCode: string }>("/couples/invite", {
    method: "POST",
  })
}

export async function connectCouple(inviteCode: string) {
  return fetchApi<{ coupleId: number; partnerNickname: string }>("/couples/invite/accept", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  })
}

export async function getMyCoupleInfo() {
  return fetchApi("/couples/me")
}

export async function disconnectCouple() {
  return fetchApi("/couples/disconnect", { method: "POST" })
}

export async function withdraw() {
  return fetchApi("/auth/withdraw", { method: "DELETE" })
}

// 찜목록
interface FavoriteItem {
  id: number
  vendorId: number
  name: string
  category: string
  price: number
  rating: number
  imageUrl: string
  description: string
  createdAt: string
}

export async function getMyFavorites() {
  return fetchApi<FavoriteItem[]>("/personal/favorites")
}

export async function addFavorite(vendorId: number) {
  return fetchApi<FavoriteItem>(`/personal/favorites/${vendorId}`, {
    method: "POST",
  })
}

export async function removeFavorite(vendorId: number) {
  return fetchApi(`/personal/favorites/${vendorId}`, { method: "DELETE" })
}

export async function getCoupleFavorites() {
  return fetchApi<FavoriteItem[]>("/couple/favorites")
}

export async function getAllCoupleFavorites() {
  return fetchApi<(FavoriteItem & { userId: number })[]>("/couple/favorites/all")
}

// 업체 공유
export async function shareVendor(vendorId: number, message?: string) {
  return fetchApi<{
    id: number; vendorId: number; vendorName: string; category: string
    price: number; rating: number; imageUrl: string
    sharedUserId: number; message: string; sharedAt: string
  }>(`/vendors/${vendorId}/share`, {
    method: "POST",
    body: JSON.stringify({ message }),
  })
}

export async function getSharedVendors() {
  return fetchApi<{
    id: number; vendorId: number; vendorName: string; category: string
    price: number; rating: number; imageUrl: string
    sharedUserId: number; message: string; sharedAt: string
  }[]>("/vendors/shared")
}

// 예약
export async function createReservation(vendorId: number, data: {
  reservationDate?: string; serviceDate?: string; reservationTime?: string; memo?: string; hallDetailId?: number
}) {
  return fetchApi(`/vendors/${vendorId}/book`, {
    method: "POST",
    body: JSON.stringify({ vendorId, hallDetailId: data.hallDetailId || 0, ...data }),
  })
}

export async function getReservations() {
  return fetchApi<{
    id: number; coupleId: number; vendorId: number; vendorName: string
    category: string; imageUrl: string; reservationDate: string
    serviceDate: string; reservationTime: string; status: string; progress: string
    memo: string; createdAt: string
  }[]>("/reservations")
}

export async function updateReservation(id: number, data: {
  reservationDate?: string; serviceDate?: string; reservationTime?: string; memo?: string
}) {
  return fetchApi(`/reservations/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function cancelReservation(id: number) {
  return fetchApi(`/reservations/${id}`, { method: "DELETE" })
}

export async function getBookedTimes(vendorId: number, date: string) {
  return fetchApi<string[]>(`/vendors/${vendorId}/reservations?date=${date}`)
}

// 업체 신고
export async function reportVendor(vendorId: number, reason: string) {
  return fetchApi(`/vendors/${vendorId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

// 투표
export async function getVoteItems() {
  return fetchApi<{
    id: number; vendorId: number; vendorName: string; category: string
    price: number; rating: number; imageUrl: string
    sourceType: string; createdByUserId: number; partnerVoted: boolean
    myScore: string | null; myReason: string | null; createdAt: string
  }[]>("/votes/items")
}

export async function createVoteItem(data: { vendorId: number; sharedVendorId?: number; sourceType: string }) {
  return fetchApi<{ id: number; vendorId: number; coupleId: number; sourceType: string; createdByUserId: number }>("/votes/items", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function submitVote(voteItemId: number, data: { score: string; reason?: string }) {
  return fetchApi<{ id: number; userId: number; voteItemId: number; score: string; reason: string }>(`/votes/${voteItemId}/votes`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteVote(voteItemId: number) {
  return fetchApi(`/votes/${voteItemId}/votes`, { method: "DELETE" })
}

export async function deleteVoteItem(voteItemId: number) {
  return fetchApi(`/votes/items/${voteItemId}`, { method: "DELETE" })
}

export async function unshareVendor(vendorId: number) {
  return fetchApi(`/vendors/${vendorId}/share`, { method: "DELETE" })
}

export async function getChatMessages() {
  return fetchApi<{
    id: number
    senderId: number
    senderName: string
    senderRole: string
    content: string
    messageType: string
    vendorId: number | null
    createdAt: string
  }[]>("/chat/couple/messages")
}

export interface AiRecommendation {
  id: number | null
  source: string
  category: string
  name: string
  reason: string | null
  rating: number | null
  reviewCount: number | null
  price: number | null
  imageUrl: string | null
  contact: string | null
  description: string | null
  hashtags: string | null
  address: string | null
}

export async function sendAiChat(data: {
  message: string
  sessionId?: string | null
}) {
  return fetchApi<{
    answer: string
    sessionId: string
    success: boolean
    recommendations: AiRecommendation[]
  }>("/chat/ai", {
    method: "POST",
    body: JSON.stringify({
      message: data.message,
      sessionId: data.sessionId ?? undefined,
    }),
  })
}

export interface AiChatHistoryItem {
  id: number
  sessionId: string
  role: string
  content: string
  recommendations: string | null
  createdAt: string
}

export async function getAiChatHistory(sessionId: string) {
  return fetchApi<AiChatHistoryItem[]>(`/chat/ai/history/${sessionId}`)
}

export async function getAiChatSessions() {
  return fetchApi<AiChatHistoryItem[]>("/chat/ai/sessions")
}

// ─── 카드 관리 ──────────────────────────────────────────────────────────

export async function registerCard(data: { authKey: string; customerKey: string }) {
  return fetchApi<{
    id: number; cardBrand: string; cardLast4: string; ownerName: string; createdAt: string
  }>("/cards", { method: "POST", body: JSON.stringify(data) })
}

export async function getCards() {
  return fetchApi<{
    id: number; cardBrand: string; cardLast4: string; ownerName: string; createdAt: string
  }[]>("/cards")
}

export async function deleteCard(cardId: number) {
  return fetchApi(`/cards/${cardId}`, { method: "DELETE" })
}

export async function getTossClientKey() {
  return fetchApi<{ clientKey: string }>("/cards/toss-client-key")
}

// ─── 결제 ──────────────────────────────────────────────────────────────

export async function requestPayment(data: {
  reservationId: number; cardId: number; type: string; amount: number
}) {
  return fetchApi<{
    id: number; vendorId: number; vendorName: string; vendorCategory: string; vendorImage: string
    reservationId: number; type: string
    amount: number; status: string; paymentKey: string
    cardBrand: string; cardLast4: string; requestedAt: string; approvedAt: string
  }>("/payments", { method: "POST", body: JSON.stringify(data) })
}

export async function getPayments() {
  return fetchApi<{
    id: number; vendorId: number; vendorName: string; vendorCategory: string; vendorImage: string
    reservationId: number; type: string
    amount: number; status: string; paymentKey: string
    cardBrand: string; cardLast4: string; requestedAt: string; approvedAt: string
  }[]>("/payments")
}

export async function getVendorPayments(vendorId: number) {
  return fetchApi<{
    id: number; vendorId: number; vendorName: string; vendorCategory: string; vendorImage: string
    reservationId: number; type: string
    amount: number; status: string; paymentKey: string
    cardBrand: string; cardLast4: string; requestedAt: string; approvedAt: string
  }[]>(`/payments/vendor/${vendorId}`)
}

// ─── 리뷰 ──────────────────────────────────────────────────────────────

export interface MyReviewItem {
  id: number
  vendorId: number
  vendorName: string
  vendorCategory: string
  rating: number
  content: string
  reviewedAt: string
}

export async function getMyReviews() {
  return fetchApi<MyReviewItem[]>("/vendors/my")
}

export async function createReview(vendorId: number, data: { rating: number; content: string }) {
  return fetchApi<{
    id: number
    rating: number
    authorName: string | null
    content: string
    reviewedAt: string
  }>(`/vendors/${vendorId}/reviews`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateReview(reviewId: number, data: { rating: number; content: string }) {
  return fetchApi<{
    id: number
    rating: number
    authorName: string | null
    content: string
    reviewedAt: string
  }>(`/reviews/${reviewId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteReview(reviewId: number) {
  return fetchApi(`/reviews/${reviewId}`, { method: "DELETE" })
}

// ─── 예산 관리 ──────────────────────────────────────────────────────

export async function getBudget() {
  return fetchApi<{
    id: number; totalBudget: number; totalSpent: number; totalRemaining: number
    categories: {
      id: number; name: string; allocated: number; spent: number; remaining: number
      items: { id: number; name: string; vendorId: number; amount: number; isPaid: boolean }[]
    }[]
  }>("/budgets")
}

export async function updateBudgetTotal(totalBudget: number) {
  return fetchApi("/budgets/total", { method: "PUT", body: JSON.stringify({ totalBudget }) })
}

export async function addBudgetItem(data: { category: string; name: string; vendorId?: number; amount: number }) {
  return fetchApi("/budgets/category/items", { method: "POST", body: JSON.stringify(data) })
}

export async function updateBudgetItem(itemId: number, data: { name?: string; amount?: number }) {
  return fetchApi(`/budgets/category/${itemId}`, { method: "PUT", body: JSON.stringify(data) })
}

export async function deleteBudgetItem(itemId: number) {
  return fetchApi(`/budgets/category/${itemId}`, { method: "DELETE" })
}

export async function getMcpToken() {
  return fetchApi("/mcp/token", { method: "POST" })
}

export async function refreshMcpToken() {
  return fetchApi("/mcp/token/refresh", { method: "POST" })
}
