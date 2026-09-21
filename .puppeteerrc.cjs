const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Indique à Puppeteer d'installer Chrome DANS le dossier du projet et non dans le cache système /opt/render
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};