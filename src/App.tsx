import React, { useState, useEffect } from 'react';
import { TelegramSimulator } from './components/TelegramSimulator.js';
import {
  ShieldCheck,
  Bot,
  Terminal,
  Key,
  FileText,
  Lock,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState<any>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(console.error);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F5] text-[#5A5A5A] flex flex-col font-sans selection:bg-[#4A111C] selection:text-white">
      {/* Top Status Header */}
      <header className="border-b border-[#C9A6A5]/30 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A111C] flex items-center justify-center text-white shadow-md shadow-[#4A111C]/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg text-[#4A111C] tracking-wide">
                  PERLA BODY SCULPT
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase rounded-full bg-[#4A111C]/10 text-[#4A111C]">
                  TELEGRAM ERP SERVER
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Backend Node.js + TypeScript + GrammY + Puppeteer + Chiffrement AES-256-GCM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Serveur Actif (Port 3000)</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>⚡ Mode Test (Sans PIN)</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3E8DE] border border-[#C9A6A5] text-[#4A111C] font-medium">
              <ShieldCheck className="w-4 h-4 text-[#B08D57]" />
              <span>AES-256 Chiffré</span>
            </div>
          </div>
        </div>
      </header>

      {/* Test Mode Alert Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-200 py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs text-amber-950 font-medium">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold uppercase tracking-wider text-[10px]">
              Mode Test Actif
            </span>
            <span>
              La sécurité, la restriction Whitelist et le code PIN sont <b>désactivés</b> : vous pouvez tester librement tous les devis, factures, bilans et exports sans mot de passe.
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Instructions & Documentation (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Hero / Quick Status Card */}
          <div className="bg-white rounded-2xl border border-[#C9A6A5]/40 p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#F3E8DE]/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <h1 className="font-serif text-2xl font-bold text-[#4A111C] mb-2">
              Système 100% Bot Telegram Médical
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Toutes les opérations (saisie des patientes, devis, factures officielles, calcul de marge nette, exports comptables) sont pilotées directement depuis votre <b>application Telegram</b>.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="p-3 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30 text-center">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 block mb-1">
                  🇹🇳 Tunisien
                </span>
                <span className="text-sm font-bold text-[#4A111C] block">Devis & Facture</span>
                <span className="text-[11px] text-stone-500">Dinars (TND)</span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30 text-center">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 block mb-1">
                  🌍 Étranger
                </span>
                <span className="text-sm font-bold text-[#4A111C] block">Devis & Facture</span>
                <span className="text-[11px] text-stone-500">Euros (€) + Hôtel</span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30 text-center">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 block mb-1">
                  Sécurité PII
                </span>
                <span className="text-sm font-bold text-emerald-700 block">AES-256-GCM</span>
                <span className="text-[11px] text-stone-500">Passeport / CIN</span>
              </div>
              <div className="p-3 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30 text-center">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 block mb-1">
                  Rendu PDF
                </span>
                <span className="text-sm font-bold text-[#B08D57] block">Puppeteer A4</span>
                <span className="text-[11px] text-stone-500">Design Officiel</span>
              </div>
            </div>
          </div>

          {/* Guide par Étapes en Arabe / Français */}
          <div className="bg-white rounded-2xl border border-[#C9A6A5]/40 p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-[#C9A6A5]/20 pb-4">
              <Terminal className="w-5 h-5 text-[#4A111C]" />
              <h2 className="font-serif text-lg font-bold text-[#4A111C]">
                Guide d'exécution étape par étape (Kifeh tkhaddem el bot)
              </h2>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30">
                <div className="w-7 h-7 rounded-full bg-[#4A111C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1 text-xs sm:text-sm">
                  <h3 className="font-bold text-[#4A111C] mb-1">
                    San3a el Bot 3la Telegram (Création via @BotFather)
                  </h3>
                  <p className="text-stone-600 text-xs mb-2">
                    Odkhol l-Telegram, lawej 3la <b>@BotFather</b> w ektéb <code>/newbot</code>. A3tih ism el clinic (ex: <i>Perla Body Sculpt Bot</i>) w username yofa b <i>_bot</i>. BotFather bech ya3tik el <b>HTTP API Token</b>.
                  </p>
                  <div className="bg-[#4A111C]/5 border border-[#4A111C]/10 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-[#4A111C]">
                    <span>TELEGRAM_BOT_TOKEN=123456789:ABCdef...</span>
                    <button
                      onClick={() => copyToClipboard('TELEGRAM_BOT_TOKEN=', 't1')}
                      className="text-stone-500 hover:text-[#4A111C]"
                    >
                      {copiedCmd === 't1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30">
                <div className="w-7 h-7 rounded-full bg-[#4A111C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1 text-xs sm:text-sm">
                  <h3 className="font-bold text-[#4A111C] mb-1">
                    Hott el Telegram ID mte3ek f-Whitelist (Sécurité absolue)
                  </h3>
                  <p className="text-stone-600 text-xs mb-2">
                    Béch 7ad ma ynajem yodkhol l-bot ken enti w les médecins autorisés, odkhol l-<b>@userinfobot</b> f Telegram bech ta3ref el ID mte3ek (ex: <code>123456789</code>).
                  </p>
                  <div className="bg-[#4A111C]/5 border border-[#4A111C]/10 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-[#4A111C]">
                    <span>TELEGRAM_WHITELIST_IDS=123456789,987654321</span>
                    <button
                      onClick={() => copyToClipboard('TELEGRAM_WHITELIST_IDS=', 't2')}
                      className="text-stone-500 hover:text-[#4A111C]"
                    >
                      {copiedCmd === 't2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30">
                <div className="w-7 h-7 rounded-full bg-[#4A111C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="flex-1 text-xs sm:text-sm">
                  <h3 className="font-bold text-[#4A111C] mb-1">
                    Khaddem el Bot (Exécution du serveur)
                  </h3>
                  <p className="text-stone-600 text-xs mb-2">
                    El serveur déjà yikhdem tawwa ! Si tu veux le relancer en local ou VPS :
                  </p>
                  <div className="bg-[#4A111C]/5 border border-[#4A111C]/10 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-[#4A111C]">
                    <span>npm run dev</span>
                    <button
                      onClick={() => copyToClipboard('npm run dev', 't3')}
                      className="text-stone-500 hover:text-[#4A111C]"
                    >
                      {copiedCmd === 't3' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#FFF9F5] border border-[#C9A6A5]/30">
                <div className="w-7 h-7 rounded-full bg-[#4A111C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  4
                </div>
                <div className="flex-1 text-xs sm:text-sm">
                  <h3 className="font-bold text-[#4A111C] mb-1">
                    Les Commandes Telegram mte3ek
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="p-2 rounded-lg bg-white border border-[#C9A6A5]/30">
                      <code className="text-[#4A111C] font-bold">/start</code>
                      <p className="text-stone-500 text-[11px]">Menu principal & boutons rapides</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#C9A6A5]/30">
                      <code className="text-[#4A111C] font-bold">/nouveau</code>
                      <p className="text-stone-500 text-[11px]">Création devis/facture pas-à-pas</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#C9A6A5]/30">
                      <code className="text-[#4A111C] font-bold">/stats_mois</code>
                      <p className="text-stone-500 text-[11px]">CA, Charges & Marge Nette</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#C9A6A5]/30">
                      <code className="text-[#4A111C] font-bold">/historique_client</code>
                      <p className="text-stone-500 text-[11px]">Recherche patiente & dossiers</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#C9A6A5]/30">
                      <code className="text-[#4A111C] font-bold">/export_excel</code>
                      <p className="text-stone-500 text-[11px]">Télécharger CSV pour Excel</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#C9A6A5]/30">
                      <code className="text-[#4A111C] font-bold">/pin 2026</code>
                      <p className="text-stone-500 text-[11px]">Déverrouillage sécurité 2h</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spécifications des Modèles Officiels Perla */}
          <div className="bg-white rounded-2xl border border-[#C9A6A5]/40 p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-lg font-bold text-[#4A111C] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#B08D57]" />
              Les 4 Modèles Officiels Intégrés
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-[#C9A6A5]/30 bg-[#FFF9F5] space-y-1">
                <span className="font-bold text-[#4A111C] block">1. Devis Étranger (EUR)</span>
                <p className="text-stone-500 text-[11px]">
                  Template <code>devis_etranger.hbs</code> : Prestations chirurgicales, Hôtel 5★ The Residence Tunis, Transferts VIP aéroport/clinique, total en lettres, validité du devis.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-[#C9A6A5]/30 bg-[#FFF9F5] space-y-1">
                <span className="font-bold text-[#4A111C] block">2. Facture Étranger (EUR)</span>
                <p className="text-stone-500 text-[11px]">
                  Template <code>facture_etranger.hbs</code> : Décompte officiel, hébergement, transferts, acompte, net à payer en EUR.
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-[#C9A6A5]/30 bg-[#FFF9F5] space-y-1">
                <span className="font-bold text-[#4A111C] block">3. Devis Tunisien (TND)</span>
                <p className="text-stone-500 text-[11px]">
                  Template <code>devis_tunisien.hbs</code> : Séjour clinique, honoraires chirurgien, soins post-opératoires en Dinars Tunisiens (TND).
                </p>
              </div>
              <div className="p-3.5 rounded-xl border border-[#C9A6A5]/30 bg-[#FFF9F5] space-y-1">
                <span className="font-bold text-[#4A111C] block">4. Facture Tunisienne (TND)</span>
                <p className="text-stone-500 text-[11px]">
                  Template <code>facture_tunisien.hbs</code> : Facture conforme clinique esthétique, suivi des versements et solde en TND.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Bot Console (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#4A111C]" />
              <span className="font-serif font-bold text-[#4A111C]">
                Console Directe du Bot Telegram
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
              Prêt à tester
            </span>
          </div>
          <p className="text-xs text-stone-500 px-1">
            Testez directement le flux complet (saisie, calcul de marge, génération PDF) exactement comme dans Telegram :
          </p>

          <div className="flex-1 h-[680px]">
            <TelegramSimulator />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#C9A6A5]/20 py-4 bg-white text-center text-xs text-stone-500">
        Perla Body Sculpt — 22 RUE EMERAUDES, Le Kram, Tunisie • Tél: +216 26 723 876 • Chiffrement AES-256-GCM Actif
      </footer>
    </div>
  );
}
