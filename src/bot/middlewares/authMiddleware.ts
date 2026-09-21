import { Context, NextFunction } from 'grammy';
import { config } from '../../config/env.js';
import { Request, Response, NextFunction as ExpressNext } from 'express';

// Flag de sécurité désactivée pour la phase de test (à la demande de l'utilisateur)
export let SECURITY_ENABLED = false;

// Sessions PIN en mémoire (TelegramId -> Timestamp de dernière vérification)
const verifiedPinSessions = new Map<number, number>();

// Durée de validité du PIN : 2 heures (en ms)
const PIN_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * Middleware GramMY pour la Whitelist Telegram
 * En mode test : autorise tous les utilisateurs sans restriction
 */
export async function whitelistMiddleware(ctx: Context, next: NextFunction) {
  // Si la sécurité est désactivée pour les tests, on autorise tout le monde directement
  if (!SECURITY_ENABLED) {
    return next();
  }

  const telegramId = ctx.from?.id;

  if (!telegramId) {
    return ctx.reply('⚠️ Erreur d\'identification de l\'utilisateur.');
  }

  // Vérification de la liste blanche
  const isWhitelisted = config.telegram.whitelistIds.includes(telegramId);

  if (!isWhitelisted) {
    console.warn(`[Sécurité Bot] Tentative d'accès non autorisée de l'ID Telegram: ${telegramId} (@${ctx.from?.username || 'inconnu'})`);
    return ctx.reply(
      `⛔ <b>ACCÈS REFUSÉ — PERLA BODY SCULPT ERP</b>\n\n` +
      `Votre identifiant Telegram (<code>${telegramId}</code>) n'est pas autorisé sur ce système médical sécurisé.\n\n` +
      `<i>Veuillez contacter la direction de l'établissement pour ajouter votre identifiant à la whitelist.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  await next();
}

/**
 * Vérifie si l'utilisateur Telegram a déverrouillé sa session avec le code PIN
 * En mode test : retourne toujours true pour ne pas bloquer les tests
 */
export function isUserPinVerified(telegramId: number): boolean {
  if (!SECURITY_ENABLED) {
    return true; // Déverrouillé par défaut pour les tests
  }

  const lastVerified = verifiedPinSessions.get(telegramId);
  if (!lastVerified) return false;

  // Expiration de session PIN
  if (Date.now() - lastVerified > PIN_SESSION_TIMEOUT_MS) {
    verifiedPinSessions.delete(telegramId);
    return false;
  }
  return true;
}

/**
 * Enregistre la validation du PIN pour un utilisateur
 */
export function setPinVerified(telegramId: number) {
  verifiedPinSessions.set(telegramId, Date.now());
}

/**
 * Supprime la session PIN (déconnexion)
 */
export function revokePinSession(telegramId: number) {
  verifiedPinSessions.delete(telegramId);
}

/**
 * Middleware de sécurité pour Express Webhook
 * En mode test : autorise tout appel sans exiger le secret strict
 */
export function validateWebhookSecret(req: Request, res: Response, next: ExpressNext) {
  if (!SECURITY_ENABLED) {
    return next(); // Mode test : webhook ouvert
  }

  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];

  if (!config.telegram.secretToken) {
    return next(); // Si aucun secret configuré, continuer
  }

  if (secretHeader !== config.telegram.secretToken) {
    console.warn('[Webhook Security] Rejet webhook : Token secret invalide ou absent');
    return res.status(403).json({ error: 'Accès interdit : Secret Token non valide' });
  }

  next();
}
