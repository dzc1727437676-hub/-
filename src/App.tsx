import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Table as TableIcon, 
  Upload, 
  BrainCircuit, 
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Download,
  Filter,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Package,
  X,
  Edit2,
  Save,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { processData, type OrderData, type MSKUMapping, type PlatformMapping } from './utils';
import { GoogleGenAI } from "@google/genai";

// --- UI Components ---

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Button = ({ className, variant = 'primary', size = 'md', ...props }: any) => {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100',
    success: 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100',
  };
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button 
      className={cn('rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', variants[variant as keyof typeof variants], sizes[size as keyof typeof sizes], className)} 
      {...props} 
    />
  );
};

const Card = ({ children, className }: any) => (
  <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
    {children}
  </div>
);

const Input = ({ className, ...props }: any) => (
  <input 
    className={cn('w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all text-sm', className)} 
    {...props} 
  />
);

const Select = ({ options, value, onChange, placeholder, className }: any) => (
  <select 
    value={value} 
    onChange={(e) => onChange(e.target.value)}
    className={cn('px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all text-sm bg-white', className)}
  >
    <option value="">{placeholder || '请选择...'}</option>
    {options.map((opt: any) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('mappings');
  const [mskuMappings, setMskuMappings] = useState<MSKUMapping[]>([]);
  const [platformMappings, setPlatformMappings] = useState<PlatformMapping[]>([]);
  const [processedData, setProcessedData] = useState<OrderData[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userQuery, setUserQuery] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    platform: '',
    category1: '',
    attr_name: '',
    product_type: '',
    week: '',
    month: '',
    startDate: '',
    endDate: ''
  });

  const [chartMetric, setChartMetric] = useState<'orders' | 'sales'>('sales');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    fetchMappings();
    fetchSettings();
  }, []);

  const fetchMappings = async () => {
    const [mskuRes, platRes] = await Promise.all([
      fetch('/api/mappings/msku'),
      fetch('/api/mappings/platform')
    ]);
    setMskuMappings(await mskuRes.json());
    setPlatformMappings(await platRes.json());
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    setSettings(await res.json());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const processed = processData(results.data as OrderData[], mskuMappings, platformMappings);
          setProcessedData(processed);
          setLoading(false);
          setActiveTab('dashboard');
        }
      });
    };
    reader.readAsText(file, importEncoding);
    // Reset input value to allow re-uploading the same file
    e.target.value = '';
  };

  const [importEncoding, setImportEncoding] = useState<'UTF-8' | 'GBK'>('UTF-8');

  const handleBulkImport = (type: 'msku' | 'platform', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const data = results.data.map((row: any) => {
              if (type === 'msku') {
                return {
                  msku: (row['MSKU'] || row['msku'] || row['Msku'] || '').toString().trim(),
                  platform_zh: (row['中文平台'] || row['platform_zh'] || row['平台'] || '').toString().trim(),
                  category1: (row['一级品类'] || row['category1'] || '').toString().trim(),
                  category2: (row['二级品类'] || row['category2'] || '').toString().trim(),
                  attr_name: (row['销售属性名称'] || row['attr_name'] || '').toString().trim(),
                  product_type: (row['产品类型'] || row['product_type'] || '').toString().trim(),
                };
              } else {
                return {
                  source_platform: (row['源平台标识'] || row['source_platform'] || '').toString().trim(),
                  platform_zh: (row['中文平台名称'] || row['platform_zh'] || '').toString().trim(),
                };
              }
            }).filter((item: any) => {
              if (type === 'msku') {
                return item.msku && item.platform_zh;
              } else {
                return item.source_platform && item.platform_zh;
              }
            });

            if (data.length === 0) {
              alert('未发现有效数据，请检查 CSV 表头是否匹配（如：MSKU, 中文平台 等）。');
              return;
            }

            const res = await fetch(`/api/mappings/${type}/bulk`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || '导入请求失败');
            }

            fetchMappings();
            alert(`成功导入 ${data.length} 条数据！`);
          } catch (err) {
            console.error(err);
            alert('导入失败: ' + (err as Error).message);
          }
        }
      });
    };
    reader.readAsText(file, importEncoding);
    // Reset input
    e.target.value = '';
  };

  const saveMskuMapping = async (mapping: MSKUMapping) => {
    await fetch('/api/mappings/msku', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping)
    });
    fetchMappings();
  };

  const deleteMskuMapping = async (id: number) => {
    await fetch(`/api/mappings/msku/${id}`, { method: 'DELETE' });
    fetchMappings();
  };

  const savePlatformMapping = async (mapping: PlatformMapping) => {
    await fetch('/api/mappings/platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping)
    });
    fetchMappings();
  };

  const deletePlatformMapping = async (id: number) => {
    await fetch(`/api/mappings/platform/${id}`, { method: 'DELETE' });
    fetchMappings();
  };

  const saveSetting = async (key: string, value: string) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    fetchSettings();
  };

  const runAiAnalysis = async () => {
    const apiKey = settings.ai_api_key;
    const baseUrl = settings.ai_base_url || 'https://generativelanguage.googleapis.com/v1beta/openai';
    const modelName = settings.ai_model_name || 'gemini-3-flash-preview';

    if (!apiKey) {
      alert('请先在设置中配置您的 API Key。');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Flexible API call (OpenAI compatible)
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的电商数据分析专家。请根据用户提供的数据摘要和具体问题进行深度分析。'
            },
            {
              role: 'user',
              content: `
                数据分析上下文:
                1. 总体概况:
                   - 总订单数: ${orderCount}
                   - 总销售额: ¥${filteredData.reduce((acc, d) => acc + (d['销售额'] || 0), 0).toLocaleString()}
                   - 总销量: ${filteredData.reduce((acc, d) => acc + (d['销量'] || 0), 0).toLocaleString()}
                
                2. 平台销售分布 (销售额):
                   ${JSON.stringify(getPlatformChartData(filteredData, 'sales'), null, 2)}
                
                3. 每周销售趋势 (销售额):
                   ${JSON.stringify(getWeeklyChartData(filteredData, 'sales'), null, 2)}
                
                4. 品类表现摘要 (前15名):
                   ${JSON.stringify(getSummaryData(filteredData).sort((a, b) => b.sales - a.sales).slice(0, 15), null, 2)}

                5. 数据样本 (前10条):
                   ${JSON.stringify(filteredData.slice(0, 10), null, 2)}
                
                用户的问题: ${userQuery || '请对当前数据进行常规分析，包括趋势、品类表现和改进建议。'}
              `
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
      }

      const result = await response.json();
      setAiAnalysis(result.choices?.[0]?.message?.content || '未能生成分析报告。');
    } catch (err) {
      console.error(err);
      setAiAnalysis('AI 分析过程中出错: ' + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter Logic
  const filteredData = useMemo(() => {
    return processedData.filter(d => {
      const matchPlat = !filters.platform || d['中文平台'] === filters.platform;
      const matchCat = !filters.category1 || d['一级品类'] === filters.category1;
      const matchAttr = !filters.attr_name || d['销售属性名称'] === filters.attr_name;
      const matchType = !filters.product_type || d['产品类型'] === filters.product_type;
      const matchWeek = !filters.week || d['年-周数'] === filters.week;
      const matchMonth = !filters.month || d['年-月份'] === filters.month;
      const matchStart = !filters.startDate || d['日期'] >= filters.startDate;
      const matchEnd = !filters.endDate || d['日期'] <= filters.endDate;
      return matchPlat && matchCat && matchAttr && matchType && matchWeek && matchMonth && matchStart && matchEnd;
    });
  }, [processedData, filters]);
  
  const orderCount = useMemo(() => {
    const sum = filteredData.reduce((acc, d) => acc + (d['订单量'] || 0), 0);
    if (sum > 0) return sum;
    
    // Fallback to unique order IDs if sum is 0
    const orderIds = filteredData.map(d => d['订单号']).filter(id => id && id !== '');
    if (orderIds.length === 0) return filteredData.length;
    return new Set(orderIds).size;
  }, [filteredData]);

  const filterOptions = useMemo(() => {
    const getUnique = (key: string) => Array.from(new Set(processedData.map(d => d[key]).filter(Boolean))).sort();
    return {
      platforms: getUnique('中文平台').map(v => ({ label: v, value: v })),
      categories: getUnique('一级品类').map(v => ({ label: v, value: v })),
      attrs: getUnique('销售属性名称').map(v => ({ label: v, value: v })),
      types: getUnique('产品类型').map(v => ({ label: v, value: v })),
      weeks: getUnique('年-周数').map(v => ({ label: v, value: v })),
      months: getUnique('年-月份').map(v => ({ label: v, value: v })),
    };
  }, [processedData]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">电商数据处理专家</h1>
          </div>
          
          <nav className="flex items-center gap-1">
            <TabButton active={activeTab === 'mappings'} onClick={() => setActiveTab('mappings')} icon={<TableIcon className="w-4 h-4" />} label="映射管理" />
            <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} icon={<Upload className="w-4 h-4" />} label="上传数据" />
            <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />} label="可视化看板" />
            <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<BrainCircuit className="w-4 h-4" />} label="AI 智能分析" />
            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon className="w-4 h-4" />} label="系统设置" />
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'mappings' && (
            <motion.div key="mappings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <MappingSection 
                title="MSKU 映射" 
                description="维护 MSKU 与产品品类及销售属性的对应关系。"
                data={mskuMappings}
                onSave={saveMskuMapping}
                onDelete={deleteMskuMapping}
                onBulkImport={(e: any) => handleBulkImport('msku', e)}
                encoding={importEncoding}
                onEncodingChange={setImportEncoding}
                fields={[
                  { name: 'msku', label: 'MSKU' },
                  { name: 'platform_zh', label: '中文平台' },
                  { name: 'category1', label: '一级品类' },
                  { name: 'category2', label: '二级品类' },
                  { name: 'attr_name', label: '销售属性名称' },
                  { name: 'product_type', label: '产品类型' },
                ]}
              />
              
              <MappingSection 
                title="平台映射" 
                description="将源报表中的平台标识映射为统一的中文名称。"
                data={platformMappings}
                onSave={savePlatformMapping}
                onDelete={deletePlatformMapping}
                onBulkImport={(e: any) => handleBulkImport('platform', e)}
                encoding={importEncoding}
                onEncodingChange={setImportEncoding}
                fields={[
                  { name: 'source_platform', label: '源平台标识' },
                  { name: 'platform_zh', label: '中文平台名称' },
                ]}
              />
            </motion.div>
          )}

          {activeTab === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto">
              <Card className="p-12 text-center space-y-6">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-slate-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold">上传周报表</h2>
                  <p className="text-slate-500 text-sm">选择从电商平台下载的 CSV 原始数据文件。</p>
                </div>

                <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto">
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg w-full">
                    <button 
                      className={cn('flex-1 py-1.5 text-xs rounded-md transition-all', importEncoding === 'UTF-8' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
                      onClick={() => setImportEncoding('UTF-8')}
                    >
                      UTF-8
                    </button>
                    <button 
                      className={cn('flex-1 py-1.5 text-xs rounded-md transition-all', importEncoding === 'GBK' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
                      onClick={() => setImportEncoding('GBK')}
                    >
                      GBK (中文)
                    </button>
                  </div>

                  <div className="relative group w-full">
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 group-hover:border-slate-400 transition-all bg-slate-50/50">
                      <p className="text-sm font-medium text-slate-600">点击或拖拽 CSV 文件至此处</p>
                    </div>
                  </div>
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在处理数据...
                  </div>
                )}
              </Card>

              <Card className="mt-6 p-6 space-y-4 border-slate-200 bg-slate-50/30">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>上传字段模版说明</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-600">核心必填字段 (任选其一):</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-500">
                      <li><code className="bg-slate-100 px-1 rounded text-slate-900">MSKU</code> / <code className="bg-slate-100 px-1 rounded text-slate-900">商家编码</code></li>
                      <li><code className="bg-slate-100 px-1 rounded text-slate-900">成交金额</code> / <code className="bg-slate-100 px-1 rounded text-slate-900">销售额</code></li>
                      <li><code className="bg-slate-100 px-1 rounded text-slate-900">数量</code> / <code className="bg-slate-100 px-1 rounded text-slate-900">销量</code></li>
                      <li><code className="bg-slate-100 px-1 rounded text-slate-900">时间</code> / <code className="bg-slate-100 px-1 rounded text-slate-900">日期</code></li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-600">可选/辅助字段:</p>
                    <ul className="list-disc list-inside space-y-1 text-slate-500">
                      <li><code className="bg-slate-100 px-1 rounded text-slate-900">订单量</code> (若无则按行统计)</li>
                      <li><code className="bg-slate-100 px-1 rounded text-slate-900">订单号</code> (用于订单去重)</li>
                    </ul>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-400">
                    * 系统会自动识别中英文表头，支持模糊匹配。建议使用 CSV 格式上传。
                  </p>
                </div>
              </Card>

              {processedData.length > 0 && processedData.some(d => !d._isMapped) && (
                <Card className="mt-8 overflow-hidden border-amber-100">
                  <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-bold text-sm">发现未映射的 MSKU</span>
                    </div>
                    <span className="text-xs text-amber-700">
                      共 {processedData.filter(d => !d._isMapped).length} 条记录未找到映射关系
                    </span>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 font-medium text-slate-500">MSKU</th>
                          <th className="px-4 py-2 font-medium text-slate-500">平台</th>
                          <th className="px-4 py-2 font-medium text-slate-500">出现次数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(
                          processedData.filter(d => !d._isMapped).reduce((acc: any, curr) => {
                            const key = `${curr.MSKU}|${curr['中文平台']}`;
                            acc[key] = (acc[key] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([key, count]: [string, any]) => {
                          const [msku, platform] = key.split('|');
                          return (
                            <tr key={key} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-mono">{msku}</td>
                              <td className="px-4 py-2">{platform}</td>
                              <td className="px-4 py-2">{count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
                    <p className="text-[10px] text-slate-400">请在“映射管理”中添加以上 MSKU 的对应关系，以确保统计数据完整。</p>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {processedData.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-slate-500">暂无数据。请先上传报表。</p>
                </Card>
              ) : (
                <>
                  {/* Multi-dimensional Filters */}
                  <Card className="p-4 bg-white border-slate-200">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700">多维筛选:</span>
                      </div>
                      <Select 
                        placeholder="所有平台" 
                        options={filterOptions.platforms} 
                        value={filters.platform} 
                        onChange={(v: string) => setFilters({ ...filters, platform: v })} 
                      />
                      <Select 
                        placeholder="所有品类" 
                        options={filterOptions.categories} 
                        value={filters.category1} 
                        onChange={(v: string) => setFilters({ ...filters, category1: v })} 
                      />
                      <Select 
                        placeholder="所有属性" 
                        options={filterOptions.attrs} 
                        value={filters.attr_name} 
                        onChange={(v: string) => setFilters({ ...filters, attr_name: v })} 
                      />
                      <Select 
                        placeholder="产品类型" 
                        options={filterOptions.types} 
                        value={filters.product_type} 
                        onChange={(v: string) => setFilters({ ...filters, product_type: v })} 
                      />
                      <div className="flex items-center gap-2">
                        <Input 
                          type="date" 
                          className="w-36 h-9 py-1" 
                          value={filters.startDate} 
                          onChange={(e: any) => setFilters({ ...filters, startDate: e.target.value })} 
                        />
                        <span className="text-slate-400">至</span>
                        <Input 
                          type="date" 
                          className="w-36 h-9 py-1" 
                          value={filters.endDate} 
                          onChange={(e: any) => setFilters({ ...filters, endDate: e.target.value })} 
                        />
                      </div>
                      <Select 
                        placeholder="所有周数" 
                        options={filterOptions.weeks} 
                        value={filters.week} 
                        onChange={(v: string) => setFilters({ ...filters, week: v })} 
                      />
                      <Select 
                        placeholder="所有月份" 
                        options={filterOptions.months} 
                        value={filters.month} 
                        onChange={(v: string) => setFilters({ ...filters, month: v })} 
                      />
                      <Button variant="ghost" size="sm" onClick={() => setFilters({ platform: '', category1: '', attr_name: '', product_type: '', week: '', month: '', startDate: '', endDate: '' })}>
                        重置筛选
                      </Button>
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard title="销售额" value={`¥${filteredData.reduce((acc, d) => acc + (d['销售额'] || 0), 0).toLocaleString()}`} icon={<BarChart3 className="w-4 h-4" />} />
                    <StatCard title="销量" value={filteredData.reduce((acc, d) => acc + (d['销量'] || 0), 0).toLocaleString()} icon={<Package className="w-4 h-4" />} />
                    <StatCard title="订单量" value={orderCount.toLocaleString()} icon={<FileSpreadsheet className="w-4 h-4" />} />
                    <StatCard title="活跃MSKU/总SKU" value={`${new Set(filteredData.map(d => d['MSKU'])).size} / ${new Set(mskuMappings.map(m => m.msku)).size}`} icon={<Filter className="w-4 h-4" />} />
                  </div>

                  <div className="flex justify-end">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                      <button 
                        className={cn('px-3 py-1 text-xs rounded-md transition-all', chartMetric === 'sales' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
                        onClick={() => setChartMetric('sales')}
                      >
                        销售额
                      </button>
                      <button 
                        className={cn('px-3 py-1 text-xs rounded-md transition-all', chartMetric === 'orders' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
                        onClick={() => setChartMetric('orders')}
                      >
                        订单量
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6 space-y-4">
                      <h3 className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> 平台分布 ({chartMetric === 'sales' ? '销售额' : '订单量'})</span>
                      </h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getPlatformChartData(filteredData, chartMetric)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(val: any) => chartMetric === 'sales' ? `¥${val.toLocaleString()}` : val} />
                            <Bar dataKey="value" fill="#0F172A" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="p-6 space-y-4">
                      <h3 className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-2"><LineChartIcon className="w-4 h-4" /> 趋势分析 ({chartMetric === 'sales' ? '销售额' : '订单量'})</span>
                      </h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getWeeklyChartData(filteredData, chartMetric)}>
                            <defs>
                              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(val: any) => chartMetric === 'sales' ? `¥${val.toLocaleString()}` : val} />
                            <Area type="monotone" dataKey="value" stroke="#10B981" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold flex items-center gap-2"><TableIcon className="w-4 h-4" /> 销售额汇总 (可直接复制)</h3>
                      <p className="text-xs text-slate-400">按平台与品类汇总，方便快速复制到 Excel。</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100" onClick={() => setSortConfig({ key: 'platform', direction: sortConfig?.key === 'platform' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                              平台 {sortConfig?.key === 'platform' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100" onClick={() => setSortConfig({ key: 'category', direction: sortConfig?.key === 'category' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                              一级品类 {sortConfig?.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase text-right cursor-pointer hover:bg-slate-100" onClick={() => setSortConfig({ key: 'orders', direction: sortConfig?.key === 'orders' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                              订单量 {sortConfig?.key === 'orders' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase text-right cursor-pointer hover:bg-slate-100" onClick={() => setSortConfig({ key: 'sales', direction: sortConfig?.key === 'sales' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                              销售额 (¥) {sortConfig?.key === 'sales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const data = getSummaryData(filteredData);
                            if (sortConfig) {
                              data.sort((a, b) => {
                                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                                return 0;
                              });
                            }
                            return data.map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 text-sm text-slate-700">{row.platform}</td>
                                <td className="px-4 py-2 text-sm text-slate-700">{row.category}</td>
                                <td className="px-4 py-2 text-sm text-slate-700 text-right">{row.orders}</td>
                                <td className="px-4 py-2 text-sm font-medium text-slate-900 text-right">{row.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ));
                          })()}
                          <tr className="bg-slate-50 font-bold">
                            <td colSpan={2} className="px-4 py-2 text-sm text-slate-900">总计</td>
                            <td className="px-4 py-2 text-sm text-slate-900 text-right">{filteredData.length}</td>
                            <td className="px-4 py-2 text-sm text-slate-900 text-right">¥{filteredData.reduce((acc, d) => acc + (d['销售额'] || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <Card className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {Object.keys(filteredData[0] || {}).slice(0, 12).map(key => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.slice(0, 50).map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).slice(0, 12).map((val: any, j) => (
                              <td key={j}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                      显示前 50 条数据，共 {filteredData.length} 条。
                    </div>
                  </Card>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <Card className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold flex items-center gap-2"><BrainCircuit className="w-5 h-5" /> AI 智能分析</h2>
                    <p className="text-slate-500 text-sm">利用大模型分析当前筛选数据下的销量趋势及平台变动。</p>
                  </div>
                  <Button onClick={runAiAnalysis} disabled={isAnalyzing || filteredData.length === 0}>
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                    开始分析
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">您想问什么？(可选)</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="例如：分析上周销售额下降的原因，或者哪个品类潜力最大？" 
                      value={userQuery}
                      onChange={(e: any) => setUserQuery(e.target.value)}
                      onKeyDown={(e: any) => e.key === 'Enter' && runAiAnalysis()}
                    />
                  </div>
                </div>

                {aiAnalysis ? (
                  <div className="prose prose-slate max-w-none bg-slate-50 p-6 rounded-xl border border-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2 border-2 border-dashed border-slate-100 rounded-xl">
                    <BrainCircuit className="w-12 h-12 opacity-20" />
                    <p className="text-sm">输入问题并点击“开始分析”生成数据洞察。</p>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto">
              <Card className="p-6 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> 系统设置</h2>
                
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">大模型配置 (支持国产模型)</h3>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">API Base URL</label>
                      <Input 
                        placeholder="例如: https://api.deepseek.com/v1" 
                        value={settings.ai_base_url || ''}
                        onChange={(e: any) => saveSetting('ai_base_url', e.target.value)}
                      />
                      <p className="text-xs text-slate-500">OpenAI 兼容接口地址。留空默认使用 Gemini。</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Model Name</label>
                      <Input 
                        placeholder="例如: deepseek-chat" 
                        value={settings.ai_model_name || ''}
                        onChange={(e: any) => saveSetting('ai_model_name', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">API Key</label>
                      <Input 
                        type="password" 
                        placeholder="输入您的 API Key..." 
                        value={settings.ai_api_key || ''}
                        onChange={(e: any) => saveSetting('ai_api_key', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">设置将自动保存。</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Helper Components ---

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
      active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
    )}
  >
    {icon}
    {label}
  </button>
);

const StatCard = ({ title, value, icon }: any) => (
  <Card className="p-6 flex items-center justify-between">
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
      {icon}
    </div>
  </Card>
);

const MappingSection = ({ title, description, data, onSave, onDelete, onBulkImport, fields, encoding, onEncodingChange }: any) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [mskuFilter, setMskuFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter data based on search term and specific filters
  const filteredData = useMemo(() => {
    let result = data;
    
    // General search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row: any) => 
        fields.some((f: any) => 
          String(row[f.name] || '').toLowerCase().includes(term)
        )
      );
    }
    
    // MSKU filter
    if (mskuFilter) {
      const term = mskuFilter.toLowerCase();
      result = result.filter((row: any) => 
        String(row.msku || row.source_platform || '').toLowerCase().includes(term)
      );
    }
    
    // Platform filter
    if (platformFilter) {
      const term = platformFilter.toLowerCase();
      result = result.filter((row: any) => 
        String(row.platform_zh || '').toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [data, searchTerm, mskuFilter, platformFilter, fields]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, mskuFilter, platformFilter]);

  const handleSaveNew = () => {
    if (title.includes('MSKU')) {
      if (!newEntry.msku || !newEntry.platform_zh) {
        alert('MSKU 和 中文平台 为必填项！');
        return;
      }
    } else {
      if (!newEntry.source_platform || !newEntry.platform_zh) {
        alert('源平台标识 和 中文平台名称 为必填项！');
        return;
      }
    }
    onSave(newEntry);
    setNewEntry({});
    setIsAdding(false);
  };

  const handleStartEdit = (row: any) => {
    setEditingId(row.id);
    setEditingEntry({ ...row });
  };

  const handleSaveEdit = () => {
    if (title.includes('MSKU')) {
      if (!editingEntry.msku || !editingEntry.platform_zh) {
        alert('MSKU 和 中文平台 为必填项！');
        return;
      }
    } else {
      if (!editingEntry.source_platform || !editingEntry.platform_zh) {
        alert('源平台标识 和 中文平台名称 为必填项！');
        return;
      }
    }
    onSave(editingEntry);
    setEditingId(null);
    setEditingEntry({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingEntry({});
  };

  const handleExport = () => {
    if (data.length === 0) {
      alert('没有数据可导出！');
      return;
    }
    
    // Prepare data for export (remove internal ID)
    const exportData = data.map(({ id, ...rest }: any) => rest);
    const csv = Papa.unparse(exportData);
    const blob = new Blob([encoding === 'GBK' ? new TextEncoder().encode(csv) : csv], { type: 'text/csv;charset=' + encoding });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-slate-500 text-sm">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input 
                placeholder={title.includes('MSKU') ? "搜索 MSKU..." : "搜索源平台..."}
                value={mskuFilter}
                onChange={(e: any) => setMskuFilter(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <div className="relative w-full md:w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input 
                placeholder="搜索中文平台..." 
                value={platformFilter}
                onChange={(e: any) => setPlatformFilter(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
          <div className="relative w-full md:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="全局搜索..." 
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button 
              className={cn('px-2 py-1 text-xs rounded-md transition-all', encoding === 'UTF-8' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
              onClick={() => onEncodingChange('UTF-8')}
            >
              UTF-8
            </button>
            <button 
              className={cn('px-2 py-1 text-xs rounded-md transition-all', encoding === 'GBK' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
              onClick={() => onEncodingChange('GBK')}
            >
              GBK
            </button>
          </div>
          <div className="relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={onBulkImport}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <Button variant="secondary" size="sm">
              <FileUp className="w-4 h-4" /> 导入
            </Button>
          </div>
          <Button onClick={handleExport} variant="secondary" size="sm">
            <Download className="w-4 h-4" /> 导出
          </Button>
          <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? 'secondary' : 'primary'} size="sm">
            {isAdding ? '取消' : <><Plus className="w-4 h-4" /> 添加</>}
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="p-4 bg-slate-50 border-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {fields.map((f: any) => (
              <div key={f.name} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{f.label}</label>
                <Input 
                  value={newEntry[f.name] || ''} 
                  onChange={(e: any) => setNewEntry({ ...newEntry, [f.name]: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveNew} variant="success" size="sm">保存</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden border-slate-200">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {fields.map((f: any) => (
                  <th key={f.name} className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 1} className="text-center py-12 text-slate-400 italic text-sm">
                    {searchTerm ? '未找到匹配的条目。' : '暂无匹配条目。'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {fields.map((f: any) => (
                      <td key={f.name} className="px-3 py-1.5 text-xs text-slate-600">
                        {editingId === row.id ? (
                          <Input 
                            value={editingEntry[f.name] || ''} 
                            onChange={(e: any) => setEditingEntry({ ...editingEntry, [f.name]: e.target.value })}
                            className="h-7 py-0.5 text-xs"
                          />
                        ) : (
                          <div className="truncate max-w-[150px]" title={row[f.name]}>
                            {row[f.name]}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {editingId === row.id ? (
                          <>
                            <button onClick={handleSaveEdit} className="text-emerald-500 hover:text-emerald-600 transition-colors" title="保存">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600 transition-colors" title="取消">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleStartEdit(row)} className="text-slate-300 hover:text-slate-600 transition-colors" title="编辑">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => onDelete(row.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, filteredData.length)} 条，共 {filteredData.length} 条
            </div>
            <div className="flex items-center gap-1">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        'w-7 h-7 text-xs font-medium rounded flex items-center justify-center transition-all',
                        currentPage === pageNum ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-600'
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

// --- Chart Data Helpers ---

const getPlatformChartData = (data: OrderData[], metric: 'orders' | 'sales' = 'orders') => {
  const counts: any = {};
  
  data.forEach(d => {
    const plat = d['中文平台'] || '未知';
    if (metric === 'sales') {
      counts[plat] = (counts[plat] || 0) + (d['销售额'] || 0);
    } else {
      // Use '订单量' field if available, otherwise count rows
      const val = d['订单量'] !== undefined ? (d['订单量'] || 0) : 1;
      counts[plat] = (counts[plat] || 0) + val;
    }
  });

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
};

const getWeeklyChartData = (data: OrderData[], metric: 'orders' | 'sales' = 'orders') => {
  const counts: any = {};

  data.forEach(d => {
    const week = d['年-周数'];
    if (week) {
      if (metric === 'sales') {
        counts[week] = (counts[week] || 0) + (d['销售额'] || 0);
      } else {
        const val = d['订单量'] !== undefined ? (d['订单量'] || 0) : 1;
        counts[week] = (counts[week] || 0) + val;
      }
    }
  });

  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name, value }));
};

const getSummaryData = (data: OrderData[]) => {
  const summary: any = {};

  data.forEach(d => {
    const key = `${d['中文平台']}|${d['一级品类'] || '未分类'}`;
    if (!summary[key]) {
      summary[key] = { platform: d['中文平台'], category: d['一级品类'] || '未分类', sales: 0, orders: 0, quantity: 0 };
    }
    summary[key].sales += (d['销售额'] || 0);
    summary[key].quantity += (d['销量'] || 0);
    summary[key].orders += d['订单量'] !== undefined ? (d['订单量'] || 0) : 1;
  });

  return Object.values(summary) as any[];
};
