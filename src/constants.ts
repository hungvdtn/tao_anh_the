export interface PhotoType {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
  faceRatio: number; // Face height / Image height (e.g., 0.75 for 75%)
  bgColor: string;
  description: string;
}

export const PHOTO_TYPES: PhotoType[] = [
  {
    id: 'passport-4x6',
    name: 'Hộ chiếu 4x6',
    widthCm: 4,
    heightCm: 6,
    faceRatio: 0.55,
    bgColor: '#ffffff',
    description: 'Nền trắng, mặt chiếm ~55%',
  },
  {
    id: 'id-3x4-blue',
    name: 'Bằng lái/Thẻ SV 3x4',
    widthCm: 3,
    heightCm: 4,
    faceRatio: 0.50,
    bgColor: '#005bb5',
    description: 'Nền xanh dương, mặt chiếm ~50%',
  },
  {
    id: 'id-3x4-white',
    name: 'Sơ yếu lý lịch 3x4',
    widthCm: 3,
    heightCm: 4,
    faceRatio: 0.50,
    bgColor: '#ffffff',
    description: 'Nền trắng, mặt chiếm ~50%',
  },
];

export const DPI = 300;
export const CM_TO_INCH = 1 / 2.54;

export function cmToPx(cm: number): number {
  return Math.round(cm * CM_TO_INCH * DPI);
}
