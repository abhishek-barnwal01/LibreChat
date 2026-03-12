import { useState } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';
import {
  OGDialog,
  OGDialogTitle,
  OGDialogContent,
  OGDialogTrigger,
  useToastContext,
} from '@librechat/client';
import {
  useUpdateUserDataAccessMutation,
  useUpdateUserRoleMutation,
} from '~/data-provider/admin';
import { useAuthContext, useLocalize } from '~/hooks';

/** All available product categories for Azure AI Search filtering */
const PRODUCT_CATEGORIES = ['Soaps', 'Household Insecticides'];

/** All available countries for Azure AI Search filtering */
const COUNTRIES = ['India', 'Sri Lanka'];

/** A simple multi-select checkbox list */
function MultiCheckList({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="mb-4">
      <p className="mb-1 text-sm font-medium text-text-primary">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-surface-tertiary"
          >
            <input
              type="checkbox"
              className="accent-green-500"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Section: Data Access Management */
function DataAccessSection() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [email, setEmail] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [unrestricted, setUnrestricted] = useState(false);

  const { mutate, isLoading } = useUpdateUserDataAccessMutation({
    onSuccess: (data) => {
      showToast({ status: 'success', message: data.message });
      setEmail('');
      setCategories([]);
      setCountries([]);
      setUnrestricted(false);
    },
    onError: (err: any) => {
      showToast({
        status: 'error',
        message: err?.response?.data?.message ?? localize('com_ui_error_save_admin_settings'),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast({ status: 'warning', message: 'Please enter a user email.' });
      return;
    }
    mutate({
      email: email.trim(),
      dataAccess: unrestricted
        ? null
        : {
            productCategories: categories.length > 0 ? categories : null,
            countries: countries.length > 0 ? countries : null,
          },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-text-primary">User Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@company.com"
          className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
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
          <MultiCheckList
            label="Product Categories"
            options={PRODUCT_CATEGORIES}
            selected={categories}
            onChange={setCategories}
          />
          <MultiCheckList
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
          disabled={isLoading}
          className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-60"
        >
          {isLoading ? 'Saving…' : 'Save Data Access'}
        </button>
      </div>
    </form>
  );
}

/** Section: User Role Management */
function UserRoleSection() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>(SystemRoles.ADMIN);

  const { mutate, isLoading } = useUpdateUserRoleMutation({
    onSuccess: (data) => {
      showToast({ status: 'success', message: data.message });
      setEmail('');
    },
    onError: (err: any) => {
      showToast({
        status: 'error',
        message: err?.response?.data?.message ?? localize('com_ui_error_save_admin_settings'),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast({ status: 'warning', message: 'Please enter a user email.' });
      return;
    }
    mutate({ email: email.trim(), role });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-text-primary">User Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@company.com"
          className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text-primary">Role</label>
        <div className="flex gap-3">
          {[SystemRoles.ADMIN, SystemRoles.USER].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-1.5 text-sm text-text-primary">
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="accent-green-500"
              />
              {r}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-60"
        >
          {isLoading ? 'Saving…' : 'Update Role'}
        </button>
      </div>
    </form>
  );
}

/** Main admin panel dialog — only renders for ADMIN users */
const UserManagement = () => {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<'data-access' | 'role'>('data-access');

  if (user?.role !== SystemRoles.ADMIN) {
    return null;
  }

  return (
    <OGDialog>
      <OGDialogTrigger asChild>
        <button
          className="select-item flex w-full items-center gap-2 text-sm"
          aria-label="User Management"
        >
          <Users className="icon-md" aria-hidden="true" />
          User Management
        </button>
      </OGDialogTrigger>

      <OGDialogContent className="border-border-light bg-surface-primary text-text-primary w-full max-w-md">
        <OGDialogTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          Admin — User Management
        </OGDialogTitle>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border border-border-light p-0.5">
          {(
            [
              { id: 'data-access', label: 'Data Access' },
              { id: 'role', label: 'User Role' },
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

        {activeTab === 'data-access' && <DataAccessSection />}
        {activeTab === 'role' && <UserRoleSection />}
      </OGDialogContent>
    </OGDialog>
  );
};

export default UserManagement;
