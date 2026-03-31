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
  Loader2,
  ArrowRight,
  Info,
  Check,
  User,
  Settings,
  FileImage,
  Zap,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ReactGA from 'react-ga4';
import { PHOTO_TYPES, PhotoType } from './constants';
import { photoProcessor } from './services/photoProcessor';
import { cn } from './lib/utils';

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<PhotoType>(PHOTO_TYPES[0]);
  const [customBgColor, setCustomBgColor] = useState('#3a98e3');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Pre-initialize AI models to reduce first-run delay, but delay it significantly
    // to ensure the initial UI and intro are perfectly responsive.
    const initAI = () => {
      console.log("[App] Khởi tạo sớm các mô hình AI...");
      photoProcessor.init().catch(err => console.error("[App] Lỗi khởi tạo sớm:", err));
    };

    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => initAI());
      } else {
        initAI();
      }
    }, 3000); // Wait 3s after mount to start heavy work
    
    return () => clearTimeout(timer);
  }, []);

  const validateResolution = (file: File, typeId: string): Promise<{ valid: boolean; message?: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        
        let minW = 0;
        let minH = 0;
        let dpi = 0;

        if (typeId === 'passport-4x6' || typeId === 'card-4x6') {
          minW = 630;
          minH = 945;
          dpi = 400;
        } else if (typeId === 'license-3x4') {
          minW = 591;
          minH = 787;
          dpi = 500;
        } else if (typeId === 'card-3x4') {
          minW = 472;
          minH = 630;
          dpi = 400;
        }

        if (w < minW || h < minH) {
          resolve({
            valid: false,
            message: `Độ phân giải ảnh quá thấp. Vui lòng tải lên ảnh có độ phân giải tối thiểu ${dpi}dpi trở lên, tương ứng với kích thước ảnh ${minW} x ${minH} pixel.`
          });
        } else {
          resolve({ valid: true });
        }
      };
      img.onerror = () => resolve({ valid: false, message: 'Không thể đọc tệp hình ảnh.' });
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng chọn tệp hình ảnh.');
        return;
      }
      
      const validation = await validateResolution(file, selectedType.id);
      if (!validation.valid) {
        setError(validation.message || 'Ảnh không đạt yêu cầu.');
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultUrl(null);
      setError(null);
      if (currentStep < 4) setCurrentStep(4);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const validation = await validateResolution(file, selectedType.id);
      if (!validation.valid) {
        setError(validation.message || 'Ảnh không đạt yêu cầu.');
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultUrl(null);
      setError(null);
      if (currentStep < 4) setCurrentStep(4);
    }
  };

  const processPhoto = async () => {
    if (!selectedFile) return;

    console.log("[App] Bắt đầu tiến trình xử lý ảnh...");
    setIsProcessing(true);
    setError(null);
    setResultUrl(null);
    setProgress(5);
    setProcessingStatus('Bạn vui lòng chờ chút xíu nhé ....');

    try {
      const typeWithColor = { 
        ...selectedType, 
        bgColor: selectedType.id.startsWith('card-') ? customBgColor : selectedType.bgColor 
      };
      
      const result = await photoProcessor.process(selectedFile, typeWithColor, (p) => {
        // Ensure progress only moves forward and is visible
        setProgress(prev => {
          const next = Math.max(prev, p);
          console.log(`[App] Tiến trình: ${next}%`);
          return next;
        });
      });
      
      console.log("[App] Xử lý ảnh hoàn tất, cập nhật giao diện.");
      setProgress(100);
      setResultUrl(result);
      setCurrentStep(5);
      
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (confettiErr) {
        console.warn("[App] Lỗi khi chạy hiệu ứng pháo hoa:", confettiErr);
      }
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

    try {
      // Track GA4 event
      ReactGA.event({
        category: "ID_Photo_Generator",
        action: "download_photo_success",
        label: "Tạo ảnh thẻ thành công"
      });
    } catch (gaError) {
      // Silent fail for GA4 to not block download
      console.error("GA4 Event Tracking Error:", gaError);
    }

    try {
      const link = document.createElement('a');
      link.href = resultUrl;
      link.download = `photo_${selectedType.id}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (downloadError) {
      console.error("Download Error:", downloadError);
      setError("Có lỗi xảy ra khi tải ảnh xuống. Vui lòng thử lại.");
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResultUrl(null);
    setError(null);
    setProgress(0);
    setProcessingStatus('');
    setCurrentStep(1);
  };

  const steps = [
    { id: 1, name: 'Tự chụp ảnh', icon: Camera },
    { id: 2, name: 'Chọn loại ảnh', icon: Settings },
    { id: 3, name: 'Tải ảnh lên', icon: Upload },
    { id: 4, name: 'Tạo ảnh thẻ', icon: Zap },
    { id: 5, name: 'Tải ảnh xuống', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
              <Camera className="text-white w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">ID Photo <span className="text-blue-600">AIBTeM</span></h1>
          </div>
          <nav className="hidden md:flex gap-8 text-lg font-bold text-slate-500">
            <a href="https://hungvdtn.vn/huong-dan-tao-anh-tren-app-tao-anh-the-aibtem/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-all flex items-center gap-2">
              Hướng dẫn
              <ExternalLink className="w-4 h-4" />
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-12">
        {/* Process Flow Block */}
        <section className="bg-white p-8 rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex flex-col items-center gap-3 relative z-10 flex-1">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg",
                  currentStep === step.id ? "bg-blue-600 text-white shadow-blue-200 scale-110" : "bg-slate-100 text-slate-400"
                )}>
                  <step.icon className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest", currentStep === step.id ? "text-blue-600" : "text-slate-400")}>Bước {step.id}</p>
                  <p className={cn("text-sm font-bold", currentStep === step.id ? "text-slate-900" : "text-slate-500")}>{step.name}</p>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "hidden md:block absolute top-7 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px transition-colors duration-500",
                    currentStep > step.id ? "bg-blue-600" : "bg-slate-100"
                  )} />
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-12">
            {/* Step 1: Self Photo Guide */}
            <section 
              className={cn(
                "bg-white p-8 rounded-[40px] shadow-2xl shadow-blue-100/50 border border-blue-50 relative overflow-hidden group hover:shadow-blue-200/50 transition-all duration-500",
                currentStep !== 1 && "opacity-60 grayscale-[0.3]"
              )}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500" />
              
              <h2 className="text-xl font-extrabold mb-6 flex items-center gap-3 text-slate-800">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Camera className="w-6 h-6" />
                </div>
                1. Tự chụp ảnh
              </h2>
              
              <div className="space-y-4 text-sm text-slate-600 relative z-10">
                <p className="font-medium text-slate-800">Bạn có thể tự chụp ảnh bằng chân máy (tripod) hoặc nhờ người chụp hộ. Lưu ý:</p>
                <ul className="space-y-3">
                  {[
                    { t: 'Tư thế', d: 'Đầu thẳng không cúi xuống hay ngửa ra sau, không nghiêng; lưng thẳng, vai thẳng, duỗi thẳng tay; mắt nhìn vào camera đặt ngang tầm mắt, cách người 0.6-0.8m' },
                    { t: 'Phông nền', d: 'Nên đứng trước một bức tường trơn; nền càng đơn giản, tách nền càng đẹp.' },
                    { t: 'Ánh sáng', d: 'Đứng đối diện nguồn sáng đều, không để đổ bóng trên mặt.' },
                    { t: 'Khung hình', d: 'Lấy từ thắt lưng trở lên' },
                    { t: 'Chụp ảnh', d: 'Dùng camera sau, không chụp ảnh selfie.' }
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5 text-blue-600 font-bold text-[10px]">
                        {i + 1}
                      </div>
                      <p><span className="font-bold text-slate-800">{item.t}:</span> {item.d}</p>
                    </li>
                  ))}
                </ul>
                
                <div className="pt-4 border-t border-slate-100">
                  <a 
                    href="https://hungvdtn.vn/huong-dan-tao-anh-tren-app-tao-anh-the-aibtem/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 font-bold hover:underline flex items-center gap-2 group/link"
                  >
                    Xem hướng dẫn chi tiết tạo ảnh thẻ ID Photo AIBTeM tại đây
                    <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                  </a>
                </div>

                {currentStep === 1 && (
                  <button 
                    onClick={() => setCurrentStep(2)}
                    className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all mt-4 shadow-lg shadow-blue-200/50"
                  >
                    Tôi đã hiểu, tiếp tục
                  </button>
                )}
              </div>
            </section>

            {/* Step 2: Select Type */}
            <section className={cn(
              "bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50",
              currentStep < 2 && "opacity-50 pointer-events-none grayscale-[0.5]",
              currentStep === 2 && "ring-2 ring-blue-600 ring-offset-4"
            )}>
              <h2 className="text-xl font-extrabold mb-6 flex items-center gap-3 text-slate-800">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Settings className="w-6 h-6" />
                </div>
                2. Chọn loại ảnh thẻ
              </h2>
              
              <div className="space-y-4">
                {PHOTO_TYPES.map((type) => (
                  <div key={type.id}>
                    <button
                      onClick={() => {
                        setSelectedType(type);
                        if (currentStep < 3) setCurrentStep(3);
                      }}
                      className={cn(
                        "w-full text-left p-5 rounded-[24px] border-2 transition-all flex items-center justify-between group relative overflow-hidden",
                        selectedType.id === type.id 
                          ? "border-blue-600 bg-blue-50/50" 
                          : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="relative z-10">
                        <p className={cn("text-base font-bold", selectedType.id === type.id ? "text-blue-700" : "text-slate-700")}>
                          {type.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">{type.description}</p>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedType.id === type.id ? "border-blue-600 bg-blue-600" : "border-slate-200"
                      )}>
                        {selectedType.id === type.id && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                    
                    {selectedType.id === type.id && type.id.startsWith('card-') && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 p-4 bg-white rounded-3xl border-2 border-blue-100 flex items-center gap-4 shadow-sm"
                      >
                        <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Màu nền:</span>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => setCustomBgColor('#3a98e3')}
                            className={cn(
                              "w-10 h-10 rounded-2xl bg-[#3a98e3] border-4 transition-all shadow-sm",
                              customBgColor === '#3a98e3' ? "border-blue-600 scale-110" : "border-white"
                            )}
                          />
                          <button 
                            onClick={() => setCustomBgColor('#ffffff')}
                            className={cn(
                              "w-10 h-10 rounded-2xl bg-white border-4 transition-all shadow-sm",
                              customBgColor === '#ffffff' ? "border-blue-600 scale-110" : "border-slate-100"
                            )}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Step 3: Upload Portrait */}
            <section className={cn(
              "bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50",
              currentStep < 3 && "opacity-50 pointer-events-none grayscale-[0.5]",
              currentStep === 3 && "ring-2 ring-blue-600 ring-offset-4"
            )}>
              <h2 className="text-xl font-extrabold mb-6 flex items-center gap-3 text-slate-800">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <FileImage className="w-6 h-6" />
                </div>
                3. Tải ảnh chân dung
              </h2>
              
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-[32px] p-10 transition-all cursor-pointer group overflow-hidden",
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
                
                <div className="flex flex-col items-center text-center relative z-10">
                  {previewUrl ? (
                    <div className="relative w-40 h-40 mb-6 rounded-3xl overflow-hidden shadow-2xl ring-8 ring-white">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <RefreshCw className="text-white w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-slate-100 rounded-[28px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:bg-blue-50">
                      <Upload className="text-slate-400 w-10 h-10 group-hover:text-blue-600" />
                    </div>
                  )}
                  <p className="text-lg font-bold text-slate-700">
                    {selectedFile ? selectedFile.name : "Kéo thả hoặc nhấn để tải ảnh"}
                  </p>
                  <p className="text-sm text-slate-400 mt-2 font-medium">Hỗ trợ JPG, PNG (Tối đa 10MB)</p>
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-5 bg-red-50 border-2 border-red-100 rounded-3xl flex items-start gap-4 text-red-700"
                >
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <p className="text-sm font-bold leading-relaxed">{error}</p>
                </motion.div>
              )}
            </section>

            {/* Step 4: Generate Button */}
            <button
              disabled={!selectedFile || isProcessing}
              onClick={processPhoto}
              className={cn(
                "w-full py-6 rounded-[32px] font-extrabold text-xl shadow-2xl transition-all flex items-center justify-center gap-3",
                !selectedFile
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : isProcessing
                    ? "bg-blue-500 text-white cursor-wait shadow-blue-100 opacity-90"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-200 hover:shadow-blue-300",
                currentStep === 4 && !isProcessing && "ring-4 ring-blue-200 animate-pulse"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  AI đang xử lý .... {progress}%
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6 fill-current" />
                  4. Tạo ảnh thẻ ngay
                </>
              )}
            </button>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col transition-all hover:shadow-2xl hover:shadow-slate-200/50">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.2em]">Kết quả xem trước</span>
                </div>
                {resultUrl && (
                  <span className="flex items-center gap-2 text-xs font-extrabold text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-100">
                    <CheckCircle2 className="w-4 h-4" />
                    Đã hoàn tất
                  </span>
                )}
              </div>
              
              <div className="flex-1 flex items-center justify-center p-12 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:30px_30px]">
                <AnimatePresence mode="wait">
                  {resultUrl ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-10"
                    >
                      <div className="relative group">
                        <div className="absolute -inset-8 bg-blue-200/30 rounded-[60px] blur-3xl group-hover:bg-blue-300/40 transition-all duration-700" />
                        <div className="relative bg-white p-4 rounded-3xl shadow-2xl ring-1 ring-slate-100">
                          <img 
                            src={resultUrl} 
                            alt="Result" 
                            className="max-h-[450px] w-auto rounded-xl shadow-inner"
                          />
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4 w-full">
                        <button
                          onClick={downloadResult}
                          className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-blue-600 text-white rounded-[24px] font-extrabold hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200/50 active:scale-95"
                        >
                          <Download className="w-6 h-6" />
                          Tải xuống JPG ({selectedType.dpi} DPI)
                        </button>
                        <button
                          onClick={reset}
                          className="px-8 py-5 bg-white border-2 border-[#1CA7EC] text-[#1CA7EC] rounded-[24px] font-extrabold hover:bg-slate-50 transition-all active:scale-95"
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
                      className="flex flex-col items-center gap-6"
                    >
                      <div className="relative">
                        <div className="w-32 h-32 border-[6px] border-blue-50 border-t-blue-600 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-blue-600/30" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-xl font-extrabold text-slate-800">{processingStatus || 'Bạn vui lòng chờ chút xíu nhé ....'}</p>
                        <p className="text-sm font-medium text-slate-400">
                          {progress < 20 ? 'Đang tải mô hình AI (chỉ lần đầu)...' : 
                           progress < 80 ? 'Đang tách nền & Căn chỉnh khuôn mặt...' : 
                           'Đang hoàn thiện chi tiết ảnh...'}
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center space-y-6 max-w-sm"
                    >
                      <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto text-slate-200 shadow-inner">
                        <ImageIcon className="w-12 h-12" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-extrabold text-slate-600">Chưa có ảnh nào được tạo</p>
                        <p className="text-sm font-medium text-slate-400 leading-relaxed">Hoàn thành các bước bên trái để xem kết quả ảnh thẻ chuyên nghiệp tại đây.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12">
        <div className="w-full h-px bg-blue-600" />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <Camera className="text-white w-5 h-5" />
              </div>
              <p className="font-bold text-slate-800">AIBTeM ID Photo</p>
            </div>
            <p className="text-sm font-medium text-slate-500 text-center md:text-left leading-relaxed">
              © 2026 Vũ Xuân Hùng | AIBTeM. Bảo mật 100% - Xử lý ảnh trực tiếp trên trình duyệt, không lưu trữ trên máy chủ.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
