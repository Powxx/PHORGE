import Sidebar from '@/components/Sidebar';
import PushNotifications from '@/components/PushNotifications';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <PushNotifications />
      <div className="flex-1 md:pl-64 pb-20 md:pb-0">
        {children}
      </div>
    </div>
  );
}
