import React, { useState, useCallback, useEffect } from 'react';
import { useConfiguratorStore } from '../../../store/useConfiguratorStore';
import IdCardPreview from '../IdCardPreview';
import { Layers, Database, Type, Image as ImageIcon, QrCode, Barcode, ChevronRight, Maximize2, Move, Grid3x3, Columns, ImagePlus, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Stage, Layer, Group, Line } from 'react-konva';
import { getBatchImageKeys, hydrateBatchImageStore } from './SetupMode';
import FontBar from './FontBar';

const AVAILABLE_FRAMES = [
  { id: 'rect', label: 'Square', icon: '■' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'hexagon', label: 'Hexagon', icon: '⬢' },
  { id: 'star', label: 'Star', icon: '★' },
  { id: 'blob', label: 'Liquid', icon: '☁' },
  { id: 'heart', label: 'Heart', icon: '♥' },
  { id: 'diamond', label: 'Diamond', icon: '◆' },
  { id: 'pill', label: 'Pill', icon: '▬' },
  { id: 'shield', label: 'Shield', icon: '🛡️' },
  { id: 'cloud', label: 'Cloud', icon: '☁️' },
  { id: 'badge', label: 'Badge', icon: '🔆' },
  { id: 'cross', label: 'Cross', icon: '✚' },
  { id: 'arrow-right', label: 'Arw R', icon: '➜' },
  { id: 'arrow-left', label: 'Arw L', icon: '⬅' },
  { id: 'arrow-up', label: 'Arw U', icon: '⬆' },
  { id: 'arrow-down', label: 'Arw D', icon: '⬇' },
  { id: 'poly-3', label: 'Tri', icon: '▲' },
  { id: 'poly-5', label: 'Pent', icon: '⬠' },
  { id: 'poly-7', label: 'Hept', icon: '⬡' },
  { id: 'poly-8', label: 'Oct', icon: 'meta' },
  { id: 'star-3', label: 'Star3', icon: '▲' },
  { id: 'star-4', label: 'Star4', icon: '✦' },
  { id: 'star-6', label: 'Star6', icon: '✶' },
  { id: 'star-8', label: 'Star8', icon: '✴' },
  { id: 'star-12', label: 'Star12', icon: '❂' },
  // Adding more to reach 50...
  { id: 'poly-4', label: 'Rect', icon: '▭' },
  { id: 'poly-9', label: 'Non', icon: '⬡' },
  { id: 'poly-10', label: 'Dec', icon: '⬡' },
  { id: 'star-5', label: 'Star5', icon: '★' },
  { id: 'star-7', label: 'Star7', icon: '✴' },
  { id: 'star-9', label: 'Star9', icon: '✵' },
  { id: 'star-10', label: 'Star10', icon: '✺' },
  { id: 'star-11', label: 'Star11', icon: '🌟' },
  { id: 'chevron-right', label: 'Chv R', icon: '❯' },
  { id: 'chevron-left', label: 'Chv L', icon: '❮' },
  { id: 'chevron-up', label: 'Chv U', icon: '︿' },
  { id: 'chevron-down', label: 'Chv D', icon: '﹀' },
  { id: 'moon', label: 'Moon', icon: '🌙' },
  { id: 'sun', label: 'Sun', icon: '☀️' },
  { id: 'tag', label: 'Tag', icon: '🏷️' },
  { id: 'flag', label: 'Flag', icon: '🚩' },
  { id: 'marker', label: 'Pin', icon: '📍' },
  { id: 'message', label: 'Chat', icon: '💬' },
  { id: 'thought', label: 'Think', icon: '💭' },
  { id: 'quote', label: 'Quote', icon: '＂' },
  { id: 'seal', label: 'Seal', icon: '💮' },
  { id: 'poly-6', label: 'Hexagon', icon: '⬢' },
  { id: 'poly-11', label: 'Hend', icon: '⬡' },
  { id: 'poly-12', label: 'Dod', icon: '⬡' },
  { id: 'burst-1', label: 'Burst1', icon: '💥' },
  { id: 'leaf-1', label: 'Leaf1', icon: '🍃' },
];

export default function DesignMode({ stageRef, idCardStageRef, zoom, setZoom }: any) {
  const design = useConfiguratorStore(state => state.design);
  const setField = useConfiguratorStore(state => state.setField);
  const { mapping, datasetColumns } = design.idCard.bulkWorkflow;
  const activeSide = design.idCard.activeSide;
  const elements = design.idCard[activeSide].elements;

  const [activeTab, setActiveTab] = useState<'headers' | 'layers' | 'frames'>('headers');

  // Hydrate batchImageStore from Zustand on mount (ensures photos survive mode transitions & HMR)
  useEffect(() => {
    const storeImgs = design.idCard.bulkWorkflow.datasetImages || {};
    const storeKeys = Object.keys(storeImgs);
    const batchKeys = getBatchImageKeys();
    if (storeKeys.length > 0 && batchKeys.length === 0) {
      hydrateBatchImageStore(storeImgs);
    }
  }, []);

  const [editingText, setEditingText] = useState<any>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<number[]>([]);

  const { width, height } = React.useMemo(() => {
    switch (design.idCard.size) {
      case '100x70': return { width: 283, height: 198 };
      case '70x100': return { width: 198, height: 283 };
      case '54x86': return { width: 153, height: 244 };
      default: return { width: 244, height: 153 }; // 86x54
    }
  }, [design.idCard.size]);

  const padding = 80;
  const stageWidth = 800;
  const stageHeight = 700;
  
  const baseScale = Math.min(
    (stageWidth - padding) / width,
    (stageHeight - padding) / height
  );
  const scale = baseScale * zoom;
  const cx = (stageWidth - width * scale) / 2;
  const cy = (stageHeight - height * scale) / 2;

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
    setZoom(Math.min(Math.max(newZoom, 0.1), 5));
  }, [zoom, setZoom]);

  const resetView = useCallback(() => {
    setStagePos({ x: 0, y: 0 });
    setZoom(1);
  }, [setZoom]);

  const addFrame = (shapeType: string) => {
    const newId = `frame-${Date.now()}`;
    const newElement: any = {
      id: newId,
      type: 'frame',
      shapeType,
      x: Math.round(width / 2 - 40),
      y: Math.round(height / 2 - 40),
      width: 80,
      height: 80,
    };
    setField(`idCard.${activeSide}.elements`, [...elements, newElement]);
    setField('idCard.selected', newId);
  };

  const spawnElement = (columnName: string, type: 'text' | 'qr' | 'barcode' | 'image' | 'frame' = 'text') => {
    const newId = `field-${Date.now()}`;
    const textWidth = Math.round(width * 0.85);
    
    // Check if this column is the photo-matching column
    const isPhotoCol = columnName === design.idCard.bulkWorkflow.imageMatchColumn;
    
    const newElement: any = {
      id: newId,
      type: type,
      x: type === 'text' ? Math.round((width - textWidth) / 2) : Math.round(width / 2 - (type === 'image' ? 40 : 25)),
      y: type === 'image' ? Math.round(height * 0.15) : height / 2 - 10,
      content: columnName,
    };

    if (type === 'text') {
      newElement.width = textWidth;
      newElement.fontSize = 12;
      newElement.fontFamily = design.idCard.defaultFontFamily || 'Montserrat';
      newElement.fill = design.idCard.defaultColor || '#1e293b';
      newElement.align = 'center';
      newElement.fontStyle = 'bold';
    } else if (type === 'image') {
      // Larger default for photo elements so they're visible
      newElement.width = isPhotoCol ? 80 : 60;
      newElement.height = isPhotoCol ? 90 : 60;
      newElement.cornerRadius = isPhotoCol ? 6 : 0;
    } else {
      newElement.width = 50;
      newElement.height = 50;
    }

    setField(`idCard.${activeSide}.elements`, [...elements, newElement]);
    setField(`idCard.bulkWorkflow.mapping`, { ...mapping, [newId]: columnName });
    setField('idCard.selected', newId);
  };

  const handleStaticImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newId = `img-static-${Date.now()}`;
      const newElement: any = {
        id: newId,
        type: 'image',
        x: width / 2 - 25,
        y: height / 2 - 25,
        width: 50,
        height: 50,
        src: event.target?.result as string,
      };
      setField(`idCard.${activeSide}.elements`, [...elements, newElement]);
      setField('idCard.selected', newId);
    };
    reader.readAsDataURL(file);
  };

  const addStaticText = () => {
    const newId = `text-static-${Date.now()}`;
    const textWidth = Math.round(width * 0.85);
    const newElement: any = {
      id: newId,
      type: 'text',
      x: Math.round((width - textWidth) / 2),
      y: height / 2 - 10,
      width: textWidth,
      content: 'Double click to edit',
      fontSize: 12,
      fontFamily: design.idCard.defaultFontFamily || 'Montserrat',
      fill: design.idCard.defaultColor || '#1e293b',
      align: 'center',
      fontStyle: 'bold',
    };
    setField(`idCard.${activeSide}.elements`, [...elements, newElement]);
    setField('idCard.selected', newId);
  };

  const handleMouseDown = (e: any) => {
    if (!isDrawingMode) return;
    
    setIsDrawing(true);
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    // Convert absolute to group-relative
    const group = stage.findOne('#card-group');
    if (!group) return;
    const transform = group.getAbsoluteTransform().copy();
    transform.invert();
    const relativePos = transform.point(pos);

    setDrawingPoints([relativePos.x, relativePos.y]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawingMode || !isDrawing) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const group = stage.findOne('#card-group');
    if (!group) return;
    const transform = group.getAbsoluteTransform().copy();
    transform.invert();
    const relativePos = transform.point(pos);

    setDrawingPoints(prev => [...prev, relativePos.x, relativePos.y]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (drawingPoints.length < 4) {
      setDrawingPoints([]);
      return;
    }

    // Normalize points: make x,y the top-left and shift all points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < drawingPoints.length; i += 2) {
      minX = Math.min(minX, drawingPoints[i]);
      minY = Math.min(minY, drawingPoints[i+1]);
      maxX = Math.max(maxX, drawingPoints[i]);
      maxY = Math.max(maxY, drawingPoints[i+1]);
    }

    const newId = `line-${Date.now()}`;
    const line: any = {
      id: newId,
      type: 'line',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      points: drawingPoints.map((p: number, i: number) => i % 2 === 0 ? p - minX : p - minY),
      stroke: '#5d5fef',
      strokeWidth: 2,
      tension: 0.5,
      lineCap: 'round',
      lineJoin: 'round',
      closed: true,
    };
    
    setField(`idCard.${activeSide}.elements`, [...elements, line]);
    setField('idCard.selected', newId);
    setDrawingPoints([]);
  };

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-72 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 shrink-0">
        <div className="flex px-4 py-3 border-b border-slate-100 gap-1">
          <button onClick={() => setActiveTab('headers')} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-lg transition-all ${activeTab === 'headers' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>Headers</button>
          <button onClick={() => setActiveTab('frames')} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-lg transition-all ${activeTab === 'frames' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>Frames</button>
          <button onClick={() => setActiveTab('layers')} className={`flex-1 text-[10px] font-black uppercase py-2 rounded-lg transition-all ${activeTab === 'layers' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>Layers</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'headers' && (
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Dataset Columns</div>
              {datasetColumns.map((col: string) => {
                const isMapped = Object.values(mapping).includes(col);
                return (
                  <div key={col} className={`p-3 rounded-xl border-2 transition-all group ${isMapped ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md cursor-pointer'}`}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-bold text-slate-700 truncate">{col}</span>
                       {isMapped && <span className="text-[10px] font-bold text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-100">Added</span>}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-2">
                      <button onClick={() => spawnElement(col, 'text')} className="flex-1 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-bold flex flex-col items-center"><Type size={12}/> Text</button>
                      <button onClick={() => spawnElement(col, 'image')} className="flex-1 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-bold flex flex-col items-center"><ImageIcon size={12}/> Image</button>
                      <button onClick={() => spawnElement(col, 'qr')} className="flex-1 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-bold flex flex-col items-center"><QrCode size={12}/> QR</button>
                      <button onClick={() => spawnElement(col, 'barcode')} className="flex-1 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-bold flex flex-col items-center"><Barcode size={12}/> Bar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {activeTab === 'frames' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-black uppercase text-slate-400">Image Frames (Masks)</div>
                <button 
                  onClick={() => setIsDrawingMode(!isDrawingMode)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${isDrawingMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isDrawingMode ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                  {isDrawingMode ? 'Stop Drawing' : 'Draw'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                {AVAILABLE_FRAMES.map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => {
                        setIsDrawingMode(false);
                        addFrame(frame.id);
                    }}
                    className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all group aspect-square"
                    title={frame.label}
                  >
                    <span className="text-xl text-slate-400 group-hover:text-indigo-400 mb-1 transition-colors">{frame.icon}</span>
                    <span className="text-[8px] font-bold text-slate-400 group-hover:text-indigo-600 truncate w-full text-center px-0.5">{frame.label}</span>
                  </button>
                ))}
              </div>
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <p className="text-[10px] text-indigo-600 font-medium leading-relaxed">
                  <strong>Pro Tip:</strong> Select a frame, then drag an image into it. Or use <strong>"Draw"</strong> to create a custom mask!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'layers' && (
            <div className="space-y-2">
               <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                 <button onClick={() => setField('idCard.activeSide', 'front')} className={`text-[11px] font-bold ${activeSide === 'front' ? 'text-indigo-600' : 'text-slate-400'}`}>FRTSIDE</button>
                 <button onClick={() => setField('idCard.activeSide', 'back')} className={`text-[11px] font-bold ${activeSide === 'back' ? 'text-indigo-600' : 'text-slate-400'}`}>BAKSIDE</button>
               </div>
               {[...elements].reverse().map((el, i) => (
                 <div key={el.id} onClick={() => setField('idCard.selected', el.id)} className={`p-2 rounded-lg flex items-center justify-between cursor-pointer border ${design.idCard.selected === el.id ? 'border-indigo-400 bg-indigo-50/50' : 'border-transparent hover:bg-slate-50'}`}>
                   <div className="flex items-center gap-2">
                     {el.type === 'text' ? <Type size={14} className="text-slate-400"/> : el.type === 'qr' ? <QrCode size={14} className="text-slate-400"/> : <ImageIcon size={14} className="text-slate-400"/>}
                     <span className="text-xs font-medium text-slate-700 truncate w-32">{mapping[el.id] || el.type}</span>
                   </div>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace (Canvas) */}
      <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
        {/* Workspace formatting toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white/90 backdrop-blur border border-slate-200 shadow-sm p-1 rounded-xl">
          <button onClick={() => setField('idCard.size', '54x86')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${design.idCard.size === '54x86' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Portrait</button>
          <button onClick={() => setField('idCard.size', '86x54')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${design.idCard.size === '86x54' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Landscape</button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <FontBar />
        </div>

        {/* The zooming workspace area — freely draggable */}
        <div className="w-full h-full bg-white rounded-3xl shadow-xl flex items-center justify-center overflow-hidden border border-white/50 relative p-10 mt-10">
          <Stage
            width={stageWidth}
            height={stageHeight}
            ref={stageRef}
            draggable={!isDrawingMode}
            x={stagePos.x}
            y={stagePos.y}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage()) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ cursor: isDrawingMode ? 'crosshair' : 'grab' }}
          >
            <Layer>
              <Group id="card-group" x={cx} y={cy} scaleX={scale} scaleY={scale}>
                <IdCardPreview 
                  isReviewStep={false}
                  record={design.idCard.bulkWorkflow.datasetRecords?.[design.idCard.bulkWorkflow.sampleRecordIndex || 0]}
                  mapping={mapping}
                  onSelectElement={(id, sideName) => {
                    setField('idCard.selected', id);
                    if (sideName) setField('idCard.activeSide', sideName);
                  }}
                  onUpdateElement={(id, pos, sideName) => {
                    const side = sideName || activeSide;
                    const els = design.idCard[side].elements;
                    const movedEl = els.find((e: any) => e.id === id);
                    
                    if (movedEl?.type === 'image' && (pos.x !== undefined || pos.y !== undefined)) {
                      const updatedEl = { ...movedEl, ...pos };
                      const centerX = updatedEl.x + (updatedEl.width || 0) / 2;
                      const centerY = updatedEl.y + (updatedEl.height || 0) / 2;
                      
                      const targetFrame = els.find((e: any) => 
                        (e.type === 'frame' || e.type === 'line') && 
                        centerX > e.x && centerX < e.x + (e.width ?? 100) &&
                        centerY > e.y && centerY < e.y + (e.height ?? 100)
                      );
                      
                      if (targetFrame) {
                        // Transfer src and mapping
                        const newEls = els.filter((e: any) => e.id !== id).map((e: any) => {
                          if (e.id === targetFrame.id) {
                            return { ...e, src: movedEl.src };
                          }
                          return e;
                        });
                        
                        // Transfer mapping if exists
                        const imgMapping = mapping[id];
                        if (imgMapping) {
                           const newMapping = { ...mapping };
                           delete newMapping[id];
                           newMapping[targetFrame.id] = imgMapping;
                           setField('idCard.bulkWorkflow.mapping', newMapping);
                        }
                        
                        setField(`idCard.${side}.elements`, newEls);
                        setField('idCard.selected', targetFrame.id);
                        return;
                      }
                    }
                    
                    setField(`idCard.${side}.elements`, els.map((e: any) => e.id === id ? { ...e, ...pos } : e));
                  }}
                onDblClickElement={(id: string, sideName: string, e: any) => {
                  const side = sideName || activeSide;
                  const el = design.idCard[side].elements.find((el: any) => el.id === id);
                  if (!el) return;
                  if (el.type === 'text') {
                    const node = e.target;
                    const textPosition = node.absolutePosition();
                    const absScaleY = node.getAbsoluteScale().y;
                    const absScaleX = node.getAbsoluteScale().x;
                    
                    // Convert Konva's absolute stage coords to Container coords
                    const stageBox = stageRef.current.container().getBoundingClientRect();

                    setEditingText({
                      id, side, value: el.content, fontStyle: el.fontStyle, color: el.fill, align: el.align || 'left',
                      fontFamily: el.fontFamily || 'sans-serif',
                      fontSize: (el.fontSize || 12) * absScaleY, 
                      x: stageBox.left + textPosition.x, 
                      y: stageBox.top + textPosition.y,
                      width: node.width() * absScaleX + 10, 
                      height: node.height() * absScaleY + 10,
                    });
                  }
                }}
              />
              {isDrawing && drawingPoints.length > 2 && (
                <Line
                  points={drawingPoints}
                  stroke="#5d5fef"
                  strokeWidth={2}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  closed
                  opacity={0.5}
                />
              )}
              </Group>
            </Layer>
          </Stage>
          {editingText && (
            <textarea
              value={editingText.value}
              onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
              onBlur={() => {
                const els = design.idCard[editingText.side].elements;
                setField(`idCard.${editingText.side}.elements`, els.map((el: any) => el.id === editingText.id ? { ...el, content: editingText.value } : el));
                setEditingText(null);
              }}
              autoFocus
              style={{
                position: 'fixed',
                top: editingText.y, left: editingText.x, width: editingText.width, height: editingText.height,
                fontSize: editingText.fontSize, fontFamily: editingText.fontFamily || 'sans-serif', fontWeight: editingText.fontStyle?.includes('bold') ? 'bold' : 'normal',
                color: editingText.color, background: 'rgba(255, 255, 255, 0.8)', border: '2px solid #5d5fef', zIndex: 100,
                outline: 'none', resize: 'none'
              }}
            />
          )}
        </div>
      </div>

      {/* Right Sidebar Toolbar */}
      <div className="w-16 bg-white border-l border-slate-200 shadow-sm flex flex-col z-10 shrink-0 items-center py-4 space-y-4">
        {/* Toggle Grid */}
        <button 
          onClick={() => setField('idCard.showGrid', !design.idCard.showGrid)}
          className={`p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group ${design.idCard.showGrid ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
          title="Toggle Grid Lines"
        >
          <Grid3x3 size={20} />
          <span className="text-[9px] font-bold group-hover:block transition-all text-center leading-tight">Grid</span>
        </button>

        {/* Toggle Both Sides */}
        <button 
          onClick={() => setField('idCard.showBothSides', !design.idCard.showBothSides)}
          className={`p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group ${design.idCard.showBothSides ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
          title="Toggle Two-Side Printing View"
        >
          <Columns size={20} />
          <span className="text-[9px] font-bold group-hover:block transition-all text-center leading-tight">2-Side</span>
        </button>

        <div className="w-8 h-[1px] bg-slate-100 my-1"></div>

        {/* Upload Image */}
        <label className="p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer" title="Add Static Image">
          <input type="file" accept="image/*" className="hidden" onChange={handleStaticImageUpload} />
          <ImagePlus size={20} />
          <span className="text-[9px] font-bold group-hover:block transition-all text-center leading-tight">Image</span>
        </label>

        {/* Add Text */}
        <button 
          onClick={addStaticText}
          className="p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
          title="Add Static Text"
        >
          <Type size={20} />
          <span className="text-[9px] font-bold group-hover:block transition-all text-center leading-tight">Text</span>
        </button>

        <div className="w-8 h-[1px] bg-slate-100 my-1"></div>

        {/* Zoom Controls */}
        <button 
          onClick={() => setZoom(Math.min(zoom + 0.1, 5))}
          className="p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
        <span className="text-[10px] font-bold text-slate-500">{Math.round(zoom * 100)}%</span>
        <button 
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.1))}
          className="p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>

        <div className="w-8 h-[1px] bg-slate-100 my-1"></div>

        {/* Reset View */}
        <button 
          onClick={resetView}
          className="p-2.5 rounded-xl transition-all flex flex-col items-center gap-1 group text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          title="Reset View"
        >
          <RotateCcw size={20} />
          <span className="text-[9px] font-bold group-hover:block transition-all text-center leading-tight">Reset</span>
        </button>
      </div>

    </div>
  );
}
