import { apiRequest } from "./client";

export interface GenerateKeyResponse {
  api_key: string;
}

export function generateApiKey(): Promise<GenerateKeyResponse> {
  return apiRequest<GenerateKeyResponse>("/generate-api-key", { method: "POST" });
}

export function revokeApiKey(): Promise<void> {
  return apiRequest<void>("/revoke-api-key", { method: "POST" });
}

export interface TokenUsage {
  tokensUsed: number;
  tokensLimit: number;
  resetAt?: string;
}

export function fetchTokenUsage(): Promise<TokenUsage> {
  return apiRequest<TokenUsage>("/token-usage", { skipLogoutOn401: true });
}
