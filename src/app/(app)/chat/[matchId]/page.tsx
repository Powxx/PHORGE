"use client";
import React, { useEffect, useState } from 'react';
import MatchChat from '@/components/MatchChat';
import { supabase } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ChatPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const router = useRouter();
  
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<'apprenti'|'patron'>('apprenti');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.push('/login');
        return;
      }
      setUserId(authData.user.id);
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
      if (profile) setUserRole(profile.role);
      
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6 text-zinc-500">Chargement...</div>;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6 flex flex-col">
      <div className="max-w-2xl mx-auto w-full mb-4">
        <Link href="/messages" className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#D4AF37] font-medium">
          <ArrowLeft size={20} /> Retour aux messages
        </Link>
      </div>
      <div className="flex-1 max-w-2xl mx-auto w-full h-[80vh]">
        <MatchChat matchId={matchId} currentUserId={userId} userRole={userRole} />
      </div>
    </main>
  );
}
