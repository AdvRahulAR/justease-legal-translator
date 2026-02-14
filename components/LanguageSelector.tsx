import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { LanguageOption } from '../types';
import { SUPPORTED_LANGUAGES, AUTO_DETECT } from '../constants';

interface Props {
  selectedCode: string;
  onChange: (code: string) => void;
  includeAuto?: boolean;
  label?: string;
  disabled?: boolean;
}

const LanguageSelector: React.FC<Props> = ({ selectedCode, onChange, includeAuto = false, label, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const languages = includeAuto ? [AUTO_DETECT, ...SUPPORTED_LANGUAGES] : SUPPORTED_LANGUAGES;

  const selectedLang = languages.find(l => l.code === selectedCode) || languages[0];

  const filteredLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  // Focus input on open & reset state
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Auto-scroll to highlighted item
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!disabled) setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredLanguages.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredLanguages[highlightedIndex]) {
          onChange(filteredLanguages[highlightedIndex].code);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative" ref={wrapperRef} onKeyDown={handleKeyDown}>
      {label && <span className="text-[10px] font-bold text-legal-400 uppercase mb-1 block">{label}</span>}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full min-w-[140px] bg-white border border-legal-200 hover:border-legal-300 rounded-lg px-3 py-2 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-legal-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-lg leading-none">{selectedLang.flag}</span>
          <div className="flex flex-col items-start truncate">
            <span className="text-sm font-semibold text-legal-800 leading-tight truncate">{selectedLang.name}</span>
            <span className="text-[10px] text-legal-400 font-medium leading-tight truncate">{selectedLang.nativeName}</span>
          </div>
        </div>
        <ChevronDown size={14} className={`text-legal-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-legal-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col border-legal-200/60 ring-1 ring-legal-900/5">
          <div className="p-3 border-b border-legal-100 bg-legal-50/30 shrink-0">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-legal-400 group-focus-within:text-legal-600 transition-colors" />
              <input
                ref={inputRef}
                type="text"
                className="w-full bg-white border border-legal-200 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-legal-200/50 text-legal-800 placeholder:text-legal-400 transition-all"
                placeholder="Search language..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
            role="listbox"
          >
            {filteredLanguages.length === 0 ? (
              <div className="p-4 text-center text-xs text-legal-400 font-medium">No results found</div>
            ) : (
              filteredLanguages.map((lang, idx) => (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={selectedCode === lang.code}
                  onClick={() => {
                    onChange(lang.code);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${idx === highlightedIndex ? 'bg-legal-100/80 text-legal-900 shadow-sm' : 'text-legal-700 hover:bg-legal-50'
                    } ${selectedCode === lang.code ? 'bg-legal-50 font-bold' : ''}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-xl filter drop-shadow-sm">{lang.flag}</span>
                    <div className="flex flex-col">
                      <div className={`text-sm ${selectedCode === lang.code ? 'text-legal-900' : 'text-legal-800 font-medium'}`}>{lang.name}</div>
                      <div className="text-[10px] text-legal-400 font-bold uppercase tracking-wider">{lang.nativeName}</div>
                    </div>
                  </div>
                  {selectedCode === lang.code && (
                    <div className="bg-legal-700 rounded-full p-0.5 shadow-sm">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;