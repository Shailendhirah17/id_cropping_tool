import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricImage, IText, Rect } from 'fabric';
import { loadPDFPageAsImage, getPDFPageCount } from '@/utils/pdfHandler';
import { exportMultiPagePDF } from '@/utils/exportPDF';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import EditorToolbar from './EditorToolbar';
import PropertiesPanel from './PropertiesPanel';

interface PageState {
  json: string;
  bgDataUrl: string;
  width: number;
  height: number;
}

const PDFEditorTab: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalPagesRef] = [useRef(0)];
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  // Use a ref for pageStates to avoid stale closure in loadPageOntoCanvas
  const pageStatesRef = useRef<Map<number, PageState>>(new Map());
  const [pageStates, _setPageStates] = useState<Map<number, PageState>>(new Map());
  const setPageStates = (updater: (prev: Map<number, PageState>) => Map<number, PageState>) => {
    _setPageStates(prev => {
      const next = updater(prev);
      pageStatesRef.current = next;
      return next;
    });
  };
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  // Flag to suppress saveState during programmatic canvas operations (load/clear)
  const suppressSave = useRef(false);
  const currentPageRef = useRef(1);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    fabricRef.current = new Canvas(canvasRef.current, {
      width: 600,
      height: 800,
      backgroundColor: '#f1f5f9',
    });

    fabricRef.current.on('object:added', () => { if (!suppressSave.current) saveState(); });
    fabricRef.current.on('object:modified', () => { if (!suppressSave.current) saveState(); });
    fabricRef.current.on('object:removed', () => { if (!suppressSave.current) saveState(); });

    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveState = useCallback(() => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toObject());
    setHistory(prev => [...prev.slice(-49), json]);
    setRedoStack([]);
  }, []);

  const handleUndo = () => {
    if (history.length <= 1 || !fabricRef.current) return;
    const newHistory = [...history];
    const current = newHistory.pop();
    if (!current) return;

    setRedoStack(prev => [...prev, current]);
    setHistory(newHistory);

    const last = newHistory[newHistory.length - 1];
    suppressSave.current = true;
    fabricRef.current.loadFromJSON(JSON.parse(last)).then(() => {
      fabricRef.current?.requestRenderAll();
      suppressSave.current = false;
    });
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !fabricRef.current) return;
    const newRedo = [...redoStack];
    const next = newRedo.pop();
    if (!next) return;

    setHistory(prev => [...prev, next]);
    setRedoStack(newRedo);

    suppressSave.current = true;
    fabricRef.current.loadFromJSON(JSON.parse(next)).then(() => {
      fabricRef.current?.requestRenderAll();
      suppressSave.current = false;
    });
  };

  // Save current page state before switching — reads from ref to avoid stale closures
  const saveCurrentPageState = useCallback(() => {
    if (!fabricRef.current || !isLoaded) return;

    const json = JSON.stringify(fabricRef.current.toObject());
    const bgImg = fabricRef.current.backgroundImage as any;
    const bgDataUrl = bgImg?.getSrc?.() || '';

    const updated = new Map(pageStatesRef.current);
    updated.set(currentPageRef.current, {
      json,
      bgDataUrl,
      width: fabricRef.current.width!,
      height: fabricRef.current.height!,
    });
    pageStatesRef.current = updated;
    _setPageStates(updated);
  }, [isLoaded]);

  // Load a specific page onto the canvas — uses refs for freshest data
  const loadPageOntoCanvas = useCallback(async (pageNum: number) => {
    if (!fabricRef.current || !pdfFileRef.current) return;

    const canvas = fabricRef.current;
    suppressSave.current = true;

    try {
      // Read from ref (not state) to avoid stale closures
      const savedState = pageStatesRef.current.get(pageNum);

      if (savedState) {
        canvas.setDimensions({ width: savedState.width, height: savedState.height });
        await canvas.loadFromJSON(JSON.parse(savedState.json));

        const img = await FabricImage.fromURL(savedState.bgDataUrl);
        const scale = savedState.width / img.width!;
        img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
        canvas.backgroundImage = img;
        canvas.requestRenderAll();
      } else {
        const dataUrl = await loadPDFPageAsImage(pdfFileRef.current, pageNum);
        const img = await FabricImage.fromURL(dataUrl);

        const canvasWidth = 600;
        const scale = canvasWidth / img.width!;
        const canvasHeight = img.height! * scale;

        canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
        canvas.clear();

        img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
        canvas.backgroundImage = img;
        canvas.requestRenderAll();
      }

      setHistory([]);
      setRedoStack([]);
    } finally {
      suppressSave.current = false;
      // Capture initial state for undo
      saveState();
    }
  }, [saveState]);

  // Handle PDF upload
  const handlePDFUpload = async (file: File) => {
    try {
      toast.loading('Loading PDF...', { id: 'pdf-load' });
      pdfFileRef.current = file;
      setPdfFile(file);
      pageStatesRef.current = new Map();
      _setPageStates(new Map());

      const numPages = await getPDFPageCount(file);
      setTotalPages(numPages);
      totalPagesRef.current = numPages;
      setCurrentPage(1);
      currentPageRef.current = 1;
      setIsLoaded(true);

      if (!fabricRef.current) return;

      suppressSave.current = true;
      const dataUrl = await loadPDFPageAsImage(file, 1);
      const img = await FabricImage.fromURL(dataUrl);

      const canvasWidth = 600;
      const scale = canvasWidth / img.width!;
      const canvasHeight = img.height! * scale;

      fabricRef.current.setDimensions({ width: canvasWidth, height: canvasHeight });
      fabricRef.current.clear();

      img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
      fabricRef.current.backgroundImage = img;
      fabricRef.current.requestRenderAll();

      setHistory([]);
      setRedoStack([]);
      suppressSave.current = false;
      saveState();

      toast.success(`PDF loaded — ${numPages} page${numPages > 1 ? 's' : ''}`, { id: 'pdf-load' });
    } catch (error) {
      console.error(error);
      suppressSave.current = false;
      toast.error('Failed to load PDF', { id: 'pdf-load' });
    }
  };

  // Handle page change
  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPagesRef.current || newPage === currentPageRef.current) return;

    // Save before switching
    saveCurrentPageState();
    currentPageRef.current = newPage;
    setCurrentPage(newPage);
    await loadPageOntoCanvas(newPage);
  };

  // Add text
  const addText = () => {
    if (!fabricRef.current) return;
    const text = new IText('Edit me', {
      left: 100, top: 100,
      fontSize: 20, fontFamily: 'Inter, sans-serif', fill: '#000000',
    });
    (text as any).name = 'Text';
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.requestRenderAll();
  };

  // Add image
  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file || !fabricRef.current) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        const img = await FabricImage.fromURL(dataUrl);
        img.scaleToWidth(150);
        img.set({ left: 100, top: 100 });
        (img as any).name = `Image: ${file.name}`;
        fabricRef.current!.add(img);
        fabricRef.current!.setActiveObject(img);
        fabricRef.current!.requestRenderAll();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // White-out tool
  const addWhiteOut = () => {
    if (!fabricRef.current) return;
    const rect = new Rect({
      left: 100, top: 100,
      width: 150, height: 30,
      fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1,
    });
    (rect as any).name = 'White-out';
    fabricRef.current.add(rect);
    fabricRef.current.setActiveObject(rect);
    fabricRef.current.requestRenderAll();
    toast.info('White-out rectangle added — drag and resize to cover mistakes');
  };

  // Add shape
  const addShape = () => {
    if (!fabricRef.current) return;
    const rect = new Rect({
      left: 100, top: 100,
      width: 120, height: 80,
      fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6', strokeWidth: 2, rx: 4, ry: 4,
    });
    (rect as any).name = 'Shape';
    fabricRef.current.add(rect);
    fabricRef.current.setActiveObject(rect);
    fabricRef.current.requestRenderAll();
  };

  // Export corrected PDF
  const handleExport = async () => {
    if (!fabricRef.current || !pdfFileRef.current) return;

    try {
      toast.loading('Generating corrected PDF...', { id: 'export' });

      // Flush current page to ref before exporting
      saveCurrentPageState();

      const pages: { dataUrl: string; width: number; height: number }[] = [];
      const totalPgs = totalPagesRef.current;
      const curPage = currentPageRef.current;

      for (let i = 1; i <= totalPgs; i++) {
        const saved = pageStatesRef.current.get(i);

        if (i === curPage) {
          // Current page — export directly from live canvas
          const dataUrl = fabricRef.current.toDataURL({ multiplier: 2 });
          pages.push({
            dataUrl,
            width: fabricRef.current.width! * 2,
            height: fabricRef.current.height! * 2,
          });
        } else if (saved) {
          // Edited page — reconstruct on a temp canvas
          const tempCanvas = document.createElement('canvas');
          const tempFabric = new Canvas(tempCanvas, { width: saved.width, height: saved.height });

          suppressSave.current = true;
          const bgImg = await FabricImage.fromURL(saved.bgDataUrl);
          const scale = saved.width / bgImg.width!;
          bgImg.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
          tempFabric.backgroundImage = bgImg;
          await tempFabric.loadFromJSON(JSON.parse(saved.json));
          tempFabric.requestRenderAll();

          const dataUrl = tempFabric.toDataURL({ multiplier: 2 });
          pages.push({ dataUrl, width: saved.width * 2, height: saved.height * 2 });
          tempFabric.dispose();
          suppressSave.current = false;
        } else {
          // Unedited page — render straight from PDF
          const dataUrl = await loadPDFPageAsImage(pdfFileRef.current!, i);
          const img = new Image();
          await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
          pages.push({ dataUrl, width: img.width, height: img.height });
        }
      }

      const filename = pdfFileRef.current!.name.replace(/\.pdf$/i, '_edited.pdf');
      await exportMultiPagePDF(pages, filename);
      toast.success('PDF downloaded successfully!', { id: 'export' });
    } catch (error) {
      console.error(error);
      suppressSave.current = false;
      toast.error('Failed to export PDF', { id: 'export' });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] bg-[#f8fafc] rounded-xl border border-slate-200 overflow-hidden">
      <EditorToolbar
        onUploadPDF={handlePDFUpload}
        onAddText={addText}
        onAddImage={addImage}
        onWhiteOut={addWhiteOut}
        onAddShape={addShape}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExport}
        isLoaded={isLoaded}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      <div className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Canvas area */}
        <div className="flex-1 flex justify-center items-start overflow-auto bg-slate-200/50 rounded-xl border-2 border-dashed border-slate-300 p-6 relative">
          <div className={`flex flex-col items-center w-full justify-center py-20 text-slate-400 ${isLoaded ? 'hidden' : ''}`}>
            <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">Upload a PDF to start editing</p>
            <p className="text-xs mt-1">Supports multi-page ID card PDFs</p>
          </div>
          <Card className={`shadow-2xl overflow-hidden bg-white ${!isLoaded ? 'hidden' : ''}`}>
            <canvas id="editor-canvas" ref={canvasRef} />
          </Card>
        </div>

        {/* Right panel */}
        <PropertiesPanel canvas={fabricRef.current} />
      </div>
    </div>
  );
};

export default PDFEditorTab;
