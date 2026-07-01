import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderKanban, CheckSquare, HelpCircle, FileText, Loader2 } from 'lucide-react';
import { useGlobalSearch, type SearchResult, type SearchResultKind } from '@/hooks/useGlobalSearch';
import { useDebounce } from '@/hooks/useDebounce';

const KIND_ICON: Record<SearchResultKind, React.ReactNode> = {
  project: <FolderKanban className="h-3.5 w-3.5 shrink-0" />,
  task: <CheckSquare className="h-3.5 w-3.5 shrink-0" />,
  rfi: <HelpCircle className="h-3.5 w-3.5 shrink-0" />,
  document: <FileText className="h-3.5 w-3.5 shrink-0" />,
};

const KIND_LABEL: Record<SearchResultKind, string> = {
  project: 'Projet',
  task: 'Tâche',
  rfi: 'RFI',
  document: 'Document',
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 250);
  const { data: results = [], isFetching } = useGlobalSearch(debouncedQuery);

  // Cmd+K / Ctrl+K focus
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Ferme le dropdown si clic hors du composant
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setActiveIdx(0);
    setOpen(true);
  }

  const navigate_to = useCallback(
    (result: SearchResult) => {
      navigate(result.href);
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    },
    [navigate]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) navigate_to(r);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Rechercher…"
          aria-label="Recherche globale"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          autoComplete="off"
          onChange={handleInputChange}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-150 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {/* Raccourci Cmd+K */}
        {!query && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shadow-sm">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {results.length === 0 && !isFetching && (
            <p className="px-4 py-3 text-sm text-slate-400">Aucun résultat</p>
          )}
          {results.map((r, idx) => (
            <button
              key={`${r.kind}-${r.id}`}
              role="option"
              aria-selected={idx === activeIdx}
              onClick={() => navigate_to(r)}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                idx === activeIdx ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={idx === activeIdx ? 'text-brand-500' : 'text-slate-400'}>
                {KIND_ICON[r.kind]}
              </span>
              <span className="flex-1 truncate font-medium">{r.label}</span>
              <span className="shrink-0 text-xs text-slate-400">
                {r.sub ?? KIND_LABEL[r.kind]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
