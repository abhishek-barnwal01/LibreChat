import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, FileText, Download, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { useGetBlobListQuery } from '~/data-provider';
import { cn } from '~/utils';

/** Extract just the filename from a blob path like "soaps/filename.pdf" */
const getDisplayName = (fullPath: string): string => {
  const parts = fullPath.split('/');
  return parts[parts.length - 1] || fullPath;
};

/** Extract the folder name from a blob path */
const getFolderName = (fullPath: string): string => {
  const parts = fullPath.split('/');
  if (parts.length > 1) {
    return parts[0];
  }
  return '';
};

/** Convert metadata key like "file_category_ai" to "File Category AI" */
const formatFilterLabel = (key: string): string => {
  return key
    .split('_')
    .map((word) => (word.toLowerCase() === 'ai' ? 'AI' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
};

/** Folder badge color mapping */
const FOLDER_STYLES: Record<string, string> = {
  soaps: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Household_Insecticides:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const DEFAULT_FOLDER_STYLE =
  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

/** Format folder name for display: "Household_Insecticides" → "Household Insecticides" */
const formatFolderName = (folder: string): string => {
  return folder.replace(/_/g, ' ');
};

/** Metadata keys to exclude from filter dropdowns */
const EXCLUDED_FILTER_KEYS = new Set(['file_path', 'document_id', 'source_system']);

/** Check if a metadata value should be excluded from filter options */
const isExcludedValue = (value: string): boolean => {
  const lower = value.toLowerCase().trim();
  return lower === '' || lower === 'na' || lower === 'n/a' || lower === 'null';
};

/* ------------------------------------------------------------------ */
/*  FilterDropdown – a multi-select dropdown for a single metadata key */
/* ------------------------------------------------------------------ */

interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const FilterDropdown = memo(({ label, options, selected, onChange }: FilterDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange],
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          selected.length > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'border-border-light bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 min-w-[220px] max-w-[320px] overflow-hidden rounded-lg border border-border-light bg-surface-primary shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-text-primary transition-colors hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="h-3.5 w-3.5 rounded border-border-light text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{option}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border-light px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

FilterDropdown.displayName = 'FilterDropdown';

/* ------------------------------------------------------------------ */
/*  KnowledgeBase – main modal component                               */
/* ------------------------------------------------------------------ */

interface KnowledgeBaseProps {
  onClose: () => void;
}

const BLOB_DOWNLOAD_BASE = 'https://gcplcmiadls001.blob.core.windows.net/gcpl-rag-embeddings';
const DOWNLOAD_SAS_TOKEN = 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupyx&se=2026-03-19T14:08:21Z&st=2026-01-30T05:53:21Z&spr=https&sig=nYKjE2yfrFEcncreXt%2BA0dM6zFLbvNeignb3ZrnWcn0%3D';

const KnowledgeBase = memo(({ onClose }: KnowledgeBaseProps) => {
  const { data, isLoading, error } = useGetBlobListQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  // Static list of valid filter keys (computed once from all documents)
  const allFilterKeys = useMemo(() => {
    if (!data?.documents) {
      return [];
    }
    const keyCounts: Record<string, Set<string>> = {};
    data.documents.forEach((doc) => {
      if (!doc.metadata) {
        return;
      }
      Object.entries(doc.metadata).forEach(([key, value]) => {
        if (EXCLUDED_FILTER_KEYS.has(key)) {
          return;
        }
        if (!value || isExcludedValue(value)) {
          return;
        }
        if (!keyCounts[key]) {
          keyCounts[key] = new Set();
        }
        keyCounts[key].add(value.trim());
      });
    });
    // Only include keys with at least 2 distinct values (useful for filtering)
    return Object.entries(keyCounts)
      .filter(([, values]) => values.size >= 2)
      .map(([key]) => key)
      .sort();
  }, [data?.documents]);

  // Interlinked filter options: for each key, compute available values from
  // documents that match ALL OTHER active filters (Excel-style cascading)
  const filterOptions = useMemo(() => {
    if (!data?.documents || allFilterKeys.length === 0) {
      return {};
    }

    const result: Record<string, string[]> = {};

    for (const key of allFilterKeys) {
      // Start with all documents, then apply every active filter EXCEPT this key
      let docs = data.documents;

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        docs = docs.filter((doc) => getDisplayName(doc.name).toLowerCase().includes(query));
      }

      // Apply all active metadata filters except the current key
      Object.entries(activeFilters).forEach(([filterKey, values]) => {
        if (filterKey !== key && values.length > 0) {
          docs = docs.filter((doc) => {
            const docValue = doc.metadata?.[filterKey];
            return docValue != null && values.includes(docValue.trim());
          });
        }
      });

      // Collect unique valid values from the remaining documents
      const values = new Set<string>();
      docs.forEach((doc) => {
        const value = doc.metadata?.[key];
        if (value && !isExcludedValue(value)) {
          values.add(value.trim());
        }
      });

      if (values.size >= 1) {
        result[key] = Array.from(values).sort((a, b) => a.localeCompare(b));
      }
    }

    return result;
  }, [data?.documents, allFilterKeys, activeFilters, searchQuery]);

  // Combined filtering: search query + metadata filters
  const filteredDocuments = useMemo(() => {
    if (!data?.documents) {
      return [];
    }
    let docs = data.documents;

    // Text search on filename
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      docs = docs.filter((doc) => getDisplayName(doc.name).toLowerCase().includes(query));
    }

    // Metadata filters (AND across keys, OR within same key)
    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        docs = docs.filter((doc) => {
          const docValue = doc.metadata?.[key];
          return docValue != null && values.includes(docValue.trim());
        });
      }
    });

    return docs;
  }, [data?.documents, searchQuery, activeFilters]);

  const handleFilterChange = useCallback((key: string, values: string[]) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (values.length === 0) {
        delete next[key];
      } else {
        next[key] = values;
      }
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setSearchQuery('');
  }, []);

  const removeFilterChip = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      const remaining = (next[key] || []).filter((v) => v !== value);
      if (remaining.length === 0) {
        delete next[key];
      } else {
        next[key] = remaining;
      }
      return next;
    });
  }, []);

  const hasActiveFilters = useMemo(
    () => Object.values(activeFilters).some((v) => v.length > 0),
    [activeFilters],
  );

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; value: string }[] = [];
    Object.entries(activeFilters).forEach(([key, values]) => {
      values.forEach((value) => chips.push({ key, value }));
    });
    return chips;
  }, [activeFilters]);

  const handleDownload = useCallback((blobName: string) => {
    const encodedName = blobName.split('/').map(encodeURIComponent).join('/');
    window.open(`${BLOB_DOWNLOAD_BASE}/${encodedName}?${DOWNLOAD_SAS_TOKEN}`, '_blank');
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-xl bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-border-light p-6">
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

        {/* Search Bar */}
        {data && !isLoading && !error && (
          <div className="flex-shrink-0 border-b border-border-light px-6 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by name..."
                className="w-full rounded-lg border border-border-light bg-surface-secondary py-2 pl-10 pr-10 text-sm text-text-primary placeholder-text-secondary outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                aria-label="Search documents"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-secondary transition-colors hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Metadata Filter Bar */}
        {data && !isLoading && !error && allFilterKeys.length > 0 && (
          <div className="flex-shrink-0 border-b border-border-light px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters:</span>
              </div>
              {allFilterKeys.map((key) => (
                <FilterDropdown
                  key={key}
                  label={formatFilterLabel(key)}
                  options={filterOptions[key] || []}
                  selected={activeFilters[key] || []}
                  onChange={(values) => handleFilterChange(key, values)}
                />
              ))}
              {(hasActiveFilters || searchQuery.trim()) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Active filter chips */}
            {activeFilterChips.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                  Active:
                </span>
                {activeFilterChips.map((chip) => (
                  <span
                    key={`${chip.key}-${chip.value}`}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    <span className="text-blue-500 dark:text-blue-400">
                      {formatFilterLabel(chip.key)}:
                    </span>
                    {chip.value}
                    <button
                      type="button"
                      onClick={() => removeFilterChip(chip.key, chip.value)}
                      className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                      aria-label={`Remove filter ${chip.value}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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
                      {searchQuery.trim() || hasActiveFilters
                        ? 'Matching Documents'
                        : 'Total Documents'}
                    </p>
                    <p className="text-4xl font-bold text-text-primary">
                      {filteredDocuments.length}
                      {(searchQuery.trim() || hasActiveFilters) && (
                        <span className="ml-2 text-lg font-normal text-text-secondary">
                          of {data.totalCount as number} total
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documents List */}
              {filteredDocuments.length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-text-primary">Documents</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDocuments.map((doc, index) => {
                      const folder = getFolderName(doc.name);
                      return (
                        <div
                          key={index}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleDownload(doc.name)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleDownload(doc.name);
                            }
                          }}
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
                              {folder && (
                                <span
                                  className={cn(
                                    'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                                    FOLDER_STYLES[folder] || DEFAULT_FOLDER_STYLE,
                                  )}
                                >
                                  {formatFolderName(folder)}
                                </span>
                              )}
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
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredDocuments.length === 0 && (searchQuery.trim() || hasActiveFilters) && (
                <div className="flex h-64 items-center justify-center">
                  <div className="text-center">
                    <Search className="mx-auto h-12 w-12 text-text-secondary opacity-50" />
                    <p className="mt-4 text-text-secondary">
                      No documents match the current filters
                    </p>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Clear all filters
                    </button>
                  </div>
                </div>
              )}

              {(data.totalCount as number) === 0 &&
                !searchQuery.trim() &&
                !hasActiveFilters && (
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
