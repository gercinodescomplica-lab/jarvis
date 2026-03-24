import { AdminTokenProvider } from './AdminTokenContext';
import { Sidebar } from './sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = process.env.ADMIN_TOKEN ?? '';
  return (
    <AdminTokenProvider token={token}>
      <div className="flex min-h-screen bg-muted/20 text-foreground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="w-full max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AdminTokenProvider>
  );
}
