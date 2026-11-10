'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { AppUser, Outlet } from '@/types/supabase';
import { UserForm } from '@/components/admin/UserForm';
import { Button } from '@/components/ui/Button';
import { UserPlus, Edit2, Power, Trash2, Mail, Users, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const { currentUser } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<AppUser[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        fetchUsers();
      }
    } catch (e) {
      console.error('Error toggling user status:', e);
    }
  };

  // Delete User from Supabase Auth + Database
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?id=${userToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setUserToDelete(null);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (e) {
      console.error('Error deleting user:', e);
    } finally {
      setIsDeleting(false);
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

  const roleBadges: Record<string, string> = {
    admin: 'bg-orange/15 text-orange-dark border-orange/30',
    manager: 'bg-mustard/20 text-[#7D5A00] border-mustard/40',
    staff: 'bg-[#EBF7EE] text-brandGreen border-brandGreen/30',
    ordering_staff: 'bg-sand text-espresso border-border',
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-7xl mx-auto">
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

          <Button
            onClick={handleOpenAdd}
            className="h-11 px-5 text-sm font-bold shadow-orange self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            <span>Add User</span>
          </Button>
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
                            title="Edit user"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* 2. Activate / Deactivate Toggle */}
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

                          {/* 3. Delete Button (Cannot delete self) */}
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
                          className="px-2.5 py-1.5 rounded-lg bg-sand/40 hover:bg-sand text-xs font-bold text-espresso"
                        >
                          Edit
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