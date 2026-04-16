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

const CardGroupingTab: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [analyses, setAnalyses] = useState<FileAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('single');

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;
    setFiles(prev => [...prev, ...newFiles]);
    setAnalyses([]);
    setPreviewImage(null);
    setProcessLog([]);
    toast.success(`${newFiles.length} file(s) added`);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setAnalyses([]);
    setPreviewImage(null);
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
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        addLog(`📄 Analyzing "${file.name}"...`);

        const totalPages = await getPDFPageCount(file);
        addLog(`   → ${totalPages} page(s) found`);

        if (groupingMode === 'double' && totalPages < 2) {
          addLog(`   ⚠️ Warning: File "${file.name}" has only 1 page but Double-Sided mode is active.`);
        }

        // Get the relevant pages for analysis
        // For Single: Just the last page
        // For Double: Last page (Fronts) and Second-to-last (Backs) or vice versa?
        // Let's assume the very last page is the one we analyze for the grid
        const lastPageIdx = totalPages;
        const lastPageImage = await loadPDFPageAsImage(file, lastPageIdx);
        
        addLog(`   → Detecting grid on last page (CR80 Standard)...`);
        const grid = await detectCardGrid(lastPageImage);
        addLog(`   → Grid: ${grid.rows}×${grid.cols} detected`);

        addLog(`   → Extracting slots...`);
        const slots = await analyzePageSlots(lastPageImage, grid);

        // If Double Sided, also extract backs from the previous page
        if (groupingMode === 'double' && totalPages >= 2) {
          addLog(`   → Extracting Back images from page ${totalPages - 1}...`);
          const backPageImage = await loadPDFPageAsImage(file, totalPages - 1);
          const backSlots = await analyzePageSlots(backPageImage, grid);
          for (let s = 0; s < slots.length; s++) {
            if (!slots[s].isEmpty && backSlots[s]) {
              slots[s].backImageDataUrl = backSlots[s].imageDataUrl;
            }
          }
        }

        const filledCount = slots.filter(s => !s.isEmpty).length;
        const emptyCount = slots.filter(s => s.isEmpty).length;
        addLog(`   → ${filledCount} filled slots recorded`);

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
      addLog('✅ Analysis complete!');
      toast.success('All files analyzed');
    } catch (error) {
      console.error(error);
      addLog(`❌ Error: ${(error as Error).message}`);
      toast.error('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, groupingMode]);

  const processGrouping = useCallback(async () => {
    if (analyses.length === 0) return;

    setIsProcessing(true);
    setProcessLog(prev => [...prev, '', `🔄 Processing ${groupingMode}-sided grouping...`]);

    try {
      const primary = analyses[0];

      // Collect filler cards/sets from other files
      const fillerCards: string[] = [];
      const fillerSets: { front: string; back: string }[] = [];

      for (let i = 1; i < analyses.length; i++) {
        const analysis = analyses[i];
        addLog(`   → Collecting from "${analysis.fileName}"...`);

        for (const slot of analysis.slots) {
          if (!slot.isEmpty && slot.imageDataUrl) {
            if (groupingMode === 'single') {
              fillerCards.push(slot.imageDataUrl);
            } else if (slot.backImageDataUrl) {
              fillerSets.push({ front: slot.imageDataUrl, back: slot.backImageDataUrl });
            }
          }
        }
      }

      // Fill empty slots on primary with fillers
      const currentSlots = [...primary.slots];
      let fillCount = 0;

      for (let i = 0; i < currentSlots.length; i++) {
        if (currentSlots[i].isEmpty) {
          if (groupingMode === 'single' && fillerCards.length > 0) {
            const card = fillerCards.shift()!;
            currentSlots[i] = { ...currentSlots[i], isEmpty: false, imageDataUrl: card };
            fillCount++;
          } else if (groupingMode === 'double' && fillerSets.length > 0) {
            const set = fillerSets.shift()!;
            currentSlots[i] = { 
              ...currentSlots[i], 
              isEmpty: false, 
              imageDataUrl: set.front, 
              backImageDataUrl: set.back 
            };
            fillCount++;
          }
        }
      }

      addLog(`   → Filled ${fillCount} empty slots with borrowed cards.`);
      addLog(`   → Compositing A3 sheet (${groupingMode === 'single' ? '5×4' : '5×2 Sets'})...`);

      const a3Image = await compositeCardsOntoA3(
        currentSlots,
        groupingMode === 'single' ? fillerCards : fillerSets.flatMap(s => [s.front, s.back]),
        groupingMode
      );

      setPreviewImage(a3Image);
      addLog('');
      addLog('✅ Grouping complete! A3 Preview generated.');
      toast.success('Layout generated successfully');
    } catch (error) {
      console.error(error);
      addLog(`❌ Error: ${(error as Error).message}`);
      toast.error('Processing failed');
    } finally {
      setIsProcessing(false);
    }
  }, [analyses, groupingMode]);

  const downloadA3 = async () => {
    if (!previewImage) return;
    try {
      toast.loading('Exporting A3...', { id: 'a3-export' });
      await exportCanvasToPDF(previewImage, A3_WIDTH_PT, A3_HEIGHT_PT, `grouped_${groupingMode}_A3.pdf`);
      toast.success('A3 PDF downloaded!', { id: 'a3-export' });
    } catch (error) {
      console.error(error);
      toast.error('Export failed', { id: 'a3-export' });
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Grouping Mode</Label>
                <p className="text-[10px] text-slate-500">
                  {groupingMode === 'single' ? 'Single Sided (5×4)' : 'Double Sided (5×2 Sets)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${groupingMode === 'single' ? 'text-indigo-600' : 'text-slate-400'}`}>SINGLE</span>
                <Switch 
                  checked={groupingMode === 'double'} 
                  onCheckedChange={(checked) => setGroupingMode(checked ? 'double' : 'single')}
                />
                <span className={`text-[10px] font-bold ${groupingMode === 'double' ? 'text-indigo-600' : 'text-slate-400'}`}>DOUBLE</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 text-[10px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800 uppercase tracking-wider mb-1">Sheet Specifications</p>
              {groupingMode === 'single' ? (
                <>
                  <p>• Capacity: 20 Cards per A3</p>
                  <p>• Grid: 5 Columns × 4 Rows</p>
                  <p>• Card Size: 54×86mm (Fixed)</p>
                </>
              ) : (
                <>
                  <p>• Capacity: 10 Sets per A3</p>
                  <p>• Grid: 5 Columns × 2 Rows of Sets</p>
                  <p>• Set: Front and Back stacked vertically</p>
                </>
              )}
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
              Process & Generate A3
            </Button>
          )}

          {previewImage && (
            <Button onClick={downloadA3} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200">
              <Download size={14} /> Download A3 PDF
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
              <Info size={16} /> A3 Output Preview
            </h3>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">A3 PORTRAIT • CR80 STANDARD</span>
          </div>

          {previewImage ? (
            <div className="relative group p-1 bg-slate-100 rounded-lg shadow-inner">
              <img 
                src={previewImage} 
                alt="A3 Output" 
                className="max-w-full max-h-[600px] rounded shadow-2xl border border-white"
                style={{ aspectRatio: '297 / 420' }}
              />
              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors pointer-events-none rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-300">
              <Grid3x3 size={48} strokeWidth={1} />
              <p className="mt-4 text-sm font-medium">No preview generated yet</p>
              <p className="text-[11px] mt-1">Upload primary and filler PDFs to see the result</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CardGroupingTab;
