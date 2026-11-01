import fs from 'fs';
import path from 'path';

const logoPath = path.join(process.cwd(), 'public', 'perla-logo.png');
const logoBuffer = fs.readFileSync(logoPath);

export const PERLA_LOGO_BASE64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;