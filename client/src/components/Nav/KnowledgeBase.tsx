import { memo, useCallback } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { useGetBlobListQuery } from '~/data-provider';
import { cn } from '~/utils';

/** Extract just the filename from a blob path like "gcpl-allsoaps/filename.pdf" */
const getDisplayName = (fullPath: string): string => {
  const parts = fullPath.split('/');
  return parts[parts.length - 1] || fullPath;
};

interface KnowledgeBaseProps {
  onClose: () => void;
}

const BLOB_DOWNLOAD_BASE = 'https://gcplcmiadls001.blob.core.windows.net/gcpl-soap';
const DOWNLOAD_SAS_TOKEN = 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupyx&se=2026-03-19T14:08:21Z&st=2026-01-30T05:53:21Z&spr=https&sig=nYKjE2yfrFEcncreXt%2BA0dM6zFLbvNeignb3ZrnWcn0%3D';

const KnowledgeBase = memo(({ onClose }: KnowledgeBaseProps) => {
  const { data, isLoading, error } = useGetBlobListQuery();

  const handleDownload = useCallback((blobName: string) => {
    const encodedName = blobName.split('/').map(encodeURIComponent).join('/');
    window.open(`${BLOB_DOWNLOAD_BASE}/${encodedName}?${DOWNLOAD_SAS_TOKEN}`, '_blank');
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative h-[90vh] w-[90vw] max-w-6xl overflow-hidden rounded-xl bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-light p-6">
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-text-primary" />
              <h1 className="text-2xl font-semibold text-text-primary">
                Knowledge Base Repository
              </h1>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              CMI documents indexed for AI retrieval
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-88px)] overflow-y-auto p-6">
          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-text-primary border-r-transparent"></div>
                <p className="text-text-secondary">Loading documents...</p>
              </div>
            </div>
          )}

          {error ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
                <p className="text-red-800 dark:text-red-300">
                  Failed to load documents. Please try again later.
                </p>
              </div>
            </div>
          ) : null}

          {data && !isLoading && (
            <div className="space-y-6">
              {/* Total Documents Card */}
              <div className="rounded-xl border border-border-light bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-blue-500 p-3">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-text-secondary">
                      Total Documents
                    </p>
                    <p className="text-4xl font-bold text-text-primary">{data.totalCount as number}</p>
                  </div>
                </div>
              </div>

              {/* Documents List */}
              {(data.totalCount as number) > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-text-primary">Documents</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {data.documents.map((doc, index) => (
                      <div
                        key={index}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleDownload(doc.name)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDownload(doc.name); }}
                        className={cn(
                          'group cursor-pointer rounded-lg border border-border-light bg-surface-primary p-4 shadow-sm transition-all hover:shadow-md',
                          'hover:border-blue-300 dark:hover:border-blue-700',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                            <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words text-sm font-medium text-text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {getDisplayName(doc.name)}
                            </h3>
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-text-secondary">
                                <span className="font-medium">Size:</span>{' '}
                                {(parseInt(doc.contentLength) / 1024 / 1024).toFixed(2)} MB
                              </p>
                              <p className="text-xs text-text-secondary">
                                <span className="font-medium">Modified:</span>{' '}
                                {new Date(doc.lastModified).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                            <Download className="h-4 w-4 text-text-secondary" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(data.totalCount as number) === 0 && (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-12 w-12 text-text-secondary opacity-50" />
                    <p className="mt-4 text-text-secondary">No documents found</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

KnowledgeBase.displayName = 'KnowledgeBase';

export default KnowledgeBase;
