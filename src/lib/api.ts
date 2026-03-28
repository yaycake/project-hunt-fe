/**
 * Thin fetch wrapper for the Project Hunt API.
 * Base URL is read from VITE_API_BASE_URL env variable.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include', // send session cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      body,
      (body as { message?: string })?.message ?? `HTTP ${res.status}`,
    )
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: 'DELETE', ...options }),
}

export { ApiError }
