'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Play, LayoutDashboard, FolderOpen, Settings,
  LogOut, Menu, X, ChevronRight, Bell, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/projects', icon: FolderOpen, label: 'My Projects' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, loadUser, logout, isLoading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().then(() => {
        if (!useAuthStore.getState().isAuthenticated) {
          router.push('/auth/login');
        }
      });
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    router.push('/auth/login');
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-glow-brand">
          <Play className="w-4 h-4 fill-white text-white" />
        </div>
        <span className="font-bold text-lg">EduVideo</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]',
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-surface-0 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-surface-50 border-r border-white/[0.06] shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-surface-50 flex flex-col z-50 lg:hidden border-r border-white/[0.06]"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-white/[0.06] flex items-center px-5 gap-4 bg-surface-0/80 backdrop-blur-md shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <button className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            <Bell className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-brand-600/30 flex items-center justify-center">
              <User className="w-3 h-3 text-brand-400" />
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name || 'User'}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
