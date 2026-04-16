import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Type, ChevronDown, X } from 'lucide-react';
import { GOOGLE_FONTS, FONT_CATEGORIES, loadGoogleFont, preloadFontBatch, isFontLoaded, FontCategory } from '../../../data/googleFonts';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';

const VISIBLE_BATCH_SIZE = 40;

export default function FontBar() {
  const design = useConfiguratorStore(state => state.design);
  const setField = useConfiguratorStore(state => state.setField);
  const activeSide = design.idCard.activeSide;
  const selectedId = design.idCard.selected;
  const elements = design.idCard[activeSide].elements;
  const selectedEl = elements.find((e: any) => e.id === selectedId);
  const isTextSelected = selectedEl?.type === 'text';

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<FontCategory | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH_SIZE);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Preload the first batch of fonts on mount
  useEffect(() => {
    preloadFontBatch(GOOGLE_FONTS.slice(0, 30).map(f => f.family));
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isOpen) {
      setVisibleCount(VISIBLE_BATCH_SIZE);
    }
  }, [isOpen]);

  // Filter fonts
  const filtered = useMemo(() => {
    let result = [...GOOGLE_FONTS];
    if (activeCategory !== 'all') result = result.filter(f => f.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f => f.family.toLowerCase().includes(q));
    }
    return result;
  }, [search, activeCategory]);

  const visible = filtered.slice(0, visibleCount);

  // Lazy-load fonts as they appear
  useEffect(() => {
    const families = visible.map(f => f.family).filter(f => !isFontLoaded(f));
    if (families.length > 0) {
      preloadFontBatch(families);
    }
  }, [visible]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      setVisibleCount(prev => Math.min(prev + VISIBLE_BATCH_SIZE, filtered.length));
    }
  }, [filtered.length]);

  const applyFont = (family: string) => {
    if (!selectedId) return;
    loadGoogleFont(family);
    setField(
      `idCard.${activeSide}.elements`,
      elements.map((e: any) => e.id === selectedId ? { ...e, fontFamily: family } : e)
    );
    setIsOpen(false);
  };

  const currentFont = selectedEl?.fontFamily || 'Sans-serif';

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => isTextSelected && setIsOpen(!isOpen)}
        disabled={!isTextSelected}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          isTextSelected
            ? isOpen
              ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            : 'text-slate-300 cursor-not-allowed'
        }`}
        title={isTextSelected ? 'Change font' : 'Select a text element first'}
      >
        <Type size={14} />
        <span className="max-w-[120px] truncate" style={{ fontFamily: isTextSelected ? `"${currentFont}", sans-serif` : undefined }}>
          {currentFont}
        </span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && isTextSelected && (
        <div className="absolute top-full left-0 mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[200] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setVisibleCount(VISIBLE_BATCH_SIZE); }}
                placeholder="Search 1000+ fonts..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 custom-scrollbar">
              <button
                onClick={() => { setActiveCategory('all'); setVisibleCount(VISIBLE_BATCH_SIZE); }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  activeCategory === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                All ({GOOGLE_FONTS.length})
              </button>
              {FONT_CATEGORIES.map(cat => {
                const count = GOOGLE_FONTS.filter(f => f.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setVisibleCount(VISIBLE_BATCH_SIZE); }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap capitalize transition-all ${
                      activeCategory === cat
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font List */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-[320px] overflow-y-auto custom-scrollbar"
          >
            {visible.length === 0 ? (
              <div className="p-8 text-center">
                <Type size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs text-slate-400 font-medium">No fonts found for "{search}"</p>
              </div>
            ) : (
              visible.map((font) => {
                const isActive = currentFont === font.family;
                return (
                  <button
                    key={font.family}
                    onClick={() => applyFont(font.family)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between group transition-all border-b border-slate-50 last:border-0 ${
                      isActive
                        ? 'bg-indigo-50 border-indigo-100'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm block truncate ${isActive ? 'text-indigo-700 font-bold' : 'text-slate-800'}`}
                        style={{ fontFamily: `"${font.family}", ${font.category}` }}
                      >
                        {font.family}
                      </span>
                      <span
                        className="text-[11px] text-slate-400 block truncate mt-0.5"
                        style={{ fontFamily: `"${font.family}", ${font.category}` }}
                      >
                        The quick brown fox jumps
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        font.category === 'sans-serif' ? 'bg-blue-50 text-blue-500' :
                        font.category === 'serif' ? 'bg-emerald-50 text-emerald-600' :
                        font.category === 'display' ? 'bg-amber-50 text-amber-600' :
                        font.category === 'handwriting' ? 'bg-purple-50 text-purple-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {font.category}
                      </span>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
            {visibleCount < filtered.length && (
              <div className="p-3 text-center">
                <span className="text-[10px] text-slate-400 font-medium">
                  Showing {visible.length} of {filtered.length} fonts • scroll for more
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
