import { Search, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { cn } from '~/utils';
import AccountSettings from './AccountSettings';

interface TopNavigationProps {
  onNewQuery?: () => void;
}

const TopNavigation = memo(({ onNewQuery }: TopNavigationProps) => {
  const navItems = [
    { label: 'Know Us', href: '#' },
    { label: 'Brands', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Sustainability', href: '#' },
    { label: 'Investors', href: '#' },
    { label: 'Media', href: '#' },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 items-center justify-between px-6">
        {/* Left: Logo */}
        <div className="flex items-center">
          <img
            alt="Godrej Consumer Products"
            className="h-10 w-auto"
            src="https://customer-assets.emergentagent.com/job_cmi-assistant/artifacts/u2rv5syb_image.png"
          />
        </div>

        {/* Center: Navigation Links */}
        <div className="hidden items-center gap-10 md:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-gray-700 transition-colors hover:text-gray-900"
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Right: Quick Search, New Query, and Profile */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Quick Search</span>
          </button>

          <button
            type="button"
            onClick={onNewQuery}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-purple-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            <span>New Query</span>
          </button>

          {/* User Profile Menu */}
          <AccountSettings />
        </div>
      </div>
    </nav>
  );
});

TopNavigation.displayName = 'TopNavigation';

export default TopNavigation;
