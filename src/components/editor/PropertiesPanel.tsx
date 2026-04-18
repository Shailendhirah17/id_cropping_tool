import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Layers, Lock, Unlock, Eye, EyeOff, Trash2,
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignEndVertical, AlignCenterVertical
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PropertiesPanelProps {
  canvas: any; // fabric.Canvas
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ canvas }) => {
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [layers, setLayers] = useState<any[]>([]);
  const [properties, setProperties] = useState({
    fontSize: 20,
    fill: '#000000',
    opacity: 1,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    text: '',
    textAlign: 'left',
  });

  const updateLayers = useCallback(() => {
    if (!canvas) return;
    const objects = canvas.getObjects().reverse();
    setLayers(
      objects.map((obj: any, index: number) => ({
        id: obj.name || `Layer ${objects.length - index}`,
        type: obj.type,
        locked: !obj.selectable,
        visible: obj.visible !== false,
        ref: obj,
      }))
    );
  }, [canvas]);

  const updateProperties = useCallback(() => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      setSelectedObject(active);
      setProperties({
        fontSize: active.fontSize || 20,
        fill: active.fill || '#000000',
        opacity: active.opacity ?? 1,
        left: Math.round(active.left || 0),
        top: Math.round(active.top || 0),
        width: Math.round((active.width || 0) * (active.scaleX || 1)),
        height: Math.round((active.height || 0) * (active.scaleY || 1)),
        text: active.text || '',
        textAlign: active.textAlign || 'left',
      });
    } else {
      setSelectedObject(null);
    }
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;

    const handlers = {
      'object:added': updateLayers,
      'object:removed': updateLayers,
      'object:modified': () => { updateLayers(); updateProperties(); },
      'selection:created': updateProperties,
      'selection:updated': updateProperties,
      'selection:cleared': () => setSelectedObject(null),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      canvas.on(event, handler);
    });

    updateLayers();

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        canvas.off(event, handler);
      });
    };
  }, [canvas, updateLayers, updateProperties]);

  const handlePropertyChange = (key: string, value: any) => {
    if (!selectedObject || !canvas) return;

    if (key === 'text') {
      selectedObject.set({ text: value });
    } else if (key === 'textAlign') {
      selectedObject.set({ textAlign: value });
    } else if (key === 'fontSize') {
      selectedObject.set({ fontSize: Number(value) });
    } else if (key === 'fill') {
      selectedObject.set({ fill: value });
    } else if (key === 'opacity') {
      selectedObject.set({ opacity: Number(value) });
    } else if (key === 'left') {
      selectedObject.set({ left: Number(value) });
    } else if (key === 'top') {
      selectedObject.set({ top: Number(value) });
    }

    canvas.requestRenderAll();
    setProperties((prev: typeof properties) => ({ ...prev, [key]: value }));
  };

  const handleDelete = () => {
    if (!selectedObject || !canvas) return;
    canvas.remove(selectedObject);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelectedObject(null);
  };

  const toggleLock = (layer: any) => {
    layer.ref.set({ selectable: layer.locked, evented: layer.locked });
    canvas?.requestRenderAll();
    updateLayers();
  };

  const toggleVisibility = (layer: any) => {
    layer.ref.set({ visible: !layer.visible });
    canvas?.requestRenderAll();
    updateLayers();
  };

  const alignObject = (type: string) => {
    if (!selectedObject || !canvas) return;

    const canvasWidth = canvas.width!;
    const canvasHeight = canvas.height!;
    const objWidth = selectedObject.getScaledWidth();
    const objHeight = selectedObject.getScaledHeight();

    switch (type) {
      case 'left': selectedObject.set({ left: 0 }); break;
      case 'center': selectedObject.set({ left: (canvasWidth - objWidth) / 2 }); break;
      case 'right': selectedObject.set({ left: canvasWidth - objWidth }); break;
      case 'top': selectedObject.set({ top: 0 }); break;
      case 'middle': selectedObject.set({ top: (canvasHeight - objHeight) / 2 }); break;
      case 'bottom': selectedObject.set({ top: canvasHeight - objHeight }); break;
    }

    canvas.requestRenderAll();
    updateProperties();
  };

  return (
    <div className="w-72 flex flex-col gap-4 overflow-y-auto max-h-full">
      {/* Properties Panel */}
      {selectedObject && (
        <Card className="p-4 bg-white shadow-sm border-slate-200">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
            Properties
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={handleDelete}
              title="Delete selected"
            >
              <Trash2 size={12} />
            </Button>
          </h3>

          <div className="space-y-3">
            {/* Text Content */}
            {selectedObject.type === 'i-text' && (
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Text Content</label>
                <textarea
                  value={properties.text}
                  onChange={(e) => handlePropertyChange('text', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs min-h-[60px]"
                />
              </div>
            )}

            {/* Font Size (only for text) */}
            {selectedObject.type === 'i-text' && (
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Font Size</label>
                <input
                  type="number"
                  value={properties.fontSize}
                  onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  min={8}
                  max={200}
                />
              </div>
            )}

            {/* Color */}
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={typeof properties.fill === 'string' ? properties.fill : '#000000'}
                  onChange={(e) => handlePropertyChange('fill', e.target.value)}
                  className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                />
                <span className="text-xs text-slate-600 font-mono">
                  {typeof properties.fill === 'string' ? properties.fill : '#000000'}
                </span>
              </div>
            </div>

            {/* Opacity */}
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Opacity ({Math.round(properties.opacity * 100)}%)
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={properties.opacity}
                onChange={(e) => handlePropertyChange('opacity', e.target.value)}
                className="w-full mt-1"
              />
            </div>

            <Separator />

            {/* Text Justification */}
            {selectedObject.type === 'i-text' && (
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2 block">Text Align</label>
                <div className="flex gap-1">
                  <Button variant={properties.textAlign === 'left' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handlePropertyChange('textAlign', 'left')} title="Justify Left"><AlignLeft size={14}/></Button>
                  <Button variant={properties.textAlign === 'center' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handlePropertyChange('textAlign', 'center')} title="Justify Center"><AlignCenter size={14}/></Button>
                  <Button variant={properties.textAlign === 'right' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handlePropertyChange('textAlign', 'right')} title="Justify Right"><AlignRight size={14}/></Button>
                </div>
              </div>
            )}

            {/* Page Alignment */}
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2 block">Page Alignment</label>
              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignObject('left')} title="Align Left"><AlignLeft size={14}/></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignObject('center')} title="Align Center"><AlignCenter size={14}/></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignObject('right')} title="Align Right"><AlignRight size={14}/></Button>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignObject('top')} title="Align Top"><AlignStartVertical size={14}/></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignObject('middle')} title="Align Middle"><AlignCenterVertical size={14}/></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alignObject('bottom')} title="Align Bottom"><AlignEndVertical size={14}/></Button>
              </div>
            </div>

            <Separator />

            {/* Position */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">X</label>
                <input
                  type="number"
                  value={properties.left}
                  onChange={(e) => handlePropertyChange('left', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Y</label>
                <input
                  type="number"
                  value={properties.top}
                  onChange={(e) => handlePropertyChange('top', e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Size (read-only) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">W</label>
                <div className="mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
                  {properties.width}px
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">H</label>
                <div className="mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
                  {properties.height}px
                </div>
              </div>
            </div>

            {/* Replace Image Button */}
            {selectedObject.type === 'image' && (
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  className="w-full text-xs h-8 border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/50"
                  onClick={() => {
                    // Trigger the same image replacement logic inside the canvas context
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const dataUrl = evt.target?.result as string;
                        // Use a custom event to tell the parent editor to handle the replacement
                        canvas.fire('custom:replace_image', { target: selectedObject, dataUrl, file });
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                >
                  Replace Image
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Layer Manager */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-white shadow-sm border-slate-200">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Layers size={14} /> Layers
          </h3>
          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
            {layers.length}
          </span>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {layers.length === 0 ? (
            <div className="text-[11px] text-slate-400 text-center py-8">No layers yet</div>
          ) : (
            layers.map((layer, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded-lg text-[11px] border transition-all cursor-pointer ${
                  layer.locked
                    ? 'bg-slate-50/50 border-transparent text-slate-400'
                    : 'bg-white border-slate-100 text-slate-700 shadow-sm hover:border-indigo-200'
                }`}
                onClick={() => {
                  if (canvas && !layer.locked) {
                    canvas.setActiveObject(layer.ref);
                    canvas.requestRenderAll();
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${layer.locked ? 'bg-slate-300' : 'bg-indigo-400'}`} />
                  <span className="font-semibold capitalize truncate max-w-[120px]">
                    {layer.type === 'i-text'
                      ? layer.ref.text?.substring(0, 15) || 'Text'
                      : layer.id || layer.type}
                  </span>
                </div>

                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-indigo-600"
                    onClick={(e) => { e.stopPropagation(); toggleVisibility(layer); }}
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-amber-600"
                    onClick={(e) => { e.stopPropagation(); toggleLock(layer); }}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-3 bg-indigo-50 border-indigo-100">
        <h3 className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-2">Tips</h3>
        <ul className="text-[10px] text-indigo-600 space-y-1.5 list-disc pl-3">
          <li>Upload PDF to automatically make text and images interactive</li>
          <li><b>Click text</b> to highlight and edit content</li>
          <li><b>Hover & Click images</b> (blue dashed boxes) to replace them</li>
          <li><b>Drag and drop</b> items to align; use the alignment buttons for precision</li>
          <li>Toggle layers to lock or hide elements</li>
        </ul>
      </Card>
    </div>
  );
};

export default PropertiesPanel;
