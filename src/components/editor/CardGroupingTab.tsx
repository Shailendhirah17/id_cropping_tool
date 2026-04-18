import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload, FileText, Trash2, Play, Download,
  Grid3x3, Loader2, CheckCircle, AlertTriangle, Info, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { getPDFPageCount, loadPDFPageAsImage } from '@/utils/pdfHandler';
import {
  detectCardGrid, analyzePageSlots, compositeCardsOntoA3,
  A3_WIDTH_PT, A3_HEIGHT_PT,
  type FileAnalysis, type SlotInfo, type GroupingMode
} from '@/utils/cardGroupingUtils';
import { exportCanvasToPDF } from '@/utils/exportPDF';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

const CardGroupingTab: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [analyses, setAnalyses] = useState<FileAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [templateImage, setTemplateImage] = useState<string | null>(null);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [processLog, setProcessLog] = useState<string[]>([]);

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;
    setFiles(prev => [...prev, ...newFiles]);
    setAnalyses([]);
    setPreviewImages([]);
    setTemplateImage(null);
    setZipBlob(null);
    setProcessLog([]);
    toast.success(`${newFiles.length} file(s) added`);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setAnalyses([]);
    setPreviewImages([]);
    setTemplateImage(null);
    setZipBlob(null);
    setProcessLog([]);
  };

  const addLog = (msg: string) => {
    setProcessLog(prev => [...prev, msg]);
  };

  const analyzeFiles = useCallback(async () => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setProcessLog([]);
    const results: FileAnalysis[] = [];

    try {
      let activeTemplate = templateImage;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        addLog(`📄 Analyzing "${file.name}"...`);

        const totalPages = await getPDFPageCount(file);
        addLog(`   → ${totalPages} page(s) found`);

        // Extract the Template Format from the 1st page of the 1st file
        if (i === 0) {
          addLog(`   → Extracting Page 1 formatting template...`);
          activeTemplate = await loadPDFPageAsImage(file, 1);
          setTemplateImage(activeTemplate);
        }

        const lastPageIdx = totalPages;
        const lastPageImage = await loadPDFPageAsImage(file, lastPageIdx);
        
        addLog(`   → Detecting grid on last page (CR80 Standard)...`);
        const grid = await detectCardGrid(lastPageImage);
        addLog(`   → Grid: ${grid.rows}×${grid.cols} detected [Mode: ${grid.mode.toUpperCase()}]`);

        addLog(`   → Extracting slots...`);
        const slots = await analyzePageSlots(lastPageImage, grid);

        const filledCount = slots.filter(s => !s.isEmpty).length;
        const emptyCount = slots.filter(s => s.isEmpty).length;
        addLog(`   → ${filledCount} valid cards extracted from last page.`);

        results.push({
          fileName: file.name,
          file,
          totalPages,
          lastPageImage,
          grid,
          slots,
          filledCount,
          emptyCount,
        });
      }

      setAnalyses(results);
      addLog('');
      addLog('✅ Analysis complete! Ready to batch process.');
    } catch (error) {
      console.error(error);
      addLog(`❌ Error: ${(error as Error).message}`);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [files]);

  const processGrouping = useCallback(async () => {
    if (analyses.length === 0 || !templateImage) return;

    setIsProcessing(true);
    setProcessLog(prev => [...prev, '', `🔄 Starting Batch Consolidation...`]);
    setZipBlob(null);

    try {
      const zip = new JSZip();
      const originalsFolder = zip.folder("Processed_Originals")!;

      // 1. Collect ALL filler cards from ALL analyzed files
      const fillerCards: string[] = [];

      for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];
        
        // Accumulate the extracted cards from the trailing pages
        for (const slot of analysis.slots) {
          if (!slot.isEmpty && slot.imageDataUrl) {
            fillerCards.push(slot.imageDataUrl);
          }
        }

        // Simultaneously modify the PDF file by stripping the last page
        addLog(`   → Removing last page from "${analysis.fileName}"...`);
        const arrayBuffer = await analysis.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        pdfDoc.removePage(pdfDoc.getPageCount() - 1);
        
        const modifiedPdfBytes = await pdfDoc.save();
        const outputFilename = analysis.fileName.replace(/\.pdf$/i, '_grouped.pdf');
        originalsFolder.file(outputFilename, modifiedPdfBytes);
      }

      const totalItems = fillerCards.length;
      addLog(`   → Total cards pooled: ${totalItems}`);

      // 2. Generate required A3 Template batches
      // We chunk the collected pool into capacities equal to the template's max grid size
      const primaryGrid = analyses[0].grid!;
      const maxCapacity = primaryGrid.rows * primaryGrid.cols;

      const generatedA3s: string[] = [];
      let itemsRemaining = totalItems;
      let chunkIdx = 0;

      addLog(`   → Template Capacity: ${maxCapacity} per sheet`);

      while (itemsRemaining > 0) {
        addLog(`   → Compositing Grouped Sheet ${chunkIdx + 1}...`);
        
        const chunkCards = fillerCards.slice(chunkIdx * maxCapacity, (chunkIdx + 1) * maxCapacity);
        itemsRemaining -= chunkCards.length;

        const a3Image = await compositeCardsOntoA3(
          chunkCards,
          primaryGrid,
          templateImage
        );
        generatedA3s.push(a3Image);
        chunkIdx++;
      }

      setPreviewImages(generatedA3s);

      // 3. Compile the generated A3 sheets into a single PDF
      if (generatedA3s.length > 0) {
        addLog(`   → Compiling grouped A3s into PDF...`);
        const groupedPdfDoc = await PDFDocument.create();
        for (const imgData of generatedA3s) {
          const imgBuffer = await fetch(imgData).then(res => res.arrayBuffer());
          const embedImg = await groupedPdfDoc.embedPng(imgBuffer);
          const page = groupedPdfDoc.addPage([primaryGrid.pageWidth, primaryGrid.pageHeight]);
          page.drawImage(embedImg, {
             x: 0, y: 0,
             width: primaryGrid.pageWidth,
             height: primaryGrid.pageHeight
          });
        }
        const groupedPdfBytes = await groupedPdfDoc.save();
        zip.file("Grouped_Output.pdf", groupedPdfBytes);
      }

      addLog(`   → Packaging ZIP Archive...`);
      const blob = await zip.generateAsync({ type: "blob" });
      setZipBlob(blob);

      addLog('');
      addLog('✅ Batch Grouping complete! ZIP ready for download.');
      toast.success('Layouts packaged successfully');
    } catch (error) {
      console.error(error);
      addLog(`❌ Error: ${(error as Error).message}`);
      toast.error('Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [analyses, templateImage]);

  const downloadZip = async () => {
    if (!zipBlob) return;
    try {
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Batch_Grouped_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('ZIP Downloaded!', { id: 'zip-export' });
    } catch (error) {
      console.error(error);
      toast.error('Download failed', { id: 'zip-export' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings & Upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-5 md:col-span-2 border-2 border-dashed border-slate-300 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center text-center">
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Upload PDF Files</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">The last page (and previous for double-sided) will be used to fill the A3 sheet.</p>
            <label className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 cursor-pointer transition-colors">
              <Upload size={14} />
              Browse Files
              <input type="file" className="hidden" accept=".pdf" multiple onChange={handleFilesUpload} />
            </label>
        </Card>

        <Card className="p-5 bg-white border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Layers size={16} className="text-indigo-600" /> Layout Settings
          </h3>
          
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 text-[10px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800 uppercase tracking-wider mb-1">Auto-Detected Specifications</p>
              <p>• Capacity: Extracted dynamically from page grid</p>
              <p>• Layout Model: Inferred based on vertical spans</p>
              <p>• Background Data: Maintained strictly from Page 1</p>
              <p>• Double-Sided Head-To-Head format automatically supported.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${i === 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700'}`}>
              <FileText size={14} />
              {file.name}
              {i === 0 && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full ml-1">PRIMARY</span>}
              <button onClick={() => removeFile(i)} className="ml-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      {files.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={analyzeFiles} disabled={isAnalyzing} className="gap-2 bg-slate-800 hover:bg-slate-900 text-white">
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Grid3x3 size={14} />}
            Analyze Files
          </Button>

          {analyses.length > 0 && (
            <Button onClick={processGrouping} disabled={isProcessing} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Process & Consolidate Batch
            </Button>
          )}

          {zipBlob && (
            <Button onClick={downloadZip} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200">
              <Download size={14} /> Download ZIP Archive
            </Button>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logs & Analysis */}
        <div className="space-y-4">
          {analyses.map((analysis, i) => (
            <Card key={i} className="p-4 bg-white border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className={i === 0 ? 'text-indigo-600' : 'text-slate-500'} />
                  <span className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{analysis.fileName}</span>
                </div>
                {i === 0 && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">PRIMARY</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2 rounded text-center">
                  <p className="text-[10px] text-slate-500">Filled Slots</p>
                  <p className="text-sm font-black text-slate-800">{analysis.filledCount}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded text-center">
                  <p className="text-[10px] text-slate-500">Empty Slots</p>
                  <p className="text-sm font-black text-amber-600">{analysis.emptyCount}</p>
                </div>
              </div>
            </Card>
          ))}

          {processLog.length > 0 && (
            <Card className="p-4 bg-slate-900 border-slate-800 max-h-64 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Process Log</p>
              <div className="space-y-0.5 font-mono">
                {processLog.map((log, i) => (
                  <p key={i} className={`text-[11px] ${log.startsWith('✅') ? 'text-emerald-400' : log.startsWith('❌') ? 'text-red-400' : 'text-slate-400'}`}>
                    {log || '\u00A0'}
                  </p>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Preview Area */}
        <Card className="p-5 bg-white border-slate-200 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4 border-b pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Info size={16} /> Print Template Previews
            </h3>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Templated Layout</span>
          </div>

          {previewImages.length > 0 ? (
            <div className="w-full flex flex-col items-center gap-4 max-h-[600px] overflow-y-auto p-2">
              {previewImages.map((imgSrc, idx) => (
                <div key={idx} className="relative group p-1 bg-slate-100 rounded-lg shadow-inner w-full max-w-[300px]">
                  <p className="text-center text-xs font-bold text-slate-400 mb-1">Sheet {idx + 1}</p>
                  <img 
                    src={imgSrc} 
                    alt={`A3 Output ${idx+1}`} 
                    className="w-full rounded shadow-md border border-white"
                  />
                  <div className="absolute inset-x-0 bottom-0 top-6 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors pointer-events-none rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-300">
              <Grid3x3 size={48} strokeWidth={1} />
              <p className="mt-4 text-sm font-medium">No previews generated</p>
              <p className="text-[11px] mt-1 text-center max-w-xs">Template layouts will be populated here after processing the batch</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CardGroupingTab;
