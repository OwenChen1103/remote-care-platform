import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: unknown[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('auth_token');
    } catch {
      return null;
    }
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const json: unknown = await response.json();

    const body = json as Record<string, unknown>;

    if (body['success'] === false) {
      const errorObj = body['error'] as {
        code: string;
        message: string;
        details: unknown[];
      };
      throw new ApiError(errorObj.code, errorObj.message, errorObj.details);
    }

    return body['data'] as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
