import type { Document, Types } from 'mongoose';
import { CursorPaginationParams } from '~/common';

export interface DataAccess {
  /** OData field: product_category_ai. Null means unrestricted. */
  productCategories?: string[] | null;
  /** OData field: country_ai. Null means unrestricted. */
  countries?: string[] | null;
}

export interface IUser extends Document {
  name?: string;
  username?: string;
  email: string;
  emailVerified: boolean;
  password?: string;
  avatar?: string;
  provider: string;
  role?: string;
  googleId?: string;
  facebookId?: string;
  openidId?: string;
  samlId?: string;
  ldapId?: string;
  githubId?: string;
  discordId?: string;
  appleId?: string;
  plugins?: string[];
  twoFactorEnabled?: boolean;
  totpSecret?: string;
  backupCodes?: Array<{
    codeHash: string;
    used: boolean;
    usedAt?: Date | null;
  }>;
  refreshToken?: Array<{
    refreshToken: string;
  }>;
  expiresAt?: Date;
  termsAccepted?: boolean;
  personalization?: {
    memories?: boolean;
  };
  /** Per-user data access restrictions for Azure AI Search. Null fields mean unrestricted. */
  dataAccess?: DataAccess | null;
  createdAt?: Date;
  updatedAt?: Date;
  /** Field for external source identification (for consistency with TPrincipal schema) */
  idOnTheSource?: string;
}

export interface BalanceConfig {
  enabled?: boolean;
  startBalance?: number;
  autoRefillEnabled?: boolean;
  refillIntervalValue?: number;
  refillIntervalUnit?: string;
  refillAmount?: number;
}

export interface CreateUserRequest extends Partial<IUser> {
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  emailVerified?: boolean;
  avatar?: string;
  plugins?: string[];
  twoFactorEnabled?: boolean;
  termsAccepted?: boolean;
  personalization?: {
    memories?: boolean;
  };
}

export interface UserDeleteResult {
  deletedCount: number;
  message: string;
}

export interface UserFilterOptions extends CursorPaginationParams {
  _id?: Types.ObjectId | string;
  // Includes email, username and name
  search?: string;
  role?: string;
  emailVerified?: boolean;
  provider?: string;
  twoFactorEnabled?: boolean;
  // External IDs
  googleId?: string;
  facebookId?: string;
  openidId?: string;
  samlId?: string;
  ldapId?: string;
  githubId?: string;
  discordId?: string;
  appleId?: string;
  // Date filters
  createdAfter?: string;
  createdBefore?: string;
}

export interface UserQueryOptions {
  fieldsToSelect?: string | string[] | null;
  lean?: boolean;
}
