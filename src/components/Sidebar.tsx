"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, MessageCircle, User, ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let channel: any = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Admin check
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data?.role === 'admin_cfa') {
          setIsAdmin(true);
        } else {
          // Check unread status
          const checkUnread = async () => {
            const { data: myMatches } = await supabase.from('matches')
              .select('id')
              .or(`apprenti_id.eq.${user.id},patron_id.eq.${user.id}`);
            const ids = (myMatches || []).map(m => m.id);
            if (ids.length === 0) {
              setHasUnread(false);
              return;
            }

            const { count } = await supabase.from('messages')
              .select('*', { count: 'exact', head: true })
              .neq('expediteur_id', user.id)
              .eq('is_read', false)
              .in('match_id', ids);

            setHasUnread((count || 0) > 0);
          };

          await checkUnread();

          // Listen to changes on messages table to update sidebar dot
          channel = supabase.channel('sidebar_unread_messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
              checkUnread();
            })
            .subscribe();
        }
      }
      setIsReady(true);
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!isReady) return null;

  const links = [
    { href: '/swipe', label: 'Découverte', icon: Compass },
    { href: '/messages', label: 'Messages', icon: MessageCircle },
    { href: '/profil', label: 'Profil', icon: User },
  ];

  if (isAdmin) {
    links.push({ href: '/admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 z-50">
        <div className="mb-10 text-[#D4AF37] font-extrabold text-2xl tracking-tight text-center mt-4">
          PHORGE
        </div>
        
        <nav className="flex-1 space-y-4 mt-6">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const isMessages = link.href === '/messages';
            return (
              <Link key={link.href} href={link.href} className={`flex items-center justify-between p-4 rounded-2xl font-bold transition-all ${
                isActive ? 'bg-[#D4AF37] text-white shadow-lg shadow-[#D4AF37]/20' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white'
              }`}>
                <div className="flex items-center gap-4">
                  <link.icon size={24} />
                  <span>{link.label}</span>
                </div>
                {isMessages && hasUnread && (
                  <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-white' : 'bg-[#D4AF37]'} ring-2 ring-white dark:ring-zinc-950`}></span>
                )}
              </Link>
            );
          })}
        </nav>
        
        <button onClick={handleLogout} className="flex items-center justify-center gap-3 p-4 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-2xl font-bold transition-colors">
          <LogOut size={20} /> Déconnexion
        </button>
      </aside>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 z-50 px-6 py-3 flex justify-between items-center safe-area-bottom shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const isMessages = link.href === '/messages';
          return (
            <Link key={link.href} href={link.href} className={`relative flex flex-col items-center gap-1 p-2 transition-colors ${
              isActive ? 'text-[#D4AF37]' : 'text-zinc-400 hover:text-zinc-600'
            }`}>
              <link.icon size={24} className={isActive ? 'fill-current opacity-20' : ''} />
              <span className="text-[10px] font-bold">{link.label}</span>
              {isMessages && hasUnread && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#D4AF37] rounded-full ring-2 ring-white dark:ring-zinc-950"></span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
