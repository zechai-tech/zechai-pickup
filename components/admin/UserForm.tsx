'use client';

import React, { useState, useEffect } from 'react';
import { AppUser, Outlet, UserRole } from '@/types/supabase';
import { Button } from '@/components/ui/Button';
import { X, UserPlus, Key, Mail, ShieldAlert } from 'lucide-react';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit?: AppUser | null;
  outlets: Outlet[];
  currentUserRole: UserRole;
}

export function UserForm({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
  outlets,
  currentUserRole,
}: UserFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [outletId, setOutletId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name);
      setRole(userToEdit.role);
      setOutletId(userToEdit.outlet_id || '');
    } else {
      setName('');
      setRole('staff');
      setOutletId(outlets.length > 0 ? outlets[0].id : '');
    }
    setError('');
  }, [userToEdit, outlets, isOpen]);

  // Live auto-generated email & password per specification:
  // email: {name.toLowerCase().replaceAll(' ','')}zechai@gmail.com
  // password: {name.toLowerCase().replaceAll(' ','')}@zechai
  const cleanName = name.toLowerCase().replace(/\s+/g, '');
  const autoEmail = cleanName ? `${cleanName}zechai@gmail.com` : 'enter name first...';
  const autoPassword = cleanName ? `${cleanName}@zechai` : 'enter name first...';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (role !== 'admin' && !outletId) {
      setError('Outlet is required for this role');
      return;
    }

    setLoading(true);

    try {
      const url = '/api/admin/users';
      const method = userToEdit ? 'PUT' : 'POST';
      const body = {
        id: userToEdit?.id,
        name: name.trim(),
        role,
        outlet_id: role === 'admin' ? null : outletId,
      };

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
            className="w-8 h-8 rounded-full bg-sand/60 hover:bg-sand flex items-center justify-center text-espresso"
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
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Kumar"
              required
              className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
            />
          </div>

          {/* Auto-generated Email (Read only, live updating) */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-orange" />
              <span>Auto-Generated Email (Login ID)</span>
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

          {/* Auto-generated Password (Read only, live updating) */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-orange" />
              <span>Auto-Generated Password</span>
            </label>
            <input
              type="text"
              value={autoPassword}
              readOnly
              className="w-full h-11 px-3.5 rounded-xl bg-sand/60 border border-border text-xs font-bold text-espresso/80 cursor-not-allowed select-all"
            />
            <span className="text-[10px] text-espresso/50 mt-0.5 block">
              Format: {'{name}'}@zechai
            </span>
          </div>

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
              {currentUserRole === 'admin' && <option value="admin">Admin</option>}
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
              <option value="ordering_staff">Ordering Staff</option>
            </select>
          </div>

          {/* Outlet Dropdown (required for non-admin) */}
          {role !== 'admin' && (
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
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-border font-bold text-xs text-espresso hover:bg-sand/40"
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
