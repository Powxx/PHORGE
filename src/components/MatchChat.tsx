"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Send, FileText, CheckCircle } from 'lucide-react';

export default function MatchChat({ matchId, currentUserId, userRole }: { matchId: string, currentUserId: string, userRole: 'apprenti' | 'patron' }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`chat_${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await supabase.from('messages').insert({
      match_id: matchId,
      expediteur_id: currentUserId,
      texte: newMessage
    });
    setNewMessage("");
  };

  const demanderEssai = async () => {
    await supabase.from('messages').insert({
      match_id: matchId,
      expediteur_id: currentUserId,
      texte: "📢 Le patron a fait une demande de période d'essai au CFA."
    });
    await supabase.from('matches').update({ statut: 'essai_demande' }).eq('id', matchId);
    alert("Demande envoyée au CFA !");
  };

  const declarerContrat = async () => {
    await supabase.from('messages').insert({
      match_id: matchId,
      expediteur_id: currentUserId,
      texte: "🎉 Le patron souhaite signer un contrat d'apprentissage !"
    });
    await supabase.from('matches').update({ statut: 'contrat_demande' }).eq('id', matchId);
    alert("Intention de contrat déclarée au CFA !");
  };

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {userRole === 'patron' && (
        <div className="bg-[#D4AF37]/10 p-3 flex gap-2 justify-center border-b border-[#D4AF37]/20">
          <button onClick={demanderEssai} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-[#D4AF37] text-[#D4AF37] rounded-lg text-sm font-medium hover:bg-[#D4AF37] hover:text-white transition-colors">
            <FileText size={16} /> Demander un essai
          </button>
          <button onClick={declarerContrat} className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37] text-white rounded-lg text-sm font-medium hover:bg-[#B8962E] transition-colors">
            <CheckCircle size={16} /> Intention de contrat
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isMe = msg.expediteur_id === currentUserId;
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                isMe ? 'bg-[#D4AF37] text-white rounded-br-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
              }`}>
                {msg.texte}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Écrivez un message..." 
          className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-[#D4AF37]/50 text-zinc-900 dark:text-zinc-100"
        />
        <button type="submit" className="p-2 rounded-full bg-[#D4AF37] text-white hover:bg-[#B8962E] transition-colors" disabled={!newMessage.trim()}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
