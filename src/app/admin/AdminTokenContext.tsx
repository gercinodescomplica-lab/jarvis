'use client';
import { createContext, useContext } from 'react';
export const AdminTokenContext = createContext<string>('');
export function AdminTokenProvider({ token, children }: { token: string; children: React.ReactNode }) {
  return <AdminTokenContext.Provider value={token}>{children}</AdminTokenContext.Provider>;
}
export function useAdminToken() { return useContext(AdminTokenContext); }
