import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { app } from './src/app.js';
import { config } from './src/config/env.js';
import { getBot, setupBotCommands, startBotPolling } from './src/bot/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  // En mode développement, intégrer Vite comme middleware pour React
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // En production, servir les fichiers compilés de dist/
    const distPath = path.join(process.cwd(), 'dist');
    app.use((await import('express')).default.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initialisation et démarrage du bot Telegram si un token valide est configuré
  if (config.telegram.botToken && !config.telegram.botToken.startsWith('123456789:AAFake')) {
    try {
      const bot = getBot();
      await setupBotCommands(bot);
      console.log('[Telegram Bot] Bot initialisé et commandes enregistrées avec succès.');

      // Détection automatique : Si l'URL n'est pas un domaine public HTTPS (ex: en local sur votre PC),
      // nous démarrons immédiatement le Long Polling afin que Telegram vous réponde instantanément !
      const isPublicHttps = Boolean(config.appUrl && config.appUrl.startsWith('https://'));
      if (!isPublicHttps || process.env.USE_POLLING === 'true') {
        console.log('[Telegram Bot] Environnement Local détecté (http://localhost ou http://0.0.0.0)');
        console.log('[Telegram Bot] Démarrage du mode Long Polling (écoute directe sans besoin de tunnel/ngrok)...');
        await startBotPolling(bot);
      } else {
        // En hébergement cloud public HTTPS (ex: Cloud Run)
        const webhookUrl = `${config.appUrl}/api/telegram/webhook`;
        await bot.api.setWebhook(webhookUrl, {
          secret_token: config.telegram.secretToken || undefined,
        });
        console.log(`[Telegram Bot] Mode Webhook activé sur : ${webhookUrl}`);
      }
    } catch (err: any) {
      console.warn('[Telegram Bot] Erreur démarrage bot:', err.message);
    }
  } else {
    console.log('[Telegram Bot] Aucun Token Telegram réel configuré dans .env. Utilisez le simulateur Web ou ajoutez votre TELEGRAM_BOT_TOKEN.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Perla ERP Server] Serveur démarré sur http://0.0.0.0:${PORT}`);
    console.log(`[Perla ERP Server] Interface Web: http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Échec du démarrage du serveur:', err);
  process.exit(1);
});
