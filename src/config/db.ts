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
 * Initialisation désactivée pour éviter d'insérer de fausses données de test.
 */
async function seedInitialDataIfEmpty() {
  // Fonction vidée : Pas de données de test automatiques.
  return;
}
