import { CommandContext, Context, InputFile, Keyboard } from 'grammy';
import { FinanceService } from '../../services/financeService.js';
import { config } from '../../config/env.js';
import { isUserPinVerified, setPinVerified, revokePinSession, SECURITY_ENABLED } from '../middlewares/authMiddleware.js';
import { formatTND } from '../../services/pdfService.js';
import { BotContext } from '../conversations/factureConversation.js';

export const mainMenuKeyboard = new Keyboard()
  .text('📄 Créer un Devis')
  .text('📑 Créer une Facture')
  .row()
  .text('📊 Bilan du Mois')
  .text('🔍 Chercher Patiente')
  .row()
  .text('📥 Export Excel')
  .text('ℹ️ Manuel d\'Aide')
  .resized();

/**
 * Commande /start : Accueil et panneau de contrôle
 */
export async function handleStart(ctx: Context) {
  const userId = ctx.from?.id;
  const isUnlocked = userId ? isUserPinVerified(userId) : true;

  const text =
    `💎 <b>PERLA BODY SCULPT — ERP FINANCIER CLINIQUE & BOT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Bienvenue sur le système de devis, facturation et analyse de marge pour la chirurgie et médecine esthétique.\n\n` +
    `⚡ <b>Statut système :</b>\n` +
    `• Utilisateur Telegram : <code>${userId}</code> (Autorisé)\n` +
    `• Mode Test : 🟢 <b>Accès Libre (Sécurité & PIN désactivés pour tests)</b>\n` +
    `• Chiffrement médical : <b>AES-256-GCM Actif</b>\n\n` +
    `Utilisez les boutons ci-dessous ou tapez vos commandes directement :`;

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard });
}

/**
 * Commande /pin <code> : Déverrouillage par PIN secret
 */
export async function handlePin(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!SECURITY_ENABLED) {
    return ctx.reply(
      `🔓 <b>ACCÈS LIBRE (Mode Test)</b>\n\n` +
      `La sécurité et le code PIN sont temporairement désactivés pour vous permettre de tester toutes les commandes sans restriction.`,
      { parse_mode: 'HTML' }
    );
  }

  const args = ctx.message?.text?.split(' ').slice(1).join(' ').trim();

  if (!args) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION PIN</b>\n\n` +
      `Veuillez entrer la commande suivie de votre code PIN secret à 4 chiffres :\n` +
      `Exemple : <code>/pin 2026</code>`,
      { parse_mode: 'HTML' }
    );
  }

  if (args === config.telegram.adminPin) {
    setPinVerified(userId);
    return ctx.reply(
      `🔓 <b>ACCÈS AUTORISÉ !</b>\n\n` +
      `Votre session administrateur est déverrouillée.`,
      { parse_mode: 'HTML' }
    );
  } else {
    return ctx.reply(
      `❌ <b>CODE PIN INCORRECT</b>\n\n` +
      `L'accès aux données financières reste bloqué.`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Commande /lock : Verrouillage immédiat
 */
export async function handleLock(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId) {
    revokePinSession(userId);
  }
  await ctx.reply(`🔒 <b>Session financière verrouillée.</b>\nTapez <code>/pin [code]</code> pour la déverrouiller.`, {
    parse_mode: 'HTML',
  });
}

/**
 * Commande /stats_mois : Tableau de bord financier du mois en cours
 */
export async function handleStatsMois(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId && !isUserPinVerified(userId)) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION REQUISE</b>\n\n` +
      `La consultation des chiffres d'affaires et de la marge nette nécessite de déverrouiller votre session.\n` +
      `Tapez : <code>/pin ${config.telegram.adminPin || '2026'}</code> pour continuer.`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply('📊 <i>Calcul des indicateurs financiers en cours...</i>', { parse_mode: 'HTML' });

  try {
    const stats = await FinanceService.getMonthlyStats();

    const text =
      `📊 <b>BILAN FINANCIER DU MOIS — ${stats.mois.toUpperCase()}</b>\n` +
      `Établissement : <b>${config.clinic.name}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 <b>CHIFFRE D'AFFAIRES & ENCAISSEMENTS :</b>\n` +
      `• Factures validées : <b>${stats.nombreFactures}</b>\n` +
      `• Chiffre d'Affaires Brut : <b>${stats.totalCAFormatted} TND</b>\n` +
      `• Acomptes encaissés : <b>${stats.totalAcomptesFormatted} TND</b>\n` +
      `• Soldes restants à percevoir : <b>${stats.totalSoldesEnAttenteFormatted} TND</b>\n\n` +
      `🏨 <b>CHARGES DIRECTES (Hôtel, Bloc, Transferts, Équipe) :</b>\n` +
      `• Total des charges : 🔻 <b>${stats.totalChargesFormatted} TND</b>\n\n` +
      `🟢 <b>RÉSULTAT NET & RENTABILITÉ :</b>\n` +
      `• Marge Nette Globale : 💎 <b>${stats.margeNetteFormatted} TND</b>\n` +
      `• Taux de marge nette : <b>${stats.tauxMarge}</b>\n\n` +
      `📑 <b>PIPELINE DEVIS :</b>\n` +
      `• Devis émis en cours : <b>${stats.nombreDevis}</b> (${stats.devisVolumeFormatted} TND)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Données synchronisées en temps réel.</i>`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error('Erreur stats_mois:', error);
    await ctx.reply(`⚠️ Impossible de récupérer les statistiques financières: ${error.message}`);
  }
}

/**
 * Commande /historique_client [Nom/Passeport]
 */
export async function handleHistoriqueClient(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId && !isUserPinVerified(userId)) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION REQUISE</b>\n\n` +
      `L'accès aux dossiers patients nécessite le déverrouillage de la session PIN.\n` +
      `Tapez : <code>/pin [code]</code>`,
      { parse_mode: 'HTML' }
    );
  }

  const query = ctx.message?.text?.split(' ').slice(1).join(' ').trim();

  if (!query) {
    return ctx.reply(
      `🔍 <b>RECHERCHE HISTORIQUE CLIENT</b>\n\n` +
      `Veuillez spécifier le nom du patient ou son numéro de passeport.\n` +
      `Exemples :\n` +
      `• <code>/historique_client Amira</code>\n` +
      `• <code>/historique_client X1234567</code>\n` +
      `• <code>/historique_client Nora</code>`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply(`🔎 <i>Recherche dans la base chiffrée AES-256 pour "${query}"...</i>`, { parse_mode: 'HTML' });

  try {
    const res = await FinanceService.getClientHistory(query);

    if (!res.patient) {
      return ctx.reply(
        `❌ Aucun patient correspondant à <b>"${query}"</b> n'a été trouvé dans le registre médical.`,
        { parse_mode: 'HTML' }
      );
    }

    let text =
      `👤 <b>FICHE PATIENTE — PERLA BODY SCULPT</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• <b>Nom & Prénom</b> : ${res.patient.nomPrenom}\n` +
      `• <b>Passeport / CIN</b> : <code>${res.patient.passeport}</code>\n` +
      `• <b>Téléphone</b> : ${res.patient.telephone}\n` +
      `• <b>Nationalité</b> : ${res.patient.nationalite} (${res.patient.paysResidence})\n\n` +
      `📑 <b>HISTORIQUE DES PIÈCES COMPTABLES (${res.items.length}) :</b>\n`;

    if (res.items.length === 0) {
      text += `<i>Aucune facture ou devis enregistré pour le moment.</i>\n`;
    } else {
      res.items.forEach((item, idx) => {
        const badge = item.statutPaiement === 'PAYE' ? '🟢 PAYÉ' : item.statutPaiement === 'PARTIEL' ? '🟡 PARTIEL' : '🔴 EN ATTENTE';
        text +=
          `\n<b>${idx + 1}. [${item.type}] ${item.numeroFacture}</b> — ${item.date}\n` +
          `• Acte : ${item.actePrincipal}\n` +
          `• Total TTC : <b>${item.totalHTFormatted} TND</b> | Marge : <b>${item.margeNetteFormatted} TND</b>\n` +
          `• Statut : ${badge} (Acompte: ${formatTND(item.acompte)} TND)\n`;
      });
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error('Erreur historique_client:', error);
    await ctx.reply(`⚠️ Erreur lors de la recherche : ${error.message}`);
  }
}

/**
 * Commande /export_excel : Export Excel / CSV des données financières
 */
export async function handleExportExcel(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId && !isUserPinVerified(userId)) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION REQUISE</b>\n\n` +
      `L'export des données financières nécessite le déverrouillage de la session PIN.\n` +
      `Tapez : <code>/pin [code]</code>`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply('📥 <i>Génération du fichier d\'export Excel/CSV en cours...</i>', { parse_mode: 'HTML' });

  try {
    const { data, filename } = await FinanceService.exportFinancialData('csv');
    const buffer = Buffer.from(data, 'utf-8');

    await ctx.replyWithDocument(new InputFile(buffer, filename), {
      caption:
        `📊 <b>EXPORT COMPTABLE & FINANCIER COMPLET</b>\n\n` +
        `• Format : CSV UTF-8 (Compatible Microsoft Excel, Google Sheets, LibreOffice)\n` +
        `• Sécurité : Noms et passeports déchiffrés pour usage administratif officiel\n` +
        `• Contient : Chiffre d'Affaires, Décomposition des charges, Marges nettes, Suivi acomptes.\n\n` +
        `<i>Généré le ${new Date().toLocaleDateString('fr-FR')} par Perla Body Sculpt ERP.</i>`,
      parse_mode: 'HTML',
    });
  } catch (error: any) {
    console.error('Erreur export_excel:', error);
    await ctx.reply(`⚠️ Échec de l'export: ${error.message}`);
  }
}

/**
 * Commande /aide : Manuel d'aide détaillé
 */
export async function handleHelp(ctx: Context) {
  const helpText =
    `📖 <b>MANUEL D'UTILISATION — PERLA ERP TELEGRAM</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `1️⃣ <b>CRÉER UN DEVIS OU UNE FACTURE :</b>\n` +
    `• Tapez /nouveau pour démarrer le guide pas-à-pas.\n` +
    `• Renseignez les données patientes (chiffrement AES-256 automatique du passeport).\n` +
    `• Ajoutez les actes médicaux, prix et quantités.\n` +
    `• Ajoutez les charges directes (Hôtel, Transferts VIP, Bloc, Clinique).\n` +
    `• Le bot calcule la marge nette, le solde restant et génère le PDF officiel au design Perla Body Sculpt.\n\n` +
    `2️⃣ <b>CONTRÔLE FINANCIER :</b>\n` +
    `• /stats_mois : Visualisez le CA, les charges totales et le bénéfice net du mois.\n` +
    `• /historique_client : Retrouvez l'historique médical et financier d'une patiente.\n` +
    `• /export_excel : Téléchargez le tableau comptable complet pour Excel.\n\n` +
    `3️⃣ <b>SÉCURITÉ :</b>\n` +
    `• /pin <code>[code]</code> : Déverrouille l'accès financier pendant 2h.\n` +
    `• /lock : Re-verrouille immédiatement la session.`;

  await ctx.reply(helpText, { parse_mode: 'HTML' });
}
