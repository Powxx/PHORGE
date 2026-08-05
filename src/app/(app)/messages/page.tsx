"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { MessageCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MessagesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let channel: any = null;

    const fetchMatches = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.push('/login');
        return;
      }
      const userId = authData.user.id;

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
      if (!profile) return;

      const isApprenti = profile.role === 'apprenti';
      
      const { data: userMatches } = await supabase.from('matches')
        .select('*')
        .or(`apprenti_id.eq.${userId},patron_id.eq.${userId}`);

      if (userMatches) {
        const enrichedMatches = await Promise.all(userMatches.map(async (m) => {
          const otherId = isApprenti ? m.patron_id : m.apprenti_id;
          const table = isApprenti ? 'patrons_details' : 'apprentis_details';
          
          const { data: otherDetails } = await supabase.from(table).select('*').eq('profile_id', otherId).single();
          
          // Get last message text
          const { data: lastMsg } = await supabase.from('messages')
            .select('texte, created_at')
            .eq('match_id', m.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count: unreadCount } = await supabase.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', m.id)
            .neq('expediteur_id', userId)
            .eq('is_read', false);
          
          return {
            ...m,
            otherName: isApprenti ? otherDetails?.nom_entreprise : `${otherDetails?.prenom} ${otherDetails?.nom}`,
            otherPhoto: otherDetails?.photo_profil || (isApprenti ? "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=100" : "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=100"),
            lastMessage: lastMsg?.texte || "Mise en relation établie. Écrivez un message !",
            unreadCount: unreadCount || 0
          };
        }));
        setMatches(enrichedMatches);

        if (!channel && userMatches.length > 0) {
          channel = supabase.channel('conversations_list_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
              fetchMatches();
            })
            .subscribe();
        }
      }
      setLoading(false);
    };

    fetchMatches();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 pt-10">
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-3">
            <MessageCircle /> Conversations
          </h1>
          <Link href="/swipe" className="text-sm font-medium text-zinc-500 hover:text-[#D4AF37] flex items-center gap-1">
            Retour <ArrowLeft size={16} />
          </Link>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading && <p className="p-6 text-center text-zinc-500">Chargement...</p>}
            {!loading && matches.length === 0 && <p className="p-6 text-center text-zinc-500">Aucune conversation pour le moment. Allez swiper !</p>}
            
            {matches.map(m => (
              <Link key={m.id} href={`/chat/${m.id}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <img src={m.otherPhoto} alt={m.otherName} className="w-12 h-12 rounded-full object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{m.otherName}</h3>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded capitalize shrink-0">{m.statut.replace('_', ' ')}</span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${m.unreadCount > 0 ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-500'}`}>
                      {m.lastMessage}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {m.unreadCount > 0 && (
                    <span className="w-2.5 h-2.5 bg-[#D4AF37] rounded-full"></span>
                  )}
                  <ChevronRight className="text-zinc-400" size={20} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
