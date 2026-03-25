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
  async init() {
    if (this.faceLandmarker) return;
    if (this.isInitializing) return this.initializationPromise!;

    this.isInitializing = true;
    this.initializationPromise = (async () => {
      try {
        console.log("[PhotoProcessor] Bắt đầu tải mô hình...");
        
        console.log("[PhotoProcessor] Đang tải MediaPipe FilesetResolver...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm"
        );

        console.log("[PhotoProcessor] Đang khởi tạo FaceLandmarker...");
        // Check for WebGL support to decide delegate
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const delegate = gl ? "GPU" : "CPU";
        console.log(`[PhotoProcessor] Sử dụng delegate: ${delegate}`);

        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: delegate,
          },
          runningMode: "IMAGE",
          numFaces: 1,
        });

        console.log("[PhotoProcessor] Tải mô hình thành công.");
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

  async process(imageFile: File, type: PhotoType, onProgress?: (p: number) => void): Promise<string> {
    try {
      console.log("[PhotoProcessor] Bắt đầu xử lý ảnh:", imageFile.name);
      if (onProgress) onProgress(5);
      
      // 1. Initialize models
      await this.init();
      if (onProgress) onProgress(10);

      // 2. Load image
      console.log("[PhotoProcessor] Đang tải ảnh vào bộ nhớ...");
      const image = await this.loadImage(imageFile);
      if (onProgress) onProgress(15);

      // 3. Remove background using @imgly/background-removal
      console.log("[PhotoProcessor] Đang thực hiện tách nền (Background Removal)...");
      const config: Config = {
        progress: (key, current, total) => {
          const percent = Math.round((current / total) * 60); // Use 60% of total progress for this step
          if (onProgress) onProgress(15 + percent);
          console.log(`[PhotoProcessor] Tiến trình tách nền [${key}]: ${Math.round((current / total) * 100)}%`);
        },
        output: {
          format: 'image/png',
          quality: 0.8
        }
      };
      
      let noBgBlob: Blob;
      try {
        noBgBlob = await removeBackground(imageFile, config);
        console.log("[PhotoProcessor] Tách nền thành công.");
      } catch (bgError) {
        console.error("[PhotoProcessor] Lỗi khi tách nền:", bgError);
        throw new Error("Lỗi tách nền: Có thể do ảnh quá lớn hoặc trình duyệt hết bộ nhớ.");
      }

      const noBgImage = await this.loadImage(URL.createObjectURL(noBgBlob));
      if (onProgress) onProgress(80);

      // 4. Detect face for alignment
      console.log("[PhotoProcessor] Đang nhận diện khuôn mặt và căn chỉnh...");
      const results = this.faceLandmarker!.detect(image);
      if (onProgress) onProgress(85);
      
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        console.error("[PhotoProcessor] Không tìm thấy khuôn mặt.");
        throw new Error("Không tìm thấy khuôn mặt trong ảnh. Vui lòng chọn ảnh rõ mặt hơn.");
      }

      const landmarks = results.faceLandmarks[0];
      if (onProgress) onProgress(90);
      
      // Landmarks: 10 (top of forehead/hairline), 152 (bottom of chin)
      const topHead = landmarks[10];
      const bottomChin = landmarks[152];
      const faceHeightInImage = Math.abs(bottomChin.y - topHead.y) * image.height;
      
      // Eye position (using iris centers for precision)
      // Left iris: 468, Right iris: 473
      const leftEye = landmarks[468] || landmarks[159];
      const rightEye = landmarks[473] || landmarks[386];
      const eyeYInImage = ((leftEye.y + rightEye.y) / 2) * image.height;
      const eyeXInImage = ((leftEye.x + rightEye.x) / 2) * image.width;

      // Head width (approximate using landmarks 234 and 454)
      const headWidthInImage = Math.abs(landmarks[454].x - landmarks[234].x) * image.width;

      // 5. Calculate crop and draw to final canvas
      console.log("[PhotoProcessor] Đang vẽ lên Canvas cuối cùng...");
      const targetWidth = cmToPx(type.widthCm, type.dpi);
      const targetHeight = cmToPx(type.heightCm, type.dpi);
      
      let scale = 1;
      let dy = 0;

      if (type.id === 'passport-4x6' && type.faceRatio) {
        // Passport: scale by face height ratio
        scale = (targetHeight * (type.faceRatio || 0.7)) / faceHeightInImage;
        // Eye position: (eyeY - top) / (bottom - eyeY) = eyeRatio
        const eyeRatio = type.eyeRatio || (2 / 3);
        const targetEyeY = targetHeight * (eyeRatio / (1 + eyeRatio));
        dy = targetEyeY - eyeYInImage * scale;
      } else {
        // License/Student: scale by head width ratio
        scale = (targetWidth * (type.headWidthRatio || 1 / 3)) / headWidthInImage;
        
        let targetEyeYRatio = 1 / 3;
        if (type.eyePosRange) {
          targetEyeYRatio = (type.eyePosRange[0] + type.eyePosRange[1]) / 2;
        } else if (type.eyePosRatio) {
          targetEyeYRatio = type.eyePosRatio;
        }
        
        const targetEyeY = targetHeight * targetEyeYRatio;
        dy = targetEyeY - eyeYInImage * scale;

        // Ensure the image covers the bottom of the canvas
        // If the bottom of the image doesn't reach the bottom of the canvas, we must increase the scale
        if (dy + image.height * scale < targetHeight) {
          const minScaleToFillBottom = (targetHeight - targetEyeY) / (image.height - eyeYInImage);
          scale = minScaleToFillBottom;
          // Recalculate dy with the new scale
          dy = targetEyeY - eyeYInImage * scale;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      // Fill background
      ctx.fillStyle = type.bgColor;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      
      // Improved horizontal centering: center the midpoint between the eyes
      const dx = targetWidth / 2 - eyeXInImage * scale;

      // Apply Enhancement
      ctx.imageSmoothingQuality = 'high';
      // Reverting to a cleaner filter without blur or drop-shadows to restore sharpness.
      // We will observe the raw background removal result to identify specific fringe areas.
      ctx.filter = 'contrast(1.02) saturate(1.02)';
      ctx.drawImage(noBgImage, dx, dy, drawWidth, drawHeight);
      ctx.filter = 'none';

      // 6. Convert Canvas to Blob URL
      console.log("[PhotoProcessor] Đang chuyển đổi Canvas thành kết quả cuối cùng...");
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });

      if (!blob) {
        throw new Error("Không thể tạo tệp hình ảnh từ Canvas.");
      }

      const resultUrl = URL.createObjectURL(blob);
      if (onProgress) onProgress(100);
      
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
