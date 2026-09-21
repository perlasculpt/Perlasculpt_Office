import express, { Request, Response } from 'express';
import { webhookCallback } from 'grammy';
import { config } from './config/env.js';
import { connectDB, isDbConnected } from './config/db.js';
import { getBot, setupBotCommands } from './bot/bot.js';
import { validateWebhookSecret } from './bot/middlewares/authMiddleware.js';
import { FinanceService } from './services/financeService.js';
import { PdfService, formatTND } from './services/pdfService.js';
import { CryptoService } from './services/cryptoService.js';

export const app = express();

// Middleware JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 1. HEALTH & SYSTEM STATUS ---
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    clinic: config.clinic.name,
    modeTest: true,
    security: 'Désactivée pour tests (Accès libre & sans PIN)',
    database: {
      connected: isDbConnected(),
      mode: isDbConnected() ? 'MongoDB (Mongoose)' : 'Mémoire haute performance (Fallback)',
    },
    telegram: {
      botConfigured: Boolean(config.telegram.botToken && !config.telegram.botToken.startsWith('123456789:AAFake')),
      whitelistCount: config.telegram.whitelistIds.length,
      pinProtected: false, // Désactivé pour les tests
      modeTest: true,
    },
    crypto: {
      algorithm: 'AES-256-GCM',
      status: 'Actif & Sécurisé',
    },
  });
});

// --- 2. STATISTIQUES FINANCIÈRES (DASHBOARD & /stats_mois) ---
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const stats = await FinanceService.getMonthlyStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 3. GESTION DES DOCUMENTS (FACTURES & DEVIS) ---
app.get('/api/documents', async (req: Request, res: Response) => {
  try {
    const docs = await FinanceService.getAllDocuments();
    res.json({ success: true, count: docs.length, data: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/documents/:id', async (req: Request, res: Response) => {
  try {
    const found = await FinanceService.getDocumentById(req.params.id);
    if (!found) {
      return res.status(404).json({ success: false, error: 'Document non trouvé' });
    }
    res.json({ success: true, data: found });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 4. CRÉATION D'UN DOCUMENT VIA API REST ---
app.post('/api/documents', async (req: Request, res: Response) => {
  try {
    const {
      type,
      patientNom,
      patientPasseport,
      patientTelephone,
      patientNationalite,
      patientPaysResidence,
      actePrincipal,
      prestations,
      charges,
      acompte,
      anesthesie,
      dureeEstimee,
      dateIntervention,
      notes,
    } = req.body;

    if (!patientNom || !actePrincipal) {
      return res.status(400).json({
        success: false,
        error: 'Le nom du patient et l\'acte principal sont requis.',
      });
    }

    const { doc, patient } = await FinanceService.createDocument({
      type: type === 'DEVIS' ? 'DEVIS' : 'FACTURE',
      patientData: {
        nomPrenom: patientNom,
        passeport: patientPasseport || 'P000000',
        telephone: patientTelephone || '+216 00 000 000',
        nationalite: patientNationalite || 'Tunisienne',
        paysResidence: patientPaysResidence || 'Tunisie',
      },
      actePrincipal,
      prestations: prestations || [{ designation: actePrincipal, quantite: 1, prixUnitaire: 3000 }],
      charges: charges || [],
      acompte: parseFloat(acompte) || 0,
      anesthesie,
      dureeEstimee,
      dateIntervention,
      notes,
    });

    res.status(201).json({ success: true, data: { doc, patient } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 5. TÉLÉCHARGEMENT PDF (Puppeteer + Handlebars) ---
app.get('/api/documents/:id/pdf', async (req: Request, res: Response) => {
  try {
    const found = await FinanceService.getDocumentById(req.params.id);
    if (!found) {
      return res.status(404).send('Document introuvable');
    }

    const pdfBuffer = await PdfService.generatePdf(found.doc, found.patient);

    const safeName = `${found.doc.numeroFacture}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error: any) {
    console.error('Erreur génération PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 6. APERÇU HTML DIRECT ---
app.get('/api/documents/:id/html', async (req: Request, res: Response) => {
  try {
    const found = await FinanceService.getDocumentById(req.params.id);
    if (!found) {
      return res.status(404).send('Document introuvable');
    }

    const html = PdfService.renderHtml(found.doc, found.patient);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`Erreur: ${error.message}`);
  }
});

// --- 7. HISTORIQUE PATIENT (/historique_client) ---
app.get('/api/patients/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const result = await FinanceService.getClientHistory(q);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 8. EXPORT FINANCIER (/export_excel) ---
app.get('/api/export', async (req: Request, res: Response) => {
  try {
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const { data, mimeType, filename } = await FinanceService.exportFinancialData(format);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- 9. CONFIGURATION & SÉCURITÉ ---
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      clinic: config.clinic,
      telegram: {
        botTokenSet: Boolean(config.telegram.botToken && !config.telegram.botToken.startsWith('123456789:AAFake')),
        botTokenPreview: config.telegram.botToken ? `${config.telegram.botToken.substring(0, 8)}...` : 'Non configuré',
        secretToken: config.telegram.secretToken ? '••••••••' : 'Non défini',
        whitelistIds: config.telegram.whitelistIds,
        adminPin: config.telegram.adminPin,
      },
      db: {
        mongoUri: config.db.mongoUri.replace(/:[^:@]+@/, ':••••••@'),
        connected: isDbConnected(),
      },
      security: {
        algorithm: 'AES-256-GCM',
        encryptionKeySet: Boolean(config.security.encryptionKey),
      },
    },
  });
});

app.post('/api/config', (req: Request, res: Response) => {
  const { botToken, secretToken, whitelistIds, adminPin, encryptionKey } = req.body;

  if (botToken !== undefined) config.telegram.botToken = botToken;
  if (secretToken !== undefined) config.telegram.secretToken = secretToken;
  if (adminPin !== undefined) config.telegram.adminPin = String(adminPin);
  if (encryptionKey !== undefined) config.security.encryptionKey = String(encryptionKey);
  if (Array.isArray(whitelistIds)) {
    config.telegram.whitelistIds = whitelistIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  }

  res.json({
    success: true,
    message: 'Configuration mise à jour avec succès.',
    config: {
      botTokenSet: Boolean(config.telegram.botToken),
      whitelistIds: config.telegram.whitelistIds,
      adminPin: config.telegram.adminPin,
    },
  });
});

// --- 10. WEBHOOK TELEGRAM SÉCURISÉ ---
// Validation du header X-Telegram-Bot-Api-Secret-Token
app.post('/api/telegram/webhook', validateWebhookSecret, (req: Request, res: Response) => {
  try {
    const bot = getBot();
    
    // Zid timeoutMilliseconds: 60000 (60 secondes) w timeout: 'return'
    return webhookCallback(bot, 'express', {
      timeoutMilliseconds: 60000, // 60s au lieu de 10s
      onTimeout: 'return',        // Ne crash pas le serveur si timeout
    })(req, res);
  } catch (error: any) {
    console.error('[Webhook Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- 11. SIMULATEUR WEB DE BOT TELEGRAM ---
// Permet de tester instantanément le bot, son flux de conversation grammY et le chiffrement AES-256
// directement dans le navigateur sans attendre la création d'un bot sur BotFather !
interface SimMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  buttons?: string[];
  documentUrl?: string;
  documentName?: string;
}

const simulationSessions = new Map<string, {
  step: string;
  data: any;
  pinVerified: boolean;
}>();

app.post('/api/telegram/simulate', async (req: Request, res: Response) => {
  try {
    const { sessionId = 'default_admin', message = '', buttonClick = '' } = req.body;
    const input = (buttonClick || message || '').trim();

    let session = simulationSessions.get(sessionId);
    if (!session) {
      session = {
        step: 'IDLE',
        data: {},
        pinVerified: true, // Déverrouillé par défaut pour les tests
      };
      simulationSessions.set(sessionId, session);
    }
    // Assurer que la session reste déverrouillée en mode test
    session.pinVerified = true;

    const responses: SimMessage[] = [];
    const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    function reply(text: string, buttons?: string[], doc?: { url: string; name: string }) {
      responses.push({
        id: `msg_${Date.now()}_${Math.random()}`,
        sender: 'bot',
        text,
        timestamp: nowStr,
        buttons,
        documentUrl: doc?.url,
        documentName: doc?.name,
      });
    }

    // Gestion des commandes globales et boutons
    if (input.startsWith('/start')) {
      session.step = 'IDLE';
      reply(
        `💎 <b>PERLA BODY SCULPT — ERP FINANCIER CLINIQUE & BOT</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nBienvenue sur le système de devis, facturation et analyse de marge pour la chirurgie et médecine esthétique.\n\n⚡ <b>Mode Test Activé :</b>\n• Sécurité & Code PIN : 🟢 <b>Désactivés pour vos tests</b> (Accès libre)\n• Chiffrement médical : <b>AES-256-GCM Actif</b>\n• Profils supportés : 🇹🇳 Tunisien (TND) & 🌍 Étranger (EUR + Hôtel + Transferts)\n\nChoisissez une action ou cliquez sur un bouton :`,
        ['📄 Créer un Devis', '📑 Créer une Facture', '📊 Bilan du Mois', '🔍 Chercher Patiente', '📥 Export Excel', 'ℹ️ Manuel d\'Aide']
      );
      return res.json({ success: true, responses });
    }

    if (input.startsWith('/aide') || input.startsWith('/help') || input.includes('Manuel')) {
      reply(
        `📖 <b>MANUEL D'UTILISATION — PERLA ERP TELEGRAM</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n1️⃣ <b>CRÉER UN DEVIS OU UNE FACTURE :</b>\n• /nouveau : Démarrer l'assistant pas-à-pas.\n• Enregistrez les données patientes (chiffrement AES-256 automatique).\n• Saisissez les actes et les charges (Hôtel, Transfert, Bloc).\n• Calcul automatique de la marge nette et PDF officiel.\n\n2️⃣ <b>CONTRÔLE FINANCIER :</b>\n• /stats_mois : Bilan du mois en cours\n• /historique_client [Nom/Passeport] : Rechercher un dossier\n• /export_excel : Exporter pour Microsoft Excel\n\n3️⃣ <b>MODE TEST ACTIF :</b>\n• Sécurité & PIN désactivés : toutes les commandes sont en accès libre et direct.`,
        ['📄 Créer un Devis', '📑 Créer une Facture', '📊 Bilan du Mois', '📥 Export Excel']
      );
      return res.json({ success: true, responses });
    }

    if (input.startsWith('/lock') || input === '🔒 Verrouiller') {
      reply('ℹ️ <b>Mode Test :</b> Le verrouillage est temporairement désactivé pour vous permettre de tester sans contrainte.', ['/start', '📊 Bilan du Mois']);
      return res.json({ success: true, responses });
    }

    if (input.startsWith('/pin') || input.includes('Code PIN')) {
      reply('🔓 <b>ACCÈS LIBRE (Mode Test)</b>\nTous les accès sont déjà déverrouillés sans code PIN.', ['📊 Bilan du Mois', '📄 Créer un Devis', '📑 Créer une Facture', '📥 Export Excel']);
      return res.json({ success: true, responses });
    }

    if (input.startsWith('/stats_mois') || input.includes('Bilan')) {
      const stats = await FinanceService.getMonthlyStats();
      reply(
        `📊 <b>BILAN FINANCIER DU MOIS — ${stats.mois.toUpperCase()}</b>\nÉtablissement : <b>${config.clinic.name}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n💰 <b>CHIFFRE D'AFFAIRES & ENCAISSEMENTS :</b>\n• Factures validées : <b>${stats.nombreFactures}</b>\n• Chiffre d'Affaires Brut : <b>${stats.totalCAFormatted} TND</b>\n• Acomptes encaissés : <b>${stats.totalAcomptesFormatted} TND</b>\n• Soldes en attente : <b>${stats.totalSoldesEnAttenteFormatted} TND</b>\n\n🏨 <b>CHARGES DIRECTES (Hôtel, Bloc, Transferts, Soins) :</b>\n• Total charges : 🔻 <b>${stats.totalChargesFormatted} TND</b>\n\n🟢 <b>RÉSULTAT NET & RENTABILITÉ :</b>\n• Marge Nette Globale : 💎 <b>${stats.margeNetteFormatted} TND</b>\n• Taux de marge nette : <b>${stats.tauxMarge}</b>\n\n📑 <b>PIPELINE DEVIS :</b>\n• Devis émis : <b>${stats.nombreDevis}</b> (${stats.devisVolumeFormatted} TND)`,
        ['📄 Créer un Devis', '📑 Créer une Facture', '📥 Export Excel', '🔍 Chercher Patiente']
      );
      return res.json({ success: true, responses });
    }

    if (input.startsWith('/export_excel') || input.includes('Export')) {
      const { filename } = await FinanceService.exportFinancialData('csv');
      reply(
        `📊 <b>EXPORT COMPTABLE & FINANCIER GÉNÉRÉ</b>\n• Format : CSV UTF-8 (Compatible Excel)\n• Passeports déchiffrés pour usage administratif.\n\nVous pouvez le télécharger directement ci-dessous :`,
        ['📊 Bilan du Mois', '📄 Créer un Devis'],
        { url: '/api/export?format=csv', name: filename }
      );
      return res.json({ success: true, responses });
    }

    if (input.includes('Chercher Patiente')) {
      reply('🔍 Veuillez indiquer le nom ou passeport de la patiente à rechercher :\nExemple : <code>/historique_client Amira</code> ou <code>/historique_client 25004709</code>', ['/historique_client Amira', '/historique_client Nora']);
      return res.json({ success: true, responses });
    }

    if (input.startsWith('/historique_client')) {
      const q = input.replace('/historique_client', '').trim();
      if (!q) {
        reply('🔍 Veuillez indiquer le nom ou passeport du patient :\nExemple : <code>/historique_client Amira</code> ou <code>/historique_client 25004709</code>', ['/historique_client Amira', '/historique_client Nora']);
        return res.json({ success: true, responses });
      }
      const resData = await FinanceService.getClientHistory(q);
      if (!resData.patient) {
        reply(`❌ Aucun patient trouvé pour "${q}".`);
      } else {
        let msgText = `👤 <b>FICHE PATIENTE — PERLA BODY SCULPT</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n• <b>Nom & Prénom</b> : ${resData.patient.nomPrenom}\n• <b>Passeport chiffré AES-256</b> : <code>${resData.patient.passeport}</code>\n• <b>Téléphone</b> : ${resData.patient.telephone}\n• <b>Nationalité</b> : ${resData.patient.nationalite} (${resData.patient.paysResidence})\n\n📑 <b>HISTORIQUE DES DOSSIERS (${resData.items.length}) :</b>\n`;
        resData.items.forEach((it, i) => {
          msgText += `\n<b>${i + 1}. [${it.type}] ${it.numeroFacture}</b> (${it.date})\n• Acte : ${it.actePrincipal}\n• Total TTC : <b>${it.totalHTFormatted} TND</b> | Marge Nette : <b>${it.margeNetteFormatted} TND</b>\n• Statut : ${it.statutPaiement}\n`;
        });
        reply(msgText, ['/stats_mois', '/nouveau']);
      }
      return res.json({ success: true, responses });
    }

    // --- CONVERSATION FLOW SIMULATOR ---
    if (input.startsWith('/nouveau') || input === '➕ Nouveau') {
      session.step = 'CHOOSE_PROFILE';
      session.data = { prestations: [], charges: [] };
      reply(
        `💎 <b>PERLA BODY SCULPT — ÉMISSION D'UN DOCUMENT</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nSélectionnez le profil de la patiente :\n\n• <b>🇹🇳 Patiente Tunisienne</b> : Tarification en TND, séjour clinique.\n• <b>🌍 Patiente Étrangère</b> : Tarification en EUR (€), séjour clinique + hôtel partenaire 5★ + transferts VIP.`,
        ['🇹🇳 Patiente Tunisienne (TND)', '🌍 Patiente Étrangère (EUR)', '❌ Annuler']
      );
      return res.json({ success: true, responses });
    }

    if (input === '❌ Annuler') {
      session.step = 'IDLE';
      reply('🚫 Opération annulée.', ['/start', '/nouveau']);
      return res.json({ success: true, responses });
    }

    switch (session.step) {
      case 'CHOOSE_PROFILE': {
        const isEtranger = input.includes('Étrangère') || input.includes('EUR');
        session.data.clientType = isEtranger ? 'ETRANGER' : 'TUNISIEN';
        session.data.devise = isEtranger ? 'EUR' : 'TND';
        session.step = 'CHOOSE_TYPE';
        reply(
          `Quel type de document souhaitez-vous créer pour cette patiente ${isEtranger ? 'étrangère' : 'tunisienne'} ?\n\n• <b>📄 DEVIS</b> : Proposition d'honoraires & conditions\n• <b>📑 FACTURE</b> : Facture officielle avec interventions et solde`,
          ['📄 DEVIS', '📑 FACTURE', '❌ Annuler']
        );
        break;
      }

      case 'CHOOSE_TYPE': {
        session.data.type = input.includes('DEVIS') ? 'DEVIS' : 'FACTURE';
        session.step = 'PATIENT_NOM';
        reply(
          `👤 <b>INFORMATIONS PATIENTE (1/4)</b>\n\nVeuillez saisir le <b>Nom et Prénom</b> de la patiente :`,
          session.data.clientType === 'ETRANGER'
            ? ['Nora Benchikh', 'Sophie Dupont', 'Amina Larbi']
            : ['Amira Ben Ali', 'Sabrine Trabelsi', 'Yasmine Khemir']
        );
        break;
      }

      case 'PATIENT_NOM':
        session.data.nomPrenom = input;
        session.step = 'PATIENT_PASS';
        reply(
          `🔒 <b>SÉCURITÉ RENFORCÉE (2/4)</b>\n\nVeuillez saisir le numéro de <b>${session.data.clientType === 'ETRANGER' ? 'Passeport' : 'CIN ou Passeport'}</b> :\n<i>ℹ️ Donnée chiffrée immédiatement en AES-256-GCM.</i>`,
          session.data.clientType === 'ETRANGER' ? ['25004709', '18AB98765', 'X1234567'] : ['09876543', '14235678', '08765432']
        );
        break;

      case 'PATIENT_PASS':
        session.data.passeport = input;
        session.step = 'PATIENT_TEL';
        reply(
          `📞 <b>CONTACT (3/4)</b>\n\nVeuillez saisir le numéro de <b>Téléphone</b> :`,
          session.data.clientType === 'ETRANGER'
            ? ['+213 550 12 34 56', '+33 6 12 34 56 78', '+41 79 123 45 67']
            : ['+216 26 723 876', '+216 98 123 456', '+216 55 987 654']
        );
        break;

      case 'PATIENT_TEL':
        session.data.telephone = input;
        if (session.data.clientType === 'ETRANGER') {
          session.step = 'PATIENT_NAT';
          reply(`🌍 Saisissez la <b>Nationalité</b> de la patiente :`, ['Algérienne', 'Française', 'Canadienne', 'Suisse']);
        } else {
          session.data.nationalite = 'Tunisienne';
          session.data.paysResidence = 'Tunisie';
          session.step = 'ACTE_PRINCIPAL';
          reply(
            `💉 <b>INTERVENTION MÉDICALE</b>\n\nSélectionnez ou saisissez l'acte médical :`,
            ['Liposuccion + Lipo-injection', 'BBL Sculpting Haute Définition', 'Rhinoplastie', 'Chirurgie Mammaire']
          );
        }
        break;

      case 'PATIENT_NAT':
        session.data.nationalite = input;
        session.step = 'PATIENT_PAYS';
        reply(`🏡 Saisissez le <b>Pays de Résidence</b> :`, ['Algérie', 'France', 'Canada', 'Suisse']);
        break;

      case 'PATIENT_PAYS':
        session.data.paysResidence = input;
        session.step = 'ACTE_PRINCIPAL';
        reply(
          `💉 <b>INTERVENTION MÉDICALE</b>\n\nSélectionnez ou saisissez l'acte médical :`,
          ['Liposuccion + Lipo-injection', 'BBL Sculpting Haute Définition', 'Rhinoplastie', 'Chirurgie Mammaire']
        );
        break;

      case 'ACTE_PRINCIPAL':
        session.data.actePrincipal = input;
        session.step = 'ZONES_TRAITEES';
        reply(
          `🎯 <b>ZONES TRAITÉES</b>\n\nPrécisez les zones opératoires :`,
          ['Zone abdominale + flancs', 'Liposuccion 360 + Fessiers', 'Arête et pointe nasale', 'Augmentation mammaire']
        );
        break;

      case 'ZONES_TRAITEES':
        session.data.zonesTraitees = input;
        session.step = 'PRESTATION_PRIX';
        const isEt = session.data.clientType === 'ETRANGER';
        reply(
          `📋 <b>PRESTATIONS MÉDICALES (En ${session.data.devise})</b>\n\nSaisissez le montant des honoraires chirurgicaux pour <b>${session.data.actePrincipal}</b> (${session.data.devise}) :`,
          isEt ? ['3000', '3500', '4200', '2800'] : ['3500', '4500', '5200', '2800']
        );
        break;

      case 'PRESTATION_PRIX': {
        const pu = parseFloat(input.replace(',', '.')) || (session.data.clientType === 'ETRANGER' ? 3000 : 3500);
        session.data.prestations = [
          {
            designation: `${session.data.actePrincipal} (${session.data.zonesTraitees || ''})`,
            quantite: 1,
            prixUnitaire: pu,
          },
        ];

        if (session.data.clientType === 'ETRANGER') {
          session.step = 'HOTEL_CHOICE';
          reply(
            `🏨 <b>HÉBERGEMENT HÔTELIER 5★</b>\n\nChoisissez la formule d'hébergement :`,
            ['⭐ Hôtel The Residence 5★ (4 nuits : 400 €)', 'Sans hôtel (Hébergement personnel)']
          );
        } else {
          session.step = 'CHARGE_DECISION';
          reply(
            `📊 <b>CHARGES DIRECTES & COMPTE D'AUTRUI</b>\n\nSouhaitez-vous enregistrer les charges (Clinique, Bloc, Honoraires chirurgien) pour calculer la marge nette ?`,
            ['➕ Ajouter les charges directes', '⏭️ Ignorer les charges']
          );
        }
        break;
      }

      case 'HOTEL_CHOICE': {
        if (input.includes('Sans hôtel')) {
          session.data.nomHotel = '';
          session.data.nuitsHotel = '';
          session.data.montantHotel = 0;
        } else {
          session.data.nomHotel = 'Hôtel The Residence Tunis 5★';
          session.data.nuitsHotel = '4 nuits';
          session.data.montantHotel = 400;
        }
        session.data.transferts = [
          { designation: 'Accueil à l’aéroport', quantite: 1, montant: 30 },
          { designation: 'Transfert aéroport – hôtel', quantite: 1, montant: 35 },
          { designation: 'Transfert hôtel – clinique', quantite: 1, montant: 25 },
          { designation: 'Transfert clinique – hôtel', quantite: 1, montant: 25 },
          { designation: 'Transfert hôtel – aéroport', quantite: 1, montant: 35 },
          { designation: 'Assistance pendant le séjour', quantite: 1, montant: 50 },
        ];
        session.step = 'CHARGE_DECISION';
        reply(
          `📊 <b>CHARGES DIRECTES (BLOC & CLINIQUE)</b>\n\nSouhaitez-vous enregistrer les charges directes pour le calcul de marge nette ?`,
          ['➕ Ajouter les charges directes', '⏭️ Ignorer les charges']
        );
        break;
      }

      case 'CHARGE_DECISION': {
        if (input.includes('Ajouter')) {
          session.step = 'CHARGE_MONTANT';
          reply(
            `▫️ Saisissez le montant global estimé des charges (Bloc, Clinique, Soins) en ${session.data.devise} :`,
            session.data.clientType === 'ETRANGER' ? ['1200', '1500', '1800'] : ['1400', '1800', '2200']
          );
        } else {
          session.step = 'ACOMPTE';
          const presTotal = session.data.prestations.reduce((s: number, p: any) => s + p.quantite * p.prixUnitaire, 0);
          const hotelM = session.data.montantHotel || 0;
          const transfM = (session.data.transferts || []).reduce((s: number, t: any) => s + t.montant, 0);
          const totalHT = presTotal + hotelM + transfM;
          reply(
            `💰 <b>ACOMPTE & PAIEMENT</b>\n\nTotal : <b>${totalHT} ${session.data.devise}</b>\n\nSaisissez l'acompte déjà réglé en ${session.data.devise} (ou tapez 0) :`,
            session.data.clientType === 'ETRANGER' ? ['500', '1000', '0'] : ['1000', '1500', '0']
          );
        }
        break;
      }

      case 'CHARGE_MONTANT': {
        const chMontant = parseFloat(input.replace(',', '.')) || 1000;
        session.data.charges = [
          {
            categorie: 'Clinique',
            description: 'Frais de bloc opératoire & séjour clinique',
            montant: chMontant,
          },
        ];
        session.step = 'ACOMPTE';
        const presTotal = session.data.prestations.reduce((s: number, p: any) => s + p.quantite * p.prixUnitaire, 0);
        const hotelM = session.data.montantHotel || 0;
        const transfM = (session.data.transferts || []).reduce((s: number, t: any) => s + t.montant, 0);
        const totalHT = presTotal + hotelM + transfM;
        const marge = totalHT - chMontant;
        reply(
          `💰 <b>ACOMPTE & PAIEMENT</b>\n\n• Total : <b>${totalHT} ${session.data.devise}</b>\n• Charges : ${chMontant} ${session.data.devise}\n• Marge Nette : 🟢 <b>${marge} ${session.data.devise}</b>\n\nSaisissez l'acompte réglé en ${session.data.devise} :`,
          session.data.clientType === 'ETRANGER' ? ['500', '1000', '0'] : ['1000', '1500', '0']
        );
        break;
      }

      case 'ACOMPTE': {
        const acompteVal = parseFloat(input.replace(',', '.')) || 0;
        session.data.acompte = acompteVal;
        session.step = 'CONFIRM';

        const presTotal = session.data.prestations.reduce((s: number, p: any) => s + p.quantite * p.prixUnitaire, 0);
        const hotelM = session.data.montantHotel || 0;
        const transfM = (session.data.transferts || []).reduce((s: number, t: any) => s + t.montant, 0);
        const totalHT = presTotal + hotelM + transfM;
        const chTotal = (session.data.charges || []).reduce((s: number, c: any) => s + c.montant, 0);
        const margeNette = totalHT - chTotal;
        const solde = Math.max(0, totalHT - acompteVal);

        const templateNom = session.data.clientType === 'ETRANGER'
          ? (session.data.type === 'DEVIS' ? 'devis_etranger.hbs' : 'facture_etranger.hbs')
          : (session.data.type === 'DEVIS' ? 'devis_tunisien.hbs' : 'facture_tunisien.hbs');

        reply(
          `📋 <b>RÉCAPITULATIF DU DOCUMENT PERLA BODY SCULPT</b>\n━━━━━━━━━━━━━━━━━━━━\n• <b>Type</b> : ${session.data.type} (${session.data.clientType})\n• <b>Template</b> : <code>${templateNom}</code>\n• <b>Patiente</b> : ${session.data.nomPrenom} (${session.data.nationalite})\n• <b>Passeport</b> : Chiffré AES-256 (<code>${session.data.passeport}</code>)\n• <b>Intervention</b> : ${session.data.actePrincipal} — ${session.data.zonesTraitees || ''}\n• <b>Total HT</b> : <b>${totalHT} ${session.data.devise}</b>\n• <b>Acompte</b> : ${acompteVal} ${session.data.devise}\n• <b>Solde restant</b> : <b>${solde} ${session.data.devise}</b>\n• <b>Marge Nette</b> : 🟢 <b>${margeNette} ${session.data.devise}</b>\n━━━━━━━━━━━━━━━━━━━━\n\nSouhaitez-vous générer le PDF officiel haute définition ?`,
          ['✅ Confirmer & Générer le PDF', '❌ Annuler la création']
        );
        break;
      }

      case 'CONFIRM': {
        if (!input.includes('Confirmer')) {
          session.step = 'IDLE';
          reply('🚫 Création annulée.', ['/start', '/nouveau']);
        } else {
          session.step = 'IDLE';
          const { doc, patient } = await FinanceService.createDocument({
            type: session.data.type,
            clientType: session.data.clientType,
            devise: session.data.devise,
            patientData: {
              nomPrenom: session.data.nomPrenom,
              passeport: session.data.passeport,
              telephone: session.data.telephone,
              nationalite: session.data.nationalite,
              paysResidence: session.data.paysResidence,
            },
            actePrincipal: session.data.actePrincipal,
            prestations: session.data.prestations,
            charges: session.data.charges,
            acompte: session.data.acompte,
            nomHotel: session.data.nomHotel,
            nuitsHotel: session.data.nuitsHotel,
            montantHotel: session.data.montantHotel,
            transferts: session.data.transferts,
            zonesTraitees: session.data.zonesTraitees,
          });

          const isEur = doc.devise === 'EUR';
          const unit = isEur ? 'EUR' : 'TND';

          reply(
            `✨ <b>${doc.type} OFFICIEL ÉMIS AVEC SUCCÈS !</b>\n━━━━━━━━━━━━━━━━━━━━\n• <b>Numéro</b> : <code>${doc.numeroFacture}</code>\n• <b>Patiente</b> : ${patient.nomPrenom}\n• <b>Modèle appliqué</b> : ${doc.clientType === 'ETRANGER' ? '🌍 Étranger (EUR)' : '🇹🇳 Tunisien (TND)'}\n• <b>Total TTC</b> : <b>${doc.totalHT} ${unit}</b>\n• <b>Acompte</b> : ${doc.acompte} ${unit}\n• <b>Solde restant</b> : <b>${doc.soldeRestant} ${unit}</b>\n• <b>Marge Nette</b> : 🟢 <b>${doc.margeNette} ${unit}</b>\n• <b>Chiffrement</b> : Passeport protégé AES-256\n\n📄 <i>Votre document PDF A4 est prêt avec le design officiel Perla Body Sculpt :</i>`,
            ['/nouveau', '/stats_mois', '/export_excel'],
            {
              url: `/api/documents/${doc._id}/pdf`,
              name: `${doc.numeroFacture}_${patient.nomPrenom.replace(/\s+/g, '_')}.pdf`,
            }
          );
        }
        break;
      }

      default:
        reply(
          `Commandes reconnues : <code>/nouveau</code>, <code>/stats_mois</code>, <code>/historique_client [nom]</code>, <code>/export_excel</code>, <code>/pin 2026</code>.`,
          ['/nouveau', '/stats_mois', '/pin 2026']
        );
        break;
    }

    res.json({ success: true, responses });
  } catch (error: any) {
    console.error('Erreur simulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialisation de la base de données au démarrage
connectDB().catch((err) => {
  console.warn('[App] Échec connexion initiale MongoDB:', err.message);
});
