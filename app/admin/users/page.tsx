'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { AppUser, Outlet } from '@/types/supabase';
import { UserForm } from '@/components/admin/UserForm';
import { Button } from '@/components/ui/Button';
import {
  UserPlus,
  Edit2,
  Power,
  Trash2,
  Mail,
  Users,
  AlertTriangle,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const { currentUser } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<AppUser[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset password modal state
  const [userToReset, setUserToReset] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const fetchUsers = useCallback(async () => {
    try {
      const outletParam = !isAdmin && currentUser?.outlet_id ? `?outlet_id=${currentUser.outlet_id}` : '';
      const res = await fetch(`/api/admin/users${outletParam}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.outlet_id, isAdmin]);

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outlets');
      const data = await res.json();
      setOutlets(data.outlets || []);
    } catch (e) {
      console.error('Error fetching outlets:', e);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchOutlets();
  }, [fetchUsers, fetchOutlets]);

  // Handle Auth Migration for existing users (hadi, athif, etc.)
  const handleMigrateAuth = async () => {
    setIsMigrating(true);
    try {
      const res = await fetch('/api/admin/migrate-auth', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(
          'success',
          data.message || `Migrated ${data.migratedCount || 0} users to Supabase Auth!`
        );
        setMigrationDone(true);
        fetchUsers();
      } else {
        showToast('error', data.error || 'Failed to migrate users to Auth');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error executing migration');
    } finally {
      setIsMigrating(false);
    }
  };

  // Activate / Deactivate Toggle
  const handleToggleActive = async (user: AppUser) => {
    try {
      const nextActive = !user.is_active;
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          is_active: nextActive,
        }),
      });
      if (res.ok) {
        showToast('success', `${user.name} is now ${nextActive ? 'Active' : 'Inactive'}`);
        fetchUsers();
      } else {
        const d = await res.json();
        showToast('error', d.error || 'Failed to update user status');
      }
    } catch (e) {
      console.error('Error toggling user status:', e);
      showToast('error', 'Network error');
    }
  };

  // Delete User from Supabase Auth + Database
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', `Deleted user ${userToDelete.name} and auth account`);
        setUserToDelete(null);
        fetchUsers();
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to delete user');
      }
    } catch (e) {
      console.error('Error deleting user:', e);
      showToast('error', 'Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset Password for User
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset || !newPassword.trim()) return;

    setIsResetting(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userToReset.id,
          password: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('success', `Password for ${userToReset.name} reset successfully!`);
        setUserToReset(null);
        setNewPassword('');
      } else {
        showToast('error', data.error || 'Failed to reset password');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error resetting password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleOpenAdd = () => {
    setUserToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setUserToEdit(user);
    setIsModalOpen(true);
  };

  const handleOpenResetPassword = (user: AppUser) => {
    setUserToReset(user);
    const cleanName = user.name.toLowerCase().replace(/\s+/g, '');
    setNewPassword(`${cleanName}@zechai`);
    setShowResetPassword(false);
  };

  const roleBadges: Record<string, string> = {
    admin: 'bg-orange/15 text-orange-dark border-orange/30',
    manager: 'bg-mustard/20 text-[#7D5A00] border-mustard/40',
    staff: 'bg-[#EBF7EE] text-brandGreen border-brandGreen/30',
    ordering_staff: 'bg-sand text-espresso border-border',
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Feedback */}
        {toast && (
          <div
            className={cn(
              'fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top duration-200',
              toast.type === 'success'
                ? 'bg-[#EBF7EE] border-brandGreen/30 text-brandGreen'
                : 'bg-[#FDF0F0] border-brandRed/30 text-brandRed'
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 rounded-full hover:bg-black/5 text-espresso/50"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
              Users & Staff Accounts
            </h1>
            <p className="text-xs text-espresso/60 mt-0.5">
              {isAdmin
                ? 'Manage credentials and branch access across all outlets'
                : `Managing staff accounts for ${currentUser?.outlet?.name || 'your outlet'}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {/* Migration Button (Admin only, hidden if already migrated) */}
            {isAdmin && !migrationDone && (
              <button
                type="button"
                onClick={handleMigrateAuth}
                disabled={isMigrating}
                className="h-11 px-4 rounded-full bg-sand hover:bg-sand/80 border border-border text-espresso font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                title="Create Supabase Auth accounts for existing users (like hadi & athif)"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange" />
                <span>{isMigrating ? 'Migrating Auth...' : 'Migrate Existing Users to Auth'}</span>
              </button>
            )}

            <Button
              onClick={handleOpenAdd}
              className="h-11 px-5 text-sm font-bold shadow-orange"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              <span>Add User</span>
            </Button>
          </div>
        </div>

        {/* Content View: Desktop Data Table / Mobile Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Users className="w-12 h-12 text-espresso/30 mx-auto mb-3" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">No users found</h3>
            <p className="text-xs text-espresso/60 max-w-xs mx-auto mb-4">
              Add managers, kitchen staff, or order-taking team members.
            </p>
            <Button onClick={handleOpenAdd} className="h-10 px-5 text-xs font-bold shadow-orange">
              <UserPlus className="w-4 h-4 mr-2" />
              <span>Add First User</span>
            </Button>
          </div>
        ) : (
          <>
            {/* 1. Desktop Table */}
            <div className="hidden md:block bg-card rounded-[24px] border border-border shadow-xs overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-sand/30 border-b border-border/80 text-[11px] font-black uppercase tracking-wider text-espresso/60">
                    <th className="py-3.5 px-5">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Assigned Branch</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-sand/20 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-espresso flex items-center gap-2">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-sand px-2 py-0.5 rounded-full font-bold text-espresso/70">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-espresso/60 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-orange" />
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              'text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                              roleBadges[u.role] || 'bg-sand text-espresso'
                            )}
                          >
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-semibold text-espresso">
                            {u.outlet_name || (u.role === 'admin' ? 'All Outlets (Global)' : 'Unassigned')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brandGreen">
                              <span className="w-2 h-2 rounded-full bg-brandGreen" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brandRed">
                              <span className="w-2 h-2 rounded-full bg-brandRed" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1.5">
                          {/* 1. Edit */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-2 rounded-xl hover:bg-sand/60 text-espresso/70 hover:text-espresso transition-colors"
                            title="Edit user details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* 2. Reset Password */}
                          <button
                            onClick={() => handleOpenResetPassword(u)}
                            className="p-2 rounded-xl hover:bg-mustard/20 text-espresso/70 hover:text-[#8B6400] transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* 3. Activate / Deactivate Toggle */}
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={cn(
                              'p-2 rounded-xl transition-colors',
                              u.is_active
                                ? 'text-brandGreen hover:bg-[#EBF7EE]'
                                : 'text-brandRed hover:bg-[#FDF0F0]'
                            )}
                            title={u.is_active ? 'Click to deactivate user' : 'Click to activate user'}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {/* 4. Delete Button (Cannot delete self) */}
                          {isSelf ? (
                            <span
                              className="inline-block p-2 text-espresso/20 cursor-not-allowed"
                              title="You cannot delete your own account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="p-2 rounded-xl hover:bg-[#FDF0F0] text-espresso/50 hover:text-brandRed transition-colors"
                              title="Delete user and auth account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. Mobile Cards Grid */}
            <div className="md:hidden space-y-3">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div key={u.id} className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-espresso">{u.name}</h3>
                          {isSelf && (
                            <span className="text-[9px] bg-sand px-1.5 py-0.2 rounded-full font-bold text-espresso/70">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-espresso/60 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-orange" />
                          <span>{u.email}</span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border',
                          roleBadges[u.role] || 'bg-sand text-espresso'
                        )}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="text-espresso/70 font-medium">
                          {u.outlet_name || (u.role === 'admin' ? 'Global Access' : 'No Outlet')}
                        </span>
                        {u.is_active ? (
                          <span className="text-[10px] font-bold text-brandGreen">· Active</span>
                        ) : (
                          <span className="text-[10px] font-bold text-brandRed">· Inactive</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-2 py-1 rounded-lg bg-sand/40 hover:bg-sand text-xs font-bold text-espresso"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          className="p-1.5 rounded-lg border border-border text-espresso/70 hover:bg-mustard/20 hover:text-[#8B6400] transition-colors"
                          title="Reset password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={cn(
                            'p-1.5 rounded-lg border text-xs font-bold transition-colors',
                            u.is_active
                              ? 'border-brandGreen/30 text-brandGreen hover:bg-[#EBF7EE]'
                              : 'border-brandRed/30 text-brandRed hover:bg-[#FDF0F0]'
                          )}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        {isSelf ? (
                          <span className="p-1.5 text-espresso/20 cursor-not-allowed">
                            <Trash2 className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 rounded-lg border border-border text-espresso/50 hover:text-brandRed hover:bg-[#FDF0F0] transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* User Modal */}
        <UserForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchUsers}
          userToEdit={userToEdit}
          outlets={outlets}
          currentUserRole={currentUser?.role || 'staff'}
        />

        {/* Reset Password Modal */}
        {userToReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-card rounded-[28px] border border-border shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-4">
                <div className="flex items-center gap-2.5 text-espresso font-bold text-base">
                  <div className="w-9 h-9 rounded-xl bg-mustard/20 flex items-center justify-center text-[#8B6400]">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <span>Reset Password for {userToReset.name}</span>
                </div>
                <button
                  onClick={() => setUserToReset(null)}
                  className="p-1.5 rounded-full hover:bg-sand/60 text-espresso/60 hover:text-espresso transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange" />
                    <span>New Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter new password"
                      className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#75604F] hover:text-espresso transition-colors cursor-pointer"
                      title={showResetPassword ? 'Hide password' : 'Show password'}
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-[#75604F] mt-1 block font-medium">
                    Recommended pattern: {userToReset.name.toLowerCase().replace(/\s+/g, '')}@zechai
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setUserToReset(null)}
                    disabled={isResetting}
                    className="px-5 py-2.5 rounded-full bg-sand text-espresso font-bold text-xs hover:bg-sand/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    isLoading={isResetting}
                    className="h-10 px-5 text-xs font-bold shadow-orange"
                  >
                    Reset Password
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-card rounded-[28px] border border-border shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-4">
                <div className="flex items-center gap-2 text-brandRed font-bold text-base">
                  <div className="w-9 h-9 rounded-xl bg-[#FDF0F0] flex items-center justify-center text-brandRed">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span>Delete User</span>
                </div>
                <button
                  onClick={() => setUserToDelete(null)}
                  className="p-1.5 rounded-full hover:bg-sand/60 text-espresso/60 hover:text-espresso transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-espresso/80 leading-relaxed mb-6 font-medium">
                Are you sure you want to delete user <strong className="text-espresso font-bold">{userToDelete.name}</strong>? This will also remove their Supabase Auth account.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-full bg-sand text-espresso font-bold text-xs hover:bg-sand/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-full bg-brandRed text-white font-bold text-xs hover:bg-[#9B1515] transition-colors shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
