import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function generateLogo() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 500, height: 500, deviceScaleFactor: 2 });

  const svgContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 500px;
    height: 500px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Playfair Display', 'Georgia', serif;
  }
  .circle {
    width: 480px;
    height: 480px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #FFFFFF 0%, #F5ECE3 30%, #E8D7C8 60%, #D5BFAC 100%);
    box-shadow: inset 0 2px 10px rgba(255,255,255,0.8), inset 0 -4px 15px rgba(138,107,85,0.3);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 38px 20px 42px;
  }
  .title {
    font-size: 38px;
    font-weight: 700;
    letter-spacing: 0.35em;
    color: #6E4F3E;
    text-shadow: 0 1px 1px rgba(255,255,255,0.6);
    margin-left: 0.35em;
  }
  .silhouette-container {
    width: 170px;
    height: 250px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bottom-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .subtitle {
    font-size: 19px;
    font-weight: 600;
    letter-spacing: 0.32em;
    color: #6E4F3E;
    margin-left: 0.32em;
    text-transform: uppercase;
  }
  .decor {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #8C6A54;
    font-size: 14px;
  }
  .decor-line {
    width: 40px;
    height: 1.5px;
    background: #8C6A54;
  }
</style>
</head>
<body>
  <div class="circle">
    <div class="title">PERLA</div>
    <div class="silhouette-container">
      <svg width="170" height="250" viewBox="0 0 170 250" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Female body contour art in bronze -->
        <path d="M88 20 C92 40, 110 55, 112 80 C114 110, 138 135, 126 175 C118 200, 122 230, 128 245" stroke="#7A5643" stroke-width="2.8" stroke-linecap="round" fill="none"/>
        <path d="M88 20 C82 35, 68 50, 64 68 C58 92, 78 120, 68 150 C58 178, 62 215, 65 245" stroke="#7A5643" stroke-width="2.8" stroke-linecap="round" fill="none"/>
        <path d="M64 68 C76 80, 84 92, 85 110 C86 135, 102 165, 110 200" stroke="#8E6A55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <path d="M112 80 C95 105, 90 135, 88 175 C86 210, 94 235, 96 245" stroke="#8E6A55" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      </svg>
    </div>
    <div class="bottom-group">
      <div class="subtitle">BODY SCULPT</div>
      <div class="decor">
        <div class="decor-line"></div>
        <span>✦</span>
        <div class="decor-line"></div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  await page.setContent(svgContent);
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const logoPath = path.join(publicDir, 'perla-logo.png');
  await page.screenshot({ path: logoPath, omitBackground: true });
  console.log('Logo saved successfully to', logoPath);

  // Also save base64 data to a file for direct embedding
  const imgBuffer = fs.readFileSync(logoPath);
  const base64Data = `data:image/png;base64,${imgBuffer.toString('base64')}`;
  fs.writeFileSync(path.join(process.cwd(), 'src/templates/logoBase64.ts'), `export const PERLA_LOGO_BASE64 = "${base64Data}";\n`);
  console.log('Logo base64 generated successfully.');

  await browser.close();
}

generateLogo().catch(console.error);
