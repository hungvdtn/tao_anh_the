import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon,
  Camera,
  ChevronDown,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PHOTO_TYPES, PhotoType } from './constants';
import { photoProcessor } from './services/photoProcessor';
import { cn } from './lib/utils';

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<PhotoType>(PHOTO_TYPES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Cleanup result URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (resultUrl && resultUrl.startsWith('blob:')) {
        URL.revokeObjectURL(resultUrl);
      }
    };
  }, [resultUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng chọn tệp hình ảnh.');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultUrl(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultUrl(null);
      setError(null);
    }
  };

  const processPhoto = async () => {
    if (!selectedFile) return;

    console.log("[App] Bắt đầu tiến trình xử lý ảnh...");
    setIsProcessing(true);
    setError(null);
    setResultUrl(null);
    setProgress(5);

    try {
      // Simulate initial progress
      setProgress(10);
      
      const result = await photoProcessor.process(selectedFile, selectedType);
      
      console.log("[App] Xử lý ảnh hoàn tất, cập nhật giao diện.");
      setProgress(100);
      setResultUrl(result);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      console.error("[App] Lỗi trong quá trình xử lý:", err);
      const errorMessage = err.message || 'Có lỗi xảy ra trong quá trình xử lý.';
      setError(errorMessage);
      
      // If it's a memory issue, we might want to suggest a specific message
      if (errorMessage.toLowerCase().includes('memory') || errorMessage.toLowerCase().includes('tài nguyên')) {
        setError("Lỗi xử lý ảnh: Quá tải tài nguyên trình duyệt. Vui lòng thử lại với ảnh nhỏ hơn hoặc khởi động lại trình duyệt.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `photo_${selectedType.id}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Camera className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">ID Photo <span className="text-blue-600">AI</span></h1>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-blue-600 transition-colors">Hướng dẫn</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Quy định</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Về chúng tôi</a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                1. Tải ảnh chân dung
              </h2>
              
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer group",
                  selectedFile 
                    ? "border-blue-200 bg-blue-50/30" 
                    : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*"
                />
                
                <div className="flex flex-col items-center text-center">
                  {previewUrl ? (
                    <div className="relative w-32 h-32 mb-4 rounded-xl overflow-hidden shadow-md ring-4 ring-white">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <RefreshCw className="text-white w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="text-slate-400 w-8 h-8" />
                    </div>
                  )}
                  <p className="font-medium text-slate-700">
                    {selectedFile ? selectedFile.name : "Kéo thả hoặc nhấn để tải ảnh"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Hỗ trợ JPG, PNG (Tối đa 10MB)</p>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChevronDown className="w-5 h-5 text-blue-600" />
                2. Chọn loại ảnh thẻ
              </h2>
              
              <div className="space-y-3">
                {PHOTO_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                      selectedType.id === type.id 
                        ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600" 
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div>
                      <p className={cn("font-semibold", selectedType.id === type.id ? "text-blue-700" : "text-slate-700")}>
                        {type.name}
                      </p>
                      <p className="text-xs text-slate-500">{type.description}</p>
                    </div>
                    <div 
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: selectedType.id === type.id ? '#2563eb' : '#cbd5e1' }}
                    >
                      {selectedType.id === type.id && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <button
              disabled={!selectedFile || isProcessing}
              onClick={processPhoto}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2",
                !selectedFile || isProcessing
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-200"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Đang xử lý {progress}%...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Tạo ảnh thẻ ngay
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">Kết quả xem trước</span>
                {resultUrl && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Đã hoàn tất
                  </span>
                )}
              </div>
              
              <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.div 
                      key="error"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-4 max-w-sm p-6 bg-red-50 rounded-3xl border border-red-100"
                    >
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="font-bold text-red-800">Lỗi xử lý ảnh</p>
                        <p className="text-sm text-red-600 mt-1">{error}</p>
                      </div>
                      <button 
                        onClick={processPhoto}
                        className="px-6 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all text-sm"
                      >
                        Thử lại
                      </button>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <div className="relative group">
                        <div className="absolute -inset-4 bg-blue-100/50 rounded-[40px] blur-2xl group-hover:bg-blue-200/50 transition-all" />
                        <div className="relative bg-white p-2 rounded-lg shadow-2xl">
                          <img 
                            src={resultUrl} 
                            alt="Result" 
                            className="max-h-[400px] w-auto rounded shadow-inner"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={downloadResult}
                          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                        >
                          <Download className="w-5 h-5" />
                          Tải xuống JPG (300 DPI)
                        </button>
                        <button
                          onClick={reset}
                          className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                        >
                          Làm lại
                        </button>
                      </div>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-blue-600/50" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-700">AI đang xử lý ảnh của bạn</p>
                        <p className="text-sm text-slate-400">Tách nền & Căn chỉnh khuôn mặt...</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center space-y-4 max-w-xs"
                    >
                      <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-600">Chưa có ảnh nào được tạo</p>
                        <p className="text-sm text-slate-400">Tải ảnh lên và nhấn "Tạo ảnh thẻ" để xem kết quả tại đây.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Tips Section */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Mẹo 1</p>
                <p className="text-sm text-slate-600">Chụp ảnh nơi có ánh sáng đều, tránh đổ bóng mạnh trên mặt.</p>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Mẹo 2</p>
                <p className="text-sm text-slate-600">Giữ đầu thẳng, mắt nhìn trực diện vào camera.</p>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Mẹo 3</p>
                <p className="text-sm text-slate-600">Phông nền gốc càng đơn giản, kết quả tách nền càng đẹp.</p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-200/50">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                Lưu Ý Quan Trọng
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-blue-600">1</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Xem hướng dẫn tự chụp ảnh thẻ tại nhà{' '}
                    <a href="https://example.com/huong-dan-chup-anh" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">
                      tại đây
                    </a>.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-blue-600">2</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Không nên upload ảnh đã qua chỉnh sửa. Nên chụp bằng camera độ phân giải cao khoảng từ 2000x3000 pixel để có kết quả tốt nhất.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-blue-600">3</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Ảnh thẻ cần rõ nét, không bị mờ nhòe, không đeo kính râm hoặc phụ kiện che mặt.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-slate-400">© 2026 ID Photo Maker AI. Bảo mật 100% - Xử lý trực tiếp trên trình duyệt.</p>
          <div className="flex gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-slate-600">Điều khoản</a>
            <a href="#" className="hover:text-slate-600">Bảo mật</a>
            <a href="#" className="hover:text-slate-600">Liên hệ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
