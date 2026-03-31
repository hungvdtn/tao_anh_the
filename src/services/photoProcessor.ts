import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { removeBackground, Config } from "@imgly/background-removal";
import { PhotoType, cmToPx } from "../constants";

export class PhotoProcessor {
  private faceLandmarker: any = null;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize models using a singleton pattern to prevent multiple loads and save memory.
   */
  async init(onProgress?: (p: number, status: string) => void) {
    if (this.faceLandmarker) {
      if (onProgress) onProgress(15, "AI đang xử lý ảnh của bạn...");
      return;
    }
    if (this.isInitializing) return this.initializationPromise!;

    this.isInitializing = true;
    this.initializationPromise = (async () => {
      try {
        console.log("[PhotoProcessor] Bắt đầu tải mô hình...");
        if (onProgress) onProgress(5, "AI đang xử lý ảnh của bạn...");
        
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm"
        );

        if (onProgress) onProgress(10, "AI đang xử lý ảnh của bạn...");
        
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        let delegate: "GPU" | "CPU" = gl ? "GPU" : "CPU";

        console.log(`[PhotoProcessor] Thử nghiệm delegate: ${delegate}`);

        try {
          this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: delegate,
            },
            runningMode: "IMAGE",
            numFaces: 1,
          });
        } catch (gpuError) {
          console.warn("[PhotoProcessor] Lỗi khi khởi tạo GPU, thử lại với CPU:", gpuError);
          delegate = "CPU";
          this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: "CPU",
            },
            runningMode: "IMAGE",
            numFaces: 1,
          });
        }

        console.log(`[PhotoProcessor] Khởi tạo thành công với delegate: ${delegate}`);

        if (onProgress) onProgress(15, "AI đang xử lý ảnh của bạn...");
        
        // Pre-warming is removed from init to prevent blocking main thread on startup
        // It will be handled naturally during the first process call

      } catch (error) {
        console.error("[PhotoProcessor] Lỗi khi tải mô hình:", error);
        this.isInitializing = false;
        this.initializationPromise = null;
        throw new Error("Không thể tải mô hình xử lý ảnh. Vui lòng kiểm tra kết nối mạng hoặc thử lại.");
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initializationPromise;
  }

  async process(imageFile: File, type: PhotoType, onProgress?: (p: number, status: string) => void): Promise<string> {
    try {
      console.log("[PhotoProcessor] Bắt đầu xử lý ảnh:", imageFile.name);
      if (onProgress) onProgress(5, "AI đang xử lý ảnh của bạn...");
      
      // 1. Initialize models
      await this.init(onProgress);
      if (onProgress) onProgress(15, "AI đang xử lý ảnh của bạn...");

      // 2. Load image
      console.log("[PhotoProcessor] Đang tải ảnh...");
      const image = await this.loadImage(imageFile);
      if (onProgress) onProgress(20, "AI đang xử lý ảnh của bạn...");

      // 3. Remove background
      console.log("[PhotoProcessor] Đang tách nền...");
      const config: Config = {
        model: 'isnet_fp16',
        progress: (key, current, total) => {
          // Map 0-100% of background removal to 25-75% of total progress
          // We use a more granular approach without the 5% step to ensure it "jumps" correctly in the UI
          const percentOfTask = current / total;
          let baseProgress = 25;
          let range = 50;
          
          if (key === 'fetch') {
            range = 10; // Fetching is first 10% of the 50% range
          } else {
            baseProgress = 35; // Processing is the remaining 40%
            range = 40;
          }
          
          const calculatedProgress = Math.round(baseProgress + (percentOfTask * range));
          if (onProgress) onProgress(calculatedProgress, "AI đang xử lý ảnh của bạn...");
        },
        output: {
          format: 'image/png',
          quality: 1.0
        }
      };
      
      let noBgBlob: Blob;
      try {
        console.log("[PhotoProcessor] Bắt đầu removeBackground...");
        noBgBlob = await removeBackground(imageFile, config);
        console.log("[PhotoProcessor] Tách nền thành công.");
        if (onProgress) onProgress(75, "AI đang xử lý ảnh của bạn...");
      } catch (bgError) {
        console.error("[PhotoProcessor] Lỗi khi tách nền:", bgError);
        throw new Error("Lỗi tách nền: Có thể do ảnh quá lớn hoặc trình duyệt hết bộ nhớ.");
      }

      console.log("[PhotoProcessor] Đang tải ảnh đã tách nền...");
      const noBgImage = await this.loadImage(URL.createObjectURL(noBgBlob));
      if (onProgress) onProgress(80, "AI đang xử lý ảnh của bạn...");

      // 4. Smart Hair Defringing
      console.log("[PhotoProcessor] Đang gỡ viền tóc...");
      const defringedCanvas = await this.defringe(noBgImage);
      if (onProgress) onProgress(85, "AI đang xử lý ảnh của bạn...");
      
      // 4.5 Selective Sharpening
      console.log("[PhotoProcessor] Đang làm nét ảnh...");
      const enhancedCanvas = await this.selectiveEnhance(defringedCanvas);
      if (onProgress) onProgress(90, "AI đang xử lý ảnh của bạn...");
      
      // 5. Detect face
      console.log("[PhotoProcessor] Đang nhận diện khuôn mặt...");
      const results = this.faceLandmarker!.detect(image);
      console.log("[PhotoProcessor] Kết quả nhận diện:", results);
      if (onProgress) onProgress(95, "AI đang xử lý ảnh của bạn...");
      
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        throw new Error("Không tìm thấy khuôn mặt trong ảnh. Vui lòng chọn ảnh rõ mặt hơn.");
      }

      const landmarks = results.faceLandmarks[0];
      
      // Landmarks: 10 (top of forehead/hairline), 152 (bottom of chin)
      const topHead = landmarks[10];
      const bottomChin = landmarks[152];
      const faceHeightInImage = Math.abs(bottomChin.y - topHead.y) * image.height;
      
      const leftEye = landmarks[468] || landmarks[159];
      const rightEye = landmarks[473] || landmarks[386];
      const eyeYInImage = ((leftEye.y + rightEye.y) / 2) * image.height;
      
      // Use face edges for more robust horizontal centering
      const faceLeft = landmarks[234];
      const faceRight = landmarks[454];
      const headCenterXInImage = ((faceLeft.x + faceRight.x) / 2) * image.width;
      
      const headWidthInImage = Math.abs(faceRight.x - faceLeft.x) * image.width;

      // 5. Calculate crop and draw
      const targetWidth = cmToPx(type.widthCm, type.dpi);
      const targetHeight = cmToPx(type.heightCm, type.dpi);
      
      let scale = 1;
      let dy = 0;

      if (type.id === 'passport-4x6' && type.faceRatio) {
        scale = (targetHeight * (type.faceRatio || 0.7)) / faceHeightInImage;
        const eyeRatio = type.eyeRatio || (2 / 3);
        const targetEyeY = targetHeight * (eyeRatio / (1 + eyeRatio));
        dy = targetEyeY - eyeYInImage * scale;
      } else {
        scale = (targetWidth * (type.headWidthRatio || 1 / 3)) / headWidthInImage;
        let targetEyeYRatio = 1 / 3;
        if (type.eyePosRange) {
          targetEyeYRatio = (type.eyePosRange[0] + type.eyePosRange[1]) / 2;
        } else if (type.eyePosRatio) {
          targetEyeYRatio = type.eyePosRatio;
        }
        const targetEyeY = targetHeight * targetEyeYRatio;
        dy = targetEyeY - eyeYInImage * scale;

        if (dy + image.height * scale < targetHeight) {
          const minScaleToFillBottom = (targetHeight - targetEyeY) / (image.height - eyeYInImage);
          scale = minScaleToFillBottom;
          dy = targetEyeY - eyeYInImage * scale;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      ctx.fillStyle = type.bgColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      let dx = targetWidth / 2 - headCenterXInImage * scale;
      if (type.horizontalOffsetRatio) {
        dx += type.horizontalOffsetRatio * targetWidth;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = 'contrast(1.01) saturate(1.01) brightness(1.01)';
      ctx.drawImage(enhancedCanvas, dx, dy, drawWidth, drawHeight);
      ctx.filter = 'none';

      // 6. Convert Canvas to Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 1.0);
      });

      if (!blob) {
        throw new Error("Không thể tạo tệp hình ảnh từ Canvas.");
      }

      const resultUrl = URL.createObjectURL(blob);
      if (onProgress) onProgress(100, "AI đang xử lý ảnh của bạn...");
      
      // Memory Cleanup: Revoke object URLs
      if (noBgImage.src.startsWith('blob:')) {
        URL.revokeObjectURL(noBgImage.src);
      }
      
      console.log("[PhotoProcessor] Xử lý hoàn tất thành công.");
      return resultUrl;
    } catch (error: any) {
      console.error("[PhotoProcessor] Lỗi trong quá trình xử lý:", error);
      throw error;
    }
  }

  private async defringe(image: HTMLImageElement): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Create a copy to read from while writing to the original
    const originalData = new Uint8ClampedArray(data);
    
    // Radius for color decontamination - increased for better coverage
    const radius = 6;
    
    for (let y = 0; y < height; y++) {
      // Yield to main thread every 50 rows to keep UI responsive
      if (y % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = originalData[idx + 3];
        
        // If it's a semi-transparent pixel (fringe)
        if (alpha > 0 && alpha < 255) {
          let sumR = 0, sumG = 0, sumB = 0;
          let weightSum = 0;
          let found = false;
          
          // Search in a radius for opaque pixels to "bleed" their color
          // Using a step of 2 for larger radius efficiency
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = (ny * width + nx) * 4;
                const nAlpha = originalData[nIdx + 3];
                
                if (nAlpha >= 245) { // Nearly opaque pixel
                  // Weight by distance (inverse square for sharper color bleeding)
                  const distSq = dx * dx + dy * dy || 0.5;
                  const weight = 1 / distSq;
                  
                  sumR += originalData[nIdx] * weight;
                  sumG += originalData[nIdx + 1] * weight;
                  sumB += originalData[nIdx + 2] * weight;
                  weightSum += weight;
                  found = true;
                }
              }
            }
          }
          
          if (found && weightSum > 0) {
            data[idx] = sumR / weightSum;
            data[idx + 1] = sumG / weightSum;
            data[idx + 2] = sumB / weightSum;
            
            // Alpha Gamma Adjustment: 
            // Tightens the mask to remove the outermost "dirty" pixels
            // without losing too much detail.
            const normalizedAlpha = alpha / 255;
            const tightenedAlpha = Math.pow(normalizedAlpha, 1.25) * 255;
            data[idx + 3] = tightenedAlpha;
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Selective Detail Restoration & Clarity Enhancement
   * Uses a "High-Frequency Separation" technique to recreate surface textures
   * (skin pores, eyelashes, fabric weave) while strictly protecting smoothed hair edges.
   */
  private async selectiveEnhance(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const originalData = new Uint8ClampedArray(data);

    // Detail Restoration Kernel (3x3) - Strengthened for better sharpness
    const kernel = [
      -0.15, -0.15, -0.15,
      -0.15,  2.2, -0.15,
      -0.15, -0.15, -0.15
    ];

    for (let y = 1; y < height - 1; y++) {
      // Yield to main thread every 50 rows to keep UI responsive
      if (y % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // --- 1. Edge Protection Logic ---
        // Only enhance fully opaque pixels AND check neighbors to protect hair edges
        let isSafeToEnhance = true;
        if (originalData[idx + 3] < 252) { // More strict threshold
          isSafeToEnhance = false;
        } else {
          // Check 5x5 neighborhood for any transparency to ensure we are far from edges
          for (let ky = -2; ky <= 2; ky++) {
            for (let kx = -2; kx <= 2; kx++) {
              const ny = y + ky;
              const nx = x + kx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const nIdx = (ny * width + nx) * 4;
                if (originalData[nIdx + 3] < 245) {
                  isSafeToEnhance = false;
                  break;
                }
              }
            }
            if (!isSafeToEnhance) break;
          }
        }

        if (isSafeToEnhance) {
          // --- 2. Detail Restoration (Micro-Texture) ---
          let r = 0, g = 0, b = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const nIdx = ((y + ky) * width + (x + kx)) * 4;
              const weight = kernel[(ky + 1) * 3 + (kx + 1)];
              r += originalData[nIdx] * weight;
              g += originalData[nIdx + 1] * weight;
              b += originalData[nIdx + 2] * weight;
            }
          }

          // --- 3. Selective Clarity (Local Contrast) ---
          // Boosts the clarity of facial features and clothing textures
          const clarity = 1.15;
          r = (r - 128) * clarity + 128;
          g = (g - 128) * clarity + 128;
          b = (b - 128) * clarity + 128;

          // --- 4. Blend & Clamp ---
          // We blend the restored detail back with the original to keep it natural
          const blend = 0.95; // 95% restored detail, 5% original
          data[idx] = Math.min(255, Math.max(0, r * blend + originalData[idx] * (1 - blend)));
          data[idx + 1] = Math.min(255, Math.max(0, g * blend + originalData[idx + 1] * (1 - blend)));
          data[idx + 2] = Math.min(255, Math.max(0, b * blend + originalData[idx + 2] * (1 - blend)));
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private loadImage(src: string | File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error("[PhotoProcessor] Lỗi khi tải ảnh:", e);
        reject(new Error("Không thể tải hình ảnh vào bộ nhớ."));
      };
      if (src instanceof File) {
        img.src = URL.createObjectURL(src);
      } else {
        img.src = src;
      }
    });
  }
}

export const photoProcessor = new PhotoProcessor();
