import { type Conversation, type ConversationFlavor } from '@grammyjs/conversations';
import { type Context, type SessionFlavor, InputFile, Keyboard } from 'grammy';
import { FinanceService } from '../../services/financeService.js';
import { PdfService, formatTND, formatEUR } from '../../services/pdfService.js';
import { CategorieCharge } from '../../models/Facture.js';

export type BotContext = ConversationFlavor<Context & SessionFlavor<Record<string, any>>>;
export type BotConversation = Conversation<BotContext, BotContext>;

/**
 * Flux de conversation interactif étape par étape avec grammY
 * Réalise la création d'un Devis ou d'une Facture (Tunisien ou Étranger)
 * en respectant scrupuleusement les champs dynamiques [entre crochets]
 */
export async function createDocumentConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  // --- ÉTAPE 1 : Choix du profil client (Tunisien vs Étranger) ---
  const profileKeyboard = new Keyboard()
    .text('🇹🇳 Patiente Tunisienne (TND)')
    .text('🌍 Patiente Étrangère (EUR)')
    .row()
    .text('❌ Annuler')
    .resized()
    .oneTime();

  await ctx.reply(
    `💎 <b>PERLA BODY SCULPT — ÉMISSION D'UN DOCUMENT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Sélectionnez le profil de la patiente :\n\n` +
    `• <b>🇹🇳 Patiente Tunisienne</b> : Tarification en TND (Dinars Tunisiens), séjour clinique, soins.\n` +
    `• <b>🌍 Patiente Étrangère</b> : Tarification en EUR (€), séjour clinique + hôtel partenaire 5★ + transferts VIP aéroport & clinique.`,
    { parse_mode: 'HTML', reply_markup: profileKeyboard }
  );

  const profileMsg = await conversation.waitFor(':text');
  const profileChoice = profileMsg.message?.text?.trim();

  if (profileChoice?.includes('Annuler') || profileChoice === '/cancel') {
    return ctx.reply('🚫 Opération annulée.', { reply_markup: { remove_keyboard: true } });
  }

  const isEtranger = profileChoice?.includes('Étrangère') || profileChoice?.includes('EUR');
  const clientType: 'TUNISIEN' | 'ETRANGER' = isEtranger ? 'ETRANGER' : 'TUNISIEN';
  const devise = isEtranger ? 'EUR' : 'TND';
  const fmt = isEtranger ? formatEUR : formatTND;

  // --- ÉTAPE 2 : Choix du type de document (Devis vs Facture) ---
  const typeKeyboard = new Keyboard()
    .text('📄 DEVIS')
    .text('📑 FACTURE')
    .row()
    .text('❌ Annuler')
    .resized()
    .oneTime();

  await ctx.reply(
    `Quel type de document souhaitez-vous créer pour cette patiente ${isEtranger ? 'étrangère' : 'tunisienne'} ?\n\n` +
    `• <b>📄 DEVIS</b> : Proposition d'honoraires détaillée avec conditions et validité\n` +
    `• <b>📑 FACTURE</b> : Facture officielle avec interventions réalisées et net à payer`,
    { parse_mode: 'HTML', reply_markup: typeKeyboard }
  );

  const typeMsg = await conversation.waitFor(':text');
  const typeChoice = typeMsg.message?.text?.trim().toUpperCase();

  if (typeChoice?.includes('ANNULER') || typeChoice === '/CANCEL') {
    return ctx.reply('🚫 Opération annulée.', { reply_markup: { remove_keyboard: true } });
  }

  const documentType: 'DEVIS' | 'FACTURE' = typeChoice?.includes('DEVIS') ? 'DEVIS' : 'FACTURE';
  const todayStr = new Date().toLocaleDateString('fr-FR');

  // Variables communes
  let nomPrenom = 'Patiente';
  let dateDevis = todayStr;
  let dateFacture = todayStr;
  let validiteDevis = '30 jours';
  let interventionTitle = 'Liposuccion';
  let interventionPrevue = 'Liposuccion — Zone abdominale + flancs';
  let dureeTotaleSejour = isEtranger ? '5 jours / 4 nuits' : '1 nuit';
  let dateNaissance = '';
  let passeport = isEtranger ? 'X1234567' : '09876543';
  let dateIntervention = todayStr;
  let zonesTraitees = 'Zone abdominale + flancs';
  let customNumeroFacture = '';

  // Saisie optionnelle du Taux EUR/TND pour patientes étrangères
  let tauxEUR = 3.40;

  const todayKeyboard = new Keyboard()
    .text(`📅 Aujourd'hui (${todayStr})`)
    .resized()
    .oneTime();

  if (isEtranger) {
    await ctx.reply(
      `💱 <b>TAUX DE CHANGE (EUR ➡️ TND)</b>\n\n` +
      `Saisissez le taux de conversion EUR ➡️ TND (Défaut: <code>3.40</code>) :`,
      { parse_mode: 'HTML' }
    );
    const tauxMsg = await conversation.waitFor(':text');
    const parsedTaux = parseFloat(tauxMsg.message?.text?.replace(',', '.') || '3.40');
    if (!isNaN(parsedTaux) && parsedTaux > 0) {
      tauxEUR = parsedTaux;
    }
  }

  if (documentType === 'DEVIS') {
    // ==========================================
    // FLUX SPÉCIFIQUE : DEVIS (Étranger ou Tunisien)
    // ==========================================
    await ctx.reply(
      `👤 <b>SECTION 1 & 2 : INFORMATIONS PATIENTE</b>\n\n` +
      `[V03 / V04] Saisissez le <b>Nom & Prénom</b> de la patiente :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    const nomMsg = await conversation.waitFor(':text');
    nomPrenom = nomMsg.message?.text?.trim() || 'Patiente';

    await ctx.reply(
      `📅 <b>[V01 / V05] Date du devis</b> [Date] :`,
      { parse_mode: 'HTML', reply_markup: todayKeyboard }
    );
    const dateDevisMsg = await conversation.waitFor(':text');
    const dDevisText = dateDevisMsg.message?.text?.trim() || '';
    if (dDevisText.includes("Aujourd'hui")) {
      dateDevis = todayStr;
    } else {
      dateDevis = dDevisText || todayStr;
    }

    const validiteKeyboard = new Keyboard()
      .text('30 jours')
      .text('15 jours')
      .row()
      .text('60 jours')
      .text('90 jours')
      .resized()
      .oneTime();

    await ctx.reply(
      `⏳ <b>[V02 / V33] Validité du devis</b> [Validité] :`,
      { parse_mode: 'HTML', reply_markup: validiteKeyboard }
    );
    const valMsg = await conversation.waitFor(':text');
    validiteDevis = valMsg.message?.text?.trim() || '30 jours';

    const actesKeyboard = new Keyboard()
      .text('Liposuccion')
      .text('BBL Sculpting HD')
      .row()
      .text('Liposuccion + Lipo-injection')
      .text('Rhinoplastie')
      .row()
      .text('Chirurgie Mammaire')
      .resized()
      .oneTime();

    await ctx.reply(
      `💉 <b>Intervention</b> :\nSélectionnez le type d'intervention :`,
      { parse_mode: 'HTML', reply_markup: actesKeyboard }
    );
    const acteMsg = await conversation.waitFor(':text');
    interventionTitle = acteMsg.message?.text?.trim() || 'Liposuccion';

    await ctx.reply(
      `🎯 <b>[V06] Intervention prévue</b>\n(ex: <code>Liposuccion — Abdomen + flancs</code>) :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    const prevMsg = await conversation.waitFor(':text');
    const prevText = prevMsg.message?.text?.trim();
    interventionPrevue = prevText ? prevText : `${interventionTitle} — Abdomen + flancs`;

    const dureeKeyboard = new Keyboard()
      .text(isEtranger ? '5 jours / 4 nuits' : '1 nuit')
      .text(isEtranger ? '4 nuits' : '2 nuits')
      .row()
      .text(isEtranger ? '7 jours / 6 nuits' : 'Soins ambulatoires')
      .resized()
      .oneTime();

    await ctx.reply(
      `🏨 <b>[V07] Durée estimative du séjour</b> [Durée de séjour] :`,
      { parse_mode: 'HTML', reply_markup: dureeKeyboard }
    );
    const durMsg = await conversation.waitFor(':text');
    dureeTotaleSejour = durMsg.message?.text?.trim() || (isEtranger ? '5 jours / 4 nuits' : '1 nuit');

  } else {
    // ==========================================
    // FLUX SPÉCIFIQUE : FACTURE (Étranger ou Tunisien)
    // ==========================================
    const nextAutoNum = await conversation.external(() => FinanceService.generateNextNumero('FACTURE'));
    const numKeyboard = new Keyboard()
      .text(`Numéro auto : ${nextAutoNum}`)
      .resized()
      .oneTime();

    await ctx.reply(
      `📑 <b>SECTION 1 : HEADER</b>\n\n` +
      `[V01] <b>N° de la facture</b> [XXXX] :\n` +
      `<i>Validez le numéro automatique ou saisissez une référence personnalisée (ex: FAC-2024-001)</i>`,
      { parse_mode: 'HTML', reply_markup: numKeyboard }
    );
    const numMsg = await conversation.waitFor(':text');
    const numInput = numMsg.message?.text?.trim();
    if (numInput?.includes('Numéro auto :')) {
      customNumeroFacture = nextAutoNum;
    } else if (numInput && numInput !== '-') {
      customNumeroFacture = numInput;
    } else {
      customNumeroFacture = nextAutoNum;
    }

    await ctx.reply(
      `📅 <b>[V02] Date de la facture</b> [Date] :`,
      { parse_mode: 'HTML', reply_markup: todayKeyboard }
    );
    const dateFactMsg = await conversation.waitFor(':text');
    const dFactText = dateFactMsg.message?.text?.trim() || '';
    if (dFactText.includes("Aujourd'hui")) {
      dateFacture = todayStr;
    } else {
      dateFacture = dFactText || todayStr;
    }

    await ctx.reply(
      `🏥 <b>[V03] Date de l'intervention</b> [Date] :`,
      { parse_mode: 'HTML', reply_markup: todayKeyboard }
    );
    const dateIntMsg = await conversation.waitFor(':text');
    const dIntText = dateIntMsg.message?.text?.trim() || '';
    if (dIntText.includes("Aujourd'hui")) {
      dateIntervention = todayStr;
    } else {
      dateIntervention = dIntText || todayStr;
    }

    const zonesKeyboard = new Keyboard()
      .text('Abdomen + flancs')
      .text('Abdomen complet')
      .row()
      .text('Flancs + culotte de cheval')
      .text('Bras + cuisses')
      .resized()
      .oneTime();

    await ctx.reply(
      `🎯 <b>[V04] Zones traitées</b> [À préciser] (ex: <code>Abdomen + flancs</code>) :`,
      { parse_mode: 'HTML', reply_markup: zonesKeyboard }
    );
    const zonesMsg = await conversation.waitFor(':text');
    const zText = zonesMsg.message?.text?.trim();
    zonesTraitees = zText && zText !== '-' ? zText : 'Abdomen + flancs';
    interventionPrevue = `Liposuccion — ${zonesTraitees}`;

    // SECTION 2 : INFORMATIONS PATIENTE
    await ctx.reply(
      `👤 <b>SECTION 2 : INFORMATIONS PATIENTE</b>\n\n` +
      `[V05] Saisissez le <b>Nom & Prénom</b> de la patiente :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    const nomMsg = await conversation.waitFor(':text');
    nomPrenom = nomMsg.message?.text?.trim() || 'Patiente';

    await ctx.reply(
      `🎂 <b>[V06] Date de naissance</b> [Date de naissance] (ex: <code>12/03/1990</code> ou tapez <code>-</code> si non renseignée) :`,
      { parse_mode: 'HTML' }
    );
    const birthMsg = await conversation.waitFor(':text');
    const rawBirth = birthMsg.message?.text?.trim();
    dateNaissance = rawBirth === '-' ? '' : (rawBirth || '');

    await ctx.reply(
      `🔒 <b>[V07] N° ${isEtranger ? 'Passeport / CIN' : 'CIN / Passeport'}</b> [Référence] (ex: <code>${isEtranger ? 'X1234567' : '09876543'}</code>) :\n` +
      `<i>ℹ️ Chiffré en AES-256 dans la base de données.</i>`,
      { parse_mode: 'HTML' }
    );
    const passMsg = await conversation.waitFor(':text');
    passeport = passMsg.message?.text?.trim() || (isEtranger ? 'X1234567' : '09876543');
  }

  // Informations de contact secondaires (optionnelles pour registre)
  let telephone = '+216 26 723 876';
  let nationalite = isEtranger ? 'Française' : 'Tunisienne';
  let paysResidence = isEtranger ? 'France' : 'Tunisie';

  // --- ÉTAPE 3 : PRESTATIONS MÉDICALES ---
  // Pour la saisie, on demande toujours en TND (Dinars Tunisiens)
  const deviseSaisie = 'TND';

  await ctx.reply(
    `📋 <b>1. PRESTATIONS MÉDICALES (En ${deviseSaisie})</b>\n\n` +
    `Veuillez saisir les montants en TND pour chacune des 12 prestations officielles :`,
    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
  );

  // Valeurs par défaut toujours exprimées en TND
  let m_consultation = 100;
  let m_bilan = 150;
  let m_honoraires = 6000;
  let m_anesthesie = 800;
  let m_bloc = 1200;
  let nuitsClinique = 1;
  let m_sejour_clinique = 700;
  let m_soins = 200;
  let m_medicaments = 150;
  let m_contention = 250;
  let m_drainage = 200;
  let m_accompagnateur = 0;
  let m_controle = 0;

  // Saisie directe de chaque ligne en TND
  await ctx.reply(`▫️ 1. <b>Consultation préopératoire</b> (montant en ${deviseSaisie}, défaut: ${m_consultation}) :`, { parse_mode: 'HTML' });
  const cMsg = await conversation.waitFor(':text');
  const cVal = parseFloat(cMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(cVal)) m_consultation = cVal;

  await ctx.reply(`▫️ 2. <b>Bilan / examens préopératoires</b> (montant en ${deviseSaisie}, défaut: ${m_bilan}) :`, { parse_mode: 'HTML' });
  const bMsg = await conversation.waitFor(':text');
  const bVal = parseFloat(bMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(bVal)) m_bilan = bVal;

  await ctx.reply(`▫️ 3. <b>Honoraires chirurgicaux</b> (montant en ${deviseSaisie}, défaut: ${m_honoraires}) :`, { parse_mode: 'HTML' });
  const hMsg = await conversation.waitFor(':text');
  const hVal = parseFloat(hMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(hVal)) m_honoraires = hVal;

  await ctx.reply(`▫️ 4. <b>Anesthésie</b> (montant en ${deviseSaisie}, défaut: ${m_anesthesie}) :`, { parse_mode: 'HTML' });
  const aMsg = await conversation.waitFor(':text');
  const aVal = parseFloat(aMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(aVal)) m_anesthesie = aVal;

  await ctx.reply(`▫️ 5. <b>Frais de bloc opératoire</b> (montant en ${deviseSaisie}, défaut: ${m_bloc}) :`, { parse_mode: 'HTML' });
  const blMsg = await conversation.waitFor(':text');
  const blVal = parseFloat(blMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(blVal)) m_bloc = blVal;

  await ctx.reply(`▫️ 6. <b>Séjour en clinique — Nombre de nuit(s)</b> (défaut: 1) :`, { parse_mode: 'HTML' });
  const qClMsg = await conversation.waitFor(':text');
  const qClVal = parseInt(qClMsg.message?.text?.trim() || '1', 10);
  if (!isNaN(qClVal) && qClVal > 0) nuitsClinique = qClVal;

  await ctx.reply(`▫️ 6. <b>Séjour en clinique — Montant total</b> (en ${deviseSaisie}, défaut: ${m_sejour_clinique * nuitsClinique}) :`, { parse_mode: 'HTML' });
  const mClMsg = await conversation.waitFor(':text');
  const mClVal = parseFloat(mClMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(mClVal)) m_sejour_clinique = mClVal;

  await ctx.reply(`▫️ 7. <b>Soins et surveillance postopératoires</b> (montant en ${deviseSaisie}, défaut: ${m_soins}) :`, { parse_mode: 'HTML' });
  const sMsg = await conversation.waitFor(':text');
  const sVal = parseFloat(sMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(sVal)) m_soins = sVal;

  await ctx.reply(`▫️ 8. <b>Médicaments et soins postopératoires</b> (montant en ${deviseSaisie}, défaut: ${m_medicaments}) :`, { parse_mode: 'HTML' });
  const medMsg = await conversation.waitFor(':text');
  const medVal = parseFloat(medMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(medVal)) m_medicaments = medVal;

  await ctx.reply(`▫️ 9. <b>Vêtement de contention</b> (montant en ${deviseSaisie}, défaut: ${m_contention}) :`, { parse_mode: 'HTML' });
  const conMsg = await conversation.waitFor(':text');
  const conVal = parseFloat(conMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(conVal)) m_contention = conVal;

  await ctx.reply(`▫️ 10. <b>Drainage</b> (montant en ${deviseSaisie}, défaut: ${m_drainage}) :`, { parse_mode: 'HTML' });
  const drMsg = await conversation.waitFor(':text');
  const drVal = parseFloat(drMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(drVal)) m_drainage = drVal;

  await ctx.reply(`▫️ 11. <b>Supplément accompagnateur</b> (montant en ${deviseSaisie}, tapez 0 si aucun) :`, { parse_mode: 'HTML' });
  const accMsg = await conversation.waitFor(':text');
  const accVal = parseFloat(accMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(accVal)) m_accompagnateur = accVal;

  await ctx.reply(`▫️ 12. <b>Contrôle postopératoire</b> (montant en ${deviseSaisie}, tapez 0 si inclus) :`, { parse_mode: 'HTML' });
  const ctrMsg = await conversation.waitFor(':text');
  const ctrVal = parseFloat(ctrMsg.message?.text?.replace(',', '.') || '');
  if (!isNaN(ctrVal)) m_controle = ctrVal;

  // Fonction Helper pour convertir un montant TND en EUR si la patiente est étrangère
  const toFinalDevise = (amountInTND: number) => {
    if (isEtranger && tauxEUR > 0) {
      return Math.round((amountInTND / tauxEUR) * 100) / 100;
    }
    return amountInTND;
  };

  // Construction du tableau des prestations converties en EUR si patiente étrangère
  const prestations = [
    { designation: 'Consultation préopératoire', quantite: 1, prixUnitaire: toFinalDevise(m_consultation) },
    { designation: 'Bilan / examens préopératoires', quantite: 1, prixUnitaire: toFinalDevise(m_bilan) },
    { designation: 'Honoraires chirurgicaux', quantite: 1, prixUnitaire: toFinalDevise(m_honoraires) },
    { designation: 'Anesthésie', quantite: 1, prixUnitaire: toFinalDevise(m_anesthesie) },
    { designation: 'Frais de bloc opératoire', quantite: 1, prixUnitaire: toFinalDevise(m_bloc) },
    { designation: `Séjour en clinique – ${nuitsClinique} nuit(s)`, quantite: nuitsClinique, prixUnitaire: toFinalDevise(nuitsClinique > 0 ? m_sejour_clinique / nuitsClinique : m_sejour_clinique) },
    { designation: 'Soins et surveillance postopératoires', quantite: 1, prixUnitaire: toFinalDevise(m_soins) },
    { designation: 'Médicaments et soins postopératoires', quantite: 1, prixUnitaire: toFinalDevise(m_medicaments) },
    { designation: 'Vêtement de contention', quantite: 1, prixUnitaire: toFinalDevise(m_contention) },
    { designation: 'Drainage', quantite: 1, prixUnitaire: toFinalDevise(m_drainage) },
    { designation: 'Supp. accompagnateur', quantite: 1, prixUnitaire: toFinalDevise(m_accompagnateur) },
    { designation: 'Contrôle postopératoire', quantite: 1, prixUnitaire: toFinalDevise(m_controle) },
  ];

  const totalPrestations = prestations.reduce((sum, p) => sum + p.quantite * p.prixUnitaire, 0);

  // --- ÉTAPE 4 : SPÉCIFICITÉS ÉTRANGER (Hôtel & Transferts VIP) ---
  let nomHotel = 'Hôtel The Residence Tunis 5★';
  let nuitsHotel = '4 nuits';
  let montantHotel = isEtranger ? 400 : 0;
  let nuitsAccompagnateurHotel = '';
  let montantAccompagnateurHotel = 0;

  let transferts: Array<{ designation: string; quantite: number; montant: number }> = [];
  let sousTotalTransferts = 0;

  if (isEtranger) {
    const hotelPromptKeyboard = new Keyboard()
      .text('⭐ Standard (4 nuits - The Residence 5★ : 400 €)')
      .row()
      .text('✏️ Personnaliser l\'hébergement')
      .resized()
      .oneTime();

    await ctx.reply(
      `🏨 <b>2. HÉBERGEMENT HÔTELIER PARTENAIRE 5★</b>\n\n` +
      `Choisissez l'option d'hébergement pour la patiente :`,
      { parse_mode: 'HTML', reply_markup: hotelPromptKeyboard }
    );
    const hotelChoice = await conversation.waitFor(':text');

    if (hotelChoice.message?.text?.includes('Personnaliser')) {
      await ctx.reply(`▫️ Nom de l'hôtel (ex: <code>Hôtel The Residence Tunis 5★</code>) :`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
      const hNomMsg = await conversation.waitFor(':text');
      nomHotel = hNomMsg.message?.text?.trim() || nomHotel;

      await ctx.reply(`▫️ Nombre de nuits (ex: <code>4 nuits</code>) :`, { parse_mode: 'HTML' });
      const hNuitsMsg = await conversation.waitFor(':text');
      nuitsHotel = hNuitsMsg.message?.text?.trim() || nuitsHotel;

      await ctx.reply(`▫️ Montant total hôtel en EUR (ex: <code>400</code>) :`, { parse_mode: 'HTML' });
      const hMontMsg = await conversation.waitFor(':text');
      montantHotel = Math.max(0, parseFloat(hMontMsg.message?.text?.replace(',', '.') || '400') || 400);

      await ctx.reply(
        `▫️ Supp. accompagnateur hôtel (en EUR, tapez <code>0</code> si aucun) :`,
        { parse_mode: 'HTML' }
      );
      const accMontMsg = await conversation.waitFor(':text');
      montantAccompagnateurHotel = Math.max(0, parseFloat(accMontMsg.message?.text?.replace(',', '.') || '0') || 0);
      if (montantAccompagnateurHotel > 0) {
        nuitsAccompagnateurHotel = nuitsHotel;
      }
    }

    transferts = [
      { designation: "Accueil à l'aéroport", quantite: 1, montant: 30 },
      { designation: 'Transfert aéroport – hôtel', quantite: 1, montant: 35 },
      { designation: 'Transfert hôtel – clinique', quantite: 1, montant: 25 },
      { designation: 'Transfert clinique – hôtel', quantite: 1, montant: 25 },
      { designation: 'Transfert hôtel – aéroport', quantite: 1, montant: 35 },
      { designation: 'Assistance pendant le séjour', quantite: 1, montant: 50 },
    ];
    sousTotalTransferts = transferts.reduce((sum, t) => sum + t.montant, 0);
  }

  // --- ÉTAPE 5 : Acompte déjà réglé & Net à payer ---
  const totalSejour = isEtranger
    ? totalPrestations + montantHotel + montantAccompagnateurHotel + sousTotalTransferts
    : totalPrestations;

  const totalSejourEUR = isEtranger ? totalSejour : (tauxEUR > 0 ? totalSejour / tauxEUR : 0);

  let acompte = 0;
  if (documentType === 'FACTURE') {
    await ctx.reply(
      `💰 <b>MONTANT DÉJÀ RÉGLÉ & NET À PAYER</b>\n\n` +
      `• Montant total de la facture : <b>${fmt(totalSejour)} ${devise}</b>\n\n` +
      `Indiquez le <b>Montant déjà réglé</b> par la patiente (en ${devise}, tapez <code>0</code> si aucun règlement préliminaire) :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    const acompteMsg = await conversation.waitFor(':text');
    acompte = Math.max(0, parseFloat(acompteMsg.message?.text?.replace(',', '.') || '0') || 0);
  }

  const netAPayer = Math.max(0, totalSejour - acompte);

  // Charges internes pour calcul de la marge nette
  const charges: Array<{ categorie: CategorieCharge; montant: number; description: string }> = [
    { categorie: 'Bloc', montant: m_bloc, description: 'Frais de bloc opératoire' },
    { categorie: 'Clinique', montant: m_sejour_clinique, description: 'Séjour clinique' },
    { categorie: 'Chirurgie', montant: Math.round(m_honoraires * 0.6), description: 'Rémunération équipe médicale' },
  ];
  if (isEtranger) {
    charges.push({ categorie: 'Hôtel', montant: montantHotel, description: 'Frais hôtel partenaire 5★' });
    charges.push({ categorie: 'Transfert', montant: sousTotalTransferts, description: 'Service chauffeur privé VIP' });
  }
  const totalCharges = charges.reduce((sum, c) => sum + c.montant, 0);
  const margeNette = Math.round((totalSejour - totalCharges) * 1000) / 1000;

  // --- ÉTAPE 6 : CONFIRMATION & GÉNÉRATION PDF ---
  const templateNom = isEtranger
    ? (documentType === 'DEVIS' ? 'devis_etranger.hbs' : 'facture_etranger.hbs')
    : (documentType === 'DEVIS' ? 'devis_tunisien.hbs' : 'facture_tunisien.hbs');

  const confirmKeyboard = new Keyboard()
    .text('✅ Confirmer & Générer le PDF')
    .text('❌ Annuler')
    .resized()
    .oneTime();

  await ctx.reply(
    `📋 <b>RÉCAPITULATIF DU DOCUMENT PERLA BODY SCULPT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• <b>Type</b> : <b>${documentType}</b> (${isEtranger ? '🌍 Étranger EUR' : '🇹🇳 Tunisien TND'})\n` +
    `• <b>Template officiel</b> : <code>${templateNom}</code>\n` +
    `• <b>Patiente</b> : <b>${nomPrenom}</b>\n` +
    (documentType === 'DEVIS'
      ? `• <b>Date devis</b> : ${dateDevis} | <b>Validité</b> : ${validiteDevis}\n` +
        `• <b>Intervention</b> : ${interventionPrevue}\n` +
        `• <b>Durée de séjour</b> : ${dureeTotaleSejour}\n`
      : `• <b>Date facture</b> : ${dateFacture} | <b>Intervention le</b> : ${dateIntervention}\n` +
        `• <b>Passeport / CIN</b> : Chiffré AES-256 (<code>${passeport}</code>)\n` +
        `• <b>Zones traitées</b> : ${zonesTraitees}\n`) +
    `• <b>Prestations médicales (12 lignes)</b> : ${fmt(totalPrestations)} ${devise}\n` +
    (isEtranger ? `• <b>Hôtel 5★</b> : ${nomHotel} (${nuitsHotel} - ${fmt(montantHotel + montantAccompagnateurHotel)} EUR)\n` : '') +
    (isEtranger ? `• <b>Transferts VIP</b> : Inclus (${fmt(sousTotalTransferts)} EUR)\n` : '') +
    `• <b>Total de la pièce</b> : <b>${fmt(totalSejour)} ${devise}</b>\n` +
    (isEtranger ? `• <b>Taux appliqué</b> : 1 EUR = ${tauxEUR.toFixed(2)} TND\n` : '') +
    (documentType === 'FACTURE' ? `• <b>Déjà réglé</b> : ${fmt(acompte)} ${devise} | <b>Net à payer</b> : <b>${fmt(netAPayer)} ${devise}</b>\n` : '') +
    `• <b>Marge Nette estimée</b> : 💎 <b>${fmt(margeNette)} ${devise}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Générer le PDF haute définition prêt à l'impression ?`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard }
  );

  const confirmMsg = await conversation.waitFor(':text');
  if (!confirmMsg.message?.text?.includes('Confirmer')) {
    return ctx.reply('🚫 Création du document annulée.', { reply_markup: { remove_keyboard: true } });
  }

  // Rendu PDF avec Puppeteer & Handlebars
  await ctx.reply(
    `⏳ <i>Génération du PDF officiel en cours via Puppeteer (${templateNom})...</i>`,
    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
  );

  try {
    const pdfData = await conversation.external(async () => {
      // 1. Création du document en BDD
      const { doc, patient } = await FinanceService.createDocument({
        type: documentType,
        clientType,
        devise,
        patientData: { nomPrenom, passeport, telephone, nationalite, paysResidence, dateNaissance },
        actePrincipal: interventionTitle,
        prestations,
        charges,
        acompte,
        nomHotel,
        nuitsHotel,
        montantHotel,
        nuitsAccompagnateurHotel,
        montantAccompagnateurHotel,
        transferts,
        dureeSejourClinique: `${nuitsClinique} nuit(s)`,
        zonesTraitees,
        validiteDevis,
        dateDevis,
        dateFacture,
        dateIntervention,
        dureeTotaleSejour,
        interventionPrevue,
        nuitsClinique,
        numeroFacture: customNumeroFacture || undefined,
      });

      // 2. Préparation de l'objet contextuel pour Handlebars
      const docObject = doc.toObject ? doc.toObject() : doc;

      // Force la devise et les totaux calculés exacts dans le payload pour Handlebars
      const payloadPdf = {
        ...docObject,
        devise: devise, // Explicitement 'EUR' ou 'TND'
        tauxEUR: tauxEUR.toFixed(2),
        totalSejourEUR: totalSejourEUR.toFixed(2),
        // Si c'est un étranger, le total principal affiché est totalSejour en EUR
        totalSejour: isEtranger ? totalSejour.toFixed(2) : totalSejour.toFixed(2),
      };

      // 3. Génération du PDF Buffer
      const buffer = await PdfService.generatePdf(payloadPdf, patient);

      // 4. Retourne des types primitifs sérialisables
      return {
        bufferBase64: buffer.toString('base64'),
        numeroFacture: doc.numeroFacture,
        totalHT: doc.totalHT,
        acompte: doc.acompte,
        soldeRestant: doc.soldeRestant,
        margeNette: doc.margeNette,
        totalSejourEUR,
        tauxEUR,
      };
    });

    // Reconstitution du Buffer depuis le string Base64
    const pdfBuffer = Buffer.from(pdfData.bufferBase64, 'base64');
    const fileName = `${pdfData.numeroFacture}_${nomPrenom.replace(/\s+/g, '_')}.pdf`;

    await ctx.replyWithDocument(new InputFile(pdfBuffer, fileName), {
      caption:
        `✨ <b>${documentType} OFFICIEL — PERLA BODY SCULPT</b>\n\n` +
        `• <b>Numéro</b> : <code>${pdfData.numeroFacture}</code>\n` +
        `• <b>Patiente</b> : ${nomPrenom}\n` +
        `• <b>Modèle appliqué</b> : ${isEtranger ? 'Étranger (EUR)' : 'Tunisien (TND)'}\n` +
        `• <b>Montant Total</b> : <b>${fmt(pdfData.totalHT)} ${devise}</b>\n` +
        (isEtranger ? `• <b>Equivalent EUR</b> : <b>${formatEUR(pdfData.totalSejourEUR)} €</b> (Taux: ${pdfData.tauxEUR.toFixed(2)})\n` : '') +
        (documentType === 'FACTURE'
          ? `• <b>Acompte réglé</b> : ${fmt(pdfData.acompte)} ${devise}\n` +
            `• <b>Net à payer</b> : <b>${fmt(pdfData.soldeRestant)} ${devise}</b>\n`
          : '') +
        `• <b>Marge Nette</b> : 🟢 ${fmt(pdfData.margeNette)} ${devise}\n\n` +
        `<i>Document prêt à être imprimé ou transmis à la patiente.</i>`,
      parse_mode: 'HTML',
    });
  } catch (error: any) {
    console.error('Erreur génération PDF bot:', error);
    await ctx.reply(
      `⚠️ <b>Erreur lors de la génération du PDF :</b> ${error.message}\n` +
      `<i>Le document a néanmoins été sauvegardé dans la base chiffrée.</i>`,
      { parse_mode: 'HTML' }
    );
  }
}