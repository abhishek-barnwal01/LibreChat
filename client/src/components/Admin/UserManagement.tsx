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
import type { AdminUser } from '~/data-provider/admin';
import { useAuthContext, useLocalize } from '~/hooks';

const PRODUCT_CATEGORIES = ['Soaps', 'Household Insecticides'];
const COUNTRIES = ['India', 'Sri Lanka'];
const ROLES = [SystemRoles.USER, SystemRoles.ADMIN];

// ---------------------------------------------------------------------------
// Searchable single-select user dropdown
// ---------------------------------------------------------------------------
function UserSelectDropdown({
  users,
  value,
  onChange,
}: {
  users: AdminUser[];
  value: string;
  onChange: (email: string) => void;
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
        className="flex w-full items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-4 py-2.5 text-sm text-text-primary transition hover:bg-surface-tertiary"
      >
        <span className={selected ? 'text-text-primary' : 'text-text-secondary'}>
          {selected
            ? `${selected.email}${selected.name ? ` (${selected.name})` : ''}`
            : 'Select a user…'}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-light bg-surface-primary shadow-xl">
          <div className="p-2">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name…"
              className="w-full rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-text-secondary">No users found</li>
            ) : (
              filtered.map((u) => (
                <li
                  key={u._id}
                  onClick={() => {
                    onChange(u.email);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-tertiary"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {u.email === value && <Check className="h-4 w-4 text-green-500" />}
                  </div>
                  <div>
                    <div className="text-text-primary">{u.email}</div>
                    {u.name && <div className="text-xs text-text-secondary">{u.name}</div>}
                  </div>
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

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  const displayText =
    selected.length === 0
      ? `Select ${label}…`
      : selected.length === options.length
        ? `All ${label}`
        : selected.join(', ');

  return (
    <div ref={ref} className="relative w-full">
      <label className="mb-1.5 block text-sm font-medium text-text-primary">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-lg border border-border-light bg-surface-secondary px-4 py-2.5 text-sm transition hover:bg-surface-tertiary"
      >
        <span className={selected.length ? 'text-text-primary' : 'text-text-secondary'}>
          {displayText}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-light bg-surface-primary shadow-xl">
          <ul className="py-1.5">
            {options.map((opt) => (
              <li
                key={opt}
                onClick={() => toggle(opt)}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-tertiary"
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
                <span className="text-text-primary">{opt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline role picker (custom dropdown, no native <select>)
// ---------------------------------------------------------------------------
function RolePicker({
  user,
  currentAdminEmail,
}: {
  user: AdminUser;
  currentAdminEmail: string;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isSelf = user.email === currentAdminEmail;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((p) => !p);
  };

  const { mutate, isLoading } = useUpdateUserRoleMutation({
    onSuccess: (data) => showToast({ status: 'success', message: data.message }),
    onError: (err: any) =>
      showToast({
        status: 'error',
        message: err?.response?.data?.message ?? localize('com_ui_error_save_admin_settings'),
      }),
  });

  const badgeBase = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold';
  const adminClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  const userClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  const currentClass = user.role === SystemRoles.ADMIN ? adminClass : userClass;

  if (isSelf) {
    return (
      <span className={`${badgeBase} ${currentClass}`}>
        {user.role}
        <span className="opacity-60">(you)</span>
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={isLoading}
        onClick={handleToggle}
        className={`${badgeBase} ${currentClass} cursor-pointer transition hover:opacity-80 disabled:opacity-50`}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            {user.role}
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {open && dropdownStyle && (
        <div
          className="fixed z-[200] w-32 rounded-lg border border-border-light bg-surface-primary shadow-xl"
          style={{ top: dropdownStyle.top, right: dropdownStyle.right }}
        >
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setOpen(false);
                if (r !== user.role) mutate({ email: user.email, role: r });
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary ${
                r === user.role ? 'font-semibold text-green-600' : 'text-text-primary'
              }`}
            >
              <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                {r === user.role && <Check className="h-3.5 w-3.5 text-green-500" />}
              </div>
              {r}
            </button>
          ))}
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

  const handleSelectUser = (email: string) => {
    setSelectedEmail(email);
    const u = users.find((x) => x.email === email);
    if (!u) return;
    if (u.dataAccess == null) {
      setUnrestricted(true);
      setCategories([]);
      setCountries([]);
    } else {
      setUnrestricted(false);
      setCategories(u.dataAccess.productCategories ?? []);
      setCountries(u.dataAccess.countries ?? []);
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text-primary">User</label>
        <UserSelectDropdown users={users} value={selectedEmail} onChange={handleSelectUser} />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border-light px-4 py-3 text-sm text-text-primary transition hover:bg-surface-secondary">
        <input
          type="checkbox"
          className="h-4 w-4 accent-green-500"
          checked={unrestricted}
          onChange={(e) => setUnrestricted(e.target.checked)}
        />
        <span>Unrestricted access — remove all data filters</span>
      </label>

      {!unrestricted && (
        <div className="space-y-4">
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
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isLoading || !selectedEmail}
          className="rounded-lg bg-green-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Saving…' : 'Save Data Access'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// User Role tab
// ---------------------------------------------------------------------------
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

  const sorted = [...filtered].sort((a, b) => {
    if (a.role === SystemRoles.ADMIN && b.role !== SystemRoles.ADMIN) return -1;
    if (a.role !== SystemRoles.ADMIN && b.role === SystemRoles.ADMIN) return 1;
    return a.email.localeCompare(b.email);
  });

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users…"
        className="w-full rounded-lg border border-border-light bg-surface-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500"
      />

      <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-border-light">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">No users found</p>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-surface-secondary">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  User
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr
                  key={u._id}
                  className="border-t border-border-light transition hover:bg-surface-secondary"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-text-primary">{u.email}</div>
                    {u.name && <div className="text-xs text-text-secondary">{u.name}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RolePicker user={u} currentAdminEmail={currentAdminEmail} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-text-secondary">
        {users.filter((u) => u.role === SystemRoles.ADMIN).length} admin(s) ·{' '}
        {users.filter((u) => u.role !== SystemRoles.ADMIN).length} regular user(s)
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

  if (user?.role !== SystemRoles.ADMIN) return null;

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

      <OGDialogContent className="border-border-light bg-surface-primary text-text-primary w-full max-w-3xl p-8">
        <OGDialogTitle className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          Admin — User Management
        </OGDialogTitle>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-border-light p-1">
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
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface-tertiary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-green-500" />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-red-500">Failed to load users.</p>
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
