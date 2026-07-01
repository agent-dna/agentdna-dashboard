import { apiRequest } from "./client";

export interface UserProfile {
  name: string;
  email: string;
  apiKey: string;
  organizationID: string;
  createdAt: string;
  adminEmail: string;
}

export function fetchUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/user-profile", {
    method: "GET",
    auth: true,
    skipLogoutOn401: true,
  });
}

export interface AdminProfile {
  name: string;
  email: string;
  organizationID: string;
  apiKey: string;
  agentCount: number;
  intentCount: number;
  threatCount: number;
  totalUsers: number;
  createdAt: number; // Unix epoch seconds
}

export function fetchAdminProfile(): Promise<AdminProfile> {
  return apiRequest<AdminProfile>("/admin-profile", {
    method: "GET",
    auth: true,
    skipLogoutOn401: true,
  });
}

export interface UpdateProfileBody {
  name?: string;
  email?: string;
}

export function updateUserProfile(body: UpdateProfileBody): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/update-profile", {
    method: "PATCH",
    body,
    auth: true,
  });
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export function changePassword(body: ChangePasswordBody): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/change-password", {
    method: "POST",
    body,
    auth: true,
  });
}
