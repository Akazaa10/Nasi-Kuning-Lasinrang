import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Check,
  AlertTriangle,
  Database,
  Store,
  Utensils,
  ClipboardList,
  Lock,
  ExternalLink,
  Download,
  Upload,
  LogOut,
  History,
  Copy,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { MenuItem, OrderRecord, StoreConfig } from '../types';
import {
  auth,
  FIREBASE_CONSOLE_AUTH_DOMAINS_URL,
  FIREBASE_CONSOLE_DATA_URL,
  FIREBASE_CONSOLE_RULES_URL,
  FIRESTORE_DATABASE_ID,
  formatFirebaseAuthError,
  OWNER_ADMIN_EMAILS,
} from '../firebase';
import type {
  FirebaseVaultAuditReport,
  FullFirebaseMigrationResult,
  MigrationProgressEvent,
  OwnerAuditLogEntry,
} from '../services/firestoreService';
import type { CloudSyncStatusInfo } from './OwnerPanelModal';
import { safeCopyToClipboard } from '../utils/safeBrowser';

interface FirebaseVaultPanelProps {
  storeConfig: StoreConfig;
  menuItems: MenuItem[];
  orders: OrderRecord[];
  currentUser: FirebaseUser | null;
  isAdminCloudVerified: boolean;
  cloudSyncStatus?: CloudSyncStatusInfo;
  ownerAuditLogs: OwnerAuditLogEntry[];
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle?: () => Promise<void>;
  onInspectFirebaseVault?: () => Promise<FirebaseVaultAuditReport>;
  onMigrateAllToFirebase?: (
    onProgress?: (ev: MigrationProgressEvent) => void
  ) => Promise<FullFirebaseMigrationResult>;
  onPullFromFirebase?: () => Promise<{
    ok: boolean;
    storeLoaded: boolean;
    menuCount: number;
  }>;
  onExportOwnerBackup: () => void;
  onImportOwnerBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNotify: (msg: string) => void;
}

const ACTION_LABELS: Record<OwnerAuditLogEntry['action'], string> = {
  migration: 'Migrasi & Proteksi Penuh',
  cloud_save: 'Simpan Permanen Cloud',
  backup_restore: 'Pemulihan Cadangan',
  explicit_reset: 'Reset Manual Owner',
};

export const FirebaseVaultPanel: React.FC<FirebaseVaultPanelProps> = ({
  storeConfig,
  menuItems,
  orders,
  currentUser,
  isAdminCloudVerified,
  cloudSyncStatus,
  ownerAuditLogs,
  onSignInGoogle,
  onSignOutGoogle,
  onInspectFirebaseVault,
  onMigrateAllToFirebase,
  onPullFromFirebase,
  onExportOwnerBackup,
  onImportOwnerBackup,
  onNotify,
}) => {
  const [auditReport, setAuditReport] = useState<FirebaseVaultAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgressEvent | null>(null);
  const [lastMigrationResult, setLastMigrationResult] =
    useState<FullFirebaseMigrationResult | null>(null);
  const [copiedDbId, setCopiedDbId] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [authError, setAuthError] = useState<{
    code: string;
    message: string;
    isUnauthorizedDomain: boolean;
  } | null>(null);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const localCustomPhotoCount = menuItems.filter((m) =>
    (m.imageUrl || '').startsWith('data:image/')
  ).length;
  const hasCustomQris = (storeConfig.qrisImageUrl || '').startsWith('data:image/');

  const runAudit = useCallback(async () => {
    if (!onInspectFirebaseVault) return;
    setIsAuditing(true);
    try {
      const report = await onInspectFirebaseVault();
      setAuditReport(report);
    } finally {
      setIsAuditing(false);
    }
  }, [onInspectFirebaseVault]);

  useEffect(() => {
    void runAudit();
  }, [runAudit, isAdminCloudVerified]);

  const handleLoginClick = async () => {
    setAuthError(null);
    try {
      await onSignInGoogle();
      if (auth.currentUser) {
        onNotify('Login Google berhasil! Memeriksa otoritas Owner & Vault Firebase...');
      }
    } catch (err) {
      const parsed = formatFirebaseAuthError(err);
      setAuthError({
        code: parsed.code,
        message: parsed.message,
        isUnauthorizedDomain: parsed.isUnauthorizedDomain,
      });
      onNotify(parsed.message);
    }
  };

  const handleRunFullMigration = async () => {
    if (!onMigrateAllToFirebase) return;
    if (!isAdminCloudVerified) {
      await handleLoginClick();
      return;
    }

    setIsMigrating(true);
    setLastMigrationResult(null);
    setMigrationProgress({
      step: 1,
      totalSteps: 6,
      label: 'Memulai migrasi & verifikasi keamanan Firebase...',
    });

    try {
      const res = await onMigrateAllToFirebase((ev) => {
        setMigrationProgress(ev);
      });
      setLastMigrationResult(res);
      if (res.verifiedAudit) {
        setAuditReport(res.verifiedAudit);
      } else {
        await runAudit();
      }

      if (res.ok) {
        onNotify(
          `Migrasi permanen selesai! Toko + ${res.menuCountSaved} menu & foto terverifikasi langsung di server Firebase.`
        );
      } else {
        onNotify(res.errorMessage || 'Migrasi Firebase belum lengkap. Cek pesan status.');
      }
    } finally {
      setIsMigrating(false);
      setMigrationProgress(null);
    }
  };

  const handlePullCloudData = async () => {
    if (!onPullFromFirebase) return;
    setIsPulling(true);
    try {
      const res = await onPullFromFirebase();
      await runAudit();
      if (res.ok) {
        onNotify(
          `Berhasil menarik data resmi dari Firebase (${res.storeLoaded ? 'Pengaturan Toko' : ''}${
            res.storeLoaded && res.menuCount > 0 ? ' + ' : ''
          }${res.menuCount > 0 ? `${res.menuCount} Menu` : ''}).`
        );
      } else {
        onNotify('Belum ada data tersimpan di server Firebase. Jalankan Migrasi Penuh terlebih dahulu.');
      }
    } finally {
      setIsPulling(false);
    }
  };

  const progressPct = migrationProgress
    ? Math.round((migrationProgress.step / migrationProgress.totalSteps) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* 1. Firebase Owner Identity & Security Header */}
      <div
        className={`p-5 rounded-2xl border shadow-xs space-y-4 ${
          isAdminCloudVerified
            ? 'bg-white border-[#193D2B]/22'
            : 'bg-amber-50/90 border-amber-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isAdminCloudVerified
                  ? 'bg-[#E9F0EC] text-[#193D2B] border border-[#193D2B]/20'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isAdminCloudVerified ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold font-serif-display text-[#193D2B]">
                {isAdminCloudVerified
                  ? 'Otoritas Google Owner Terverifikasi — Siap Simpan Permanen Firebase'
                  : currentUser
                  ? 'Akun Google Saat Ini Bukan Owner Terdaftar'
                  : 'Hubungkan Akun Google Owner untuk Proteksi Permanen Firebase'}
              </h4>
              <p className="text-xs text-[#6E5D53] leading-relaxed">
                {isAdminCloudVerified ? (
                  <>
                    Masuk sebagai <strong className="text-[#193D2B]">{currentUser?.email}</strong>.
                    Semua perubahan admin (foto menu HD, harga, QRIS, koordinat kedai, jam buka,
                    status buka/tutup, dan pesanan) langsung ditulis permanen ke Cloud Firestore dan
                    tidak akan hilang saat update website maupun ganti perangkat.
                  </>
                ) : currentUser ? (
                  <>
                    Anda sedang login dengan <strong>{currentUser.email}</strong>. Aturan keamanan
                    Firebase hanya mengizinkan penulisan permanen untuk akun Owner resmi (
                    {OWNER_ADMIN_EMAILS[0]}). Silakan ganti akun Google.
                  </>
                ) : (
                  <>
                    PIN 6 digit hanya membuka tampilan panel di perangkat ini. Untuk melindungi dan
                    menyimpan seluruh data admin secara <strong>permanen di server Firebase Cloud</strong>,
                    silakan login dengan akun Google Owner ({OWNER_ADMIN_EMAILS[0]}).
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isAdminCloudVerified ? (
              <button
                type="button"
                onClick={() => void handleLoginClick()}
                className="px-4 py-2.5 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] text-xs font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#E8C56E]" />
                <span>{currentUser ? 'Ganti ke Akun Google Owner' : 'Login Google Owner (Firebase)'}</span>
              </button>
            ) : (
              <>
                <a
                  href={FIREBASE_CONSOLE_DATA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-[#F7F3E9] hover:bg-[#EFE9DC] border border-[#30251F]/12 text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#193D2B]" />
                  <span>Buka Console Firebase</span>
                </a>
                {onSignOutGoogle && (
                  <button
                    type="button"
                    onClick={() => void onSignOutGoogle()}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-red-50 border border-[#30251F]/12 text-[#6E5D53] hover:text-[#A83A2D] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Akun</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Auth Error Diagnostic Box (e.g. auth/unauthorized-domain or popup-blocked) */}
        {authError && !isAdminCloudVerified && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Login Google Tidak Dapat Dilanjutkan ({authError.code})</span>
            </div>
            <p className="text-[11px] leading-relaxed">{authError.message}</p>
            {authError.isUnauthorizedDomain && currentHost && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <code className="px-2 py-1 rounded bg-white border border-red-200 font-mono text-[11px] text-red-950 break-all">
                  {currentHost}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void safeCopyToClipboard(currentHost);
                    setCopiedHost(true);
                    setTimeout(() => setCopiedHost(false), 1800);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-red-100 border border-red-300 text-red-900 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedHost ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHost ? 'Domain Disalin' : 'Salin Domain'}</span>
                </button>
                <a
                  href={FIREBASE_CONSOLE_AUTH_DOMAINS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#A83A2D] hover:bg-[#8C2D22] text-white font-semibold text-[11px] inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Authorized Domains</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Database Target Metadata Bar */}
        <div className="pt-3 border-t border-[#30251F]/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E5D53]">
          <div className="flex items-center gap-1.5 min-w-0">
            <Database className="w-3.5 h-3.5 text-[#9A7013] shrink-0" />
            <span className="font-semibold">Database Firestore:</span>
            <code className="px-1.5 py-0.5 rounded bg-[#EFE9DC] text-[#30251F] font-mono truncate max-w-[230px] sm:max-w-none">
              {FIRESTORE_DATABASE_ID}
            </code>
            <button
              type="button"
              onClick={() => {
                void safeCopyToClipboard(FIRESTORE_DATABASE_ID);
                setCopiedDbId(true);
                setTimeout(() => setCopiedDbId(false), 1800);
              }}
              className="p-1 rounded hover:bg-[#EFE9DC] text-[#6E5D53] cursor-pointer"
              title="Salin ID Database Firestore"
            >
              {copiedDbId ? <Check className="w-3 h-3 text-[#193D2B]" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          {cloudSyncStatus?.lastSavedAt ? (
            <span className="font-medium text-[#193D2B]">
              Sinkron terakhir: {new Date(cloudSyncStatus.lastSavedAt).toLocaleString('id-ID')}
            </span>
          ) : null}
        </div>
      </div>

      {/* 2. Live Server-Verified Audit Grid (Local vs Firebase Server) */}
      <div className="p-5 rounded-2xl bg-white border border-[#30251F]/10 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30251F]/10 pb-3">
          <div>
            <h4 className="text-base font-bold font-serif-display text-[#193D2B] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#193D2B]" />
              <span>Audit Data Perangkat vs Server Firebase Langsung</span>
            </h4>
            <p className="text-xs text-[#6E5D53] mt-0.5">
              Membaca langsung dari server Cloud Firestore (tanpa cache) untuk memastikan semua setting admin benar-benar tersimpan.
            </p>
          </div>
          <button
            type="button"
            disabled={isAuditing}
            onClick={() => void runAudit()}
            className="px-3 py-1.5 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] border border-[#30251F]/12 text-[#193D2B] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'Memeriksa...' : 'Cek Ulang Server'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: Store Settings */}
          <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#193D2B] flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#A83A2D]" />
                <span>Pengaturan Toko &amp; QRIS</span>
              </span>
              <span
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${
                  auditReport?.storeExists
                    ? 'bg-[#E9F0EC] text-[#193D2B]'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {auditReport === null
                  ? 'Memeriksa...'
                  : auditReport.storeExists
                  ? 'Tersimpan di Firebase'
                  : 'Belum Dimigrasi'}
              </span>
            </div>
            <div className="text-[11px] text-[#6E5D53] leading-relaxed">
              Perangkat: <strong className="text-[#30251F]">{storeConfig.brandName}</strong> ·{' '}
              {hasCustomQris ? 'QRIS Upload Aktif' : 'QRIS Resmi Aktif'} ·{' '}
              {storeConfig.isOpenLive ? 'Buka' : 'Tutup'}
            </div>
            {auditReport?.storeExists && auditReport.storeUpdatedAtMs > 0 && (
              <div className="text-[10.5px] text-[#193D2B] font-medium">
                Update Cloud: {new Date(auditReport.storeUpdatedAtMs).toLocaleString('id-ID')}
              </div>
            )}
          </div>

          {/* Card 2: Menu Catalog & Photos */}
          <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#193D2B] flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-[#A83A2D]" />
                <span>Katalog Menu &amp; Foto HD</span>
              </span>
              <span
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${
                  auditReport && auditReport.menuCount >= menuItems.length && menuItems.length > 0
                    ? 'bg-[#E9F0EC] text-[#193D2B]'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {auditReport === null
                  ? 'Memeriksa...'
                  : `${auditReport.menuCount} / ${menuItems.length} Menu di Firebase`}
              </span>
            </div>
            <div className="text-[11px] text-[#6E5D53] leading-relaxed">
              Perangkat: <strong className="text-[#30251F]">{menuItems.length} menu</strong> ({localCustomPhotoCount} foto
              upload HD) · Server Firebase:{' '}
              <strong className="text-[#30251F]">{auditReport?.customPhotoCount ?? 0} foto upload HD</strong>
            </div>
          </div>

          {/* Card 3: Private Admin Settings */}
          <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#193D2B] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#9A7013]" />
                <span>Pengaturan Privat Admin</span>
              </span>
              <span
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${
                  !isAdminCloudVerified
                    ? 'bg-stone-200 text-stone-700'
                    : auditReport?.privateSettingsExists
                    ? 'bg-[#E9F0EC] text-[#193D2B]'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {!isAdminCloudVerified
                  ? 'Perlu Login Owner'
                  : auditReport?.privateSettingsExists
                  ? 'Terlindungi (Admin-Only)'
                  : 'Siap Dimigrasi'}
              </span>
            </div>
            <div className="text-[11px] text-[#6E5D53] leading-relaxed">
              Draft kalkulator balasan WA &amp; URL QR Cetak kustom (hanya bisa dibaca akun Owner).
            </div>
          </div>

          {/* Card 4: Customer Orders */}
          <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#193D2B] flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-[#193D2B]" />
                <span>Riwayat Pesanan Masuk</span>
              </span>
              <span
                className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${
                  !isAdminCloudVerified
                    ? 'bg-stone-200 text-stone-700'
                    : auditReport && auditReport.orderCount >= orders.length
                    ? 'bg-[#E9F0EC] text-[#193D2B]'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {!isAdminCloudVerified
                  ? 'Perlu Login Owner'
                  : `${auditReport?.orderCount ?? 0} di Firebase · ${orders.length} Lokal`}
              </span>
            </div>
            <div className="text-[11px] text-[#6E5D53] leading-relaxed">
              Seluruh riwayat pesanan &amp; status konfirmasi terlindungi oleh aturan privasi PII.
            </div>
          </div>
        </div>

        {/* 3. Main 1-Click Migration & Pull Controls */}
        <div className="pt-3 border-t border-[#30251F]/10 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              disabled={isMigrating}
              onClick={() => void handleRunFullMigration()}
              className="flex-1 min-h-[46px] py-3 px-5 rounded-xl bg-[#193D2B] hover:bg-[#122E20] active:scale-[0.99] text-[#F7F3E9] font-semibold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
            >
              <CloudUpload className="w-4 h-4 shrink-0 text-[#E8C56E]" />
              <span>
                {isMigrating
                  ? 'Memindahkan & Memverifikasi ke Firebase...'
                  : isAdminCloudVerified
                  ? 'Pindahkan & Lindungi Semua Data ke Firebase Sekarang'
                  : 'Login Google Owner & Pindahkan Semua Data ke Firebase'}
              </span>
            </button>

            <button
              type="button"
              disabled={isPulling || isMigrating}
              onClick={() => void handlePullCloudData()}
              className="min-h-[46px] px-4 py-3 rounded-xl bg-[#EFE9DC] hover:bg-[#E5DEC9] border border-[#30251F]/12 text-[#193D2B] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors shrink-0"
            >
              <CloudDownload className="w-4 h-4 shrink-0 text-[#A83A2D]" />
              <span>{isPulling ? 'Menarik Data...' : 'Tarik Data Resmi dari Firebase'}</span>
            </button>
          </div>

          {/* Live Step-by-Step Migration Progress Bar */}
          {migrationProgress && (
            <div className="p-3.5 rounded-xl bg-[#F7F3E9] border border-[#D9A52E]/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#9A7013]">
                <span>{migrationProgress.label}</span>
                <span className="font-mono-tabular">
                  {migrationProgress.step}/{migrationProgress.totalSteps} ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#EFE9DC] overflow-hidden">
                <div
                  className="h-full bg-[#193D2B] transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Migration Verified Result Card */}
          {lastMigrationResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                lastMigrationResult.ok
                  ? 'bg-[#E9F0EC] border-[#193D2B]/25 text-[#193D2B]'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                {lastMigrationResult.ok ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Migrasi &amp; Proteksi Firebase Terverifikasi Langsung dari Server!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Migrasi Belum Selesai Sepenuhnya</span>
                  </>
                )}
              </div>
              {lastMigrationResult.ok ? (
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-[#30251F]">
                  <li>Pengaturan Toko, Alamat, Koordinat Kedai &amp; QRIS (<code>store/main</code>): <strong>Tersimpan Permanen</strong></li>
                  <li>Katalog Menu &amp; Foto HD (<code>menuItems</code>): <strong>{lastMigrationResult.menuCountSaved} menu terverifikasi</strong></li>
                  <li>
                    Riwayat Pesanan (<code>orders</code>):{' '}
                    <strong>
                      {lastMigrationResult.ordersMigrated} baru dimigrasi
                      {lastMigrationResult.ordersAlreadyInCloud > 0
                        ? `, ${lastMigrationResult.ordersAlreadyInCloud} sudah aman di cloud`
                        : ''}
                    </strong>
                  </li>
                  <li>
                    Pengaturan Privat &amp; Jejak Audit:{' '}
                    <strong>
                      {lastMigrationResult.privateSettingsSaved
                        ? 'Aktif di Firebase'
                        : 'Siap aktif setelah aturan terbaru dipublikasikan di Firebase Console'}
                    </strong>
                  </li>
                </ul>
              ) : (
                <p className="text-[11px]">{lastMigrationResult.errorMessage}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Rules Sync Notice (Only if live DB still uses older rules without menu list / private vault) */}
      {auditReport && (!auditReport.menuListAllowed || (isAdminCloudVerified && !auditReport.privateRulesReady)) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2.5">
          <div className="font-bold flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Catatan Keamanan Rules di Console Firebase</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Pengaturan Toko dan seluruh 12 Menu Utama <strong>tetap bisa disimpan &amp; dimuat otomatis</strong> melalui mekanisme proteksi ganda aplikasi. Namun agar fitur tambahan seperti daftar menu kustom baru, pengaturan privat admin, dan log audit aktif penuh di server Firebase, pastikan file <code>firestore.rules</code> terbaru sudah dipublikasikan di tab <strong>Rules</strong> Firebase Console Anda.
          </p>
          <a
            href={FIREBASE_CONSOLE_RULES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-400 text-amber-950 font-semibold text-[11px]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka Tab Rules di Firebase Console</span>
          </a>
        </div>
      )}

      {/* 5. Immutable Protection Audit Trail */}
      {isAdminCloudVerified && ownerAuditLogs.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-[#30251F]/10 shadow-xs space-y-3">
          <h4 className="text-sm font-bold font-serif-display text-[#193D2B] flex items-center gap-2">
            <History className="w-4 h-4 text-[#9A7013]" />
            <span>Jejak Audit Proteksi Permanen ({ownerAuditLogs.length})</span>
          </h4>
          <div className="space-y-2">
            {ownerAuditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-[#F7F3E9] border border-[#30251F]/10 flex flex-wrap items-center justify-between gap-2 text-[11px]"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-[#30251F]">
                    {ACTION_LABELS[log.action] || log.action} ·{' '}
                    <span className="text-[#193D2B]">{log.menuCount} menu</span>
                    {log.orderCount > 0 ? ` · ${log.orderCount} pesanan` : ''}
                  </div>
                  <div className="text-[#6E5D53] truncate">
                    Oleh {log.actorEmail}
                    {log.note ? ` — ${log.note}` : ''}
                  </div>
                </div>
                <span className="font-mono-tabular text-[10.5px] text-[#6E5D53] shrink-0">
                  {new Date(log.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Offline Master Backup (.json) Safety Net */}
      <div className="p-4 rounded-2xl bg-white border border-[#30251F]/10 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-[#193D2B]">
            Cadangan File Master Offline (.json)
          </div>
          <p className="text-[11px] text-[#6E5D53]">
            Unduh salinan lengkap seluruh foto menu &amp; pengaturan sebagai arsip pribadi di HP/laptop Anda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportOwnerBackup}
            className="px-3 py-2 rounded-xl bg-[#F7F3E9] hover:bg-[#EFE9DC] border border-[#193D2B]/25 text-[#193D2B] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Cadangan (.json)</span>
          </button>
          <label className="px-3 py-2 rounded-xl bg-[#F7F3E9] hover:bg-[#EFE9DC] border border-[#30251F]/16 text-[#30251F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Pulihkan (.json)</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={onImportOwnerBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
