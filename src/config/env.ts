import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  appUrl: string;
  telegram: {
    botToken: string;
    secretToken: string;
    whitelistIds: number[];
    adminPin: string;
  };
  security: {
    encryptionKey: string;
  };
  db: {
    mongoUri: string;
  };
  clinic: {
    name: string;
    phone: string;
    email: string;
    address: string;
    mf: string;
    identifiant: string;
  };
}

// Parse whitelist IDs from comma-separated string
const rawWhitelist = process.env.TELEGRAM_WHITELIST_IDS || '';
const whitelistIds = rawWhitelist
  .split(',')
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    secretToken: process.env.TELEGRAM_SECRET_TOKEN || 'perla_secret_webhook_token_2026',
    whitelistIds: whitelistIds.length > 0 ? whitelistIds : [123456789], // Default admin ID fallback
    adminPin: process.env.ERP_ADMIN_PIN || '2026',
  },
  security: {
    // 32-byte secret key for AES-256-GCM
    encryptionKey: process.env.ENCRYPTION_KEY || 'perla_body_sculpt_aes256_key_32_bytes!',
  },
  db: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/perla_erp',
  },
  clinic: {
    name: process.env.CLINIC_NAME || 'Perla Body Sculpt',
    phone: process.env.CLINIC_PHONE || '+216 26 723 876',
    email: process.env.CLINIC_EMAIL || 'perlabodyartcontact@gmail.com',
    address: process.env.CLINIC_ADDRESS || 'Rue de la Feuille d\'Érable, 1053 Les Berges du Lac 2, Tunis',
    mf: process.env.CLINIC_MF || '1234567/A/M/000',
    identifiant: process.env.CLINIC_IDENTIFIANT || '0682012',
  },
};
