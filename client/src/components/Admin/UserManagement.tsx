import { useState, useRef, useEffect } from 'react';
import { Users, ShieldCheck, ChevronDown, Check, Loader2 } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';
import {
  OGDialog,
  OGDialogTitle,
  OGDialogContent,
  OGDialogTrigger,
  useToastContext,
} from '@librechat/client';
import {
  useGetAdminUsersQuery,
  useUpdateUserDataAccessMutation,
  useUpdateUserRoleMutation,
} from '~/data-provider/admin';
import type { AdminUser, DataAccess } from '~/data-provider/admin';
import { useAuthContext, useLocalize } from '~/hooks';

const PRODUCT_CATEGORIES = ['Soaps', 'Household Insecticides'];
const COUNTRIES = ['India', 'Sri Lanka'];
const ROLES = [SystemRoles.USER, SystemRoles.ADMIN];

// ---------------------------------------------------------------------------
// Generic single-select user dropdown
// ---------------------------------------------------------------------------
function UserSelectDropdown({
  users,
  value,
  onChange,
  placeholder = 'Select user…',
}: {
  users: AdminUser[];
  value: string;
  onChange: (email: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const selected = users.find((u) => u.email === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary transition hover:bg-surface-tertiary"
      >
        <span className={selected ? 'text-text-primary' : 'text-text-secondary'}>
          {selected ? `${selected.email}${selected.name ? ` (${selected.name})` : ''}` : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-light bg-surface-primary shadow-lg">
          <div className="p-1.5">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded border border-border-light bg-surface-secondary px-2 py-1 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-secondary">No users found</li>
            ) : (
              filtered.map((u) => (
                <li
                  key={u._id}
                  onClick={() => {
                    onChange(u.email);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-surface-tertiary"
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${u.email === value ? 'text-green-500' : 'invisible'}`}
                  />
                  <span>
                    {u.email}
                    {u.name ? <span className="ml-1 text-text-secondary">({u.name})</span> : null}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-select dropdown
// ---------------------------------------------------------------------------
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  const displayText =
    selected.length === 0
      ? `Select ${label}…`
      : selected.length === options.length
        ? `All ${label}`
        : selected.join(', ');

  return (
    <div ref={ref} className="relative w-full">
      <div className="mb-1 text-sm font-medium text-text-primary">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm transition hover:bg-surface-tertiary"
      >
        <span className={selected.length ? 'text-text-primary' : 'text-text-secondary'}>
          {displayText}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-light bg-surface-primary shadow-lg">
          <ul className="py-1">
            {options.map((opt) => (
              <li
                key={opt}
                onClick={() => toggle(opt)}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-text-primary hover:bg-surface-tertiary"
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected.includes(opt)
                      ? 'border-green-500 bg-green-500'
                      : 'border-border-light bg-surface-secondary'
                  }`}
                >
                  {selected.includes(opt) && <Check className="h-3 w-3 text-white" />}
                </div>
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Access tab
// ---------------------------------------------------------------------------
function DataAccessSection({ users }: { users: AdminUser[] }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();

  const [selectedEmail, setSelectedEmail] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [unrestricted, setUnrestricted] = useState(false);

  // Pre-fill when the user is selected
  const handleSelectUser = (email: string) => {
    setSelectedEmail(email);
    const user = users.find((u) => u.email === email);
    if (!user) return;
    if (user.dataAccess == null) {
      setUnrestricted(true);
      setCategories([]);
      setCountries([]);
    } else {
      setUnrestricted(false);
      setCategories(user.dataAccess.productCategories ?? []);
      setCountries(user.dataAccess.countries ?? []);
    }
  };

  const { mutate, isLoading } = useUpdateUserDataAccessMutation({
    onSuccess: (data) => showToast({ status: 'success', message: data.message }),
    onError: (err: any) =>
      showToast({
        status: 'error',
        message: err?.response?.data?.message ?? localize('com_ui_error_save_admin_settings'),
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) {
      showToast({ status: 'warning', message: 'Please select a user.' });
      return;
    }
    mutate({
      email: selectedEmail,
      dataAccess: unrestricted
        ? null
        : {
            productCategories: categories.length > 0 ? categories : null,
            countries: countries.length > 0 ? countries : null,
          },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="mb-1 text-sm font-medium text-text-primary">User</div>
        <UserSelectDropdown users={users} value={selectedEmail} onChange={handleSelectUser} />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          className="accent-green-500"
          checked={unrestricted}
          onChange={(e) => setUnrestricted(e.target.checked)}
        />
        Unrestricted access (remove all filters)
      </label>

      {!unrestricted && (
        <>
          <MultiSelectDropdown
            label="Product Categories"
            options={PRODUCT_CATEGORIES}
            selected={categories}
            onChange={setCategories}
          />
          <MultiSelectDropdown
            label="Countries"
            options={COUNTRIES}
            selected={countries}
            onChange={setCountries}
          />
        </>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isLoading || !selectedEmail}
          className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-60"
        >
          {isLoading ? 'Saving…' : 'Save Data Access'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// User Role tab — inline table
// ---------------------------------------------------------------------------
function roleBadgeClass(role: string) {
  return role === SystemRoles.ADMIN
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
}

function UserRoleRow({
  user,
  currentAdminEmail,
}: {
  user: AdminUser;
  currentAdminEmail: string;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const isSelf = user.email === currentAdminEmail;

  const { mutate, isLoading } = useUpdateUserRoleMutation({
    onSuccess: (data) => showToast({ status: 'success', message: data.message }),
    onError: (err: any) =>
      showToast({
        status: 'error',
        message: err?.response?.data?.message ?? localize('com_ui_error_save_admin_settings'),
      }),
  });

  return (
    <tr className="border-b border-border-light last:border-0">
      <td className="py-2 pr-3 text-sm text-text-primary">
        <div className="font-medium">{user.email}</div>
        {user.name && <div className="text-xs text-text-secondary">{user.name}</div>}
      </td>
      <td className="py-2 text-right">
        {isSelf ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(user.role)}`}>
            {user.role} (you)
          </span>
        ) : (
          <select
            value={user.role}
            disabled={isLoading}
            onChange={(e) => mutate({ email: user.email, role: e.target.value })}
            className={`cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-green-500 ${roleBadgeClass(user.role)}`}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </td>
    </tr>
  );
}

function UserRoleSection({
  users,
  currentAdminEmail,
}: {
  users: AdminUser[];
  currentAdminEmail: string;
}) {
  const [search, setSearch] = useState('');

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  // Sort: admins first, then alphabetically by email
  const sorted = [...filtered].sort((a, b) => {
    if (a.role === SystemRoles.ADMIN && b.role !== SystemRoles.ADMIN) return -1;
    if (a.role !== SystemRoles.ADMIN && b.role === SystemRoles.ADMIN) return 1;
    return a.email.localeCompare(b.email);
  });

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users…"
        className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500"
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border-light">
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">No users found</p>
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-border-light">
              {sorted.map((u) => (
                <UserRoleRow key={u._id} user={u} currentAdminEmail={currentAdminEmail} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-text-secondary">
        {users.filter((u) => u.role === SystemRoles.ADMIN).length} admin(s) ·{' '}
        {users.filter((u) => u.role !== SystemRoles.ADMIN).length} user(s)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------
const UserManagement = () => {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<'data-access' | 'role'>('data-access');
  const [open, setOpen] = useState(false);

  const { data: users = [], isLoading, isError } = useGetAdminUsersQuery();

  if (user?.role !== SystemRoles.ADMIN) {
    return null;
  }

  return (
    <OGDialog open={open} onOpenChange={setOpen}>
      <OGDialogTrigger asChild>
        <button
          className="select-item flex w-full items-center gap-2 text-sm"
          aria-label="User Management"
        >
          <Users className="icon-md" aria-hidden="true" />
          User Management
        </button>
      </OGDialogTrigger>

      <OGDialogContent className="border-border-light bg-surface-primary text-text-primary w-full max-w-lg">
        <OGDialogTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          Admin — User Management
        </OGDialogTitle>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-border-light p-0.5">
          {(
            [
              { id: 'data-access', label: 'Data Access' },
              { id: 'role', label: 'User Roles' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-green-500 text-white'
                  : 'text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          </div>
        ) : isError ? (
          <p className="py-4 text-center text-sm text-red-500">Failed to load users.</p>
        ) : (
          <>
            {activeTab === 'data-access' && <DataAccessSection users={users} />}
            {activeTab === 'role' && (
              <UserRoleSection users={users} currentAdminEmail={user?.email ?? ''} />
            )}
          </>
        )}
      </OGDialogContent>
    </OGDialog>
  );
};

export default UserManagement;
