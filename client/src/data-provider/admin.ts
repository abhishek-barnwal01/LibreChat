import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

// Types defined here because data-service interfaces aren't re-exported from librechat-data-provider
export interface DataAccess {
  productCategories?: string[] | null;
  countries?: string[] | null;
}

export interface UpdateUserDataAccessVars {
  email: string;
  dataAccess: DataAccess | null;
}

export interface UpdateUserRoleVars {
  email: string;
  role: string;
}

export interface AdminUserUpdateResponse {
  message: string;
  user: { email: string; dataAccess?: DataAccess | null; role?: string };
}

// Make direct HTTP calls to avoid relying on the compiled data-provider package
// (which may not have the new service functions built yet)
async function patchAdmin<T>(url: string, data: unknown): Promise<T> {
  const response = await axios.patch(url, JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data as T;
}

export const useUpdateUserDataAccessMutation = (options?: {
  onSuccess?: (data: AdminUserUpdateResponse) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<AdminUserUpdateResponse, unknown, UpdateUserDataAccessVars> => {
  return useMutation(
    (variables: UpdateUserDataAccessVars) =>
      patchAdmin<AdminUserUpdateResponse>('/api/admin/users/data-access', variables),
    {
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    },
  );
};

export const useUpdateUserRoleMutation = (options?: {
  onSuccess?: (data: AdminUserUpdateResponse) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<AdminUserUpdateResponse, unknown, UpdateUserRoleVars> => {
  return useMutation(
    (variables: UpdateUserRoleVars) =>
      patchAdmin<AdminUserUpdateResponse>('/api/admin/users/role', variables),
    {
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    },
  );
};
