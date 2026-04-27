'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, BrainCircuit, FileText, BellRing, CalendarDays, Zap, BarChart2, ClipboardList, Mail, Cake } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/whitelist', label: 'Whitelist', icon: Users },
  { href: '/admin/memories', label: 'Memórias', icon: BrainCircuit },
  { href: '/admin/documents', label: 'Documentos', icon: FileText },
  { href: '/admin/reminders', label: 'Lembretes', icon: BellRing },
  { href: '/admin/agenda', label: 'Agenda Tiago', icon: CalendarDays },
  { href: '/admin/monitored-senders', label: 'Emails Monitorados', icon: Mail },
  { href: '/admin/birthday', label: 'Aniversários', icon: Cake },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/audit', label: 'Audit Log', icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border flex flex-col py-6 px-4 gap-2 bg-card">
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="bg-primary/20 text-primary p-2 rounded-xl">
          <Zap size={20} className="fill-primary" />
        </div>
        <div className="text-xl font-bold tracking-tight">Jarvis Admin</div>
      </div>
      
      <div className="flex flex-col gap-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-primary text-primary-foreground shadow-sm scale-[0.98]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <item.icon size={18} className={isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
