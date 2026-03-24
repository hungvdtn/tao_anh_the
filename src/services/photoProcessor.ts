import { FaceLandmarker, FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { PhotoType, cmToPx } from "../constants";

export class PhotoProcessor {
  private faceLandmarker: any = null;
  private imageSegmenter: any = null;

  async init() {
    if (this.faceLandmarker && this.imageSegmenter) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm"
      );

      // Check for WebGL support to decide delegate
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const delegate = gl ? "GPU" : "CPU";

      if (!this.faceLandmarker) {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: delegate,
          },
          runningMode: "IMAGE",
          numFaces: 1,
        });
      }

      if (!this.imageSegmenter) {
        this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
            delegate: delegate,
          },
          runningMode: "IMAGE",
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
      }
    } catch (error) {
      console.error("Failed to initialize photo processor:", error);
      throw error;
    }
  }

  async process(imageFile: File, type: PhotoType): Promise<string> {
    await this.init();

    // 1. Load image
    const image = await this.loadImage(imageFile);

    // 2. Remove background using MediaPipe ImageSegmenter
    const segmentationResult = this.imageSegmenter.segment(image);
    const categoryMask = segmentationResult.categoryMask;
    const maskData = categoryMask.getAsUint8Array();
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const maskCtx = maskCanvas.getContext('2d')!;
    const maskImageData = maskCtx.createImageData(image.width, image.height);

    for (let i = 0; i < maskData.length; i++) {
      const isPerson = maskData[i] > 0;
      const idx = i * 4;
      maskImageData.data[idx] = 0;
      maskImageData.data[idx + 1] = 0;
      maskImageData.data[idx + 2] = 0;
      maskImageData.data[idx + 3] = isPerson ? 255 : 0;
    }
    maskCtx.putImageData(maskImageData, 0, 0);

    const noBgCanvas = document.createElement('canvas');
    noBgCanvas.width = image.width;
    noBgCanvas.height = image.height;
    const noBgCtx = noBgCanvas.getContext('2d')!;
    noBgCtx.drawImage(maskCanvas, 0, 0);
    noBgCtx.globalCompositeOperation = 'source-in';
    noBgCtx.drawImage(image, 0, 0);

    // 3. Detect face
    const results = this.faceLandmarker!.detect(image);
    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      throw new Error("Không tìm thấy khuôn mặt trong ảnh. Vui lòng chọn ảnh rõ mặt hơn.");
    }

    const landmarks = results.faceLandmarks[0];
    
    // Calculate face bounding box from landmarks
    // Landmarks: 10 (top of forehead/hairline), 152 (bottom of chin)
    const topHead = landmarks[10];
    const bottomChin = landmarks[152];
    
    // We use the distance from top of head to chin as the face height
    const faceHeightInImage = Math.abs(bottomChin.y - topHead.y) * image.height;
    const faceCenterX = landmarks[1].x * image.width; // Tip of nose

    // 4. Calculate crop
    const targetWidth = cmToPx(type.widthCm);
    const targetHeight = cmToPx(type.heightCm);
    
    // The face height should occupy type.faceRatio of targetHeight
    const scale = (targetHeight * type.faceRatio) / faceHeightInImage;
    
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;

    // Fill background
    ctx.fillStyle = type.bgColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Calculate drawing position
    // Headroom: space from top of canvas to top of head (hairline)
    // Usually 15-20% of target height to allow for the crown/hair
    const headroom = targetHeight * 0.18; 
    
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    
    // dx: center face horizontally
    const dx = targetWidth / 2 - faceCenterX * scale;
    // dy: position top of head (hairline) at 'headroom' from top
    const dy = headroom - topHead.y * image.height * scale;

    // Apply Enhancement (Smoothing & Brightening)
    // Brightness: 1.08 (8% boost), Contrast: 1.05 (5% boost), Saturate: 1.05
    ctx.filter = 'brightness(1.08) contrast(1.05) saturate(1.05) blur(0.2px)';
    
    ctx.drawImage(noBgCanvas, dx, dy, drawWidth, drawHeight);

    // Reset filter for any future operations on this context
    ctx.filter = 'none';

    return canvas.toDataURL('image/jpeg', 0.95);
  }

  private loadImage(src: string | File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      if (src instanceof File) {
        img.src = URL.createObjectURL(src);
      } else {
        img.src = src;
      }
    });
  }
}

export const photoProcessor = new PhotoProcessor();
