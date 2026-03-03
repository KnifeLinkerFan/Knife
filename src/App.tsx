/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Info, 
  Calendar, 
  FlaskConical, 
  ClipboardList, 
  ChevronRight, 
  LayoutGrid,
  X,
  Save,
  Box,
  Search,
  Share2,
  Download,
  Dna,
  Sprout,
  Atom,
  CircleDot,
  Check,
  Droplet,
  Microscope,
  Beaker,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LZString from 'lz-string';
import * as XLSX from 'xlsx';
import { CryoBox, Sample, IconType, BoxCategory } from './types';

const STORAGE_KEY = 'cryokeep_data';

const ICON_MAP: Record<IconType, React.ReactNode> = {
  default: <FlaskConical size={18} />,
  dna: <Dna size={18} />,
  rna: <Dna size={18} className="rotate-45" />,
  protein: <Atom size={18} />,
  plasmid: <CircleDot size={18} />,
  seed: <Sprout size={18} />,
};

const ICON_LABELS: Record<IconType, string> = {
  default: '默认',
  dna: 'DNA',
  rna: 'RNA',
  protein: '蛋白',
  plasmid: '质粒',
  seed: '种子',
};

const BOX_CATEGORY_MAP: Record<BoxCategory, React.ReactNode> = {
  general: <Box size={18} />,
  cells: <CircleDot size={18} />,
  bacteria: <Atom size={18} />,
  virus: <Microscope size={18} />,
  plant: <Sprout size={18} />,
  chemicals: <Beaker size={18} />,
  blood: <Droplet size={18} />,
  custom: <MoreHorizontal size={18} />,
};

const BOX_CATEGORY_LABELS: Record<BoxCategory, string> = {
  general: '通用',
  cells: '细胞',
  bacteria: '细菌',
  virus: '病毒',
  plant: '植物',
  chemicals: '试剂',
  blood: '血液',
  custom: '自定义',
};

const BOX_CATEGORY_COLORS: Record<BoxCategory, string> = {
  general: '#0071E3',
  cells: '#FF3B30',
  bacteria: '#34C759',
  virus: '#AF52DE',
  plant: '#FF9500',
  chemicals: '#5856D6',
  blood: '#FF2D55',
  custom: '#71717A',
};

export default function App() {
  const [boxes, setBoxes] = useState<CryoBox[]>([]);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [isAddingBox, setIsAddingBox] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxSize, setNewBoxSize] = useState(9);
  const [newBoxCategory, setNewBoxCategory] = useState<BoxCategory>('general');
  const [editingSample, setEditingSample] = useState<{ boxId: string; pos: { row: number; col: number } } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShareToast, setShowShareToast] = useState(false);

  // Load data from URL hash or LocalStorage
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      try {
        // Try LZ compression first, fallback to base64
        let decodedStr = LZString.decompressFromEncodedURIComponent(hash);
        if (!decodedStr) {
          decodedStr = atob(hash);
        }
        
        const decoded = JSON.parse(decodedStr);
        if (Array.isArray(decoded)) {
          const sanitized = decoded.map(box => ({
            ...box,
            category: box.category || 'general'
          }));
          setBoxes(sanitized);
          if (sanitized.length > 0) setActiveBoxId(sanitized[0].id);
          // Clear hash to avoid confusion after loading
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      } catch (e) {
        console.error('Failed to parse share data', e);
      }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sanitized = parsed.map((box: any) => ({
          ...box,
          category: box.category || 'general'
        }));
        setBoxes(sanitized);
        if (sanitized.length > 0) setActiveBoxId(sanitized[0].id);
      } catch (e) {
        console.error('Failed to load data', e);
      }
    }
  }, []);

  // Save data to LocalStorage
  useEffect(() => {
    if (boxes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
    }
  }, [boxes]);

  const activeBox = useMemo(() => boxes.find(b => b.id === activeBoxId), [boxes, activeBoxId]);

  const handleAddBox = () => {
    if (!newBoxName.trim()) return;
    const newBox: CryoBox = {
      id: crypto.randomUUID(),
      name: newBoxName,
      size: newBoxSize,
      category: newBoxCategory,
      samples: [],
      createdAt: Date.now(),
    };
    setBoxes([...boxes, newBox]);
    setActiveBoxId(newBox.id);
    setNewBoxName('');
    setNewBoxCategory('general');
    setIsAddingBox(false);
  };

  const handleDeleteBox = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个冻存盒吗？所有样品信息都将丢失。')) {
      const newBoxes = boxes.filter(b => b.id !== id);
      setBoxes(newBoxes);
      if (activeBoxId === id) {
        setActiveBoxId(newBoxes.length > 0 ? newBoxes[0].id : null);
      }
    }
  };

  const handleSaveSample = (sampleData: Omit<Sample, 'id' | 'position'>) => {
    if (!editingSample || !activeBoxId) return;
    
    const newBoxes = boxes.map(box => {
      if (box.id === activeBoxId) {
        const existingSampleIndex = box.samples.findIndex(
          s => s.position.row === editingSample.pos.row && s.position.col === editingSample.pos.col
        );
        
        const updatedSamples = [...box.samples];
        const newSample: Sample = {
          ...sampleData,
          id: existingSampleIndex >= 0 ? box.samples[existingSampleIndex].id : crypto.randomUUID(),
          position: editingSample.pos,
        };

        if (existingSampleIndex >= 0) {
          updatedSamples[existingSampleIndex] = newSample;
        } else {
          updatedSamples.push(newSample);
        }

        return { ...box, samples: updatedSamples };
      }
      return box;
    });

    setBoxes(newBoxes);
    setEditingSample(null);
  };

  const handleDeleteSample = () => {
    if (!editingSample || !activeBoxId) return;
    const newBoxes = boxes.map(box => {
      if (box.id === activeBoxId) {
        return {
          ...box,
          samples: box.samples.filter(
            s => !(s.position.row === editingSample.pos.row && s.position.col === editingSample.pos.col)
          )
        };
      }
      return box;
    });
    setBoxes(newBoxes);
    setEditingSample(null);
  };

  const handleShare = () => {
    try {
      const data = JSON.stringify(boxes);
      // Use LZ-String for much better compression (up to 90% reduction)
      const compressed = LZString.compressToEncodedURIComponent(data);
      const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
      
      // Check if URL is too long (most browsers handle up to 32KB, but 8KB is safer)
      if (url.length > 32000) {
        alert('数据量实在太大了，即使压缩后也超出了浏览器链接限制。请尝试分批分享或删除一些旧盒子。');
        return;
      }

      navigator.clipboard.writeText(url);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (e) {
      alert('分享失败，请重试');
    }
  };

  const handleExportExcel = () => {
    if (boxes.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    const exportData = boxes.flatMap(box => 
      box.samples.map(sample => ({
        '冻存盒': box.name,
        '分类': BOX_CATEGORY_LABELS[box.category],
        '位置': `${String.fromCharCode(65 + sample.position.col)}${sample.position.row + 1}`,
        '样品名称': sample.name,
        '类型': ICON_LABELS[sample.iconType || 'default'],
        '存入日期': sample.date,
        '浓度': sample.concentration || '-',
        '用途': sample.purpose || '-',
        '备注': sample.notes || '-'
      }))
    );

    if (exportData.length === 0) {
      alert('冻存盒中暂无样品数据');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CryoKeep Samples");
    
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `CryoKeep_Inventory_${date}.xlsx`);
  };

  const getSampleAt = (row: number, col: number) => {
    return activeBox?.samples.find(s => s.position.row === row && s.position.col === col);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans overflow-hidden">
      {/* Sidebar / Mobile Header */}
      <div className="w-full md:w-72 bg-white border-b md:border-b-0 md:border-r border-[#D2D2D7] flex flex-col shadow-sm z-20">
        <div className="p-4 md:p-6 border-b border-[#D2D2D7] flex md:flex-col items-center md:items-stretch justify-between md:justify-start gap-4">
          <div className="flex items-center gap-2">
            <div 
              className="p-1.5 md:p-2 rounded-lg text-white transition-colors"
              style={{ backgroundColor: activeBox ? BOX_CATEGORY_COLORS[activeBox.category] : '#0071E3' }}
            >
              {activeBox ? BOX_CATEGORY_MAP[activeBox.category] : <Box size={20} className="md:w-6 md:h-6" />}
            </div>
            <h1 className="text-lg md:text-xl font-semibold tracking-tight">CryoKeep</h1>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="p-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#0071E3] rounded-xl transition-colors md:hidden"
              title="分享数据"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={handleExportExcel}
              className="p-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] rounded-xl transition-colors md:hidden"
              title="导出 Excel"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={() => setIsAddingBox(true)}
              className="flex items-center justify-center gap-2 bg-[#0071E3] md:bg-[#F5F5F7] hover:bg-[#0077ED] md:hover:bg-[#E8E8ED] text-white md:text-[#0071E3] font-medium px-4 md:px-0 py-2 md:py-2.5 rounded-xl transition-colors text-sm md:w-full"
            >
              <Plus size={18} />
              <span className="hidden md:inline">新建冻存盒</span>
              <span className="md:hidden">新建</span>
            </button>
          </div>
        </div>

        <div className="hidden md:flex flex-1 overflow-y-auto p-4 space-y-2">
          {boxes.map(box => (
            <div 
              key={box.id}
              onClick={() => setActiveBoxId(box.id)}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                activeBoxId === box.id 
                  ? 'bg-[#0071E3] text-white shadow-md' 
                  : 'hover:bg-[#F5F5F7] text-[#424245]'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div 
                  className="p-1.5 rounded-lg text-white flex-shrink-0"
                  style={{ 
                    backgroundColor: activeBoxId === box.id ? 'transparent' : BOX_CATEGORY_COLORS[box.category],
                    opacity: activeBoxId === box.id ? 1 : 0.8
                  }}
                >
                  {BOX_CATEGORY_MAP[box.category]}
                </div>
                <span className="font-medium truncate">{box.name}</span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10">
                  {box.size}x{box.size}
                </span>
                <button 
                  onClick={(e) => handleDeleteBox(box.id, e)}
                  className={`p-1 rounded-md hover:bg-red-500 hover:text-white transition-colors ${
                    activeBoxId === box.id ? 'text-white/80' : 'text-[#86868B]'
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {boxes.length === 0 && (
            <div className="text-center py-10 text-[#86868B]">
              <p className="text-sm">暂无冻存盒</p>
            </div>
          )}
        </div>
        
        {/* Mobile Box Selector */}
        <div className="md:hidden flex overflow-x-auto p-2 gap-2 bg-white border-b border-[#D2D2D7]">
          {boxes.map(box => (
            <button
              key={box.id}
              onClick={() => setActiveBoxId(box.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${
                activeBoxId === box.id 
                  ? 'bg-[#0071E3] text-white' 
                  : 'bg-[#F5F5F7] text-[#424245]'
              }`}
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: activeBoxId === box.id ? 'white' : BOX_CATEGORY_COLORS[box.category] }} 
              />
              {box.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeBox ? (
          <>
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-[#D2D2D7] p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{activeBox.name}</h2>
                <p className="text-xs md:text-sm text-[#86868B] mt-1">
                  规格: {activeBox.size} x {activeBox.size} · 已存: {activeBox.samples.length} 个样品
                </p>
              </div>
              
              <div className="flex items-center gap-2 md:gap-4">
                <button 
                  onClick={handleExportExcel}
                  className="hidden md:flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] px-4 py-2 rounded-full text-sm font-medium transition-colors"
                  title="导出为 Excel"
                >
                  <Download size={16} />
                  导出 Excel
                </button>
                <div className="relative flex-1 md:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" size={16} />
                  <input 
                    type="text"
                    placeholder="搜索样品..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#F5F5F7] border-none rounded-full text-sm focus:ring-2 focus:ring-[#0071E3] outline-none md:w-64 transition-all"
                  />
                </div>
                <button 
                  onClick={handleShare}
                  className="hidden md:flex items-center gap-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#0071E3] px-4 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  <Share2 size={16} />
                  分享数据
                </button>
              </div>
            </header>

            {/* Grid Area */}
            <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start bg-[#F5F5F7]">
              <div 
                className="grid gap-1.5 md:gap-2 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-[#D2D2D7] w-full max-w-4xl"
                style={{ 
                  gridTemplateColumns: `repeat(${activeBox.size}, minmax(0, 1fr))`,
                }}
              >
                {/* Column Headers */}
                {Array.from({ length: activeBox.size }).map((_, i) => (
                  <div key={`col-${i}`} className="text-center text-[9px] md:text-[10px] font-mono text-[#86868B] pb-1 uppercase tracking-wider">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}

                {/* Grid Cells */}
                {Array.from({ length: activeBox.size }).map((_, row) => (
                  <React.Fragment key={`row-${row}`}>
                    {Array.from({ length: activeBox.size }).map((_, col) => {
                      const sample = getSampleAt(row, col);
                      const isMatch = searchQuery && sample?.name.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      return (
                        <motion.div
                          key={`${row}-${col}`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setEditingSample({ boxId: activeBox.id, pos: { row, col } })}
                          className={`
                            aspect-square rounded-lg md:rounded-xl cursor-pointer flex flex-col items-center justify-center relative transition-all overflow-hidden border
                            ${sample 
                              ? isMatch 
                                ? 'bg-[#0071E3] text-white border-[#0071E3] ring-2 ring-[#0071E3]/20' 
                                : 'bg-[#F2F2F7] text-[#1D1D1F] border-[#D2D2D7] hover:bg-[#E5E5EA]' 
                              : 'bg-white border-dashed border-[#D2D2D7] hover:border-[#0071E3] hover:bg-[#F5F5F7]'
                            }
                          `}
                        >
                          {/* Row Label (only for first column) */}
                          {col === 0 && (
                            <div className="absolute -left-6 md:-left-8 top-1/2 -translate-y-1/2 text-[9px] md:text-[10px] font-mono text-[#86868B]">
                              {row + 1}
                            </div>
                          )}
                          
                          {sample ? (
                            <>
                              <div className={`${isMatch ? 'text-white' : 'text-[#0071E3]'} scale-75 md:scale-100`}>
                                {ICON_MAP[sample.iconType || 'default']}
                              </div>
                              <span className={`text-[7px] md:text-[9px] leading-[1.1] mt-0.5 md:mt-1 font-medium text-center px-0.5 break-words w-full ${isMatch ? 'text-white' : 'text-[#1D1D1F]'}`}>
                                {sample.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-[8px] md:text-[10px] text-[#D2D2D7] font-mono">
                              {String.fromCharCode(65 + col)}{row + 1}
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </main>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#86868B] p-10">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#D2D2D7] text-center max-w-sm">
              <Box size={48} className="mx-auto mb-4 text-[#D2D2D7]" />
              <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2">欢迎使用 CryoKeep</h3>
              <p className="text-sm mb-6">点击左侧按钮新建一个冻存盒，开始管理您的实验室样品。</p>
              <button 
                onClick={() => setIsAddingBox(true)}
                className="bg-[#0071E3] text-white px-6 py-2.5 rounded-full font-medium hover:bg-[#0077ED] transition-colors"
              >
                立即创建
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Share Toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1D1D1F] text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-2"
          >
            <Check size={18} className="text-emerald-400" />
            分享链接已复制到剪贴板
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Box Modal */}
      <AnimatePresence>
        {isAddingBox && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingBox(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">新建冻存盒</h3>
                  <button onClick={() => setIsAddingBox(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-2">盒子名称</label>
                    <input 
                      autoFocus
                      type="text"
                      placeholder="例如: -80℃ 冰箱 A1 盒"
                      value={newBoxName}
                      onChange={(e) => setNewBoxName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl focus:ring-2 focus:ring-[#0071E3] outline-none transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-2">规格 (正方形)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range"
                        min="2"
                        max="15"
                        value={newBoxSize}
                        onChange={(e) => setNewBoxSize(parseInt(e.target.value))}
                        className="flex-1 accent-[#0071E3]"
                      />
                      <span className="text-lg font-mono font-semibold w-12 text-center">
                        {newBoxSize}x{newBoxSize}
                      </span>
                    </div>
                    <p className="text-xs text-[#86868B] mt-2">支持 2x2 到 15x15 的自定义规格。</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#86868B] mb-2">分类</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(BOX_CATEGORY_MAP) as BoxCategory[]).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setNewBoxCategory(cat)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all border-2 ${
                            newBoxCategory === cat 
                              ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]' 
                              : 'border-transparent bg-[#F5F5F7] text-[#86868B] hover:bg-[#E8E8ED]'
                          }`}
                        >
                          <div style={{ color: newBoxCategory === cat ? '#0071E3' : BOX_CATEGORY_COLORS[cat] }}>
                            {BOX_CATEGORY_MAP[cat]}
                          </div>
                          <span className="text-[10px]">{BOX_CATEGORY_LABELS[cat]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleAddBox}
                    className="w-full bg-[#0071E3] text-white py-3 rounded-xl font-semibold hover:bg-[#0077ED] transition-colors shadow-lg shadow-[#0071E3]/20"
                  >
                    创建盒子
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sample Edit Modal */}
      <AnimatePresence>
        {editingSample && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingSample(null)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <SampleForm 
                pos={editingSample.pos}
                initialData={getSampleAt(editingSample.pos.row, editingSample.pos.col)}
                onSave={handleSaveSample}
                onDelete={handleDeleteSample}
                onClose={() => setEditingSample(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SampleForm({ 
  pos, 
  initialData, 
  onSave, 
  onDelete, 
  onClose 
}: { 
  pos: { row: number; col: number };
  initialData?: Sample;
  onSave: (data: Omit<Sample, 'id' | 'position'>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    concentration: initialData?.concentration || '',
    purpose: initialData?.purpose || '',
    notes: initialData?.notes || '',
    iconType: initialData?.iconType || 'default' as IconType,
  });

  const posLabel = `${String.fromCharCode(65 + pos.col)}${pos.row + 1}`;

  return (
    <div className="p-6 md:p-8">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h3 className="text-xl font-semibold">样品详情</h3>
          <p className="text-sm text-[#86868B]">位置: <span className="font-mono font-bold text-[#0071E3]">{posLabel}</span></p>
        </div>
        <button onClick={onClose} className="text-[#86868B] hover:text-[#1D1D1F]">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#86868B] mb-2">
            <FlaskConical size={14} /> 样品名称
          </label>
          <input 
            autoFocus
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如: HeLa Cell Line P5"
            className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl focus:ring-2 focus:ring-[#0071E3] outline-none transition-all"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#86868B] mb-2">
            选择图标
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {(Object.keys(ICON_MAP) as IconType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFormData({ ...formData, iconType: type })}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all border-2 ${
                  formData.iconType === type 
                    ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]' 
                    : 'border-transparent bg-[#F5F5F7] text-[#86868B] hover:bg-[#E8E8ED]'
                }`}
              >
                {ICON_MAP[type]}
                <span className="text-[10px]">{ICON_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#86868B] mb-2">
              <Calendar size={14} /> 存入日期
            </label>
            <input 
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl focus:ring-2 focus:ring-[#0071E3] outline-none transition-all"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#86868B] mb-2">
              <ClipboardList size={14} /> 浓度
            </label>
            <input 
              type="text"
              value={formData.concentration}
              onChange={(e) => setFormData({ ...formData, concentration: e.target.value })}
              placeholder="例如: 1x10^6 cells/mL"
              className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl focus:ring-2 focus:ring-[#0071E3] outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#86868B] mb-2">
            <Info size={14} /> 用途
          </label>
          <input 
            type="text"
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            placeholder="例如: Western Blot 验证"
            className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl focus:ring-2 focus:ring-[#0071E3] outline-none transition-all"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-[#86868B] mb-2">
            <ClipboardList size={14} /> 备注
          </label>
          <textarea 
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="其他补充信息..."
            className="w-full px-4 py-3 bg-[#F5F5F7] border-none rounded-xl focus:ring-2 focus:ring-[#0071E3] outline-none transition-all resize-none"
          />
        </div>

        <div className="pt-4 flex flex-col md:flex-row gap-3">
          {initialData && (
            <button 
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-2 border border-red-500 text-red-500 py-3 rounded-xl font-semibold hover:bg-red-50 transition-colors"
            >
              <Trash2 size={18} />
              删除样品
            </button>
          )}
          <button 
            onClick={() => onSave(formData)}
            className="flex-[2] flex items-center justify-center gap-2 bg-[#0071E3] text-white py-3 rounded-xl font-semibold hover:bg-[#0077ED] transition-colors shadow-lg shadow-[#0071E3]/20"
          >
            <Save size={18} />
            保存信息
          </button>
        </div>
      </div>
    </div>
  );
}
