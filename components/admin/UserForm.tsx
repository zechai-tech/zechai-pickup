'use client';

import React, { useState, useEffect } from 'react';
import { AppUser, Outlet, UserRole } from '@/types/supabase';
import { useAdminStore } from '@/stores/admin-store';
import { Button } from '@/components/ui/Button';
import { X, UserPlus, Key, Mail, ShieldAlert, Eye, EyeOff } from 'lucide-react';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit?: AppUser | null;
  outlets: Outlet[];
  currentUserRole?: UserRole;
  defaultOutletId?: string | null;
}

export function UserForm({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
  outlets,
  currentUserRole,
  defaultOutletId,
}: UserFormProps) {
  const { currentUser } = useAdminStore();
  const activeRole: UserRole = currentUser?.role || currentUserRole || 'staff';
  const isAdmin = activeRole === 'admin';
  const isManager = activeRole === 'manager';
  const managerOutletId = currentUser?.outlet_id || defaultOutletId || '';
  const managerOutletName =
    currentUser?.outlet?.name ||
    currentUser?.outlet_name ||
    outlets.find((o) => o.id === managerOutletId)?.name ||
    'Assigned Outlet';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCustomPassword, setIsCustomPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('staff');
  const [outletId, setOutletId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setRole(userToEdit.role);
      setOutletId(userToEdit.outlet_id || managerOutletId || '');
      setPassword('');
      setIsCustomPassword(false);
    } else {
      setName('');
      setPassword('');
      setIsCustomPassword(false);
      setRole('staff');
      setOutletId(managerOutletId || (outlets.length > 0 ? outlets[0].id : ''));
    }
    setError('');
    setShowPassword(false);
  }, [userToEdit, outlets, isOpen, managerOutletId]);

  // Live auto-generated email & password per specification:
  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  const autoEmail = cleanName ? `${cleanName}zechai@gmail.com` : 'enter name first...';
  const autoPasswordPattern = cleanName ? `${cleanName}@zechai` : '{name}@zechai';

  // Auto-populate password field if admin hasn't customized it
  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!isCustomPassword && !userToEdit) {
      const cName = newName.toLowerCase().replace(/\s+/g, '');
      setPassword(cName ? `${cName}@zechai` : '');
    }
  };

  const handlePasswordChange = (newPwd: string) => {
    setPassword(newPwd);
    setIsCustomPassword(true);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!userToEdit && !password.trim()) {
      setError('Password is required');
      return;
    }

    const effectiveOutletId = isAdmin
      ? role === 'admin'
        ? null
        : outletId
      : managerOutletId;

    if (role !== 'admin' && !effectiveOutletId) {
      setError('Assigned outlet is required for this role');
      return;
    }

    setLoading(true);

    try {
      const url = '/api/admin/users';
      const method = userToEdit ? 'PUT' : 'POST';
      const body: any = {
        id: userToEdit?.id,
        name: name.trim(),
        role,
        outlet_id: effectiveOutletId,
        caller_role: activeRole,
        caller_outlet_id: managerOutletId,
      };

      if (!userToEdit) {
        body.password = password.trim();
        body.email = `${cleanName}zechai@gmail.com`;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save user');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs">
      <div className="bg-card w-full max-w-md rounded-[28px] border border-border shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/70 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange/15 text-orange-dark flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-espresso">
                {userToEdit ? 'Edit User' : 'Add New User'}
              </h3>
              <p className="text-xs text-espresso/60">Manage credentials & roles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-sand/60 hover:bg-sand flex items-center justify-center text-espresso transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FDF0F0] border border-brandRed/20 text-brandRed text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Rahul Kumar"
              required
              className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
            />
          </div>

          {/* Auto-generated Email (Read only, live updating) */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-orange" />
              <span>Email Address (Login ID)</span>
            </label>
            <input
              type="text"
              value={autoEmail}
              readOnly
              className="w-full h-11 px-3.5 rounded-xl bg-sand/60 border border-border text-xs font-bold text-espresso/80 cursor-not-allowed select-all"
            />
            <span className="text-[10px] text-espresso/50 mt-0.5 block">
              Format: {'{name}'}zechai@gmail.com
            </span>
          </div>

          {/* Password Field (when creating new user) */}
          {!userToEdit ? (
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange" />
                <span>Initial Password *</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  placeholder="Set login password"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#75604F] hover:text-espresso transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[11px] text-[#75604F] mt-1 block font-medium">
                Default pattern: {autoPasswordPattern}
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-sand/30 border border-border text-xs text-espresso/70">
              <span className="font-bold text-espresso block mb-0.5">Password Management</span>
              Use the Key icon on the user row in the list to reset this user's password.
            </div>
          )}

          {/* Role Dropdown */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-xs font-bold text-espresso focus:outline-none focus:border-orange"
            >
              {isAdmin && <option value="admin">Admin</option>}
              {isAdmin && <option value="manager">Manager</option>}
              <option value="staff">Staff</option>
              <option value="ordering_staff">Ordering Staff</option>
            </select>
          </div>

          {/* Outlet Selector (Admin can select any outlet; Manager is locked to their outlet) */}
          {isAdmin ? (
            role !== 'admin' && (
              <div>
                <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                  Assigned Outlet *
                </label>
                <select
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-xs font-bold text-espresso focus:outline-none focus:border-orange"
                >
                  <option value="">Select an outlet</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Assigned Outlet
              </label>
              <div className="w-full h-11 px-3.5 rounded-xl bg-sand/60 border border-border text-xs font-bold text-espresso/80 flex items-center cursor-not-allowed">
                Outlet: {managerOutletName}
              </div>
              <span className="text-[10px] text-espresso/50 mt-0.5 block">
                Managers can only assign team members to their own outlet.
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-border font-bold text-xs text-espresso hover:bg-sand/40 transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" isLoading={loading} className="h-11 px-6 text-sm font-bold shadow-orange">
              {userToEdit ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
