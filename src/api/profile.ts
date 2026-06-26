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
