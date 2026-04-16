import React from 'react';
import {
  FileUp, Type, Image as ImageIcon, Square,
  RotateCcw, RotateCw, Download, ChevronLeft,
  ChevronRight, Eraser, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface EditorToolbarProps {
  onUploadPDF: (file: File) => void;
  onAddText: () => void;
  onAddImage: () => void;
  onWhiteOut: () => void;
  onAddShape: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  isLoaded: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onUploadPDF, onAddText, onAddImage, onWhiteOut, onAddShape,
  onUndo, onRedo, onExport, isLoaded, currentPage, totalPages, onPageChange,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white border-b border-slate-200 flex items-center justify-between px-5 py-2.5 shadow-sm z-10 shrink-0 gap-3 flex-wrap">
      {/* Left section: Upload + Tools */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Upload PDF */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={(e) => e.target.files?.[0] && onUploadPDF(e.target.files[0])}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-700 text-xs h-9"
          >
            <FileUp size={14} /> Upload PDF
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Editing tools */}
        <div className="flex items-center gap-1">
          <Button
            disabled={!isLoaded}
            onClick={onAddText}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600 text-xs h-8"
            title="Add editable text"
          >
            <Type size={14} /> Text
          </Button>

          <Button
            disabled={!isLoaded}
            onClick={onAddImage}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600 text-xs h-8"
            title="Add image"
          >
            <ImageIcon size={14} /> Image
          </Button>

          <Button
            disabled={!isLoaded}
            onClick={onWhiteOut}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600 text-xs h-8"
            title="White-out tool"
          >
            <Eraser size={14} /> White-out
          </Button>

          <Button
            disabled={!isLoaded}
            onClick={onAddShape}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600 text-xs h-8"
            title="Add rectangle shape"
          >
            <Square size={14} /> Shape
          </Button>
        </div>
      </div>

      {/* Center: Page navigation */}
      {isLoaded && totalPages > 0 && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-semibold text-slate-700 min-w-[80px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* Right: Undo/Redo + Export */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Button onClick={onUndo} variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title="Undo">
            <RotateCcw size={14} />
          </Button>
          <Button onClick={onRedo} variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title="Redo">
            <RotateCw size={14} />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Button
          disabled={!isLoaded}
          onClick={onExport}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9"
        >
          <Download size={14} /> Download PDF
        </Button>
      </div>
    </div>
  );
};

export default EditorToolbar;
