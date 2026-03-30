export interface PhotoType {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
  faceRatio?: number; // Face height / Image height
  eyeRatio?: number; // (Eye to top) / (Eye to bottom)
  headWidthRatio?: number; // Head width / Image width
  eyePosRatio?: number; // (Eye to top) / Image height
  eyePosRange?: [number, number]; // Min/Max (Eye to top) / Image height
  headHeightMm?: number; // Head height in mm
  topToHeadMm?: number; // Distance from top of image to top of head in mm
  horizontalOffsetRatio?: number; // Shift image left (-) or right (+) relative to target width
  dpi: number;
  bgColor: string;
  description: string;
}

export const PHOTO_TYPES: PhotoType[] = [
  {
    id: 'passport-4x6',
    name: 'Hộ chiếu 4x6',
    widthCm: 4,
    heightCm: 6,
    headWidthRatio: 0.55, // Larger face
    eyePosRatio: 0.4, // > 1/3, adjusted for tie visibility
    dpi: 400,
    bgColor: '#ffffff',
    description: 'Quy chuẩn theo Thủ tục Cấp hộ chiếu phổ thông trên Cổng DVC Bộ Công an',
  },
  {
    id: 'license-3x4',
    name: 'Giấy phép lái xe 3x4',
    widthCm: 3,
    heightCm: 4,
    headWidthRatio: 0.38, // Close to 1/3 but slightly larger for better framing
    eyePosRatio: 0.33, // Exactly 1/3
    horizontalOffsetRatio: -0.03, // Shift left to correct alignment
    dpi: 500,
    bgColor: '#3a98e3',
    description: 'Quy chuẩn theo Thủ tục Cấp đổi GPLX trực tuyến mức độ 4 trên Cổng DVC Cảnh sát giao thông Bộ Công an',
  },
  {
    id: 'card-3x4',
    name: 'Thẻ/Sơ yếu lý lịch 3 x 4',
    widthCm: 3,
    heightCm: 4,
    headWidthRatio: 1 / 3,
    eyePosRatio: 0.33,
    horizontalOffsetRatio: -0.03, // Shift left to correct alignment
    dpi: 400,
    bgColor: '#3a98e3',
    description: 'Theo quy chuẩn chung; nền trắng hoặc nền xanh',
  },
  {
    id: 'card-4x6',
    name: 'Thẻ/Sơ yếu lý lịch 4 x 6',
    widthCm: 4,
    heightCm: 6,
    headWidthRatio: 1 / 3,
    eyePosRatio: 0.33,
    horizontalOffsetRatio: -0.03, // Shift left to correct alignment
    dpi: 400,
    bgColor: '#3a98e3',
    description: 'Theo quy chuẩn chung; nền trắng hoặc nền xanh',
  },
];

export const CM_TO_INCH = 1 / 2.54;

export function cmToPx(cm: number, dpi: number = 300): number {
  return Math.round(cm * CM_TO_INCH * dpi);
}
