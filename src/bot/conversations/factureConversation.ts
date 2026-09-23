import { type Conversation, type ConversationFlavor } from '@grammyjs/conversations';
import { type Context, type SessionFlavor, InputFile, Keyboard } from 'grammy';
import { FinanceService } from '../../services/financeService.js';
import { PdfService, formatTND, formatEUR } from '../../services/pdfService.js';
import { CategorieCharge } from '../../models/Facture.js';

export type BotContext = ConversationFlavor<Context & SessionFlavor<Record<string, any>>>;
export type BotConversation = Conversation<BotContext, BotContext>;

export async function createDocumentConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  // --- ÉTAPE 1 : Choix du profil client ---
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
    `• <b>🇹🇳 Patiente Tunisienne</b> : Tarification en TND.\n` +
    `• <b>🌍 Patiente Étrangère</b> : Tarification saisie en TND avec conversion automatique du Total en EUR fil-lākhir.`,
    { parse_mode: 'HTML', reply_markup: profileKeyboard }
  );

  const profileMsg = await conversation.waitFor(':text');
  const profileChoice = profileMsg.message?.text?.trim();

  if (profileChoice?.includes('Annuler') || profileChoice === '/cancel') {
    return ctx.reply('🚫 Opération annulée.', { reply_markup: { remove_keyboard: true } });
  }

  const isEtranger = profileChoice?.includes('Étrangère') || profileChoice?.includes('EUR');
  const clientType: 'TUNISIEN' | 'ETRANGER' = isEtranger ? 'ETRANGER' : 'TUNISIEN';

  // --- ÉTAPE 2 : Choix du type de document ---
  const typeKeyboard = new Keyboard()
    .text('📄 DEVIS')
    .text('📑 FACTURE')
    .row()
    .text('❌ Annuler')
    .resized()
    .oneTime();

  await ctx.reply(
    `Quel type de document souhaitez-vous créer ?\n\n` +
    `• <b>📄 DEVIS</b> : Proposition d'honoraires détaillée\n` +
    `• <b>📑 FACTURE</b> : Facture officielle`,
    { parse_mode: 'HTML', reply_markup: typeKeyboard }
  );

  const typeMsg = await conversation.waitFor(':text');
  const typeChoice = typeMsg.message?.text?.trim().toUpperCase();

  if (typeChoice?.includes('ANNULER') || typeChoice === '/CANCEL') {
    return ctx.reply('🚫 Opération annulée.', { reply_markup: { remove_keyboard: true } });
  }

  const documentType: 'DEVIS' | 'FACTURE' = typeChoice?.includes('DEVIS') ? 'DEVIS' : 'FACTURE';
  const todayStr = new Date().toLocaleDateString('fr-FR');

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

  let tauxEUR = 3.40;

  const todayKeyboard = new Keyboard()
    .text(`📅 Aujourd'hui (${todayStr})`)
    .resized()
    .oneTime();

  // Taux de change appliqué pour la conversion finale en EUR
  if (isEtranger) {
    await ctx.reply(
      `💱 <b>TAUX DE CHANGE (EUR ➡️ TND)</b>\n\n` +
      `Saisissez le taux de conversion (Exemple: <code>3.40</code>) :`,
      { parse_mode: 'HTML' }
    );
    const tauxMsg = await conversation.waitFor(':text');
    const parsedTaux = parseFloat(tauxMsg.message?.text?.replace(',', '.') || '3.40');
    if (!isNaN(parsedTaux) && parsedTaux > 0) {
      tauxEUR = parsedTaux;
    }
  }

  if (documentType === 'DEVIS') {
    await ctx.reply(
      `👤 <b>SECTION 1 & 2 : INFORMATIONS PATIENTE</b>\n\n` +
      `Saisissez le <b>Nom & Prénom</b> de la patiente :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    const nomMsg = await conversation.waitFor(':text');
    nomPrenom = nomMsg.message?.text?.trim() || 'Patiente';

    await ctx.reply(
      `📅 <b>Date du devis</b> :`,
      { parse_mode: 'HTML', reply_markup: todayKeyboard }
    );
    const dateDevisMsg = await conversation.waitFor(':text');
    const dDevisText = dateDevisMsg.message?.text?.trim() || '';
    dateDevis = dDevisText.includes("Aujourd'hui") ? todayStr : (dDevisText || todayStr);

    const validiteKeyboard = new Keyboard()
      .text('30 jours')
      .text('15 jours')
      .row()
      .text('60 jours')
      .text('90 jours')
      .resized()
      .oneTime();

    await ctx.reply(
      `⏳ <b>Validité du devis</b> :`,
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
      `🎯 <b>Intervention prévue</b> (ex: <code>Liposuccion — Abdomen + flancs</code>) :`,
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
      `🏨 <b>Durée estimative du séjour</b> :`,
      { parse_mode: 'HTML', reply_markup: dureeKeyboard }
    );
    const durMsg = await conversation.waitFor(':text');
    dureeTotaleSejour = durMsg.message?.text?.trim() || (isEtranger ? '5 jours / 4 nuits' : '1 nuit');

  } else {
    const nextAutoNum = await conversation.external(() => FinanceService.generateNextNumero('FACTURE'));
    const numKeyboard = new Keyboard()
      .text(`Numéro auto : ${nextAutoNum}`)
      .resized()
      .oneTime();

    await ctx.reply(
      `📑 <b>SECTION 1 : HEADER</b>\n\n` +
      `<b>N° de la facture</b> :`,
      { parse_mode: 'HTML', reply_markup: numKeyboard }
    );
    const numMsg = await conversation.waitFor(':text');
    const numInput = numMsg.message?.text?.trim();
    customNumeroFacture = (numInput?.includes('Numéro auto :') || !numInput || numInput === '-') ? nextAutoNum : numInput;

    await ctx.reply(`📅 <b>Date de la facture</b> :`, { parse_mode: 'HTML', reply_markup: todayKeyboard });
    const dateFactMsg = await conversation.waitFor(':text');
    const dFactText = dateFactMsg.message?.text?.trim() || '';
    dateFacture = dFactText.includes("Aujourd'hui") ? todayStr : (dFactText || todayStr);

    await ctx.reply(`🏥 <b>Date de l'intervention</b> :`, { parse_mode: 'HTML', reply_markup: todayKeyboard });
    const dateIntMsg = await conversation.waitFor(':text');
    const dIntText = dateIntMsg.message?.text?.trim() || '';
    dateIntervention = dIntText.includes("Aujourd'hui") ? todayStr : (dIntText || todayStr);

    const zonesKeyboard = new Keyboard()
      .text('Abdomen + flancs')
      .text('Abdomen complet')
      .row()
      .text('Flancs + culotte de cheval')
      .text('Bras + cuisses')
      .resized()
      .oneTime();

    await ctx.reply(`🎯 <b>Zones traitées</b> :`, { parse_mode: 'HTML', reply_markup: zonesKeyboard });
    const zonesMsg = await conversation.waitFor(':text');
    const zText = zonesMsg.message?.text?.trim();
    zonesTraitees = zText && zText !== '-' ? zText : 'Abdomen + flancs';
    interventionPrevue = `Liposuccion — ${zonesTraitees}`;

    await ctx.reply(`👤 <b>Nom & Prénom de la patiente</b> :`, { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } });
    const nomMsg = await conversation.waitFor(':text');
    nomPrenom = nomMsg.message?.text?.trim() || 'Patiente';

    await ctx.reply(`🎂 <b>Date de naissance</b> (ex: <code>12/03/1990</code> ou <code>-</code>) :`, { parse_mode: 'HTML' });
    const birthMsg = await conversation.waitFor(':text');
    const rawBirth = birthMsg.message?.text?.trim();
    dateNaissance = rawBirth === '-' ? '' : (rawBirth || '');

    await ctx.reply(`🔒 <b>N° Passeport / CIN</b> :`, { parse_mode: 'HTML' });
    const passMsg = await conversation.waitFor(':text');
    passeport = passMsg.message?.text?.trim() || (isEtranger ? 'X1234567' : '09876543');
  }

  let telephone = '+216 26 723 876';
  let nationalite = isEtranger ? 'Française' : 'Tunisienne';
  let paysResidence = isEtranger ? 'France' : 'Tunisie';

  // --- ÉTAPE 3 : PRESTATIONS MÉDICALES (SAISIE 100% EN TND) ---
  await ctx.reply(
    `📋 <b>1. PRESTATIONS MÉDICALES (En TND)</b>\n\n` +
    `Saisissez les montants en Dinars Tunisiens (TND) :`,
    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
  );

  let m_consultation = 100, m_bilan = 150, m_honoraires = 6000, m_anesthesie = 800, m_bloc = 1200;
  let nuitsClinique = 1, m_sejour_clinique = 700, m_soins = 200, m_medicaments = 150;
  let m_contention = 250, m_drainage = 200, m_accompagnateur = 0, m_controle = 0;

  await ctx.reply(`▫️ 1. <b>Consultation préopératoire (TND)</b> (défaut: ${m_consultation}) :`, { parse_mode: 'HTML' });
  let val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_consultation = val;

  await ctx.reply(`▫️ 2. <b>Bilan / examens préopératoires (TND)</b> (défaut: ${m_bilan}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_bilan = val;

  await ctx.reply(`▫️ 3. <b>Honoraires chirurgicaux (TND)</b> (défaut: ${m_honoraires}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_honoraires = val;

  await ctx.reply(`▫️ 4. <b>Anesthésie (TND)</b> (défaut: ${m_anesthesie}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_anesthesie = val;

  await ctx.reply(`▫️ 5. <b>Frais de bloc opératoire (TND)</b> (défaut: ${m_bloc}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_bloc = val;

  await ctx.reply(`▫️ 6. <b>Séjour en clinique — Nombre de nuit(s)</b> (défaut: 1) :`, { parse_mode: 'HTML' });
  const qClVal = parseInt((await conversation.waitFor(':text')).message?.text?.trim() || '1', 10);
  if (!isNaN(qClVal) && qClVal > 0) nuitsClinique = qClVal;

  await ctx.reply(`▫️ 6. <b>Séjour en clinique — Total TND</b> (défaut: ${m_sejour_clinique * nuitsClinique}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_sejour_clinique = val;

  await ctx.reply(`▫️ 7. <b>Soins postopératoires (TND)</b> (défaut: ${m_soins}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_soins = val;

  await ctx.reply(`▫️ 8. <b>Médicaments (TND)</b> (défaut: ${m_medicaments}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_medicaments = val;

  await ctx.reply(`▫️ 9. <b>Vêtement de contention (TND)</b> (défaut: ${m_contention}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_contention = val;

  await ctx.reply(`▫️ 10. <b>Drainage (TND)</b> (défaut: ${m_drainage}) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_drainage = val;

  await ctx.reply(`▫️ 11. <b>Supplément accompagnateur (TND)</b> (tapez 0 si aucun) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_accompagnateur = val;

  await ctx.reply(`▫️ 12. <b>Contrôle postopératoire (TND)</b> (tapez 0 si inclus) :`, { parse_mode: 'HTML' });
  val = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
  if (!isNaN(val)) m_controle = val;

  const prestations = [
    { designation: 'Consultation préopératoire', quantite: 1, prixUnitaire: m_consultation },
    { designation: 'Bilan / examens préopératoires', quantite: 1, prixUnitaire: m_bilan },
    { designation: 'Honoraires chirurgicaux', quantite: 1, prixUnitaire: m_honoraires },
    { designation: 'Anesthésie', quantite: 1, prixUnitaire: m_anesthesie },
    { designation: 'Frais de bloc opératoire', quantite: 1, prixUnitaire: m_bloc },
    { designation: `Séjour en clinique – ${nuitsClinique} nuit(s)`, quantite: nuitsClinique, prixUnitaire: nuitsClinique > 0 ? m_sejour_clinique / nuitsClinique : m_sejour_clinique },
    { designation: 'Soins et surveillance postopératoires', quantite: 1, prixUnitaire: m_soins },
    { designation: 'Médicaments et soins postopératoires', quantite: 1, prixUnitaire: m_medicaments },
    { designation: 'Vêtement de contention', quantite: 1, prixUnitaire: m_contention },
    { designation: 'Drainage', quantite: 1, prixUnitaire: m_drainage },
    { designation: 'Supp. accompagnateur', quantite: 1, prixUnitaire: m_accompagnateur },
    { designation: 'Contrôle postopératoire', quantite: 1, prixUnitaire: m_controle },
  ];

  // --- ÉTAPE 4 : HÔTEL ET TRANSFERTS VIP DÉTAILLÉS (EN TND) ---
  let nomHotel = 'Hôtel The Residence Tunis 5★';
  let nuitsHotel = '4 nuits';
  let nbNuitsHotelNum = 4;
  let prixNuiteeHotelTND = 340;
  let montantHotelTND = isEtranger ? 1360 : 0;
  let nuitsAccompagnateurHotel = '';
  let montantAccompagnateurHotelTND = 0;

  let transferts: Array<{ designation: string; quantite: number; montant: number }> = [];
  let sousTotalTransfertsTND = 0;

  if (isEtranger) {
    // === 2. HÔTEL PARTENAIRE (EN TND) ===
    const hotelPromptKeyboard = new Keyboard()
      .text('⭐ Standard (4 nuits @ 340 TND/nuit = 1360 TND)')
      .row()
      .text('✏️ Personnaliser l\'hébergement')
      .resized()
      .oneTime();

    await ctx.reply(
      `🏨 <b>2. HÉBERGEMENT HÔTELIER PARTENAIRE  (En TND)</b>\n\n` +
      `Choisissez l'option d'hébergement :`,
      { parse_mode: 'HTML', reply_markup: hotelPromptKeyboard }
    );
    const hotelChoice = await conversation.waitFor(':text');

    if (hotelChoice.message?.text?.includes('Personnaliser')) {
      await ctx.reply(`▫️ Nom de l'hôtel (ex: <code>Hôtel The Residence Tunis </code>) :`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
      const hNomMsg = await conversation.waitFor(':text');
      nomHotel = hNomMsg.message?.text?.trim() || nomHotel;

      await ctx.reply(`▫️ Nombre de nuits (ex: <code>4</code>) :`, { parse_mode: 'HTML' });
      const hNuitsMsg = await conversation.waitFor(':text');
      nbNuitsHotelNum = parseInt(hNuitsMsg.message?.text?.trim() || '4', 10) || 4;
      nuitsHotel = `${nbNuitsHotelNum} nuits`;

      await ctx.reply(`▫️ Prix de la nuitée en TND (ex: <code>340</code>) :`, { parse_mode: 'HTML' });
      const hPrixNuitMsg = await conversation.waitFor(':text');
      prixNuiteeHotelTND = parseFloat(hPrixNuitMsg.message?.text?.replace(',', '.') || '340') || 340;

      montantHotelTND = nbNuitsHotelNum * prixNuiteeHotelTND;

      await ctx.reply(
        `▫️ Supplément accompagnateur hôtel en TND (Total séjour, tapez <code>0</code> si aucun) :`,
        { parse_mode: 'HTML' }
      );
      const accMontMsg = await conversation.waitFor(':text');
      montantAccompagnateurHotelTND = Math.max(0, parseFloat(accMontMsg.message?.text?.replace(',', '.') || '0') || 0);
      if (montantAccompagnateurHotelTND > 0) {
        nuitsAccompagnateurHotel = nuitsHotel;
      }
    }

    // === 3. TRANSFERTS ET ACCOMPAGNEMENT (DÉTAILLÉ LIGNE PAR LIGNE EN TND) ===
    await ctx.reply(
      `🚘 <b>3. TRANSFERTS ET ACCOMPAGNEMENT (En TND)</b>\n\n` +
      `Saisissez le montant pour chaque transfert en Dinars Tunisiens (TND) :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );

    let m_acc_aeroport = 30;
    let m_tr_aero_hotel = 35;
    let m_tr_hotel_clinique = 25;
    let m_tr_clinique_hotel = 25;
    let m_tr_hotel_aero = 35;
    let m_assistance = 50;

    // 1. Accueil à l'aéroport
    await ctx.reply(`▫️ 1. <b>Accueil à l'aéroport (TND)</b> (défaut: ${m_acc_aeroport}) :`, { parse_mode: 'HTML' });
    let trVal = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
    if (!isNaN(trVal)) m_acc_aeroport = trVal;

    // 2. Transfert aéroport – hôtel
    await ctx.reply(`▫️ 2. <b>Transfert aéroport – hôtel (TND)</b> (défaut: ${m_tr_aero_hotel}) :`, { parse_mode: 'HTML' });
    trVal = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
    if (!isNaN(trVal)) m_tr_aero_hotel = trVal;

    // 3. Transfert hôtel – clinique
    await ctx.reply(`▫️ 3. <b>Transfert hôtel – clinique (TND)</b> (défaut: ${m_tr_hotel_clinique}) :`, { parse_mode: 'HTML' });
    trVal = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
    if (!isNaN(trVal)) m_tr_hotel_clinique = trVal;

    // 4. Transfert clinique – hôtel
    await ctx.reply(`▫️ 4. <b>Transfert clinique – hôtel (TND)</b> (défaut: ${m_tr_clinique_hotel}) :`, { parse_mode: 'HTML' });
    trVal = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
    if (!isNaN(trVal)) m_tr_clinique_hotel = trVal;

    // 5. Transfert hôtel – aéroport
    await ctx.reply(`▫️ 5. <b>Transfert hôtel – aéroport (TND)</b> (défaut: ${m_tr_hotel_aero}) :`, { parse_mode: 'HTML' });
    trVal = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
    if (!isNaN(trVal)) m_tr_hotel_aero = trVal;

    // 6. Assistance pendant le séjour
    await ctx.reply(`▫️ 6. <b>Assistance pendant le séjour (TND)</b> (défaut: ${m_assistance}) :`, { parse_mode: 'HTML' });
    trVal = parseFloat((await conversation.waitFor(':text')).message?.text?.replace(',', '.') || '');
    if (!isNaN(trVal)) m_assistance = trVal;

    // Tableau des transferts
    transferts = [
      { designation: "Accueil à l'aéroport", quantite: 1, montant: m_acc_aeroport },
      { designation: "Transfert aéroport – hôtel", quantite: 1, montant: m_tr_aero_hotel },
      { designation: "Transfert hôtel – clinique", quantite: 1, montant: m_tr_hotel_clinique },
      { designation: "Transfert clinique – hôtel", quantite: 1, montant: m_tr_clinique_hotel },
      { designation: "Transfert hôtel – aéroport", quantite: 1, montant: m_tr_hotel_aero },
      { designation: "Assistance pendant le séjour", quantite: 1, montant: m_assistance },
    ];

    sousTotalTransfertsTND = transferts.reduce((sum, t) => sum + t.montant, 0);
  }

  // --- ÉTAPE 5 : Calculs Totaux TND & Conversion Finale EUR ---
  const totalPrestationsTND = prestations.reduce((sum, p) => sum + p.quantite * p.prixUnitaire, 0);
  const totalSejourTND = totalPrestationsTND + montantHotelTND + montantAccompagnateurHotelTND + sousTotalTransfertsTND;

  // Calcul du Total en EUR pour affichage final sous le Total TND
  const totalSejourEUR = (isEtranger && tauxEUR > 0) ? totalSejourTND / tauxEUR : 0;

  let acompte = 0;
  if (documentType === 'FACTURE') {
    await ctx.reply(
      `💰 <b>MONTANT DÉJÀ RÉGLÉ & NET À PAYER</b>\n\n` +
      `• Montant total : <b>${formatTND(totalSejourTND)} TND</b> ${isEtranger ? `(${formatEUR(totalSejourEUR)} €)` : ''}\n\n` +
      `Indiquez le <b>Montant déjà réglé</b> par la patiente (en TND, tapez <code>0</code> si aucun) :`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    const acompteMsg = await conversation.waitFor(':text');
    acompte = Math.max(0, parseFloat(acompteMsg.message?.text?.replace(',', '.') || '0') || 0);
  }

  const netAPayerTND = Math.max(0, totalSejourTND - acompte);

  const charges: Array<{ categorie: CategorieCharge; montant: number; description: string }> = [
    { categorie: 'Bloc', montant: m_bloc, description: 'Frais de bloc opératoire' },
    { categorie: 'Clinique', montant: m_sejour_clinique, description: 'Séjour clinique' },
    { categorie: 'Chirurgie', montant: Math.round(m_honoraires * 0.6), description: 'Rémunération équipe médicale' },
  ];
  if (isEtranger) {
    charges.push({ categorie: 'Hôtel', montant: montantHotelTND, description: 'Frais hôtel partenaire ' });
    charges.push({ categorie: 'Transfert', montant: sousTotalTransfertsTND, description: 'Service chauffeur privé VIP' });
  }
  const totalChargesTND = charges.reduce((sum, c) => sum + c.montant, 0);
  const margeNetteTND = totalSejourTND - totalChargesTND;
  const margeNetteEUR = tauxEUR > 0 ? margeNetteTND / tauxEUR : 0;

  // --- ÉTAPE 6 : CONFIRMATION & GÉNÉRATION PDF ---
  const confirmKeyboard = new Keyboard()
    .text('✅ Confirmer & Générer le PDF')
    .text('❌ Annuler')
    .resized()
    .oneTime();

  await ctx.reply(
    `📋 <b>RÉCAPITULATIF DU DOCUMENT PERLA BODY SCULPT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• <b>Type</b> : <b>${documentType}</b> (${isEtranger ? '🌍 Étranger' : '🇹🇳 Tunisien'})\n` +
    `• <b>Patiente</b> : <b>${nomPrenom}</b>\n` +
    (documentType === 'DEVIS'
      ? `• <b>Date devis</b> : ${dateDevis} | <b>Validité</b> : ${validiteDevis}\n` +
        `• <b>Intervention</b> : ${interventionPrevue}\n`
      : `• <b>Date facture</b> : ${dateFacture} | <b>Intervention le</b> : ${dateIntervention}\n` +
        `• <b>Zones traitées</b> : ${zonesTraitees}\n`) +
    `• <b>Prestations médicales</b> : ${formatTND(totalPrestationsTND)} TND\n` +
    (isEtranger ? `• <b>Hôtel </b> : ${nomHotel} (${nuitsHotel} - ${formatTND(montantHotelTND + montantAccompagnateurHotelTND)} TND)\n` : '') +
    (isEtranger ? `• <b>Sous-total Transferts</b> : ${formatTND(sousTotalTransfertsTND)} TND\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• <b>TOTAL GÉNÉRAL</b> : <b>${formatTND(totalSejourTND)} TND</b>\n` +
    (isEtranger ? `• <b>TOTAL ÉQUIVALENT EN EURO</b> : <b>${formatEUR(totalSejourEUR)} €</b>\n` : '') +
    (isEtranger ? `<i>(Taux appliqué : 1 EUR = ${tauxEUR.toFixed(2)} TND)</i>\n` : '') +
    (documentType === 'FACTURE' ? `• <b>Acompte</b> : ${formatTND(acompte)} TND | <b>Net à payer</b> : <b>${formatTND(netAPayerTND)} TND</b>\n` : '') +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Générer le PDF officiel ?`,
    { parse_mode: 'HTML', reply_markup: confirmKeyboard }
  );

  const confirmMsg = await conversation.waitFor(':text');
  if (!confirmMsg.message?.text?.includes('Confirmer')) {
    return ctx.reply('🚫 Création du document annulée.', { reply_markup: { remove_keyboard: true } });
  }

  await ctx.reply(
    `⏳ <i>Génération du PDF officiel en cours...</i>`,
    { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
  );

  try {
    const pdfData = await conversation.external(async () => {
      const { doc, patient } = await FinanceService.createDocument({
        type: documentType,
        clientType,
        devise: 'TND',
        patientData: { nomPrenom, passeport, telephone, nationalite, paysResidence, dateNaissance },
        actePrincipal: interventionTitle,
        prestations,
        charges,
        acompte,
        nomHotel,
        nuitsHotel,
        montantHotel: montantHotelTND,
        nuitsAccompagnateurHotel,
        montantAccompagnateurHotel: montantAccompagnateurHotelTND,
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

      const docObject = doc.toObject ? doc.toObject() : doc;

      const payloadPdf = {
        ...docObject,
        devise: 'TND',
        totalSejour: totalSejourTND.toFixed(2),
        totalSejourEUR: totalSejourEUR.toFixed(2),
        totalEUR: totalSejourEUR.toFixed(2),
        tauxEUR: tauxEUR.toFixed(2),
      };

      const buffer = await PdfService.generatePdf(payloadPdf, patient);

      return {
        bufferBase64: buffer.toString('base64'),
        numeroFacture: doc.numeroFacture,
        totalTND: totalSejourTND,
        totalEUR: totalSejourEUR,
        acompte,
        soldeRestantTND: netAPayerTND,
        margeNetteTND,
        margeNetteEUR,
        tauxEUR,
      };
    });

    const pdfBuffer = Buffer.from(pdfData.bufferBase64, 'base64');
    const fileName = `${pdfData.numeroFacture}_${nomPrenom.replace(/\s+/g, '_')}.pdf`;

    await ctx.replyWithDocument(new InputFile(pdfBuffer, fileName), {
      caption:
        `✨ <b>${documentType} OFFICIEL — PERLA BODY SCULPT</b>\n\n` +
        `• <b>Numéro</b> : <code>${pdfData.numeroFacture}</code>\n` +
        `• <b>Patiente</b> : ${nomPrenom}\n` +
        `• <b>Montant Total (TND)</b> : <b>${formatTND(pdfData.totalTND)} TND</b>\n` +
        (isEtranger ? `• <b>Équivalent EUR</b> : <b>${formatEUR(pdfData.totalEUR)} €</b>\n` : '') +
        (documentType === 'FACTURE'
          ? `• <b>Acompte réglé</b> : ${formatTND(pdfData.acompte)} TND\n` +
            `• <b>Net à payer</b> : <b>${formatTND(pdfData.soldeRestantTND)} TND</b>\n`
          : '') +
        `\n<i>Document généré avec succès.</i>`,
      parse_mode: 'HTML',
    });
  } catch (error: any) {
    console.error('Erreur génération PDF bot:', error);
    await ctx.reply(
      `⚠️ <b>Erreur lors de la génération du PDF :</b> ${error.message}`,
      { parse_mode: 'HTML' }
    );
  }
}