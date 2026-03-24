export class ApiClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    }
  }

  async get<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`)
    const json = await res.json()
    return json.data ?? json
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      method: "POST",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`)
    const json = await res.json()
    return json.data ?? json
  }

  async patch<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`)
    const json = await res.json()
    return json.data ?? json
  }

  async put<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      method: "PUT",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`)
    const json = await res.json()
    return json.data ?? json
  }

  async delete<T = any>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api${path}`, {
      method: "DELETE",
      headers: this.headers,
    })
    if (!res.ok) throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`)
    const text = await res.text()
    if (!text) return null as T
    const json = JSON.parse(text)
    return json.data ?? json
  }

  async refreshToken(userId: number): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/auth/test-login/${userId}`, {
      method: "POST",
    })
    if (!res.ok) throw new Error("토큰 발급 실패")
    const json = await res.json()
    this.token = json.data?.accessToken ?? json.accessToken
    return this.token
  }
}
