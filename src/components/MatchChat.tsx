"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Send, FileText, CheckCircle } from 'lucide-react';

export default function MatchChat({ matchId, currentUserId, userRole }: { matchId: string, currentUserId: string, userRole: 'apprenti' | 'patron' }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState<string>("Quelqu'un");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecipient = async () => {
      const { data } = await supabase
        .from('matches')
        .select('apprenti_id, patron_id')
        .eq('id', matchId)
        .single();
      if (data) {
        const otherId = data.apprenti_id === currentUserId ? data.patron_id : data.apprenti_id;
        setRecipientId(otherId);
      }
    };
    fetchRecipient();
  }, [matchId, currentUserId]);

  useEffect(() => {
    const fetchSenderName = async () => {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', currentUserId).single();
      if (prof) {
        const table = prof.role === 'apprenti' ? 'apprentis_details' : 'patrons_details';
        const { data: details } = await supabase.from(table).select('*').eq('profile_id', currentUserId).single();
        if (details) {
          const name = prof.role === 'apprenti' ? `${details.prenom} ${details.nom}` : details.nom_entreprise;
          setSenderName(name);
        }
      }
    };
    fetchSenderName();
  }, [currentUserId]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      if (data) {
        // Mark all messages from the other user as read in local state
        const localUpdated = data.map(m => m.expediteur_id !== currentUserId ? { ...m, is_read: true } : m);
        setMessages(localUpdated);
        
        // Mark all unread messages from the other user as read in DB
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('match_id', matchId)
          .neq('expediteur_id', currentUserId)
          .eq('is_read', false);
        if (error) {
          console.error("Error marking messages as read on load:", error);
        }
      }
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
        const newMsg = payload.new as any;
        const incomingMsg = { 
          ...newMsg, 
          is_read: newMsg.expediteur_id !== currentUserId ? true : newMsg.is_read 
        };
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some(m => m.id === incomingMsg.id)) {
            return prev;
          }
          // Filter out matching optimistic messages
          const filtered = prev.filter(m => !(m.isOptimistic && m.texte === incomingMsg.texte && m.expediteur_id === incomingMsg.expediteur_id));
          return [...filtered, incomingMsg];
        });

        // Mark incoming message as read if it's from the other user
        if (payload.new.expediteur_id !== currentUserId) {
          supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', payload.new.id)
            .select()
            .then(({ error }) => {
              if (error) {
                console.error("Error marking incoming message as read:", error);
              }
            });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const tempText = newMessage;
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      match_id: matchId,
      expediteur_id: currentUserId,
      texte: tempText,
      is_read: false,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };

    // Update UI immediately
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage("");

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          match_id: matchId,
          expediteur_id: currentUserId,
          texte: tempText
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to send message:", error);
        setMessages((prev) => prev.filter(m => m.id !== tempId));
        alert("Erreur lors de l'envoi du message");
      } else if (data) {
        // Replace optimistic message with real message
        setMessages((prev) => prev.map(m => m.id === tempId ? data : m));
        
        // Trigger push notification in background
        if (recipientId) {
          fetch('/api/push/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: recipientId,
              title: senderName,
              body: tempText,
              url: `/chat/${matchId}`
            })
          }).catch(err => console.error("Error triggering push notification:", err));
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.filter(m => m.id !== tempId));
    }
  };

  const demanderEssai = async () => {
    const text = "📢 Le patron a fait une demande de période d'essai au CFA.";
    await supabase.from('messages').insert({
      match_id: matchId,
      expediteur_id: currentUserId,
      texte: text
    });
    await supabase.from('matches').update({ statut: 'essai_demande' }).eq('id', matchId);
    if (recipientId) {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: recipientId,
          title: senderName,
          body: text,
          url: `/chat/${matchId}`
        })
      }).catch(err => console.error("Error triggering push notification:", err));
    }
    alert("Demande envoyée au CFA !");
  };

  const declarerContrat = async () => {
    const text = "🎉 Le patron souhaite signer un contrat d'apprentissage !";
    await supabase.from('messages').insert({
      match_id: matchId,
      expediteur_id: currentUserId,
      texte: text
    });
    await supabase.from('matches').update({ statut: 'contrat_demande' }).eq('id', matchId);
    if (recipientId) {
      fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: recipientId,
          title: senderName,
          body: text,
          url: `/chat/${matchId}`
        })
      }).catch(err => console.error("Error triggering push notification:", err));
    }
    alert("Intention de contrat déclarée au CFA !");
  };

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto bg-white dark:bg-zinc-950 md:border border-t border-zinc-200 dark:border-zinc-800 rounded-none md:rounded-xl overflow-hidden shadow-none md:shadow-sm">
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

      <form onSubmit={sendMessage} className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
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
