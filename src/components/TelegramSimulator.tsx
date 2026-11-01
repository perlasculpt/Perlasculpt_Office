import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  ShieldCheck,
  FileDown,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  buttons?: string[];
  documentUrl?: string;
  documentName?: string;
}

export const TelegramSimulator: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const startBot = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/start' }),
      });
      const data = await res.json();
      if (data.success && data.responses) {
        setMessages(data.responses);
      }
    } catch (err) {
      console.error('Erreur démarrage simulateur:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startBot();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputValue).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });
      const data = await res.json();
      if (data.success && data.responses) {
        setMessages(prev => [...prev, ...data.responses]);
      }
    } catch (err) {
      console.error('Erreur simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setMessages([]);
    await startBot();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-[#FFF9F5] border border-[#C9A6A5]/50 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="font-serif-luxury text-xl font-bold text-[#4A111C]">
              Simulateur Conversationnel Telegram (grammY)
            </h2>
          </div>
          <p className="text-xs text-[#5A5A5A] mt-1">
            Testez en direct le flux pas-à-pas de création de Devis/Facture, le chiffrement AES-256 et la génération de PDF.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleReset}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#C9A6A5] text-xs font-semibold text-[#4A111C] hover:bg-[#F3E8DE] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réinitialiser (/start)
          </button>
        </div>
      </div>

      {/* Telegram Chat Box */}
      <div className="bg-[#FAF3EE] border border-[#C9A6A5]/60 rounded-2xl overflow-hidden shadow-lg flex flex-col h-[650px]">
        {/* Chat Top Bar */}
        <div className="bg-[#4A111C] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-[#B08D57] bg-[#F3E8DE] flex items-center justify-center text-[#4A111C] font-serif-luxury font-bold text-lg">
              P
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide">Perla Body Sculpt Bot</div>
              <div className="text-[10px] text-[#F3E8DE]/80 flex items-center gap-1">
                <span>Bot ERP Médical &amp; Financier</span>
                <span>•</span>
                <span className="text-emerald-300 font-semibold">En ligne</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Mode Test : Sans PIN (Accès Libre)
            </span>
          </div>
        </div>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F7EFE9]/50">
          {messages.map(msg => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} animate-in fade-in duration-200`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                    isBot
                      ? 'bg-white text-[#4A111C] border border-[#C9A6A5]/30 rounded-tl-xs'
                      : 'bg-[#4A111C] text-white rounded-tr-xs'
                  }`}
                >
                  {/* HTML formatted message */}
                  <div
                    className="whitespace-pre-wrap break-words leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: msg.text }}
                  />

                  {/* Document Attachment Card */}
                  {msg.documentUrl && (
                    <div className="mt-3 p-3 bg-[#FFF9F5] border border-[#B08D57] rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#4A111C] text-white flex items-center justify-center shrink-0">
                          <FileDown className="w-4 h-4 text-[#B08D57]" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#4A111C] truncate text-[11px]">
                            {msg.documentName || 'Document.pdf'}
                          </div>
                          <span className="text-[10px] text-[#5A5A5A]">PDF Officiel Perla A4</span>
                        </div>
                      </div>

                      <a
                        href={msg.documentUrl}
                        download
                        className="px-3 py-1.5 bg-[#B08D57] hover:bg-[#9a7b4c] text-white rounded-lg font-bold text-[11px] transition-colors shrink-0 shadow-xs"
                      >
                        Télécharger
                      </a>
                    </div>
                  )}

                  <div
                    className={`mt-1.5 text-[9px] text-right ${
                      isBot ? 'text-gray-400' : 'text-white/60'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {/* Inline Keyboard Buttons */}
                {isBot && msg.buttons && msg.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                    {msg.buttons.map((btn, bIdx) => (
                      <button
                        key={bIdx}
                        onClick={() => handleSend(btn)}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F3E8DE] border border-[#C9A6A5]/60 text-[#4A111C] font-semibold text-[11px] shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        {btn}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#5A5A5A] italic">
              <div className="w-2 h-2 rounded-full bg-[#4A111C] animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-[#4A111C] animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-2 h-2 rounded-full bg-[#4A111C] animate-bounce [animation-delay:0.4s]"></div>
              <span>Perla Bot écrit...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 bg-white border-t border-[#C9A6A5]/40 flex items-center gap-2">
          <input
            id="input-sim-message"
            type="text"
            placeholder="Tapez un message ou une commande (/nouveau, /stats_mois, /pin 2026)..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSend();
            }}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-[#C9A6A5]/60 bg-[#FFF9F5] focus:outline-none focus:border-[#4A111C]"
          />

          <button
            id="btn-sim-send"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || loading}
            className="p-2.5 rounded-xl bg-[#4A111C] hover:bg-[#380d15] text-white disabled:opacity-40 transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
