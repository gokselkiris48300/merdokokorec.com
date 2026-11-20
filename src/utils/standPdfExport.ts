import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { StandSettings } from '../types';

export interface ExportStandPdfOptions {
  standSize: 'a5' | '10x15';
  targetUrl: string;
  logoUrl: string;
  settings: StandSettings;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Görsel yüklenemedi: ${src}`));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  lines.forEach((line, idx) => {
    ctx.fillText(line, centerX, startY + idx * lineHeight);
  });
}

export async function exportStandPdf({
  standSize,
  targetUrl,
  logoUrl,
  settings,
}: ExportStandPdfOptions): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const widthMm = standSize === 'a5' ? 148 : 100;
  const heightMm = standSize === 'a5' ? 210 : 150;

  // 300 DPI print resolution
  const pxPerMm = 300 / 25.4;
  const widthPx = Math.round(widthMm * pxPerMm);
  const heightPx = Math.round(heightMm * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('PDF oluşturma bağlamı başlatılamadı.');
  }

  const mm = (val: number) => val * pxPerMm;
  const centerX = widthPx / 2;

  // 1. Rich Black full bleed background (#090A0C)
  ctx.fillStyle = '#090A0C';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // 2. Vibrant Orange outer border frame (#FF7300)
  const inset = mm(5);
  const frameW = widthPx - inset * 2;
  const frameH = heightPx - inset * 2;
  drawRoundedRect(ctx, inset, inset, frameW, frameH, mm(7));
  ctx.strokeStyle = '#FF7300';
  ctx.lineWidth = mm(1.1);
  ctx.stroke();

  // 3. Top orange pill accent
  const pillW = mm(24);
  const pillH = mm(1.8);
  drawRoundedRect(ctx, centerX - pillW / 2, mm(11), pillW, pillH, pillH / 2);
  ctx.fillStyle = '#FF7300';
  ctx.fill();

  // 4. Seamless pure black logo panel + Merdo Kokoreç logo
  const logoBoxW = widthPx - mm(22);
  const logoBoxH = standSize === 'a5' ? mm(52) : mm(36);
  const logoBoxX = (widthPx - logoBoxW) / 2;
  const logoBoxY = mm(17);

  drawRoundedRect(ctx, logoBoxX, logoBoxY, logoBoxW, logoBoxH, mm(4.5));
  ctx.fillStyle = '#000000';
  ctx.fill();

  const logoImg = await loadImage(logoUrl);
  const padX = mm(6);
  const padY = mm(3.5);
  const maxLogoW = logoBoxW - padX * 2;
  const maxLogoH = logoBoxH - padY * 2;
  const logoRatio = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
  const drawLogoW = logoImg.width * logoRatio;
  const drawLogoH = logoImg.height * logoRatio;
  ctx.drawImage(
    logoImg,
    centerX - drawLogoW / 2,
    logoBoxY + (logoBoxH - drawLogoH) / 2,
    drawLogoW,
    drawLogoH
  );

  // 5. Title & Sub-label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labelY = logoBoxY + logoBoxH + (standSize === 'a5' ? mm(11) : mm(8));
  ctx.fillStyle = '#FF7300';
  ctx.font = `700 ${Math.round(mm(standSize === 'a5' ? 4.2 : 3.2))}px "JetBrains Mono", monospace`;
  ctx.fillText('D İ J İ T A L   M E N Ü', centerX, labelY);

  const headingY = labelY + (standSize === 'a5' ? mm(8.5) : mm(6.5));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${Math.round(mm(standSize === 'a5' ? 8.8 : 6.4))}px "Outfit", sans-serif`;
  ctx.fillText('Menü İçin Okutun', centerX, headingY);

  // 6. High-Contrast QR Code Card
  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    width: 1200,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const qrImg = await loadImage(qrDataUrl);

  const qrCardSize = standSize === 'a5' ? mm(72) : mm(48);
  const qrCardX = centerX - qrCardSize / 2;
  const qrCardY = headingY + (standSize === 'a5' ? mm(9.5) : mm(7));

  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, mm(5));
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#FF7300';
  ctx.lineWidth = mm(1.6);
  ctx.stroke();

  const qrInnerPad = mm(4);
  ctx.drawImage(
    qrImg,
    qrCardX + qrInnerPad,
    qrCardY + qrInnerPad,
    qrCardSize - qrInnerPad * 2,
    qrCardSize - qrInnerPad * 2
  );

  // 7. Scan Instruction Text
  const instrY = qrCardY + qrCardSize + (standSize === 'a5' ? mm(9) : mm(7));
  ctx.fillStyle = '#D4D4D8';
  ctx.font = `500 ${Math.round(mm(standSize === 'a5' ? 3.9 : 2.9))}px "Plus Jakarta Sans", sans-serif`;
  drawWrappedText(
    ctx,
    'Telefon kameranızı QR koda tutarak güncel fiyat listemize anında ulaşabilirsiniz.',
    centerX,
    instrY,
    widthPx - mm(32),
    mm(standSize === 'a5' ? 5.6 : 4.2)
  );

  // 8. Bottom Hairline Divider & Tagline / Wi-Fi
  const footerLineY = heightPx - mm(standSize === 'a5' ? 23 : 17);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = mm(0.35);
  ctx.beginPath();
  ctx.moveTo(mm(14), footerLineY);
  ctx.lineTo(widthPx - mm(14), footerLineY);
  ctx.stroke();

  const taglineY = footerLineY + mm(standSize === 'a5' ? 6.5 : 4.8);
  ctx.fillStyle = '#A1A1AA';
  ctx.font = `600 ${Math.round(mm(standSize === 'a5' ? 3.5 : 2.6))}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(settings.tagline, centerX, taglineY);

  if (settings.wifiName) {
    const wifiY = taglineY + mm(standSize === 'a5' ? 5.8 : 4.3);
    ctx.fillStyle = '#E4E4E7';
    ctx.font = `500 ${Math.round(mm(standSize === 'a5' ? 3.3 : 2.4))}px "JetBrains Mono", monospace`;
    const wifiLabel = settings.wifiPassword
      ? `Wi-Fi: ${settings.wifiName} · ${settings.wifiPassword}`
      : `Wi-Fi: ${settings.wifiName}`;
    ctx.fillText(wifiLabel, centerX, wifiY);
  }

  // 9. Package into print-sized PDF and trigger download
  const pageDataUrl = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });
  pdf.addImage(pageDataUrl, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

  const blob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download =
    standSize === 'a5'
      ? 'merdo-kokorec-masa-standi-a5.pdf'
      : 'merdo-kokorec-masa-standi-10x15.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
