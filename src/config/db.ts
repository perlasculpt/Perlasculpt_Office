import mongoose from 'mongoose';
import { config } from './env.js';
import { Patient } from '../models/Patient.js';
import { Facture } from '../models/Facture.js';
import { CryptoService } from '../services/cryptoService.js';

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  if (isConnected) return true;

  try {
    mongoose.set('strictQuery', true);
    
    // Timeout court pour éviter de bloquer le démarrage si Mongo n'est pas encore lancé
    await mongoose.connect(config.db.mongoUri, {
      serverSelectionTimeoutMS: 2000,
    });

    isConnected = true;
    console.log(`[Database] Connecté avec succès à MongoDB: ${config.db.mongoUri}`);
    
    // Initialiser les données de démonstration si la base est vide
    await seedInitialDataIfEmpty();
    return true;
  } catch (error: any) {
    console.warn(`[Database] MongoDB non accessible à ${config.db.mongoUri} (${error.message}).`);
    console.warn(`[Database] Mode fallback mémoire actif : l'ERP et le Bot fonctionnent avec persistance en mémoire.`);
    isConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Insère des données de test conformes aux exemples de Perla Body Sculpt
 * (Amira Ben Ali, Nora Benchikh) si la base est vide.
 */
async function seedInitialDataIfEmpty() {
  try {
    const count = await Patient.countDocuments();
    if (count === 0) {
      console.log('[Database] Initialisation des données modèles pour Perla Body Sculpt...');
      
      // Patiente 1 : Amira Ben Ali
      const patient1 = await Patient.create({
        nomPrenom: 'Amira Ben Ali',
        passeportEncrypted: CryptoService.encrypt('X1234567'),
        nationalite: 'Tunisienne',
        telephone: '+216 26 723 876',
        paysResidence: 'Tunisie',
      });

      // Facture FAC-2024-001 (comme dans le HTML fourni)
      await Facture.create({
        numeroFacture: 'FAC-2024-001',
        type: 'FACTURE',
        patientId: patient1._id,
        actePrincipal: 'Liposuccion + Lipo-injection',
        anesthesie: 'Générale',
        dureeEstimee: '2h30',
        dateIntervention: '20/06/2024',
        dateEcheance: '30/05/2024',
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
        acompte: 1000,
        notes: 'Dossier complet validé avec bilan pré-anesthésique.',
      });

      // Patiente 2 : Nora Benchikh
      const patient2 = await Patient.create({
        nomPrenom: 'Nora Benchikh',
        passeportEncrypted: CryptoService.encrypt('25004709'),
        nationalite: 'Algérienne',
        telephone: '+213 550 12 34 56',
        paysResidence: 'Algérie',
      });

      // Devis DEV-2025-014
      await Facture.create({
        numeroFacture: 'DEV-2025-014',
        type: 'DEVIS',
        patientId: patient2._id,
        actePrincipal: 'BBL & Remodelage silhouette',
        anesthesie: 'Générale',
        dureeEstimee: '3h00',
        dateIntervention: '15/10/2025',
        prestations: [
          { designation: 'BBL Sculpting Haute Définition', detail: 'Liposuccion 360 + Injection fessiers', quantite: 1, prixUnitaire: 3662.378 },
        ],
        charges: [
          { categorie: 'Clinique', montant: 879.535, description: 'Compte d\'autrui clinique Myron' },
          { categorie: 'Bloc', montant: 450, description: 'Frais consommables opératoires' },
          { categorie: 'Chirurgie', montant: 1200, description: 'Honoraires équipe chirurgicale' },
        ],
        acompte: 1000,
      });

      console.log('[Database] Données modèles insérées avec succès (chiffrement AES-256 actif).');
    }
  } catch (err: any) {
    console.warn('[Database] Impossible d\'insérer les données d\'amorçage:', err.message);
  }
}
