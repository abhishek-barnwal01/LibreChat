import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

// Types
export interface DataAccess {
  productCategories?: string[] | null;
  countries?: string[] | null;
}

export interface AdminUser {
  _id: string;
  email: string;
  name?: string;
  role: string;
  dataAccess?: DataAccess | null;
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

// Query key
export const ADMIN_USERS_KEY = ['admin', 'users'];

// Fetchers — direct axios calls, independent of the compiled data-provider package
async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await axios.get('/api/admin/users');
  return res.data.users as AdminUser[];
}

async function patchAdmin<T>(url: string, data: unknown): Promise<T> {
  const res = await axios.patch(url, JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data as T;
}

// Hooks
export const useGetAdminUsersQuery = (): UseQueryResult<AdminUser[]> =>
  useQuery(ADMIN_USERS_KEY, fetchAdminUsers, {
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

export const useUpdateUserDataAccessMutation = (options?: {
  onSuccess?: (data: AdminUserUpdateResponse) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<AdminUserUpdateResponse, unknown, UpdateUserDataAccessVars> => {
  const queryClient = useQueryClient();
  return useMutation(
    (variables: UpdateUserDataAccessVars) =>
      patchAdmin<AdminUserUpdateResponse>('/api/admin/users/data-access', variables),
    {
      onSuccess: (data, variables) => {
        // Update cached user list in place
        queryClient.setQueryData<AdminUser[]>(ADMIN_USERS_KEY, (old) =>
          old?.map((u) =>
            u.email === variables.email ? { ...u, dataAccess: variables.dataAccess } : u,
          ),
        );
        options?.onSuccess?.(data);
      },
      onError: options?.onError,
    },
  );
};

export const useUpdateUserRoleMutation = (options?: {
  onSuccess?: (data: AdminUserUpdateResponse) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<AdminUserUpdateResponse, unknown, UpdateUserRoleVars> => {
  const queryClient = useQueryClient();
  return useMutation(
    (variables: UpdateUserRoleVars) =>
      patchAdmin<AdminUserUpdateResponse>('/api/admin/users/role', variables),
    {
      onSuccess: (data, variables) => {
        // Update cached user list in place
        queryClient.setQueryData<AdminUser[]>(ADMIN_USERS_KEY, (old) =>
          old?.map((u) => (u.email === variables.email ? { ...u, role: variables.role } : u)),
        );
        options?.onSuccess?.(data);
      },
      onError: options?.onError,
    },
  );
};
