"use client";

import Sidebar from '@/components/Sidebar';
import PushNotifications from '@/components/PushNotifications';
import { usePathname } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith('/chat/');

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <PushNotifications />
      <div className={`flex-1 md:pl-64 ${isChatPage ? 'pb-0' : 'pb-20 md:pb-0'}`}>
        {children}
      </div>
    </div>
  );
}
