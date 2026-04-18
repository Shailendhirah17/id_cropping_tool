import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, FabricImage, IText, Rect } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
import { loadPDFPageAsImage } from '@/utils/pdfHandler';
import { exportMultiPagePDF } from '@/utils/exportPDF';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const pdfDocRef = useRef<any>(null);
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

    // Snapping logic
    const grid = 10;
    fabricRef.current.on('object:moving', (options) => {
      if (options.target) {
        options.target.set({
          left: Math.round(options.target.left! / grid) * grid,
          top: Math.round(options.target.top! / grid) * grid,
        });
      }
    });

    fabricRef.current.on('object:added', () => { if (!suppressSave.current) saveState(); });
    fabricRef.current.on('object:modified', () => { if (!suppressSave.current) saveState(); });
    fabricRef.current.on('object:removed', () => { if (!suppressSave.current) saveState(); });

    // Handle Image Hover — change cursor for replaceable objects
    fabricRef.current.on('mouse:over', (e) => {
      const obj = e.target;
      if (obj && (obj as any).isPDFImage) {
        obj.set('hoverCursor', 'pointer');
      }
    });

    // Handle Object Click for Replacement
    fabricRef.current.on('mouse:down', (e) => {
      const obj = e.target as any;
      if (obj && obj.isPDFImage) {
        handleReplaceImage(obj);
      }
    });

    // Enter edit mode on single click (mouse up to avoid drag conflict)
    fabricRef.current.on('mouse:up', (e) => {
      const obj = e.target as any;
      if (obj && obj.type === 'i-text') {
        fabricRef.current?.setActiveObject(obj);
        obj.enterEditing();
        obj.selectAll();
        fabricRef.current?.requestRenderAll();
      }
    });

    // Zoom logic
    fabricRef.current.on('mouse:wheel', function(opt) {
      if (!fabricRef.current) return;
      var delta = opt.e.deltaY;
      var zoom = fabricRef.current.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;
      fabricRef.current.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Handle custom image replace event from PropertiesPanel
    fabricRef.current.on('custom:replace_image', async (e: any) => {
      const { target, dataUrl, file } = e;
      if (!fabricRef.current || !target || !dataUrl) return;
      
      try {
        const img = await FabricImage.fromURL(dataUrl);
        
        // Preserve dimensions
        const targetWidth = target.getScaledWidth();
        const targetHeight = target.getScaledHeight();
        
        img.scaleToWidth(targetWidth);
        if (img.getScaledHeight() > targetHeight) {
            img.scaleToHeight(targetHeight);
        }
        
        img.set({ 
            left: target.left, 
            top: target.top,
        });
        
        (img as any).isPDFImage = true;
        (img as any).name = `Replaced: ${file.name}`;
        
        fabricRef.current.add(img);
        fabricRef.current.remove(target);
        fabricRef.current.setActiveObject(img);
        fabricRef.current.requestRenderAll();
        toast.success('Image replaced successfully');
      } catch (err) {
        toast.error('Failed to replace image');
      }
    });

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

  /**
   * Render a single PDF page onto the Fabric canvas.
   * The PDF is rendered as a static background image (no masking).
   * Text items are extracted and placed as editable IText objects on top.
   */
  const renderPageToCanvas = async (
    canvas: Canvas,
    pdfDoc: any,
    file: File,
    pageNum: number
  ) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport1 = page.getViewport({ scale: 1.0 });

    // Render PDF page as a plain background image (NO masking)
    const dataUrl = await loadPDFPageAsImage(file, pageNum);
    const img = await FabricImage.fromURL(dataUrl);

    const canvasWidth = 600;
    const scale = canvasWidth / img.width!;
    const canvasHeight = img.height! * scale;

    canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
    canvas.clear();

    img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
    canvas.backgroundImage = img;

    // Extract text content for interactive editing
    const textContent = await page.getTextContent();
    const pdfToCanvasScale = canvasWidth / viewport1.width;

    const textItems = textContent.items
      .filter((item: any) => item.str && item.str.trim() && item.transform && item.transform.length >= 6)
      .map((item: any) => {
        const transform = item.transform;
        const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
        return {
          str: item.str,
          x: transform[4],
          y: transform[5],
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
          fontName: item.fontName,
        };
      });

    // Add editable text objects
    for (const item of textItems) {
      const text = new IText(item.str, {
        left: item.x * pdfToCanvasScale,
        top: (viewport1.height - item.y - item.fontSize) * pdfToCanvasScale,
        fontSize: item.fontSize * pdfToCanvasScale,
        fontFamily: 'Inter, sans-serif',
        fill: '#000000',
      });
      canvas.add(text);
    }

    // Detect potential image placeholders (heuristic: text ending in .jpg)
    const potentialImages = textItems.filter((t: any) => t.str.toLowerCase().endsWith('.jpg'));
    for (const item of potentialImages) {
      const rect = new Rect({
        left: item.x * pdfToCanvasScale,
        top: (viewport1.height - item.y - 120) * pdfToCanvasScale,
        width: 100 * pdfToCanvasScale,
        height: 120 * pdfToCanvasScale,
        fill: 'rgba(255,255,255,0.5)',
        stroke: '#3b82f6',
        strokeWidth: 1,
        strokeDashArray: [5, 5],
      });
      (rect as any).isPDFImage = true;
      (rect as any).name = 'Replaceable Image';
      canvas.add(rect);
    }

    canvas.requestRenderAll();
  };

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
        // Reuse the cached PDF document or load a fresh one
        if (!pdfDocRef.current) {
          const arrayBuffer = await pdfFileRef.current.arrayBuffer();
          pdfDocRef.current = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        }
        await renderPageToCanvas(canvas, pdfDocRef.current, pdfFileRef.current, pageNum);
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

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      pdfDocRef.current = pdf;

      const numPages = pdf.numPages;
      setTotalPages(numPages);
      totalPagesRef.current = numPages;
      setCurrentPage(1);
      currentPageRef.current = 1;
      setIsLoaded(true);

      if (!fabricRef.current) return;

      suppressSave.current = true;

      await renderPageToCanvas(fabricRef.current, pdf, file, 1);

      setHistory([]);
      setRedoStack([]);
      suppressSave.current = false;
      saveState();

      toast.success(`PDF loaded — ${numPages} page${numPages > 1 ? 's' : ''}`, { id: 'pdf-load' });
    } catch (error: any) {
      console.error('PDF upload error:', error);
      suppressSave.current = false;
      toast.error(`Failed to load PDF: ${error?.message || String(error)}`, { id: 'pdf-load' });
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
  const handleReplaceImage = (targetObj: any) => {
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
        
        // Preserve dimensions
        const targetWidth = targetObj.getScaledWidth();
        const targetHeight = targetObj.getScaledHeight();
        
        img.scaleToWidth(targetWidth);
        if (img.getScaledHeight() > targetHeight) {
            img.scaleToHeight(targetHeight);
        }
        
        img.set({ 
            left: targetObj.left, 
            top: targetObj.top,
        });
        
        (img as any).isPDFImage = true;
        (img as any).name = `Replaced: ${file.name}`;
        
        fabricRef.current!.add(img);
        fabricRef.current!.remove(targetObj);
        fabricRef.current!.setActiveObject(img);
        fabricRef.current!.requestRenderAll();
        toast.success('Image replaced successfully');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };



  const [zoomLevel, setZoomLevel] = useState(1);

  // Export corrected PDF
  const handleExport = async () => {
    if (!fabricRef.current || !pdfFileRef.current) return;

    try {
      toast.loading('Generating corrected PDF...', { id: 'export' });

      // Revert zoom to 1 before capturing export
      const currentZoom = fabricRef.current.getZoom();
      const currentW = fabricRef.current.width!;
      const currentH = fabricRef.current.height!;
      fabricRef.current.setZoom(1);
      fabricRef.current.setDimensions({ width: currentW / currentZoom, height: currentH / currentZoom });
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

      // Restore zoom
      fabricRef.current.setZoom(currentZoom);
      fabricRef.current.setDimensions({ width: currentW, height: currentH });

      const filename = pdfFileRef.current!.name.replace(/\.pdf$/i, '_edited.pdf');
      await exportMultiPagePDF(pages, filename);
      toast.success('PDF downloaded successfully!', { id: 'export' });
    } catch (error) {
      console.error(error);
      suppressSave.current = false;
      toast.error('Failed to export PDF', { id: 'export' });
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!fabricRef.current) return;
    let newZoom = zoomLevel + (direction === 'in' ? 0.25 : -0.25);
    newZoom = Math.max(0.25, Math.min(newZoom, 5));
    setZoomLevel(newZoom);
    
    // Scale HTML canvas size for native scrollbars
    const baseWidth = 600;
    const baseHeight = (fabricRef.current.backgroundImage as any)?.height * ((fabricRef.current.backgroundImage as any)?.scaleY || 1);
    
    fabricRef.current.setZoom(newZoom);
    fabricRef.current.setDimensions({ 
      width: baseWidth * newZoom, 
      height: (baseHeight || fabricRef.current.height!) * newZoom 
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] bg-[#f8fafc] rounded-xl border border-slate-200 overflow-hidden">
      <EditorToolbar
        onUploadPDF={handlePDFUpload}
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

          {/* Floating Zoom Controls */}
          {isLoaded && (
            <div className="absolute bottom-4 right-6 bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 rounded-lg flex items-center p-1 z-50">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => handleZoom('out')} disabled={zoomLevel <= 0.25} title="Zoom Out">
                 <span className="text-lg font-medium leading-none cursor-pointer">-</span>
              </Button>
              <div className="w-12 text-center text-[11px] font-bold text-slate-700">
                {Math.round(zoomLevel * 100)}%
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={() => handleZoom('in')} disabled={zoomLevel >= 5} title="Zoom In">
                 <span className="text-lg font-medium leading-none cursor-pointer">+</span>
              </Button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <PropertiesPanel canvas={fabricRef.current} />
      </div>
    </div>
  );
};

export default PDFEditorTab;
