import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  firestoreInfo: FirestoreErrorInfo | null;
}

function tryParseFirestoreError(rawMessage: string): FirestoreErrorInfo | null {
  try {
    const parsed = JSON.parse(rawMessage) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string' && typeof parsed.operationType === 'string') {
      return parsed as FirestoreErrorInfo;
    }
  } catch {
    // not JSON
  }
  return null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      firestoreInfo: null,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error || 'Terjadi kesalahan sistem');
    const firestoreInfo = tryParseFirestoreError(raw);
    return {
      hasError: true,
      message: firestoreInfo ? firestoreInfo.error : raw,
      firestoreInfo,
    };
  }

  componentDidCatch(error: unknown): void {
    console.error('Application ErrorBoundary caught error:', error);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isPermission =
      this.state.message.includes('permission-denied') ||
      this.state.message.includes('Missing or insufficient permissions');

    return (
      <div className="min-h-screen w-full bg-forest-architectural text-[#F7F3E9] flex items-center justify-center p-5">
        <div className="max-w-md w-full rounded-2xl bg-white text-[#30251F] border border-[#D9A52E]/40 shadow-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#A83A2D]" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-bold font-serif-display text-[#193D2B]">
                {isPermission
                  ? 'Akses Firebase Memerlukan Verifikasi Owner'
                  : 'Terjadi Gangguan Sementara'}
              </h1>
              <p className="text-xs text-[#6E5D53] leading-relaxed">
                {isPermission
                  ? 'Operasi database ditolak oleh aturan keamanan Firebase. Pastikan Anda login dengan akun Google Owner yang terverifikasi lalu muat ulang halaman.'
                  : 'Aplikasi mengalami kendala tak terduga. Data Anda tetap aman, silakan muat ulang halaman untuk melanjutkan.'}
              </p>
            </div>
          </div>

          {this.state.firestoreInfo?.path && (
            <div className="px-3 py-2 rounded-xl bg-[#F7F3E9] border border-[#30251F]/12 text-[11px] font-mono text-[#6E5D53] break-all">
              Path: {this.state.firestoreInfo.path} ({this.state.firestoreInfo.operationType})
            </div>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl bg-[#193D2B] hover:bg-[#122E20] text-[#F7F3E9] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      </div>
    );
  }
}
