import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Printer,
  QrCode,
  RotateCcw,
  Wifi,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import type { StandSettings } from '../types';
import { getInitialQrBaseUrl, normalizeMenuQrUrl, saveQrBaseUrl } from '../utils/qrUrl';
import { exportStandPdf } from '../utils/standPdfExport';

interface TableStandStudioProps {
  settings: StandSettings;
  onPreviewMenu: () => void;
}

const LOGO_URL = '/assets/aistudio/03648E70-0E47-429D-8D86-6445A1B732AA_5227a2d0.png';

export function TableStandStudio({ settings, onPreviewMenu }: TableStandStudioProps) {
  const [standSize, setStandSize] = useState<'a5' | '10x15'>('a5');
  const [baseUrl, setBaseUrl] = useState<string>(getInitialQrBaseUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');

  const normalizedQr = useMemo(() => normalizeMenuQrUrl(baseUrl), [baseUrl]);
  const targetUrl = normalizedQr.url;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    saveQrBaseUrl(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    let active = true;
    if (!normalizedQr.valid || !targetUrl) {
      setQrDataUrl('');
      return () => {
        active = false;
      };
    }

    QRCode.toDataURL(targetUrl, {
      width: 640,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR render error:', err);
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [normalizedQr.valid, targetUrl]);

  async function handleDownloadPdf() {
    if (!normalizedQr.valid || !targetUrl) {
      setExportError('PDF oluşturmak için lütfen geçerli bir menü URL adresi girin.');
      return;
    }
    setExportError('');
    setExportingPdf(true);
    try {
      await exportStandPdf({
        standSize,
        targetUrl,
        logoUrl: LOGO_URL,
        settings,
      });
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'PDF dosyası oluşturulurken bir hata oluştu.'
      );
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleDownloadPng() {
    if (!normalizedQr.valid || !targetUrl) {
      setExportError('PNG indirmek için lütfen geçerli bir menü URL adresi girin.');
      return;
    }
    try {
      const highRes = await QRCode.toDataURL(targetUrl, {
        width: 1200,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      const link = document.createElement('a');
      link.href = highRes;
      link.download = 'merdo-kokorec-qr-menu.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('QR download error:', err);
    }
  }

  async function handleCopyUrl() {
    if (!normalizedQr.valid || !targetUrl) return;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      {/* Page Intro (Hidden when printing) */}
      <div className="no-print border-b border-white/[0.08] pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#FF7300]">
              Baskıya Hazır Masa Üstü Standı &amp; QR Üretici
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl text-balance">
              Masa Üstü QR Menü Stand Tasarımı
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
              Tüm masalarda kullanabileceğiniz tek QR kodlu masa üstü standınızı özelleştirin;
              baskıya hazır PDF veya PNG olarak doğrudan indirin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!normalizedQr.valid}
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#121417] px-4 py-2.5 text-xs font-semibold text-white hover:border-[#FF7300] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[42px]"
            >
              <Download className="h-4 w-4 text-[#FF7300]" />
              <span>QR PNG İndir</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="Tarayıcı yazdırma penceresini aç"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#121417] px-3.5 py-2.5 text-xs font-semibold text-zinc-300 hover:border-white/30 hover:text-white transition-colors whitespace-nowrap min-h-[42px]"
            >
              <Printer className="h-4 w-4" />
              <span>Yazdır</span>
            </button>
            <button
              type="button"
              disabled={exportingPdf || !normalizedQr.valid}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF7300] px-5 py-2.5 text-xs font-bold text-[#090A0C] hover:bg-[#FF8826] disabled:opacity-60 transition-colors whitespace-nowrap min-h-[42px]"
            >
              <FileDown className="h-4 w-4" />
              <span>{exportingPdf ? 'PDF Hazırlanıyor...' : 'PDF İndir'}</span>
            </button>
          </div>
        </div>
        {exportError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-200"
          >
            {exportError}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Controls (Hidden on Print) */}
        <section className="no-print lg:col-span-5">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121417] p-6 space-y-5">
            <div>
              <h2 className="font-display text-base font-bold text-white">Stand Yapılandırması</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Masalarınızdaki pleksi veya karton stand ölçüsüne uygun 300 DPI baskı kalitesinde
                PDF indirin.
              </p>
            </div>

            {/* Stand Physical Format */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Stand Baskı Ölçüsü
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#090A0C] p-1">
                <button
                  type="button"
                  onClick={() => setStandSize('a5')}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                    standSize === 'a5'
                      ? 'bg-[#FF7300] text-[#090A0C]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  A5 Stand (148×210 mm)
                </button>
                <button
                  type="button"
                  onClick={() => setStandSize('10x15')}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                    standSize === '10x15'
                      ? 'bg-[#FF7300] text-[#090A0C]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Pleksi (100×150 mm)
                </button>
              </div>
            </div>

            {/* Base URL Input */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label htmlFor="qr-base-url" className="block text-xs font-semibold text-zinc-300">
                  Menü Alan Adı / URL
                </label>
                {currentOrigin && baseUrl.trim() !== currentOrigin && (
                  <button
                    type="button"
                    onClick={() => setBaseUrl(currentOrigin)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-[#FF7300] transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Mevcut Adresi Kullan</span>
                  </button>
                )}
              </div>
              <input
                id="qr-base-url"
                type="url"
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setExportError('');
                }}
                placeholder="https://merdokokorec.com"
                className={`w-full rounded-xl border bg-[#090A0C] px-3.5 py-2.5 font-mono text-xs text-zinc-200 focus:outline-none min-h-[42px] ${
                  !normalizedQr.valid
                    ? 'border-red-500/70 focus:border-red-500'
                    : 'border-white/10 focus:border-[#FF7300]'
                }`}
              />

              {!normalizedQr.valid && (
                <p className="mt-2 text-xs font-medium text-red-300">
                  Lütfen geçerli bir web adresi girin (ör.{' '}
                  <span className="font-mono">https://merdokokorec.com</span>).
                </p>
              )}

              {normalizedQr.valid && (normalizedQr.isPrivatePreview || normalizedQr.isLocalhost) && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-100 space-y-1.5"
                >
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      {normalizedQr.isPrivatePreview
                        ? 'Önizleme Adresi Telefon Kamerasından Açılmaz'
                        : 'Yerel Adres (localhost) Dış Cihazlardan Açılmaz'}
                    </span>
                  </div>
                  <p className="text-amber-100/90">
                    {normalizedQr.isPrivatePreview
                      ? 'Şu anki ais-dev / ais-pre bağlantısı yalnızca geliştirici oturumuna özeldir; müşteriler QR kodu okuttuğunda Google girişi veya hata ekranı görür.'
                      : 'localhost adresi yalnızca bu bilgisayarda çalışır; telefon kamerasıyla okutulduğunda menü açılmaz.'}
                  </p>
                  <p className="text-amber-200/90">
                    Masalarda çalışması için uygulamayı <strong>Deploy (Yayınla)</strong> ile
                    yayınlayın ve oluşan herkese açık <span className="font-mono">.run.app</span>{' '}
                    (veya kendi alan adınızı) yukarıdaki kutuya girin.
                  </p>
                </div>
              )}

              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-[#090A0C] px-3 py-2">
                <span className="truncate font-mono text-[11px] text-zinc-400">
                  {normalizedQr.valid ? targetUrl : 'Geçerli URL bekleniyor...'}
                </span>
                <button
                  type="button"
                  disabled={!normalizedQr.valid}
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF7300] hover:underline disabled:opacity-40 shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {normalizedQr.valid ? (
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#090A0C] px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:border-[#FF7300]/60 hover:text-white transition-colors min-h-[42px]"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-[#FF7300]" />
                    <span>QR Linkini Aç</span>
                  </a>
                ) : (
                  <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-[#090A0C] px-3 py-2.5 text-xs font-semibold text-zinc-600 min-h-[42px]">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>QR Linkini Aç</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={onPreviewMenu}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#090A0C] px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:border-[#FF7300]/60 hover:text-white transition-colors min-h-[42px]"
                >
                  <QrCode className="h-3.5 w-3.5 text-[#FF7300]" />
                  <span>Menü Önizlemesi</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Live Tabletop Stand Preview (Printable Area) */}
        <section
          id="printable-stand-area"
          className="lg:col-span-7 flex flex-col items-center justify-center"
        >
          <div
            className={`relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border-2 border-[#FF7300] bg-[#090A0C] text-center shadow-2xl shadow-black/70 ${
              standSize === 'a5'
                ? 'w-full max-w-[420px] min-h-[595px] p-7 sm:p-8'
                : 'w-full max-w-[360px] min-h-[530px] p-6'
            }`}
          >
            {/* Top Orange Accent Strip */}
            <div className="w-full">
              <div className="mx-auto h-1.5 w-20 rounded-full bg-[#FF7300]" />
              <div className="mt-4 rounded-2xl bg-[#000000] px-4 py-3 flex items-center justify-center">
                <img
                  src={LOGO_URL}
                  alt="Merdo Kokoreç"
                  referrerPolicy="no-referrer"
                  className="h-28 w-auto object-contain sm:h-32"
                />
              </div>
            </div>

            {/* Center QR Block */}
            <div className="my-5 flex flex-col items-center">
              <p className="font-mono text-xs font-bold tracking-widest text-[#FF7300] uppercase">
                DİJİTAL MENÜ
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white">
                Menü İçin Okutun
              </h2>

              {/* High-Contrast QR Frame */}
              <div className="mt-4 rounded-2xl border-4 border-[#FF7300] bg-white p-3.5 shadow-lg">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Merdo Kokoreç QR Kodu - ${targetUrl}`}
                    className="h-44 w-44 sm:h-48 sm:w-48 object-contain"
                  />
                ) : (
                  <div className="flex h-44 w-44 items-center justify-center text-zinc-400">
                    <QrCode className="h-10 w-10 animate-pulse" />
                  </div>
                )}
              </div>

              <p className="mt-3.5 max-w-[260px] text-xs font-medium leading-relaxed text-zinc-300">
                Telefon kameranızı QR koda tutarak güncel fiyat listemize anında ulaşabilirsiniz.
              </p>
            </div>

            {/* Bottom Brand & Optional Wi-Fi Footer */}
            <div className="w-full border-t border-white/10 pt-4">
              <p className="text-[11px] font-semibold text-zinc-400">{settings.tagline}</p>
              {settings.wifiName && (
                <p className="mt-1.5 inline-flex items-center justify-center gap-1.5 font-mono text-[11px] text-zinc-300">
                  <Wifi className="h-3 w-3 text-[#FF7300]" />
                  <span>
                    Wi-Fi: {settings.wifiName}
                    {settings.wifiPassword ? ` · ${settings.wifiPassword}` : ''}
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
