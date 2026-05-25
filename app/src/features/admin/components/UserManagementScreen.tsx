/*
 * Admin screen for viewing and managing user accounts (US42).
 * Lists all users from the user_profiles table via useUserManagement,
 * supports name-based search, and lets admins grant or revoke the admin
 * role with a two-tap confirmation flow to prevent accidental changes.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserManagement } from '../hooks/useUserManagement';
import type { AdminUser } from '../hooks/useUserManagement';

// Formats an ISO date to a short readable string
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface UserCardProps {
  user: AdminUser;
  onToggleAdmin: (userId: string, current: boolean) => Promise<boolean>;
}

// Individual user card with admin role toggle — US42
function UserCard({ user, onToggleAdmin }: UserCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = async () => {
    if (!showConfirm) {
      // First tap — ask for confirmation
      setShowConfirm(true);
      return;
    }
    // Second tap — confirmed, proceed
    setLoading(true);
    await onToggleAdmin(user.id, user.is_admin);
    setLoading(false);
    setShowConfirm(false);
  };

  const handleCancel = () => setShowConfirm(false);

  return (
    <div className="bg-eris-surface border border-eris-border/50 rounded-2xl p-4 flex flex-col gap-3">
      {/* User info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-eris-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-eris-primary text-xl">person</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">
              {user.first_name || t('admin.unknownUser', 'Unknown')} {user.last_name || ''}
            </p>
            {user.is_admin && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-eris-danger/10 text-eris-danger border border-eris-danger/30 flex-shrink-0">
                {t('admin.adminBadge', 'ADMIN')}
              </span>
            )}
          </div>
          <p className="text-eris-text-muted text-xs">
            {t('admin.joined', 'Joined ')} {formatDate(user.created_at)}
          </p>
        </div>
      </div>

      {/* Confirmation prompt or toggle button */}
      {showConfirm ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-eris-alert font-medium">
            {user.is_admin
              ? t('admin.revokePrompt', {
                  name: user.first_name,
                  defaultValue: `Revoke admin role from ${user.first_name}?`,
                })
              : t('admin.grantPrompt', {
                  name: user.first_name,
                  defaultValue: `Grant admin role to ${user.first_name}?`,
                })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 bg-eris-surface border border-eris-border/50 text-eris-text-muted text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`flex-1 text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50 ${
                user.is_admin
                  ? 'bg-eris-danger/10 border border-eris-danger/30 text-eris-danger'
                  : 'bg-eris-success/10 border border-eris-success/30 text-eris-success'
              }`}
            >
              {loading ? t('admin.saving', 'Saving...') : t('common.confirm', 'Confirm')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleToggle}
          className={`w-full text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform border ${
            user.is_admin
              ? 'bg-eris-danger/10 border-eris-danger/30 text-eris-danger'
              : 'bg-eris-surface border-eris-border/50 text-eris-text-muted'
          }`}
        >
          <span className="material-symbols-outlined text-sm align-middle mr-1">
            {user.is_admin ? 'remove_moderator' : 'add_moderator'}
          </span>
          {user.is_admin ? t('admin.revokeBtn', 'Revoke Admin') : t('admin.grantBtn', 'Grant Admin')}
        </button>
      )}
    </div>
  );
}

interface UserManagementScreenProps {
  onBack: () => void;
}

export default function UserManagementScreen({ onBack }: UserManagementScreenProps) {
  const { t } = useTranslation();
  const { users, loading, error, toggleAdminRole, refetch } = useUserManagement();
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => {
    const fullName = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const adminCount = users.filter((u) => u.is_admin).length;

  return (
    <div className="flex flex-col h-full w-full bg-eris-bg text-eris-text">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-eris-border/50">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-base">User Management</h2>
          <p className="text-eris-text-muted text-xs">
            {loading
              ? t('admin.loading', 'Loading...')
              : t('admin.usersStats', { total: users.length, adminCount: adminCount })}
          </p>
        </div>
        <button
          onClick={refetch}
          className="w-9 h-9 flex items-center justify-center bg-eris-surface rounded-full active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-xl">refresh</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="px-5 py-3 border-b border-eris-border/30">
        <div className="flex items-center gap-2 bg-eris-surface border border-eris-border/50 rounded-xl px-3 py-2">
          <span className="material-symbols-outlined text-eris-text-subtle text-lg">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchUsers', 'Search by name...')}
            className="flex-1 bg-transparent text-sm text-eris-text placeholder:text-eris-text-subtle outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-symbols-outlined text-eris-text-subtle text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-eris-text-subtle text-3xl">sync</span>
          </div>
        )}

        {error && (
          <div className="bg-eris-danger/10 border border-eris-danger/30 rounded-2xl p-4 text-eris-danger text-sm">
            {t('admin.errorUsers', 'Error loading users:')}
            {error}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-eris-text-subtle text-4xl">group_off</span>
            <p className="text-eris-text-muted text-sm">{t('admin.noUsers', 'No users found')}</p>
          </div>
        )}

        {filtered.map((user) => (
          <UserCard key={user.id} user={user} onToggleAdmin={toggleAdminRole} />
        ))}
      </div>
    </div>
  );
}
