import { Facture, IFacture } from '../models/Facture.js';
import { Patient, IPatient } from '../models/Patient.js';
import { CryptoService } from './cryptoService.js';
import { isDbConnected } from '../config/db.js';
import { formatTND } from './pdfService.js';

// Stockage mémoire de secours (fallback en cas d'absence de serveur MongoDB externe)
export interface MemoryPatient {
  _id: string;
  nomPrenom: string;
  passeportEncrypted: string;
  nationalite: string;
  telephone: string;
  paysResidence: string;
  dateNaissance?: string;
  createdAt: Date;
}

export interface MemoryFacture {
  _id: string;
  numeroFacture: string;
  type: 'DEVIS' | 'FACTURE';
  clientType?: 'TUNISIEN' | 'ETRANGER';
  devise?: 'TND' | 'EUR';
  patientId: string;
  actePrincipal: string;
  prestations: Array<{ designation: string; detail?: string; quantite: number; prixUnitaire: number }>;
  charges: Array<{ categorie: string; montant: number; description: string }>;
  totalHT: number;
  acompte: number;
  soldeRestant: number;
  margeNette: number;
  statutPaiement: 'EN_ATTENTE' | 'PARTIEL' | 'PAYE';
  anesthesie?: string;
  dureeEstimee?: string;
  dateIntervention?: string;
  dateEcheance?: string;
  modeReglement?: string;
  notes?: string;
  nomHotel?: string;
  nuitsHotel?: string;
  montantHotel?: number;
  nuitsAccompagnateurHotel?: string;
  montantAccompagnateurHotel?: number;
  transferts?: Array<{ designation: string; quantite: number; montant: number }>;
  dureeSejourClinique?: string;
  zonesTraitees?: string;
  validiteDevis?: string;
  dateDevis?: string;
  dateFacture?: string;
  dureeTotaleSejour?: string;
  interventionPrevue?: string;
  nuitsClinique?: number;
  createdAt: Date;
}

// Données en mémoire initialisées avec les exemples Perla Body Sculpt
let memoryPatients: MemoryPatient[] = [
  {
    _id: 'mem_p1',
    nomPrenom: 'Amira Ben Ali',
    passeportEncrypted: CryptoService.encrypt('X1234567'),
    nationalite: 'Tunisienne',
    telephone: '+216 26 723 876',
    paysResidence: 'Tunisie',
    createdAt: new Date('2026-05-15'),
  },
  {
    _id: 'mem_p2',
    nomPrenom: 'Nora Benchikh',
    passeportEncrypted: CryptoService.encrypt('25004709'),
    nationalite: 'Algérienne',
    telephone: '+213 550 12 34 56',
    paysResidence: 'Algérie',
    createdAt: new Date('2026-07-11'),
  },
];

let memoryFactures: MemoryFacture[] = [
  {
    _id: 'mem_f1',
    numeroFacture: 'FAC-2026-001',
    type: 'FACTURE',
    patientId: 'mem_p1',
    actePrincipal: 'Liposuccion + Lipo-injection',
    anesthesie: 'Générale',
    dureeEstimee: '2h30',
    dateIntervention: '20/06/2026',
    dateEcheance: '30/05/2026',
    modeReglement: 'Virement bancaire',
    prestations: [
      { designation: 'Liposuccion', detail: 'Zone abdominale + flancs', quantite: 1, prixUnitaire: 3000 },
      { designation: 'Lipo-injection fessière', detail: 'Greffe de graisse autologue', quantite: 1, prixUnitaire: 2500 },
      { designation: 'Consultation pré-opératoire', detail: 'Bilan + analyses', quantite: 1, prixUnitaire: 250 },
    ],
    charges: [
      { categorie: 'Hôtel', montant: 400, description: 'Séjour clinique & hôtel partenaire' },
      { categorie: 'Transfert', montant: 150, description: 'Chauffeur privé aéroport / clinique' },
      { categorie: 'Bloc', montant: 600, description: 'Frais de bloc opératoire & stérilisation' },
      { categorie: 'Chirurgie', montant: 1800, description: 'Honoraires chirurgien principal' },
    ],
    totalHT: 5750,
    acompte: 1000,
    soldeRestant: 4750,
    margeNette: 2800,
    statutPaiement: 'PARTIEL',
    notes: 'Dossier complet validé avec bilan pré-anesthésique.',
    createdAt: new Date('2026-05-15'),
  },
  {
    _id: 'mem_f2',
    numeroFacture: 'DEV-2026-014',
    type: 'DEVIS',
    patientId: 'mem_p2',
    actePrincipal: 'BBL Sculpting HD',
    anesthesie: 'Générale',
    dureeEstimee: '3h00',
    dateIntervention: '15/10/2026',
    dateEcheance: '15/08/2026',
    modeReglement: 'Espèces / Virement',
    prestations: [
      { designation: 'BBL Sculpting Haute Définition', detail: 'Liposuccion 360 + Injection fessiers', quantite: 1, prixUnitaire: 4680 },
    ],
    charges: [
      { categorie: 'Clinique', montant: 880, description: 'Compte clinique Myron' },
      { categorie: 'Bloc', montant: 500, description: 'Frais consommables opératoires' },
      { categorie: 'Chirurgie', montant: 1400, description: 'Honoraires équipe chirurgicale' },
    ],
    totalHT: 4680,
    acompte: 1500,
    soldeRestant: 3180,
    margeNette: 1900,
    statutPaiement: 'PARTIEL',
    createdAt: new Date(),
  },
];

export class FinanceService {
  /**
   * Génère le prochain numéro séquentiel (ex: FAC-2026-002 ou DEV-2026-002)
   */
  public static async generateNextNumero(type: 'DEVIS' | 'FACTURE'): Promise<string> {
    const prefix = type === 'DEVIS' ? 'DEV' : 'FAC';
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^${prefix}-${year}-`);

    let nextSeq = 1;

    if (isDbConnected()) {
      try {
        const lastDoc = await Facture.findOne({
          numeroFacture: { $regex: pattern },
        })
          .sort({ createdAt: -1 })
          .lean();

        if (lastDoc) {
          const parts = lastDoc.numeroFacture.split('-');
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num)) nextSeq = num + 1;
          }
        }
      } catch (e) {
        console.warn('Erreur séquence MongoDB, utilisation fallback:', e);
      }
    } else {
      const docs = memoryFactures.filter(f => f.numeroFacture.startsWith(`${prefix}-${year}-`));
      if (docs.length > 0) {
        nextSeq = docs.length + 1;
      }
    }

    const seqFormatted = String(nextSeq).padStart(3, '0');
    return `${prefix}-${year}-${seqFormatted}`;
  }

  /**
   * Crée ou met à jour un patient avec chiffrement AES-256 du passeport
   */
  public static async findOrCreatePatient(data: {
    nomPrenom: string;
    passeport: string;
    nationalite?: string;
    telephone: string;
    paysResidence?: string;
    dateNaissance?: string;
  }): Promise<{ patient: any; id: string }> {
    const passeportEncrypted = CryptoService.encrypt(data.passeport);

    if (isDbConnected()) {
      // Chercher par nom ou passeport
      let patient = await Patient.findOne({
        nomPrenom: new RegExp(`^${data.nomPrenom.trim()}$`, 'i'),
      });

      if (!patient) {
        patient = await Patient.create({
          nomPrenom: data.nomPrenom.trim(),
          passeportEncrypted,
          nationalite: data.nationalite || 'Tunisienne',
          telephone: data.telephone.trim(),
          paysResidence: data.paysResidence || 'Tunisie',
          dateNaissance: data.dateNaissance || '',
        });
      } else if (data.dateNaissance && !patient.dateNaissance) {
        patient.dateNaissance = data.dateNaissance;
        await patient.save();
      }
      return { patient, id: patient._id.toString() };
    } else {
      let patient = memoryPatients.find(
        p => p.nomPrenom.toLowerCase() === data.nomPrenom.trim().toLowerCase()
      );

      if (!patient) {
        const newPatient: MemoryPatient = {
          _id: `mem_p_${Date.now()}`,
          nomPrenom: data.nomPrenom.trim(),
          passeportEncrypted,
          nationalite: data.nationalite || 'Tunisienne',
          telephone: data.telephone.trim(),
          paysResidence: data.paysResidence || 'Tunisie',
          dateNaissance: data.dateNaissance || '',
          createdAt: new Date(),
        };
        memoryPatients.push(newPatient);
        patient = newPatient;
      } else if (data.dateNaissance && !patient.dateNaissance) {
        patient.dateNaissance = data.dateNaissance;
      }
      return { patient, id: patient._id };
    }
  }

  /**
   * Crée et enregistre un Devis ou une Facture
   */
  public static async createDocument(params: {
    type: 'DEVIS' | 'FACTURE';
    clientType?: 'TUNISIEN' | 'ETRANGER';
    devise?: 'TND' | 'EUR';
    patientData: {
      nomPrenom: string;
      passeport: string;
      telephone: string;
      nationalite?: string;
      paysResidence?: string;
      dateNaissance?: string;
    };
    actePrincipal: string;
    prestations: Array<{ designation: string; detail?: string; quantite: number; prixUnitaire: number }>;
    charges: Array<{ categorie: any; montant: number; description: string }>;
    acompte: number;
    anesthesie?: string;
    dureeEstimee?: string;
    dateIntervention?: string;
    notes?: string;
    nomHotel?: string;
    nuitsHotel?: string;
    montantHotel?: number;
    nuitsAccompagnateurHotel?: string;
    montantAccompagnateurHotel?: number;
    transferts?: Array<{ designation: string; quantite: number; montant: number }>;
    dureeSejourClinique?: string;
    zonesTraitees?: string;
    validiteDevis?: string;
    dateDevis?: string;
    dateFacture?: string;
    dureeTotaleSejour?: string;
    interventionPrevue?: string;
    nuitsClinique?: number;
    numeroFacture?: string;
  }): Promise<{ doc: any; patient: any }> {
    const { patient, id: patientId } = await this.findOrCreatePatient(params.patientData);
    const numeroFacture = params.numeroFacture || await this.generateNextNumero(params.type);

    const isEtranger =
      params.clientType === 'ETRANGER' ||
      (params.patientData.nationalite &&
        params.patientData.nationalite.toLowerCase() !== 'tunisienne' &&
        params.patientData.nationalite.toLowerCase() !== 'tunisien' &&
        params.patientData.nationalite.toLowerCase() !== 'tn');

    const clientType = params.clientType || (isEtranger ? 'ETRANGER' : 'TUNISIEN');
    const devise = params.devise || (isEtranger ? 'EUR' : 'TND');

    // Calculs
    const totalPrestations = params.prestations.reduce(
      (acc, p) => acc + (p.quantite || 1) * (p.prixUnitaire || 0),
      0
    );

    let extraSejour = 0;
    if (clientType === 'ETRANGER') {
      extraSejour += (params.montantHotel || 0) + (params.montantAccompagnateurHotel || 0);
      extraSejour += (params.transferts || []).reduce((acc, t) => acc + (t.montant || 0), 0);
    }

    const totalHT = Math.round((totalPrestations + extraSejour) * 1000) / 1000;

    const totalCharges = params.charges.reduce(
      (acc, c) => acc + (c.montant || 0),
      0
    );
    const margeNette = Math.round((totalHT - totalCharges) * 1000) / 1000;
    const acompteSecurise = Math.min(params.acompte || 0, totalHT);
    const soldeRestant = Math.round((totalHT - acompteSecurise) * 1000) / 1000;

    let statutPaiement: 'EN_ATTENTE' | 'PARTIEL' | 'PAYE' = 'EN_ATTENTE';
    if (soldeRestant === 0 && totalHT > 0) {
      statutPaiement = 'PAYE';
    } else if (acompteSecurise > 0) {
      statutPaiement = 'PARTIEL';
    }

    if (isDbConnected()) {
      const doc = await Facture.create({
        numeroFacture,
        type: params.type,
        clientType,
        devise,
        patientId,
        actePrincipal: params.actePrincipal,
        prestations: params.prestations,
        charges: params.charges,
        totalHT,
        acompte: acompteSecurise,
        soldeRestant,
        margeNette,
        statutPaiement,
        anesthesie: params.anesthesie || 'Générale',
        dureeEstimee: params.dureeEstimee || '2h00',
        dateIntervention: params.dateIntervention,
        notes: params.notes,
        nomHotel: params.nomHotel,
        nuitsHotel: params.nuitsHotel,
        montantHotel: params.montantHotel,
        nuitsAccompagnateurHotel: params.nuitsAccompagnateurHotel,
        montantAccompagnateurHotel: params.montantAccompagnateurHotel,
        transferts: params.transferts,
        dureeSejourClinique: params.dureeSejourClinique,
        zonesTraitees: params.zonesTraitees,
        validiteDevis: params.validiteDevis,
        dateDevis: params.dateDevis,
        dateFacture: params.dateFacture,
        dureeTotaleSejour: params.dureeTotaleSejour,
        interventionPrevue: params.interventionPrevue,
        nuitsClinique: params.nuitsClinique,
      });

      return { doc, patient };
    } else {
      const doc: MemoryFacture = {
        _id: `mem_f_${Date.now()}`,
        numeroFacture,
        type: params.type,
        clientType,
        devise,
        patientId,
        actePrincipal: params.actePrincipal,
        prestations: params.prestations,
        charges: params.charges,
        totalHT,
        acompte: acompteSecurise,
        soldeRestant,
        margeNette,
        statutPaiement,
        anesthesie: params.anesthesie || 'Générale',
        dureeEstimee: params.dureeEstimee || '2h00',
        dateIntervention: params.dateIntervention,
        notes: params.notes,
        nomHotel: params.nomHotel,
        nuitsHotel: params.nuitsHotel,
        montantHotel: params.montantHotel,
        nuitsAccompagnateurHotel: params.nuitsAccompagnateurHotel,
        montantAccompagnateurHotel: params.montantAccompagnateurHotel,
        transferts: params.transferts,
        dureeSejourClinique: params.dureeSejourClinique,
        zonesTraitees: params.zonesTraitees,
        validiteDevis: params.validiteDevis,
        dateDevis: params.dateDevis,
        dateFacture: params.dateFacture,
        dureeTotaleSejour: params.dureeTotaleSejour,
        interventionPrevue: params.interventionPrevue,
        nuitsClinique: params.nuitsClinique,
        createdAt: new Date(),
      };
      memoryFactures.push(doc);
      return { doc, patient };
    }
  }

  /**
   * Commande /stats_mois : calcule CA, Total Charges, Marge Nette pour le mois en cours
   */
  public static async getMonthlyStats(month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month !== undefined ? month : now.getMonth();
    const targetYear = year !== undefined ? year : now.getFullYear();

    let facturesList: any[] = [];

    if (isDbConnected()) {
      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      facturesList = await Facture.find({
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();
    } else {
      facturesList = memoryFactures.filter(f => {
        const d = new Date(f.createdAt);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      });
    }

    // Statistiques séparées Factures (CA réel) et Devis (potentiel)
    const facturesOnly = facturesList.filter(f => f.type === 'FACTURE');
    const devisOnly = facturesList.filter(f => f.type === 'DEVIS');

    const totalCA = facturesOnly.reduce((sum, f) => sum + (f.totalHT || 0), 0);
    const totalChargesFactures = facturesOnly.reduce((sum, f) => {
      const chSum = (f.charges || []).reduce((cSum: number, c: any) => cSum + (c.montant || 0), 0);
      return sum + chSum;
    }, 0);
    const margeNetteFactures = totalCA - totalChargesFactures;
    const totalAcomptes = facturesOnly.reduce((sum, f) => sum + (f.acompte || 0), 0);
    const totalSoldesEnAttente = facturesOnly.reduce((sum, f) => sum + (f.soldeRestant || 0), 0);

    const devisVolume = devisOnly.reduce((sum, f) => sum + (f.totalHT || 0), 0);
    const tauxMarge = totalCA > 0 ? ((margeNetteFactures / totalCA) * 100).toFixed(1) : '0.0';

    return {
      mois: new Date(targetYear, targetMonth, 1).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      }),
      nombreFactures: facturesOnly.length,
      nombreDevis: devisOnly.length,
      totalCA,
      totalCAFormatted: formatTND(totalCA),
      totalCharges: totalChargesFactures,
      totalChargesFormatted: formatTND(totalChargesFactures),
      margeNette: margeNetteFactures,
      margeNetteFormatted: formatTND(margeNetteFactures),
      tauxMarge: `${tauxMarge}%`,
      totalAcomptes,
      totalAcomptesFormatted: formatTND(totalAcomptes),
      totalSoldesEnAttente,
      totalSoldesEnAttenteFormatted: formatTND(totalSoldesEnAttente),
      devisVolume,
      devisVolumeFormatted: formatTND(devisVolume),
    };
  }

  /**
   * Commande /historique_client [Nom/Passeport]
   * Recherche un patient et retourne l'historique complet de ses devis et factures
   */
  public static async getClientHistory(query: string) {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return { patient: null, items: [] };

    let matchedPatients: any[] = [];

    if (isDbConnected()) {
      const allPatients = await Patient.find().lean();
      matchedPatients = allPatients.filter(p => {
        const nomMatches = p.nomPrenom.toLowerCase().includes(cleanQuery);
        const passeport = CryptoService.decrypt(p.passeportEncrypted).toLowerCase();
        const passMatches = passeport.includes(cleanQuery);
        return nomMatches || passMatches;
      });
    } else {
      matchedPatients = memoryPatients.filter(p => {
        const nomMatches = p.nomPrenom.toLowerCase().includes(cleanQuery);
        const passeport = CryptoService.decrypt(p.passeportEncrypted).toLowerCase();
        const passMatches = passeport.includes(cleanQuery);
        return nomMatches || passMatches;
      });
    }

    if (matchedPatients.length === 0) {
      return { patient: null, items: [] };
    }

    const patient = matchedPatients[0];
    const patientId = patient._id.toString();

    let items: any[] = [];
    if (isDbConnected()) {
      items = await Facture.find({ patientId: patient._id })
        .sort({ createdAt: -1 })
        .lean();
    } else {
      items = memoryFactures.filter(f => f.patientId.toString() === patientId);
    }

    return {
      patient: {
        nomPrenom: patient.nomPrenom,
        passeport: CryptoService.decrypt(patient.passeportEncrypted),
        telephone: patient.telephone,
        nationalite: patient.nationalite,
        paysResidence: patient.paysResidence,
      },
      items: items.map(it => ({
        numeroFacture: it.numeroFacture,
        type: it.type,
        actePrincipal: it.actePrincipal,
        totalHT: it.totalHT,
        totalHTFormatted: formatTND(it.totalHT),
        margeNette: it.margeNette,
        margeNetteFormatted: formatTND(it.margeNette),
        acompte: it.acompte,
        soldeRestant: it.soldeRestant,
        statutPaiement: it.statutPaiement,
        date: new Date(it.createdAt).toLocaleDateString('fr-FR'),
      })),
    };
  }

  /**
   * Commande /export_excel : export CSV conforme Excel (UTF-8 avec BOM) ou JSON
   */
  public static async exportFinancialData(format: 'csv' | 'json'): Promise<{ data: string; mimeType: string; filename: string }> {
    let allFactures: any[] = [];
    let allPatients: any[] = [];

    if (isDbConnected()) {
      allFactures = await Facture.find().sort({ createdAt: -1 }).lean();
      allPatients = await Patient.find().lean();
    } else {
      allFactures = [...memoryFactures];
      allPatients = [...memoryPatients];
    }

    const patientMap = new Map<string, any>();
    allPatients.forEach(p => patientMap.set(p._id.toString(), p));

    const enriched = allFactures.map(f => {
      const patient = patientMap.get(f.patientId?.toString() || '');
      const passeport = patient ? CryptoService.decrypt(patient.passeportEncrypted) : '';
      return {
        numeroPiece: f.numeroFacture,
        type: f.type,
        date: new Date(f.createdAt).toISOString().split('T')[0],
        patientNom: patient ? patient.nomPrenom : 'Inconnu',
        patientPasseport: passeport,
        patientTelephone: patient ? patient.telephone : '',
        actePrincipal: f.actePrincipal,
        totalHT_TND: f.totalHT,
        totalCharges_TND: Math.round((f.totalHT - f.margeNette) * 1000) / 1000,
        margeNette_TND: f.margeNette,
        acompte_TND: f.acompte,
        soldeRestant_TND: f.soldeRestant,
        statutPaiement: f.statutPaiement,
      };
    });

    if (format === 'json') {
      return {
        data: JSON.stringify(enriched, null, 2),
        mimeType: 'application/json',
        filename: `perla_export_${new Date().toISOString().split('T')[0]}.json`,
      };
    }

    // Format CSV avec BOM UTF-8 (\uFEFF) pour ouverture immédiate dans Excel
    const headers = [
      'N° Pièce',
      'Type',
      'Date Émission',
      'Nom Patient',
      'N° Passeport',
      'Téléphone',
      'Acte Principal',
      'Total HT (TND)',
      'Total Charges (TND)',
      'Marge Nette (TND)',
      'Acompte (TND)',
      'Solde Restant (TND)',
      'Statut Paiement',
    ];

    const rows = enriched.map(r => [
      `"${r.numeroPiece}"`,
      `"${r.type}"`,
      `"${r.date}"`,
      `"${r.patientNom.replace(/"/g, '""')}"`,
      `"${r.patientPasseport}"`,
      `"${r.patientTelephone}"`,
      `"${r.actePrincipal.replace(/"/g, '""')}"`,
      r.totalHT_TND,
      r.totalCharges_TND,
      r.margeNette_TND,
      r.acompte_TND,
      r.soldeRestant_TND,
      `"${r.statutPaiement}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');

    return {
      data: csvContent,
      mimeType: 'text/csv; charset=utf-8',
      filename: `perla_export_financier_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  /**
   * Récupère tous les documents pour l'interface d'administration
   */
  public static async getAllDocuments() {
    let factures: any[] = [];
    let patients: any[] = [];

    if (isDbConnected()) {
      factures = await Facture.find().sort({ createdAt: -1 }).lean();
      patients = await Patient.find().lean();
    } else {
      factures = [...memoryFactures];
      patients = [...memoryPatients];
    }

    const patientMap = new Map<string, any>();
    patients.forEach(p => {
      patientMap.set(p._id.toString(), {
        ...p,
        passeportClair: CryptoService.decrypt(p.passeportEncrypted),
      });
    });

    return factures.map(f => {
      const p = patientMap.get(f.patientId?.toString() || '');
      return {
        ...f,
        patient: p || { nomPrenom: 'Patient', passeportClair: '—', telephone: '—' },
      };
    });
  }

  /**
   * Récupère une facture par son ID ou numéro
   */
  public static async getDocumentById(idOrNumber: string) {
    if (isDbConnected()) {
      let doc = await Facture.findOne({
        $or: [{ _id: idOrNumber.match(/^[0-9a-fA-F]{24}$/) ? idOrNumber : null }, { numeroFacture: idOrNumber }],
      }).populate('patientId');
      
      if (doc) {
        return { doc: doc.toObject(), patient: doc.patientId };
      }
    }

    const memDoc = memoryFactures.find(
      f => f._id === idOrNumber || f.numeroFacture === idOrNumber
    );
    if (memDoc) {
      const p = memoryPatients.find(pat => pat._id === memDoc.patientId);
      return { doc: memDoc, patient: p };
    }

    return null;
  }
}
