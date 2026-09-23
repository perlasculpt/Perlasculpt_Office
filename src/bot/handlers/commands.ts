import { Context, InputFile, Keyboard } from 'grammy';
import { FinanceService } from '../../services/financeService.js';
import { config } from '../../config/env.js';
import { isUserPinVerified, setPinVerified, revokePinSession, SECURITY_ENABLED } from '../middlewares/authMiddleware.js';
import { formatTND } from '../../services/pdfService.js';
import { BotContext } from '../conversations/factureConversation.js';
import { Charge } from '../../models/Charge.js';
import { Facture } from '../../models/Facture.js';

export const mainMenuKeyboard = new Keyboard()
  .text('📄 Créer un Devis')
  .text('📑 Créer une Facture')
  .row()
  .text('📊 Bilan du Mois')
  .text('💸 Ajouter Dépense')
  .row()
  .text('🔍 Chercher Patiente')
  .text('📥 Export Excel')
  .row()
  .text('ℹ️ Manuel d\'Aide')
  .resized();

/**
 * Commande /start : Accueil et panneau de contrôle
 */
export async function handleStart(ctx: Context) {
  const userId = ctx.from?.id;

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
 * Déclencheur de la conversation pour ajouter une Dépense / Charge
 */
export async function handleAddExpense(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (userId && !isUserPinVerified(userId)) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION REQUISE</b>\n\n` +
      `L'enregistrement des dépenses nécessite le déverrouillage PIN.\n` +
      `Tapez : <code>/pin ${config.telegram.adminPin || '2026'}</code> pour continuer.`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.conversation.enter('addExpenseConversation');
}

/**
 * Commande /historique_depenses : Affichage de la liste des dépenses
 */
export async function handleHistoriqueDepenses(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId && !isUserPinVerified(userId)) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION REQUISE</b>\n\nTapez : <code>/pin [code]</code>`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply('🔍 <i>Récupération de l\'historique des dépenses...</i>', { parse_mode: 'HTML' });

  try {
    const expenses = await Charge.find()
      .sort({ date: -1 })
      .limit(20)
      .lean();

    if (expenses.length === 0) {
      return ctx.reply('📑 <b>Aucune dépense enregistrée pour le moment.</b>', { parse_mode: 'HTML' });
    }

    let text =
      `📉 <b>HISTORIQUE DES DÉPENSES & MASARIF</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    let total = 0;

    expenses.forEach((e, idx) => {
      const d = new Date(e.date).toLocaleDateString('fr-FR');
      const badgeType = e.typeCharge === 'DIRECTE' ? '🔴 DIRECTE' : '🔵 FIXE';
      text +=
        `<b>${idx + 1}. [${e.categorie}]</b> (${badgeType}) — <code>${d}</code>\n` +
        `• Description : ${e.description}\n` +
        `• Montant : <b>${formatTND(e.montant)} TND</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      total += e.montant;
    });

    text += `\n💰 <b>Total des Dépenses Affichées :</b> 🔻 <b>${formatTND(total)} TND</b>`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error('Erreur historique_depenses:', error);
    await ctx.reply(`⚠️ Erreur lors de la récupération : ${error.message}`);
  }
}

/**
 * Commande /stats_mois : Tableau de bord financier du mois en cours
 */
export async function handleStatsMois(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId && !isUserPinVerified(userId)) {
    return ctx.reply(
      `🔒 <b>AUTHENTIFICATION REQUISE</b>\n\n` +
      `La consultation des chiffres d'affaires et du gain net nécessite de déverrouiller votre session.\n` +
      `Tapez : <code>/pin ${config.telegram.adminPin || '2026'}</code> pour continuer.`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply('📊 <i>Calcul des indicateurs financiers en cours...</i>', { parse_mode: 'HTML' });

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Récupération des Factures (Seules les factures comptent dans la caisse)
    const factures = await Facture.find({
      type: 'FACTURE',
      createdAt: { $gte: startOfMonth,$lte: endOfMonth },
    }).lean();

    let totalFactureBrut = 0;
    let totalEncaisse = 0;

    factures.forEach((f) => {
      const montantTotal = f.totalHT || 0;
      totalFactureBrut += montantTotal;
      totalEncaisse += montantTotal; // Kol facture tahseb direct f flous dakhla
    });

    // Pipeline Devis (Indicatif uniquement)
    const devisCount = await Facture.countDocuments({
      type: 'DEVIS',
      createdAt: { $gte: startOfMonth,$lte: endOfMonth },
    });

    // 2. Récupération des Dépenses (Directes + Fixes)
    const charges = await Charge.find({
      date: { $gte: startOfMonth,$lte: endOfMonth },
    }).lean();

    let totalChargesDirectes = 0;
    let totalChargesFixes = 0;

    charges.forEach((c) => {
      if (c.typeCharge === 'DIRECTE') {
        totalChargesDirectes += c.montant;
      } else {
        totalChargesFixes += c.montant;
      }
    });

    const totalDepenses = totalChargesDirectes + totalChargesFixes;

    // 3. Calcul du Gain Net Réel (Total Factures - Total Dépenses)
    const gainNetReel = totalEncaisse - totalDepenses;
    const moisNom = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();

    const text =
      `📊 <b>BILAN FINANCIER DU MOIS — ${moisNom}</b>\n` +
      `Établissement : <b>${config.clinic.name}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📥 <b>ENTRÉES D'ARGENT (Factures uniquement) :</b>\n` +
      `• Factures émises : <b>${factures.length}</b>\n` +
      `• 💰 <b>Total Flous Dakhla (Caisse) : ${formatTND(totalEncaisse)} TND</b>\n\n` +
      `📤 <b>SORTIES D'ARGENT (Dépenses) :</b>\n` +
      `• Charges Directes (Clinique, Bloc...) : 🔻 <b>${formatTND(totalChargesDirectes)} TND</b>\n` +
      `• Charges Fixes (Loyer, Pub Meta...) : 🔻 <b>${formatTND(totalChargesFixes)} TND</b>\n` +
      `• 💸 <b>Total Dépenses Cumulées : 🔻 ${formatTND(totalDepenses)} TND</b>\n\n` +
      `🟢 <b>RÉSULTAT NET :</b>\n` +
      `• Gain Net Réel : 💎 <b>${formatTND(gainNetReel)} TND</b>\n\n` +
      `📑 <b>PIPELINE DEVIS (Indicatif) :</b>\n` +
      `• Devis émis en cours : <b>${devisCount}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Calcul basé sur le montant total des factures - les dépenses.</i>`;

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
        text +=
          `\n<b>${idx + 1}. [${item.type}] ${item.numeroFacture}</b> — ${item.date}\n` +
          `• Acte : ${item.actePrincipal}\n` +
          `• Total TTC : <b>${item.totalHTFormatted} TND</b>\n`;
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
        `• Contient : Chiffre d'Affaires, Décomposition des charges, Marges nettes.\n\n` +
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
    `• Cliquez sur "📄 Créer un Devis" ou "📑 Créer une Facture".\n` +
    `• Renseignez les données patientes (chiffrement AES-256 automatique).\n` +
    `• Ajoutez les actes médicaux.\n` +
    `• Le bot génère automatiquement le PDF officiel.\n\n` +
    `2️⃣ <b>DÉPENSES & CHARGES (MASARIF) :</b>\n` +
    `• Cliquez sur "💸 Ajouter Dépense" ou tapez /depense pour enregistrer tout masrouf (Clinique, Bloc, Loyer, Sponsor...).\n` +
    `• Tapez /historique_depenses pour consulter la liste des dépenses enregistrées.\n\n` +
    `3️⃣ <b>CONTRÔLE FINANCIER & GAIN NET :</b>\n` +
    `• /stats_mois : Visualisez le total des factures, le total des charges et le gain net réel.\n` +
    `• /historique_client : Retrouvez les pièces comptables d'une patiente.\n` +
    `• /export_excel : Téléchargez le tableau comptable pour Excel.\n\n` +
    `4️⃣ <b>SÉCURITÉ :</b>\n` +
    `• /pin <code>[code]</code> : Déverrouille l'accès financier.\n` +
    `• /lock : Verrouille la session.`;

  await ctx.reply(helpText, { parse_mode: 'HTML' });
}