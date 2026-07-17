"use client";
import React, { useState } from 'react';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';
import { Heart, X, Star, Info, MessageCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export type ProfileCard = {
  id: string;
  nom: string;
  photo: string;
  sousTitre: string;
  description?: string;
  tags: string[];
  details?: Record<string, any>;
};

export default function SwipeDeck({ profiles, currentUserId }: { profiles: ProfileCard[], currentUserId?: string }) {
  const [cards, setCards] = useState(profiles);
  const [selectedProfile, setSelectedProfile] = useState<ProfileCard | null>(null);
  const [matchData, setMatchData] = useState<{ id: string, nom: string } | null>(null);
  
  const controls = useAnimation();
  const router = useRouter();

  const handleSwipeAction = async (cardId: string, type: 'like' | 'dislike' | 'superlike') => {
    const swipedCard = cards.find(c => c.id === cardId);
    setCards(prev => prev.filter(c => c.id !== cardId));
    controls.set({ x: 0, opacity: 1 });

    if (!currentUserId) return;

    await supabase.from('swipes').insert({
      de_profile_id: currentUserId,
      vers_profile_id: cardId,
      type: type
    });

    if (type === 'like' || type === 'superlike') {
      const { data: matchCheck } = await supabase.from('swipes')
        .select('*')
        .eq('de_profile_id', cardId)
        .eq('vers_profile_id', currentUserId)
        .in('type', ['like', 'superlike'])
        .single();
        
      if (matchCheck) {
        // IT'S A MATCH
        const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', currentUserId).single();
        const apprenti_id = myProfile?.role === 'apprenti' ? currentUserId : cardId;
        const patron_id = myProfile?.role === 'patron' ? currentUserId : cardId;

        const { data: newMatch } = await supabase.from('matches').insert({
          apprenti_id,
          patron_id
        }).select().single();

        if (newMatch) {
          // Premier message automatique
          await supabase.from('messages').insert({
            match_id: newMatch.id,
            expediteur_id: currentUserId,
            texte: "Mise en relation établie. Vous pouvez maintenant échanger."
          });
          
          setMatchData({ id: newMatch.id, nom: swipedCard?.nom || "Nouveau Match" });
        }
      }
    }
  };

  const handleDragEnd = async (event: any, info: PanInfo, cardId: string) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
      handleSwipeAction(cardId, 'like');
    } else if (info.offset.x < -threshold) {
      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
      handleSwipeAction(cardId, 'dislike');
    } else {
      controls.start({ x: 0, opacity: 1 });
    }
  };

  return (
    <>
      <div className="relative w-full h-[600px] max-w-sm mx-auto flex items-center justify-center">
        {cards.length === 0 && <div className="text-zinc-500 dark:text-zinc-400 text-center font-medium">Plus aucun profil disponible dans votre domaine. Revenez plus tard !</div>}
        
        {cards.map((card, index) => {
          const isFront = index === 0;
          if (index > 2) return null;
          
          return (
            <motion.div
              key={card.id}
              className="absolute w-full h-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col"
              style={{
                zIndex: cards.length - index,
                scale: 1 - index * 0.05,
                y: index * 10
              }}
              drag={isFront ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(e, info) => isFront && handleDragEnd(e, info, card.id)}
              animate={isFront ? controls : undefined}
            >
              <div className="relative w-full flex-grow bg-zinc-200 dark:bg-zinc-800">
                <img src={card.photo} alt={card.nom} className="object-cover w-full h-full pointer-events-none" />
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 text-white pb-10">
                  <div className="flex justify-between items-end">
                    <div>
                      <h2 className="text-3xl font-bold">{card.nom}</h2>
                      <p className="text-lg opacity-90">{card.sousTitre}</p>
                      {card.description && <p className="text-sm opacity-80 mt-2 line-clamp-3 italic">"{card.description}"</p>}
                    </div>
                    <button 
                      onClick={() => setSelectedProfile(card)}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors backdrop-blur-sm"
                    >
                      <Info size={24} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900 flex flex-col gap-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-wrap gap-2">
                  {card.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-xs font-semibold tracking-wide">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex justify-evenly items-center pt-2">
                  <button className="p-4 rounded-full bg-white dark:bg-zinc-800 shadow-lg text-red-500 hover:scale-110 transition-transform"
                    onClick={async () => {
                      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
                      handleSwipeAction(card.id, 'dislike');
                    }}>
                    <X size={28} />
                  </button>
                  <button className="p-3 rounded-full bg-white dark:bg-zinc-800 shadow-lg text-blue-400 hover:scale-110 transition-transform"
                    onClick={async () => {
                      await controls.start({ y: -500, opacity: 0, transition: { duration: 0.2 } });
                      handleSwipeAction(card.id, 'superlike');
                    }}>
                    <Star size={20} />
                  </button>
                  <button className="p-4 rounded-full bg-white dark:bg-zinc-800 shadow-lg text-green-500 hover:scale-110 transition-transform"
                    onClick={async () => {
                      await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
                      handleSwipeAction(card.id, 'like');
                    }}>
                    <Heart size={28} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Profile Details Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedProfile(null)}
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="h-64 relative shrink-0">
                <img src={selectedProfile.photo} className="w-full h-full object-cover" />
                <button onClick={() => setSelectedProfile(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <h2 className="text-3xl font-bold mb-1">{selectedProfile.nom}</h2>
                <p className="text-[#D4AF37] font-medium text-lg mb-6">{selectedProfile.sousTitre}</p>
                
                <div className="space-y-4">
                  {selectedProfile.details && Object.entries(selectedProfile.details).map(([key, value]) => (
                    value && (
                      <div key={key} className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <p className="text-sm text-zinc-500 capitalize mb-1">{key}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match Modal */}
      <AnimatePresence>
        {matchData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl border border-[#D4AF37]/30"
            >
              <div className="w-20 h-20 bg-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart size={40} className="text-[#D4AF37] fill-[#D4AF37]" />
              </div>
              <h2 className="text-3xl font-extrabold mb-2">Match !</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-8">Vous et <span className="font-bold text-zinc-900 dark:text-zinc-100">{matchData.nom}</span> êtes intéressés.</p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => router.push(`/chat/${matchData.id}`)}
                  className="w-full py-4 rounded-xl bg-[#D4AF37] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#B8962E] transition-colors"
                >
                  <MessageCircle size={20} /> Lancer la discussion
                </button>
                <button 
                  onClick={() => setMatchData(null)}
                  className="w-full py-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Continuer à swiper
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
