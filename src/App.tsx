/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import pptxgen from "pptxgenjs";
import { 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Wand2, 
  Settings2, 
  ChevronRight,
  Image as ImageIcon,
  Type as TypeIcon,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface MarkerBand {
  id: string;
  size: string;
  yPos: number; // percentage from top of image
}

interface Lane {
  id: string;
  name: string;
  color: string;
  xOffset: number; // Individual horizontal offset in percentage
  yOffset: number; // Individual vertical offset in pixels
}

const translations = {
  en: {
    title: "WB Lane Annotator",
    subtitle: "Precision Research Tool v1.0",
    exportHTML: "Export HTML",
    exportPPTX: "Export PPTX",
    imageSource: "Image Source",
    uploadHint: "Click or drag WB image here",
    imageLoaded: "Image Loaded",
    autoDetect: "Auto-Detect Bands",
    detecting: "Detecting Bands...",
    laneSamples: "Lane Samples",
    aiGrouping: "AI Grouping",
    analyzing: "Analyzing...",
    addLane: "Add Lane",
    layoutAdjustment: "Layout Adjustment",
    startAlignment: "Start Alignment",
    endAlignment: "End Alignment",
    verticalOffset: "Vertical Offset",
    fontSize: "Font Size",
    tiltAngle: "Tilt Angle",
    fontFamily: "Font Family",
    setup: "Setup",
    preview: "Preview",
    uploadPrompt: "Upload a WB image to begin annotation",
    proTip: "Pro Tip",
    proTipText: "Use the 'AI Grouping' button to automatically color-code similar samples based on their names.",
    lanePlaceholder: "Lane {n} name...",
    modern: "Sans Serif (Modern)",
    classic: "Serif (Classic)",
    technical: "Monospace (Technical)",
    laneColor: "Color",
    laneXOffset: "X Offset",
    laneYOffset: "Y Offset",
    individualControl: "Individual Control",
    markers: "Marker Labels",
    addMarker: "Add Marker",
    markerSize: "Size (kDa)",
    markerPos: "Y Position",
    markerX: "Marker X Position",
    laneCount: "Lane Count",
    setLanes: "Set Lanes",
  },
  cn: {
    title: "WB 条带标注工具",
    subtitle: "精准科研工具 v1.0",
    exportHTML: "导出 HTML",
    exportPPTX: "导出 PPTX",
    imageSource: "图片来源",
    uploadHint: "点击或拖拽 WB 图片至此处",
    imageLoaded: "图片已加载",
    autoDetect: "自动识别条带",
    detecting: "正在识别...",
    laneSamples: "样品名称",
    aiGrouping: "AI 智能分组",
    analyzing: "正在分析...",
    addLane: "添加泳道",
    layoutAdjustment: "布局调整",
    startAlignment: "起始对齐",
    endAlignment: "结束对齐",
    verticalOffset: "垂直偏移",
    fontSize: "字体大小",
    tiltAngle: "倾斜角度",
    fontFamily: "字体系列",
    setup: "设置",
    preview: "预览",
    uploadPrompt: "请上传 WB 图片开始标注",
    proTip: "专业提示",
    proTipText: "使用“AI 智能分组”按钮，根据样品名称自动为相似样品着色。",
    lanePlaceholder: "泳道 {n} 名称...",
    modern: "无衬线体 (现代)",
    classic: "衬线体 (经典)",
    technical: "等宽字体 (技术)",
    laneColor: "颜色",
    laneXOffset: "水平偏移",
    laneYOffset: "垂直偏移",
    individualControl: "单独调整",
    markers: "Marker 标注",
    addMarker: "添加 Marker",
    markerSize: "大小 (kDa)",
    markerPos: "垂直位置",
    markerX: "Marker 水平位置",
    laneCount: "泳道数量",
    setLanes: "生成泳道",
  }
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'cn'>('cn');
  const t = translations[lang];

  const [image, setImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [lanes, setLanes] = useState<Lane[]>([
    { id: '1', name: 'Control', color: '#141414', xOffset: 0, yOffset: 0 },
    { id: '2', name: 'Sample A', color: '#141414', xOffset: 0, yOffset: 0 },
  ]);
  const [markerBands, setMarkerBands] = useState<MarkerBand[]>([
    { id: 'm1', size: '100', yPos: 20 },
    { id: 'm2', size: '75', yPos: 40 },
    { id: 'm3', size: '50', yPos: 60 },
  ]);
  const [laneConfig, setLaneConfig] = useState({
    startX: 15, // percentage
    endX: 90,   // percentage
    yOffset: -10, // pixels above image
    fontSize: 14,
    angle: 45,
    fontFamily: 'sans-serif',
    markerX: 5, // percentage from left
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [manualLaneCount, setManualLaneCount] = useState(8);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const generateLanes = (count: number) => {
    const newLanes = Array.from({ length: count }, (_, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: `Lane ${i + 1}`,
      color: '#141414',
      xOffset: 0,
      yOffset: 0
    }));
    setLanes(newLanes);
  };

  // HTML Export
  const exportToHTML = () => {
    if (!image) return;

    const laneWidth = (laneConfig.endX - laneConfig.startX) / (lanes.length - 1 || 1);
    
    const labelsHTML = lanes.map((lane, index) => {
      const x = laneConfig.startX + (index * laneWidth) + (lane.xOffset || 0);
      const y = laneConfig.yOffset + (lane.yOffset || 0);
      return `
        <div class="lane-label" contenteditable="true" style="
          left: ${x}%;
          bottom: calc(100% - ${y}px);
          color: ${lane.color};
          font-size: ${laneConfig.fontSize}px;
          font-family: ${laneConfig.fontFamily};
          transform: rotate(-${laneConfig.angle}deg);
        ">
          ${lane.name}
        </div>
      `;
    }).join('');

    const markersHTML = markerBands.map((marker) => {
      return `
        <div class="marker-label" contenteditable="true" style="
          left: ${laneConfig.markerX}%;
          top: ${marker.yPos}%;
          font-size: ${laneConfig.fontSize}px;
          font-family: ${laneConfig.fontFamily};
          color: #141414;
        ">
          ${marker.size}
        </div>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WB Annotation Export</title>
    <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; font-family: sans-serif; }
        .container { position: relative; display: inline-block; background: white; padding: 100px 40px 40px 80px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .wb-image { display: block; max-width: 100%; height: auto; }
        .lane-label {
            position: absolute;
            white-space: nowrap;
            transform-origin: left bottom;
            font-weight: bold;
            pointer-events: auto;
            cursor: text;
        }
        .marker-label {
            position: absolute;
            white-space: nowrap;
            transform: translateY(-50%);
            font-weight: bold;
            pointer-events: auto;
            cursor: text;
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; padding: 100px 0 0 0; }
        }
    </style>
</head>
<body>
    <div class="container">
        ${labelsHTML}
        ${markersHTML}
        <img src="${image}" class="wb-image" alt="Western Blot">
    </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WB_Annotation_${new Date().getTime()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(event.target?.result as string);
          setImageSize({ width: img.width, height: img.height });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Add/Remove Lanes
  const addLane = () => {
    setLanes([...lanes, { 
      id: Math.random().toString(36).substr(2, 9), 
      name: '', 
      color: '#141414',
      xOffset: 0,
      yOffset: 0
    }]);
  };

  const removeLane = (id: string) => {
    setLanes(lanes.filter(l => l.id !== id));
  };

  const updateLane = (id: string, updates: Partial<Lane>) => {
    setLanes(lanes.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  // Marker Controls
  const addMarker = () => {
    setMarkerBands([...markerBands, { id: Math.random().toString(36).substr(2, 9), size: '', yPos: 50 }]);
  };

  const removeMarker = (id: string) => {
    setMarkerBands(markerBands.filter(m => m.id !== id));
  };

  const updateMarker = (id: string, updates: Partial<MarkerBand>) => {
    setMarkerBands(markerBands.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // AI Analysis for Grouping
  const analyzeSamples = async () => {
    if (lanes.every(l => !l.name)) return;
    setIsAnalyzing(true);
    try {
      const sampleNames = lanes.map(l => l.name).filter(Boolean);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze these Western Blot sample names: ${sampleNames.join(', ')}. 
        1. Group them by commonalities (e.g., same protein, same treatment, control vs experimental). 
        2. Assign a distinct, professional hex color to each group. 
        3. Use dark, high-contrast colors (e.g., #1A1A1A, #1E3A8A, #064E3B, #701A75, #7C2D12). 
        4. Return a JSON object where keys are the EXACT sample names provided and values are the hex colors.
        5. Ensure EVERY sample name provided is a key in the returned JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            additionalProperties: { type: Type.STRING }
          }
        }
      });

      const colorMap = JSON.parse(response.text || '{}');
      setLanes(lanes.map(l => ({
        ...l,
        color: colorMap[l.name] || l.color
      })));
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // PPT Export
  const exportToPPT = async () => {
    if (!image) return;

    const pres = new pptxgen();
    const slide = pres.addSlide();

    // Calculate dimensions to fit slide while maintaining aspect ratio
    // Slide is typically 10x5.625 inches
    const slideW = 10;
    const slideH = 5.625;
    const imgAspect = imageSize.width / imageSize.height;
    
    let displayW, displayH;
    if (imgAspect > slideW / slideH) {
      displayW = slideW * 0.8;
      displayH = displayW / imgAspect;
    } else {
      displayH = slideH * 0.6;
      displayW = displayH * imgAspect;
    }

    const startX = (slideW - displayW) / 2;
    const startY = (slideH - displayH) / 2 + 0.5; // Offset down for labels

    // Add Image
    slide.addImage({
      data: image,
      x: startX,
      y: startY,
      w: displayW,
      h: displayH
    });

    // Add Labels
    const laneWidth = (displayW * (laneConfig.endX - laneConfig.startX) / 100) / (lanes.length - 1 || 1);
    const laneStartPos = startX + (displayW * laneConfig.startX / 100);

    lanes.forEach((lane, index) => {
      const xPos = laneStartPos + (index * laneWidth) + (lane.xOffset * displayW / 100);
      const yPos = startY + (laneConfig.yOffset + lane.yOffset) / 72; // Convert px to inches roughly

      slide.addText(lane.name, {
        x: xPos - 0.5,
        y: yPos - 0.3,
        w: 2,
        h: 0.3,
        rotate: 360 - laneConfig.angle,
        fontSize: Math.max(6, laneConfig.fontSize * 0.6), // Scale down font size for PPTX
        fontFace: laneConfig.fontFamily === 'serif' ? 'Georgia' : 'Arial',
        color: lane.color.replace('#', ''),
        align: 'left',
        valign: 'bottom',
        bold: true
      });
    });

    // Add Markers
    markerBands.forEach((marker) => {
      const xPos = startX + (laneConfig.markerX * displayW / 100);
      const yPos = startY + (marker.yPos * displayH / 100);
      slide.addText(marker.size, {
        x: xPos - 0.5,
        y: yPos - 0.1,
        w: 1,
        h: 0.2,
        fontSize: Math.max(6, laneConfig.fontSize * 0.6),
        fontFace: laneConfig.fontFamily === 'serif' ? 'Georgia' : 'Arial',
        color: '141414',
        align: 'right',
        valign: 'middle',
        bold: true
      });
    });

    pres.writeFile({ fileName: `WB_Annotation_${new Date().getTime()}.pptx` });
  };

  // Render Preview on Canvas
  useEffect(() => {
    if (!image || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / img.width);
      
      // Increase top padding to prevent clipping
      const topPadding = 150; 
      canvas.width = img.width * scale;
      canvas.height = img.height * scale + topPadding;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const imgY = topPadding;
      ctx.drawImage(img, 0, imgY, img.width * scale, img.height * scale);

      const drawW = img.width * scale;
      const laneWidth = (drawW * (laneConfig.endX - laneConfig.startX) / 100) / (lanes.length - 1 || 1);
      const laneStartPos = (drawW * laneConfig.startX / 100);

      lanes.forEach((lane, index) => {
        const x = laneStartPos + (index * laneWidth) + (lane.xOffset * drawW / 100);
        const y = imgY + laneConfig.yOffset + lane.yOffset;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-laneConfig.angle * Math.PI / 180);
        ctx.fillStyle = lane.color;
        ctx.font = `bold ${laneConfig.fontSize}px ${laneConfig.fontFamily}`;
        ctx.fillText(lane.name, 0, 0);
        ctx.restore();

        // Optional: Draw a small tick mark
        ctx.beginPath();
        ctx.moveTo(x, imgY);
        ctx.lineTo(x, imgY - 5);
        ctx.strokeStyle = '#ccc';
        ctx.stroke();
      });

      // Draw Markers
      markerBands.forEach((marker) => {
        const x = (drawW * laneConfig.markerX / 100);
        const y = imgY + (img.height * scale * marker.yPos / 100);

        ctx.fillStyle = '#141414';
        ctx.font = `bold ${laneConfig.fontSize}px ${laneConfig.fontFamily}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(marker.size, x - 5, y);
      });
    };
    img.src = image;
  }, [image, lanes, laneConfig, markerBands]);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#141414]/40 mb-1">KnifeLinker 制作</div>
            <h1 className="text-2xl font-serif italic tracking-tight">{t.title}</h1>
            <p className="text-[11px] uppercase tracking-widest opacity-50 font-mono">{t.subtitle}</p>
          </div>
          <div className="flex bg-[#E4E3E0]/50 p-1 rounded-lg border border-[#141414]/10">
            <button 
              onClick={() => setLang('cn')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${lang === 'cn' ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/10'}`}
            >
              中文
            </button>
            <button 
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${lang === 'en' ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/10'}`}
            >
              EN
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          {image && (
            <>
              <button 
                onClick={exportToHTML}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#141414] text-[#141414] rounded-full text-sm font-medium hover:bg-[#E4E3E0] transition-all active:scale-95"
              >
                <ImageIcon size={16} />
                {t.exportHTML}
              </button>
              <button 
                onClick={exportToPPT}
                className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] rounded-full text-sm font-medium hover:opacity-90 transition-all active:scale-95"
              >
                <Download size={16} />
                {t.exportPPTX}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6 pb-20">
          {/* Upload Section */}
          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-[#141414]/60">
              <ImageIcon size={18} />
              <h2 className="text-xs uppercase font-mono tracking-wider">{t.imageSource}</h2>
            </div>
            {!image ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#141414]/20 rounded-xl p-8 text-center cursor-pointer hover:border-[#141414]/40 transition-colors group"
              >
                <Upload className="mx-auto mb-3 opacity-30 group-hover:opacity-60 transition-opacity" size={32} />
                <p className="text-sm text-[#141414]/60">{t.uploadHint}</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  accept="image/*" 
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#E4E3E0]/30 rounded-lg">
                  <span className="text-xs truncate max-w-[200px] opacity-70">{t.imageLoaded} ({imageSize.width}x{imageSize.height})</span>
                  <button 
                    onClick={() => setImage(null)}
                    className="p-1 hover:bg-red-50 text-red-600 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="pt-2 border-t border-[#141414]/5 space-y-3">
                  <div className="flex justify-between text-[10px] uppercase font-bold opacity-50">
                    <span>{t.laneCount}</span>
                    <span>{manualLaneCount}</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      min="1" max="30"
                      value={manualLaneCount}
                      onChange={(e) => setManualLaneCount(parseInt(e.target.value) || 1)}
                      className="w-16 bg-white border border-[#141414]/10 rounded px-2 py-1 text-sm outline-none"
                    />
                    <button 
                      onClick={() => generateLanes(manualLaneCount)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#141414] text-[#E4E3E0] rounded-lg text-xs font-bold hover:opacity-90 transition-all"
                    >
                      <Wand2 size={14} />
                      {t.setLanes}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Lanes Section */}
          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#141414]/60">
                <TypeIcon size={18} />
                <h2 className="text-xs uppercase font-mono tracking-wider">{t.laneSamples}</h2>
              </div>
              <button 
                onClick={analyzeSamples}
                disabled={isAnalyzing || lanes.length === 0}
                className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-tighter px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <Wand2 size={12} />
                {isAnalyzing ? t.analyzing : t.aiGrouping}
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {lanes.map((lane, index) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={lane.id} 
                  className="bg-[#E4E3E0]/10 border border-[#141414]/5 p-3 rounded-xl space-y-3 group"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-mono opacity-30 w-4">{index + 1}</div>
                    <input 
                      type="text"
                      value={lane.name}
                      onChange={(e) => updateLane(lane.id, { name: e.target.value })}
                      placeholder={t.lanePlaceholder.replace('{n}', (index + 1).toString())}
                      className="flex-1 bg-white border border-[#141414]/10 rounded px-3 py-1.5 text-sm outline-none transition-all"
                    />
                    <input 
                      type="color"
                      value={lane.color}
                      onChange={(e) => updateLane(lane.id, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                    />
                    <button 
                      onClick={() => removeLane(lane.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#141414]/5">
                    <div>
                      <div className="flex justify-between text-[9px] uppercase font-bold mb-1 opacity-40">
                        <span>{t.laneXOffset}</span>
                        <span>{lane.xOffset}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="-10" max="10" step="0.5"
                        value={lane.xOffset}
                        onChange={(e) => updateLane(lane.id, { xOffset: parseFloat(e.target.value) })}
                        className="w-full accent-[#141414]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] uppercase font-bold mb-1 opacity-40">
                        <span>{t.laneYOffset}</span>
                        <span>{lane.yOffset}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-50" max="50" 
                        value={lane.yOffset}
                        onChange={(e) => updateLane(lane.id, { yOffset: parseInt(e.target.value) })}
                        className="w-full accent-[#141414]"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button 
              onClick={addLane}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2 border border-dashed border-[#141414]/20 rounded-lg text-xs font-medium opacity-60 hover:opacity-100 hover:bg-[#E4E3E0]/20 transition-all"
            >
              <Plus size={14} />
              {t.addLane}
            </button>
          </section>

          {/* Markers Section */}
          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-[#141414]/60">
              <Palette size={18} />
              <h2 className="text-xs uppercase font-mono tracking-wider">{t.markers}</h2>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {markerBands.map((marker) => (
                <div key={marker.id} className="bg-[#E4E3E0]/10 p-3 rounded-xl border border-[#141414]/5 space-y-2 group">
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={marker.size}
                      onChange={(e) => updateMarker(marker.id, { size: e.target.value })}
                      placeholder={t.markerSize}
                      className="flex-1 bg-white border border-[#141414]/10 rounded px-2 py-1 text-xs outline-none"
                    />
                    <button 
                      onClick={() => removeMarker(marker.id)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] uppercase font-bold mb-1 opacity-40">
                      <span>{t.markerPos}</span>
                      <span>{marker.yPos}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={marker.yPos}
                      onChange={(e) => updateMarker(marker.id, { yPos: parseInt(e.target.value) })}
                      className="w-full accent-[#141414]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={addMarker}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2 border border-dashed border-[#141414]/20 rounded-lg text-xs font-medium opacity-60 hover:opacity-100 hover:bg-[#E4E3E0]/20 transition-all"
            >
              <Plus size={14} />
              {t.addMarker}
            </button>
          </section>

          {/* Layout Config */}
          <section className="bg-white border border-[#141414] p-6 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-[#141414]/60">
              <Settings2 size={18} />
              <h2 className="text-xs uppercase font-mono tracking-wider">{t.layoutAdjustment}</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.startAlignment}</span>
                  <span>{laneConfig.startX}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="50" 
                  value={laneConfig.startX}
                  onChange={(e) => setLaneConfig({...laneConfig, startX: parseInt(e.target.value)})}
                  className="w-full accent-[#141414]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.endAlignment}</span>
                  <span>{laneConfig.endX}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" max="100" 
                  value={laneConfig.endX}
                  onChange={(e) => setLaneConfig({...laneConfig, endX: parseInt(e.target.value)})}
                  className="w-full accent-[#141414]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.verticalOffset}</span>
                  <span>{laneConfig.yOffset}px</span>
                </div>
                <input 
                  type="range" 
                  min="-50" max="0" 
                  value={laneConfig.yOffset}
                  onChange={(e) => setLaneConfig({...laneConfig, yOffset: parseInt(e.target.value)})}
                  className="w-full accent-[#141414]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.fontSize}</span>
                  <span>{laneConfig.fontSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="8" max="32" 
                  value={laneConfig.fontSize}
                  onChange={(e) => setLaneConfig({...laneConfig, fontSize: parseInt(e.target.value)})}
                  className="w-full accent-[#141414]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.tiltAngle}</span>
                  <span>{laneConfig.angle}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="90" 
                  value={laneConfig.angle}
                  onChange={(e) => setLaneConfig({...laneConfig, angle: parseInt(e.target.value)})}
                  className="w-full accent-[#141414]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.markerX}</span>
                  <span>{laneConfig.markerX}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="30" 
                  value={laneConfig.markerX}
                  onChange={(e) => setLaneConfig({...laneConfig, markerX: parseInt(e.target.value)})}
                  className="w-full accent-[#141414]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-1 opacity-50">
                  <span>{t.fontFamily}</span>
                </div>
                <select 
                  value={laneConfig.fontFamily}
                  onChange={(e) => setLaneConfig({...laneConfig, fontFamily: e.target.value})}
                  className="w-full bg-[#E4E3E0]/20 border border-[#141414]/10 rounded px-2 py-1 text-xs outline-none"
                >
                  <option value="sans-serif">{t.modern}</option>
                  <option value="serif">{t.classic}</option>
                  <option value="monospace">{t.technical}</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-8 flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="flex gap-2 p-1 bg-white border border-[#141414] rounded-full w-fit self-center lg:self-start">
            <button 
              onClick={() => setActiveTab('edit')}
              className={`px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'edit' ? 'bg-[#141414] text-white' : 'hover:bg-[#E4E3E0]'}`}
            >
              {t.setup}
            </button>
            <button 
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'preview' ? 'bg-[#141414] text-white' : 'hover:bg-[#E4E3E0]'}`}
            >
              {t.preview}
            </button>
          </div>

          <div className="bg-white border border-[#141414] rounded-3xl p-8 min-h-[600px] flex items-center justify-center relative overflow-hidden shadow-xl">
            {!image ? (
              <div className="text-center opacity-20">
                <ImageIcon size={64} className="mx-auto mb-4" />
                <p className="font-serif italic text-xl text-[#141414]">{t.uploadPrompt}</p>
              </div>
            ) : (
              <div className="max-w-full overflow-auto custom-scrollbar">
                <canvas 
                  ref={previewCanvasRef} 
                  className="max-w-full h-auto shadow-2xl rounded-lg"
                />
              </div>
            )}

            {/* Grid Overlay Hint Removed */}
          </div>

          {/* Instructions Footer */}
          <div className="bg-[#141414] text-[#E4E3E0] p-4 rounded-2xl flex items-center gap-4">
            <div className="bg-white/10 p-2 rounded-lg">
              <Settings2 size={20} />
            </div>
            <div className="text-xs">
              <p className="font-bold uppercase tracking-wider mb-0.5">{t.proTip}</p>
              <p className="opacity-60">{t.proTipText}</p>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #141414;
          border-radius: 10px;
        }
        input[type="range"] {
          -webkit-appearance: none;
          background: #E4E3E0;
          height: 2px;
          border-radius: 2px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #141414;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
