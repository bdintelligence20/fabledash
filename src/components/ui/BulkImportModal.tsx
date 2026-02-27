import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { apiClient } from '../../lib/api';

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  endpoint: string;
  columns: ColumnDef[];
  sampleCsv: string;
  /** Field name used in the JSON body (e.g., "clients" or "tasks") */
  bodyKey: string;
}

interface ImportResult {
  total: number;
  created: number;
  failed: number;
  created_items: { id: string; name?: string; title?: string }[];
  errors: { index?: number; row?: number; error: string; name?: string; title?: string }[];
}

type Step = 'upload' | 'preview' | 'result';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

export function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  endpoint,
  columns,
  sampleCsv,
  bodyKey,
}: BulkImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep('upload');
    setRows([]);
    setSubmitting(false);
    setResult(null);
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError('No data rows found in CSV');
        return;
      }
      setRows(parsed);
      setError('');
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handlePaste = useCallback((text: string) => {
    try {
      // Try JSON first
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        setRows(data);
        setError('');
        setStep('preview');
        return;
      }
    } catch {
      // Try CSV
    }
    const parsed = parseCsv(text);
    if (parsed.length > 0) {
      setRows(parsed);
      setError('');
      setStep('preview');
    } else {
      setError('Could not parse input as CSV or JSON');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post<{ success: boolean; data: ImportResult }>(endpoint, {
        [bodyKey]: JSON.stringify(rows),
      });
      setResult(res.data);
      setStep('result');
      if (res.data.created > 0) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  }, [rows, endpoint, bodyKey, onSuccess]);

  const handleDownloadSample = useCallback(() => {
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-import.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [sampleCsv]);

  const requiredCols = columns.filter((c) => c.required);
  const validationErrors = rows.map((row, idx) => {
    const missing = requiredCols.filter((c) => !row[c.key]?.trim());
    return missing.length > 0 ? { row: idx + 1, missing: missing.map((c) => c.label) } : null;
  }).filter(Boolean);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="xl">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-surface-200 rounded-lg p-8 text-center hover:border-primary-300 transition-default">
            <Upload className="h-8 w-8 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-600 mb-2">
              Drop a CSV file or click to browse
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="block mx-auto text-sm text-surface-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-surface-400">or paste data</span>
            </div>
          </div>

          <textarea
            className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm font-mono h-32 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Paste CSV or JSON array here..."
            onBlur={(e) => e.target.value.trim() && handlePaste(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              Download sample CSV
            </button>
            <p className="text-xs text-surface-400">
              Columns: {columns.map((c) => c.label).join(', ')}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-600">
              <span className="font-semibold text-surface-800">{rows.length}</span> rows ready to import
            </p>
            {validationErrors.length > 0 && (
              <p className="text-xs text-danger-600">
                {validationErrors.length} row{validationErrors.length !== 1 ? 's' : ''} with missing required fields
              </p>
            )}
          </div>

          <div className="overflow-x-auto max-h-64 border border-surface-200 rounded-lg">
            <table className="min-w-full text-xs">
              <thead className="bg-surface-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-surface-500">#</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left font-medium text-surface-500">
                      {col.label}
                      {col.required && <span className="text-danger-500">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, idx) => {
                  const hasError = validationErrors.some((e) => e && e.row === idx + 1);
                  return (
                    <tr key={idx} className={hasError ? 'bg-danger-50' : idx % 2 === 0 ? 'bg-white' : 'bg-surface-50'}>
                      <td className="px-3 py-1.5 text-surface-400">{idx + 1}</td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-1.5 text-surface-700 truncate max-w-[200px]">
                          {row[col.key] || <span className="text-surface-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="text-xs text-surface-400 text-center py-2">
                ...and {rows.length - 20} more rows
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-50 text-danger-700 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setStep('upload'); setRows([]); }}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={rows.length === 0}
            >
              Import {rows.length} {rows.length === 1 ? 'item' : 'items'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-success-50">
            <CheckCircle className="h-6 w-6 text-success-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-800">
                Import complete
              </p>
              <p className="text-xs text-success-600 mt-0.5">
                {result.created} of {result.total} items created successfully
              </p>
            </div>
          </div>

          {result.failed > 0 && (
            <div className="border border-danger-200 rounded-lg p-3">
              <p className="text-sm font-medium text-danger-700 mb-2">
                {result.failed} failed:
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-danger-600">
                    Row {err.row ?? err.index ?? idx}: {err.error}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
