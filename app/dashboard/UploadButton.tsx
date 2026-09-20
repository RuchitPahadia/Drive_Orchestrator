'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UploadButtonProps {
  hasAccounts: boolean;
}

interface ProgressState {
  current: number;
  total: number;
  currentName: string;
}

export default function UploadButton({ hasAccounts }: UploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleUploadBatch = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    // Filter image files only
    const files = rawFiles.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff|heic)$/i.test(f.name));
    if (files.length === 0) {
      setMessage({
        type: 'error',
        text: 'No valid image files found in your selection. Please select images (JPEG, PNG, WebP, etc.).'
      });
      return;
    }

    setUploading(true);
    setMessage(null);

    const MAX_SIZE = 50 * 1024 * 1024;
    let successCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    // Process files with concurrency limit of 2
    const concurrency = 2;
    let fileIndex = 0;

    const uploadWorker = async () => {
      while (fileIndex < files.length) {
        const idx = fileIndex++;
        const file = files[idx];

        setProgress({
          current: idx + 1,
          total: files.length,
          currentName: file.name,
        });

        // File size check
        if (file.size > MAX_SIZE) {
          errors.push(`"${file.name}" exceeds 50 MB limit`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
          const res = await fetch('/api/photos/upload', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) {
            errors.push(`"${file.name}": ${data.error || 'Upload failed'}`);
          } else if (data.duplicate) {
            duplicateCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`"${file.name}": ${err instanceof Error ? err.message : 'Network error'}`);
        }
      }
    };

    // Run parallel workers
    const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => uploadWorker());
    await Promise.all(workers);

    setUploading(false);
    setProgress(null);

    if (fileInputRef.current) fileInputRef.current.value = '';

    // Final result reporting with deduplication awareness
    if (duplicateCount > 0 && successCount > 0) {
      setMessage({
        type: 'success',
        text: `Uploaded ${successCount} photo${successCount !== 1 ? 's' : ''} (${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped).`,
      });
    } else if (duplicateCount > 0 && successCount === 0 && errors.length === 0) {
      setMessage({
        type: 'success',
        text: `${duplicateCount} photo${duplicateCount !== 1 ? 's were' : ' was'} already in your library (duplicate skipped).`,
      });
    } else if (successCount === files.length) {
      setMessage({
        type: 'success',
        text: `Successfully uploaded and replicated ${successCount} photo${successCount !== 1 ? 's' : ''}!`,
      });
    } else if (successCount > 0 || duplicateCount > 0) {
      setMessage({
        type: 'success',
        text: `Processed ${successCount + duplicateCount} of ${files.length} photos (${errors.length} failed: ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? '...' : ''}).`,
      });
    } else {
      setMessage({
        type: 'error',
        text: `Failed to upload: ${errors.slice(0, 3).join('; ')}`,
      });
    }

    router.refresh();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadBatch(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (!hasAccounts) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadBatch(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (hasAccounts) setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const percent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div 
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`p-6 rounded-2xl bg-zinc-900/40 border transition-all duration-300 backdrop-blur-sm mb-8 ${
        dragOver 
          ? 'border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10' 
          : 'border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Photos
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Batch Enabled
            </span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {hasAccounts 
              ? 'Select multiple photos or drag & drop files here. Replicated across connected Google Drive accounts and indexed with CLIP AI.' 
              : 'Connect at least one Google Drive account below to enable photo uploads.'}
          </p>
        </div>

        <div>
          {hasAccounts ? (
            <>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
              />
              <button
                onClick={triggerFileSelect}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/20 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading ({progress?.current || 0}/{progress?.total || 0})...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Select Photos (Multiple)
                  </>
                )}
              </button>
            </>
          ) : (
            <Link
              href="/api/accounts/connect"
              className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-medium px-5 py-2.5 rounded-xl border border-amber-500/20 text-sm transition-all"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Connect Storage First
            </Link>
          )}
        </div>
      </div>

      {/* Progress Bar when uploading multiple files */}
      {uploading && progress && (
        <div className="mt-4 p-4 rounded-xl bg-zinc-950/80 border border-indigo-500/30 backdrop-blur-sm">
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-zinc-300 font-medium truncate max-w-[70%]">
              Uploading {progress.current} of {progress.total}: <strong className="text-indigo-400">{progress.currentName}</strong>
            </span>
            <span className="text-indigo-400 font-bold">{percent}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.5)]"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {!hasAccounts && (
        <div className="mt-4 p-3.5 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Storage pool is currently empty. Click <strong>"Connect Google Account"</strong> below to link your Google Drive and start uploading photos.
          </span>
        </div>
      )}

      {message && (
        <div className={`mt-4 p-3.5 rounded-xl text-xs flex items-start gap-2.5 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
        }`}>
          {message.type === 'success' ? (
            <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span className="break-all font-medium">{message.text}</span>
        </div>
      )}
    </div>
  );
}
