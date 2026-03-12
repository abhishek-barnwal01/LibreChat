import { useMutation } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';
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

// dataService is typed from the compiled package; cast to any to access newly added functions
// until the package is rebuilt with the new type definitions
const adminService = dataService as unknown as {
  updateUserDataAccess: (v: UpdateUserDataAccessVars) => Promise<AdminUserUpdateResponse>;
  updateUserRole: (v: UpdateUserRoleVars) => Promise<AdminUserUpdateResponse>;
};

export const useUpdateUserDataAccessMutation = (options?: {
  onSuccess?: (data: AdminUserUpdateResponse) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<AdminUserUpdateResponse, unknown, UpdateUserDataAccessVars> => {
  return useMutation(
    (variables: UpdateUserDataAccessVars) => adminService.updateUserDataAccess(variables),
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
    (variables: UpdateUserRoleVars) => adminService.updateUserRole(variables),
    {
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    },
  );
};
