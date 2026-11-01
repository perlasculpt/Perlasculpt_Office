import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Service de chiffrement symétrique renforcé AES-256-GCM
 * Conforme aux exigences de sécurité médicale pour la protection
 * des identifiants sensibles (Passeport, CIN, coordonnées).
 */
export class CryptoService {
  private static algorithm = 'aes-256-gcm';
  private static key: Buffer;

  private static getKey(): Buffer {
    if (!this.key) {
      // Hachage SHA-256 de la clé secrète pour garantir exactement 32 octets
      this.key = crypto.createHash('sha256').update(config.security.encryptionKey).digest();
    }
    return this.key;
  }

  /**
   * Chiffre un texte clair en utilisant AES-256-GCM avec un vecteur d'initialisation unique
   * @param plaintext Texte sensible à chiffrer
   * @returns Chaîne encodée au format `iv:authTag:encryptedContent`
   */
  public static encrypt(plaintext: string): string {
    if (!plaintext) return '';

    try {
      // Vecteur d'initialisation aléatoire cryptographiquement fort (16 octets / 128 bits)
      const iv = crypto.randomBytes(16);
      const key = this.getKey();

      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Tag d'authentification GCM pour garantir l'intégrité des données
      const authTag = (cipher as any).getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('[CryptoService] Erreur lors du chiffrement:', error);
      throw new Error('Échec du chiffrement des données sensibles');
    }
  }

  /**
   * Déchiffre une chaîne chiffrée en AES-256-GCM
   * @param encryptedData Chaîne au format `iv:authTag:encryptedContent`
   * @returns Texte clair original
   */
  public static decrypt(encryptedData: string): string {
    if (!encryptedData) return '';

    // Si la donnée n'est pas au format iv:authTag:ciphertext (ex: migration ou texte clair existant)
    if (!encryptedData.includes(':')) {
      return encryptedData;
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        return encryptedData;
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const key = this.getKey();

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      (decipher as any).setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[CryptoService] Échec déchiffrement (altération ou mauvaise clé):', error);
      return '[DONNÉE PROTÉGÉE - DÉCHIFFREMENT IMPOSSIBLE]';
    }
  }
}
