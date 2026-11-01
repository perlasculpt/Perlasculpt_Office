import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { CryptoService } from './cryptoService.js';
import { config } from '../config/env.js';
import { PERLA_LOGO_BASE64 } from '../templates/logoBase64.js';

// Cache des templates compilés
let devisEtrangerTemplate: handlebars.TemplateDelegate | null = null;
let devisTunisienTemplate: handlebars.TemplateDelegate | null = null;
let factureEtrangerTemplate: handlebars.TemplateDelegate | null = null;
let factureTunisienTemplate: handlebars.TemplateDelegate | null = null;

/**
 * Formate un nombre au format monétaire tunisien (ex: 250,000 ou 4 800,000)
 * Règle : virgule + 3 décimales
 */
export function formatTND(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0,000';
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Formate un nombre au format monétaire Euro (ex: 150,00 ou 1 200,00)
 * Règle : virgule + 2 décimales
 */
export function formatEUR(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0,00';
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convertit un montant en lettres (Français)
 */
export function numberToFrenchWords(amount: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

  function convertGroup(n: number): string {
    let result = '';
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;

    if (hundreds > 0) {
      if (hundreds === 1) {
        result += 'cent ';
      } else {
        result += units[hundreds] + ' cent ';
      }
    }

    if (remainder >= 10 && remainder < 20) {
      result += teens[remainder - 10] + ' ';
    } else if (remainder >= 20) {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;
      if (ten === 7) {
        result += 'soixante-' + teens[unit] + ' ';
      } else if (ten === 9) {
        result += 'quatre-vingt-' + teens[unit] + ' ';
      } else {
        result += tens[ten];
        if (unit === 1 && ten !== 8) {
          result += ' et un ';
        } else if (unit > 0) {
          result += '-' + units[unit] + ' ';
        } else {
          result += ' ';
        }
      }
    } else if (remainder > 0) {
      result += units[remainder] + ' ';
    }

    return result.trim();
  }

  const integerPart = Math.floor(amount);
  const thousands = Math.floor(integerPart / 1000);
  const hundredsPart = integerPart % 1000;

  let words = '';
  if (thousands > 0) {
    if (thousands === 1) {
      words += 'mille ';
    } else {
      words += convertGroup(thousands) + ' mille ';
    }
  }

  if (hundredsPart > 0 || words === '') {
    words += convertGroup(hundredsPart);
  }

  return words.trim();
}

export class PdfService {
  /**
   * Charge et compile les 4 templates Handlebars
   */
  private static loadTemplates() {
    const templatesDir = path.resolve(process.cwd(), 'src/templates');

    const srcDevisEtranger = fs.readFileSync(path.join(templatesDir, 'devis_etranger.hbs'), 'utf8');
    devisEtrangerTemplate = handlebars.compile(srcDevisEtranger);

    const srcDevisTunisien = fs.readFileSync(path.join(templatesDir, 'devis_tunisien.hbs'), 'utf8');
    devisTunisienTemplate = handlebars.compile(srcDevisTunisien);

    const srcFactureEtranger = fs.readFileSync(path.join(templatesDir, 'facture_etranger.hbs'), 'utf8');
    factureEtrangerTemplate = handlebars.compile(srcFactureEtranger);

    const srcFactureTunisien = fs.readFileSync(path.join(templatesDir, 'facture_tunisien.hbs'), 'utf8');
    factureTunisienTemplate = handlebars.compile(srcFactureTunisien);
  }

  /**
   * Détermine si le document ou patient est considéré étranger
   */
  public static isEtranger(facture: any, patient: any): boolean {
    if (facture?.clientType === 'ETRANGER') return true;
    if (facture?.clientType === 'TUNISIEN') return false;
    const nat = (patient?.nationalite || '').toLowerCase();
    return nat !== '' && nat !== 'tunisienne' && nat !== 'tunisien' && nat !== 'tn';
  }

  /**
   * Prépare le contexte complet de données pour Handlebars en tenant compte des variables des 4 modèles
   */
  public static prepareContext(facture: any, patient: any) {
    const isDevis = facture.type === 'DEVIS';
    const isEtranger = this.isEtranger(facture, patient);

    // Taux de conversion transmis depuis la facture/devis (défaut: 3.42)
    const tauxEUR = Number(facture.tauxEUR) || 3.42;

    // Déchiffrement sécurisé du passeport / CIN
    let passeportClair = patient?.passeport || '';
    if (patient?.passeportEncrypted) {
      try {
        passeportClair = CryptoService.decrypt(patient.passeportEncrypted);
      } catch {
        passeportClair = '—';
      }
    } else if (typeof patient?.getPasseport === 'function') {
      try {
        passeportClair = patient.getPasseport();
      } catch {
        passeportClair = '—';
      }
    }

    // Prestations médicales
    let rawPrestations = facture.prestations || [];
    if (!rawPrestations.length) {
      rawPrestations = [
        {
          designation: facture.actePrincipal || 'Intervention chirurgicale',
          quantite: 1,
          prixUnitaire: facture.totalHT || 3000,
        },
      ];
    }

    // Calcul du sous-total des prestations (toujours en TND dans le modèle de saisie)
    let calculatedSousTotalPrestations = 0;
    rawPrestations.forEach((p: any) => {
      const q = p.quantite || 1;
      const pu = p.prixUnitaire || 0;
      calculatedSousTotalPrestations += q * pu;
    });

    // Helper pour récupérer ou calculer les montants des 12 prestations médicales (en TND)
    const getPresPrice = (keywords: string[], fallback: number): number => {
      const match = rawPrestations.find((p: any) =>
        keywords.some(k => (p.designation || '').toLowerCase().includes(k.toLowerCase()))
      );
      if (match) {
        return (Number(match.prixUnitaire) || 0) * (Number(match.quantite) || 1);
      }
      return fallback;
    };

    const sejourCliniqueItem = rawPrestations.find((p: any) =>
      (p.designation || '').toLowerCase().includes('clinique') ||
      (p.designation || '').toLowerCase().includes('séjour')
    );
    const nuitsClinique = sejourCliniqueItem?.quantite || Number(facture.nuitsClinique) || 1;

    let p_consultation = getPresPrice(['consultation'], 100);
    let p_bilan = getPresPrice(['bilan', 'examen'], 150);
    let p_honoraires = getPresPrice(['honoraires', 'chirurgien', 'chirurgicaux'], 6000);
    let p_anesthesie = getPresPrice(['anesthésie', 'anesthesie'], 800);
    let p_bloc = getPresPrice(['bloc'], 1200);
    let p_sejour_clinique = getPresPrice(['clinique', 'séjour en clinique'], 700 * nuitsClinique);
    let p_soins = getPresPrice(['soins et surveillance', 'surveillance post'], 200);
    let p_medicaments = getPresPrice(['médicaments', 'medicaments'], 150);
    let p_contention = getPresPrice(['contention', 'gaine'], 250);
    let p_drainage = getPresPrice(['drainage'], 200);
    let p_accompagnateur = getPresPrice(['supp. accompagnateur', 'supplément accompagnateur'], 0);
    let p_controle = getPresPrice(['contrôle', 'controle'], 0);

    // Hôtel (spécifique étranger) - en TND
    const nomHotel = facture.nomHotel || 'Hôtel The Residence Tunis 5★';
    const nuitsHotel = facture.nuitsHotel ? String(facture.nuitsHotel).replace(/nuits?/i, '').trim() : '4';
    const montantHotel = Number(facture.montantHotel) || (isEtranger ? 1200 : 0);
    const nuitsAccompagnateurHotel = facture.nuitsAccompagnateurHotel ? String(facture.nuitsAccompagnateurHotel).replace(/nuits?/i, '').trim() : '';
    const montantAccompagnateurHotel = Number(facture.montantAccompagnateurHotel) || 0;
    const sousTotalHotel = montantHotel + montantAccompagnateurHotel;

    // Transferts (spécifique étranger) - en TND
    let rawTransferts = facture.transferts || [];
    const getTransMnt = (keywords: string[], def: number): number => {
      const match = rawTransferts.find((t: any) =>
        keywords.some(k => (t.designation || '').toLowerCase().includes(k.toLowerCase()))
      );
      return match ? Number(match.montant) || 0 : def;
    };

    const m_accueil_val = getTransMnt(['accueil'], 100);
    const m_trans_aero_hotel_val = getTransMnt(['aéroport – hôtel', 'aeroport - hotel'], 120);
    const m_trans_hotel_cli_val = getTransMnt(['hôtel – clinique', 'hotel - clinique'], 80);
    const m_trans_cli_hotel_val = getTransMnt(['clinique – hôtel', 'clinique - hotel'], 80);
    const m_trans_hotel_aero_val = getTransMnt(['hôtel – aéroport', 'hotel - aeroport'], 120);
    const m_assistance_val = getTransMnt(['assistance'], 150);

    const explicitTransferts = Number(facture.sousTotalTransferts) || Number(facture.montantTransferts) || 0;
    const rawTransfertsSum = (rawTransferts || []).reduce((sum: number, t: any) => sum + (Number(t.montant) || 0), 0);

    let sousTotalTransferts = 0;
    if (isEtranger) {
      if (explicitTransferts > 0) {
        sousTotalTransferts = explicitTransferts;
      } else if (rawTransfertsSum > 0) {
        sousTotalTransferts = rawTransfertsSum;
      } else if (facture.totalHT && Number(facture.totalHT) > (calculatedSousTotalPrestations + sousTotalHotel)) {
        sousTotalTransferts = Math.round((Number(facture.totalHT) - calculatedSousTotalPrestations - sousTotalHotel) * 1000) / 1000;
      } else {
        sousTotalTransferts = (m_accueil_val + m_trans_aero_hotel_val + m_trans_hotel_cli_val + m_trans_cli_hotel_val + m_trans_hotel_aero_val + m_assistance_val);
      }
    }

    // --- TOTAUX EN TND & CONVERSION EUR ---
    let totalGeneralTND = calculatedSousTotalPrestations + sousTotalHotel + sousTotalTransferts;
    if (facture.totalSejour && Number(facture.totalSejour) > 0) {
      totalGeneralTND = Number(facture.totalSejour);
    } else if (facture.totalHT && Number(facture.totalHT) > 0) {
      totalGeneralTND = Number(facture.totalHT);
    }

    let totalGeneralEUR = tauxEUR > 0 ? totalGeneralTND / tauxEUR : 0;
    if (facture.totalSejourEUR && Number(facture.totalSejourEUR) > 0) {
      totalGeneralEUR = Number(facture.totalSejourEUR);
    } else if (facture.totalEUR && Number(facture.totalEUR) > 0) {
      totalGeneralEUR = Number(facture.totalEUR);
    }

    const acompte = Number(facture.acompte) || 0;
    const soldeRestantTND = Math.max(0, totalGeneralTND - acompte);

    // Dates
    const dateFacture = facture.dateFacture || (facture.createdAt
      ? new Date(facture.createdAt).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR'));
    const dateDevis = facture.dateDevis || dateFacture;
    const dateIntervention = facture.dateIntervention || dateFacture;
    const validiteDevis = facture.validiteDevis || '30 jours';
    const zonesTraitees = facture.zonesTraitees || 'Zone abdominale + flancs';
    const dureeSejourClinique = facture.dureeSejourClinique || `${nuitsClinique} nuit(s)`;
    const dureeTotaleSejour = facture.dureeTotaleSejour || (isEtranger ? '5 jours / 4 nuits' : dureeSejourClinique);
    const interventionPrevue = facture.interventionPrevue || `${facture.actePrincipal || 'Liposuccion'} — ${zonesTraitees}`;
    const interventionTitle = facture.actePrincipal || 'Liposuccion';
    const patientNomPrenom = patient?.nomPrenom || 'Patiente Inconnue';
    const cinPasseport = passeportClair || '—';
    const dateNaissance = patient?.dateNaissance || '—';

    const defaultTransferts = [
      { designation: 'Accueil à l’aéroport', quantite: 1, montant: formatTND(m_accueil_val) },
      { designation: 'Transfert aéroport – hôtel', quantite: 1, montant: formatTND(m_trans_aero_hotel_val) },
      { designation: 'Transfert hôtel – clinique', quantite: 1, montant: formatTND(m_trans_hotel_cli_val) },
      { designation: 'Transfert clinique – hôtel', quantite: 1, montant: formatTND(m_trans_cli_hotel_val) },
      { designation: 'Transfert hôtel – aéroport', quantite: 1, montant: formatTND(m_trans_hotel_aero_val) },
      { designation: 'Assistance pendant le séjour', quantite: 1, montant: formatTND(m_assistance_val) },
    ];

    const formattedTransferts = (rawTransferts && rawTransferts.length > 0)
      ? rawTransferts.map((t: any) => ({
          designation: t.designation || '',
          quantite: t.quantite || 1,
          montant: formatTND(Number(t.montant) || 0),
        }))
      : defaultTransferts;

    const defaultPrestations = [
      { designation: 'Consultation préopératoire', quantite: 1, montant: formatTND(p_consultation) },
      { designation: 'Bilan / examens préopératoires', quantite: 1, montant: formatTND(p_bilan) },
      { designation: 'Honoraires chirurgicaux', quantite: 1, montant: formatTND(p_honoraires) },
      { designation: 'Anesthésie', quantite: 1, montant: formatTND(p_anesthesie) },
      { designation: 'Frais de bloc opératoire', quantite: 1, montant: formatTND(p_bloc) },
      { designation: `Séjour en clinique – ${nuitsClinique} nuit(s)`, quantite: nuitsClinique, montant: formatTND(p_sejour_clinique) },
      { designation: 'Soins et surveillance postopératoires', quantite: 1, montant: formatTND(p_soins) },
      { designation: 'Médicaments et soins postopératoires', quantite: 1, montant: formatTND(p_medicaments) },
      { designation: 'Vêtement de contention', quantite: 1, montant: formatTND(p_contention) },
      { designation: 'Drainage', quantite: 1, montant: formatTND(p_drainage) },
      { designation: 'Supplément accompagnateur', quantite: 1, montant: formatTND(p_accompagnateur) },
      { designation: 'Contrôle postopératoire', quantite: 1, montant: formatTND(p_controle) },
    ];

    return {
      logoBase64: PERLA_LOGO_BASE64,
      numeroFacture: facture.numeroFacture || 'FAC-001',
      type: isDevis ? 'Devis' : 'Facture',
      isDevis,
      isEtranger,
      devise: 'TND',
      docSub: interventionTitle,
      interventionTitle,
      actePrincipal: interventionTitle,
      interventionPrevue,
      patientNomPrenom,
      cinPasseport,
      dateNaissance,
      dateDevis,
      dateFacture,
      dateIntervention,
      validiteDevis,
      zonesTraitees,
      dureeSejour: dureeTotaleSejour,
      dureeSejourClinique,
      dureeTotaleSejour,
      modeReglement: facture.modeReglement || 'Virement bancaire / Espèces',

      // Prestations liste et 12 prestations médicales individuelles (TND)
      prestations: defaultPrestations,
      nuitsClinique,
      m_consultation: formatTND(p_consultation),
      m_bilan: formatTND(p_bilan),
      m_honoraires: formatTND(p_honoraires),
      m_anesthesie: formatTND(p_anesthesie),
      m_bloc: formatTND(p_bloc),
      m_sejour_clinique: formatTND(p_sejour_clinique),
      m_soins: formatTND(p_soins),
      m_medicaments: formatTND(p_medicaments),
      m_contention: formatTND(p_contention),
      m_drainage: formatTND(p_drainage),
      m_accompagnateur: formatTND(p_accompagnateur),
      m_controle: formatTND(p_controle),
      sousTotalPrestations: formatTND(calculatedSousTotalPrestations),

      // Hôtel
      nomHotel,
      nuitsHotel,
      m_hotel: formatTND(montantHotel),
      nuitsAccompagnateurHotel: nuitsAccompagnateurHotel || '0',
      m_accompagnateur_hotel: formatTND(montantAccompagnateurHotel),
      sousTotalHotel: formatTND(sousTotalHotel),

      // Transferts
      transferts: formattedTransferts,
      m_accueil: formatTND(m_accueil_val),
      m_trans_aero_hotel: formatTND(m_trans_aero_hotel_val),
      m_trans_hotel_cli: formatTND(m_trans_hotel_cli_val),
      m_trans_cli_hotel: formatTND(m_trans_cli_hotel_val),
      m_trans_hotel_aero: formatTND(m_trans_hotel_aero_val),
      m_assistance: formatTND(m_assistance_val),
      sousTotalTransferts: formatTND(sousTotalTransferts),
      sousTotalHotelEtTransferts: formatTND(sousTotalHotel + sousTotalTransferts),

      // --- TOTAUX & DÉVISE CONVERTIE POUR LES TEMPLATES ---
      totalSejour: formatTND(totalGeneralTND),
      totalFacture: formatTND(totalGeneralTND),
      
      // Variables spécifiques au modèle Étranger (EUR)
      tauxEUR: tauxEUR.toFixed(2),
      totalEUR: formatEUR(totalGeneralEUR),
      totalSejourEUR: formatEUR(totalGeneralEUR),

      hasAcompte: acompte > 0,
      montantRegle: formatTND(acompte),
      acompte: formatTND(acompte),
      soldeRestant: formatTND(soldeRestantTND),
      soldeRestantTND: formatTND(soldeRestantTND),
      netAPayer: formatTND(totalGeneralTND),
      montantEnLettres: numberToFrenchWords(totalGeneralTND),

      // Objet patient complet
      patient: {
        nomPrenom: patientNomPrenom,
        telephone: patient?.telephone || '',
        nationalite: patient?.nationalite || (isEtranger ? 'Étrangère' : 'Tunisienne'),
        paysResidence: patient?.paysResidence || (isEtranger ? 'France' : 'Tunisie'),
        passeportClair: cinPasseport,
        dateNaissance,
      },
      clinic: config.clinic,
    };
  }

  /**
   * Sélectionne et compile le bon template parmi les 4 selon le type et la nationalité
   */
  public static renderHtml(facture: any, patient: any): string {
    this.loadTemplates();
    const context = this.prepareContext(facture, patient);
    const isDevis = facture.type === 'DEVIS';
    const isEtranger = this.isEtranger(facture, patient);

    if (isDevis) {
      if (isEtranger) {
        return devisEtrangerTemplate!(context);
      } else {
        return devisTunisienTemplate!(context);
      }
    } else {
      if (isEtranger) {
        return factureEtrangerTemplate!(context);
      } else {
        return factureTunisienTemplate!(context);
      }
    }
  }

  /**
   * Génère un fichier PDF A4 haute définition avec Puppeteer
   */
  public static async generatePdf(facture: any, patient: any): Promise<Buffer> {
    const html = this.renderHtml(facture, patient);

    let browser = null;
    try {
      // Configuration adaptée aux serveurs Linux (Render) + Détection auto du binaire Chrome
      const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.cache', 'puppeteer');

      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: ['load', 'domcontentloaded'],
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });

      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('[PdfService] Erreur lors de la génération PDF via Puppeteer:', error);
      throw new Error(`Échec de génération du PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
