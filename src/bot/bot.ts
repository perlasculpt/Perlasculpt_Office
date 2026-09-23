import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { config } from '../config/env.js';
import { whitelistMiddleware } from './middlewares/authMiddleware.js';
import {
  handleStart,
  handlePin,
  handleLock,
  handleStatsMois,
  handleHistoriqueClient,
  handleExportExcel,
  handleHelp,
  handleAddExpense,
  handleHistoriqueDepenses,
} from './handlers/commands.js';
import {
  createDocumentConversation,
  BotContext,
} from './conversations/factureConversation.js';
import { addExpenseConversation } from './conversations/expenseConversation.js';

let botInstance: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (botInstance) return botInstance;

  // Création du Bot avec le token configuré
  const token = config.telegram.botToken || '123456789:AAFakeTokenForInitializationOnly00000';
  
  const bot = new Bot<BotContext>(token);

  // 1. Session middleware pour stocker l'état des conversations
  bot.use(
    session({
      initial: () => ({}),
    })
  );

  // 2. Plugin Conversations de grammY
  bot.use(conversations());

  // 3. Enregistrement des conversations interactives
  bot.use(createConversation(createDocumentConversation));
  bot.use(createConversation(addExpenseConversation));

  // 4. Middleware de sécurité : Whitelist des IDs Telegram
  bot.use(whitelistMiddleware);

  // 5. Commandes de base
  bot.command('start', handleStart);
  bot.command(['aide', 'help'], handleHelp);
  bot.command('pin', handlePin);
  bot.command('lock', handleLock);

  // 6. Commandes financières & Dépenses
  bot.command('stats_mois', handleStatsMois);
  bot.command('historique_client', handleHistoriqueClient);
  bot.command('export_excel', handleExportExcel);
  bot.command(['depense', 'ajouter_depense'], handleAddExpense);
  bot.command('historique_depenses', handleHistoriqueDepenses);

  // 7. Lancement des conversations interactives
  bot.command(['nouveau', 'creer', 'facture', 'devis'], async (ctx) => {
    await ctx.conversation.enter('createDocumentConversation');
  });

  // Gestion des boutons du menu principal et messages texte rapides
  bot.hears(['📄 Créer un Devis', '📑 Créer une Facture', '➕ Nouveau'], async (ctx) => {
    await ctx.conversation.enter('createDocumentConversation');
  });

  bot.hears(['💸 Ajouter Dépense', 'Ajouter Dépense', 'Masrouf'], handleAddExpense);
  bot.hears(['📊 Bilan du Mois', 'Stats du Mois', 'Bilan'], handleStatsMois);
  bot.hears(['📥 Export Excel', 'Export Excel', 'Export'], handleExportExcel);
  bot.hears(['ℹ️ Manuel d\'Aide', 'Aide', 'Manuel'], handleHelp);
  bot.hears(['🔒 Verrouiller', 'Verrouiller'], handleLock);

  bot.hears(['🔐 Code PIN (2026)', 'Déverrouiller PIN'], async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      const { setPinVerified } = await import('./middlewares/authMiddleware.js');
      setPinVerified(userId);
      await ctx.reply(
        '🔓 <b>ACCÈS AUTORISÉ !</b>\nSession administrateur déverrouillée avec succès pour 2 heures.',
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.hears(['🔍 Chercher Patiente', 'Recherche Patiente'], async (ctx) => {
    await ctx.reply(
      '🔍 <b>RECHERCHE PATIENTE</b>\n\nVeuillez envoyer la commande avec le nom ou numéro de passeport :\n' +
      'Exemple : <code>/historique_client Amira</code> ou <code>/historique_client 25004709</code>',
      { parse_mode: 'HTML' }
    );
  });

  // Gestion globale des erreurs du bot
  bot.catch((err) => {
    console.error(`[GrammY Error] Erreur dans la mise à jour ${err.ctx?.update?.update_id}:`, err.error);
  });

  botInstance = bot;
  return bot;
}

/**
 * Configure les commandes visibles dans le menu Telegram
 */
export async function setupBotCommands(bot: Bot<BotContext>) {
  if (!config.telegram.botToken) return;

  try {
    await bot.api.setMyCommands([
      { command: 'nouveau', description: 'Créer un Devis ou une Facture pas-à-pas' },
      { command: 'depense', description: 'Enregistrer une dépense / charge fixe (Masrouf)' },
      { command: 'historique_depenses', description: 'Afficher la liste des charges fixes' },
      { command: 'stats_mois', description: 'Afficher le bilan financier & marge du mois' },
      { command: 'historique_client', description: 'Rechercher l\'historique d\'une patiente' },
      { command: 'export_excel', description: 'Exporter les données comptables (Excel/CSV)' },
      { command: 'pin', description: 'Déverrouiller la session financière' },
      { command: 'lock', description: 'Verrouiller la session financière' },
      { command: 'aide', description: 'Afficher le manuel des commandes' },
    ]);
    console.log('[Telegram Bot] Commandes du menu enregistrées avec succès.');
  } catch (error: any) {
    console.warn('[Telegram Bot] Impossible d\'enregistrer les commandes du menu (token en attente ou invalide):', error.message);
  }
}

/**
 * Lance le bot en mode Long Polling
 */
export async function startBotPolling(bot: Bot<BotContext>) {
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log('[Telegram Bot] Ancien webhook libéré. Démarrage de l\'écoute en direct (Long Polling)...');

    bot.start({
      onStart: (botInfo) => {
        console.log(`[Telegram Bot] 🚀 EN LIGNE ! Le bot écoute et répond en direct sur Telegram : @${botInfo.username}`);
      },
    });
  } catch (error: any) {
    console.error('[Telegram Bot Error] Erreur démarrage polling:', error.message);
  }
}