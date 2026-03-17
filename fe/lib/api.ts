const API_BASE = "http://localhost:8080/api"

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
        return retryRes.json()
      }
    }

    clearAccessToken()
    throw new Error("인증이 만료되었습니다.")
  }

  return res.json()
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
