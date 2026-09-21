import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './src/app.js';
import { config } from './src/config/env.js';
import { getBot, setupBotCommands, startBotPolling } from './src/bot/bot.js';

// En CommonJS, __dirname existe déjà nativement
const PORT = process.env.PORT || 3000;

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

      // Détection de l'URL publique (Render fournit automatiquement process.env.RENDER_EXTERNAL_URL)
      const publicUrl = process.env.RENDER_EXTERNAL_URL || config.appUrl;
      const isRenderProd = Boolean(process.env.RENDER || (publicUrl && publicUrl.startsWith('https://')));

      if (isRenderProd && process.env.USE_POLLING !== 'true') {
        // En hébergement Cloud (Render), activation obligatoire du WEBHOOK
        const webhookUrl = `${publicUrl}/api/telegram/webhook`;
        
        // Supprimer l'ancien webhook/polling en attente
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        
        // Enregistrer le nouveau webhook
        await bot.api.setWebhook(webhookUrl, {
          secret_token: config.telegram.secretToken || undefined,
        });
        console.log(`[Telegram Bot] Mode Webhook activé avec succès sur : ${webhookUrl}`);
      } else {
        // Mode Long Polling uniquement pour le dev local sur ton PC
        console.log('[Telegram Bot] Environnement Local détecté. Démarrage du mode Long Polling...');
        await startBotPolling(bot);
      }
    } catch (err: any) {
      console.warn('[Telegram Bot] Erreur démarrage bot:', err.message);
    }
  } else {
    console.log('[Telegram Bot] Aucun Token Telegram réel configuré.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Perla ERP Server] Serveur démarré sur le port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Échec du démarrage du serveur:', err);
  process.exit(1);
});