export type AdvertisementStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ARCHIVED';

export type AdvertisementAudience = 'TEACHER' | 'STUDENT' | 'BOTH';

export type AdvertisementLayout = 'STATIC_BANNER' | 'CAROUSEL' | 'RESPONSIVE_TILES';

export type AdvertisementOrientation = 'HORIZONTAL' | 'VERTICAL';

export type AdvertisementOverlayStyle = 'NONE' | 'GRADIENT' | 'GLASS' | 'BADGE';

export type AdvertisementOverlayPosition =
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'CENTER_LEFT'
  | 'BOTTOM_RIGHT';

export type AdvertisementOverlayTextColor = 'LIGHT' | 'DARK';

export type AdvertisementButtonStyle = 'SOLID' | 'OUTLINE' | 'TEXT';
export type AdvertisementCtaPresentation = 'BUTTON' | 'TEXT_LINK' | 'NONE';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
}

export interface AdvertisementMedia {
  id: number;
  originalFilename: string | null;
  contentType: 'image/png' | 'image/jpeg';
  fileSizeBytes: number;
  displayOrder: number;
  altText: string | null;
}

export interface Advertisement {
  id: number;
  title: string;
  description: string | null;
  audience: AdvertisementAudience;
  layout: AdvertisementLayout;
  orientation?: AdvertisementOrientation;
  ctaLabel: string | null;
  ctaDestination: string | null;
  ctaPresentation?: AdvertisementCtaPresentation;
  publishAt: string | null;
  expiresAt: string | null;
  status: AdvertisementStatus;
  version: number;
  media: AdvertisementMedia[];
  mediaCount: number;
  imageOnly?: boolean;
  overlayStyle?: AdvertisementOverlayStyle;
  overlayPosition?: AdvertisementOverlayPosition;
  overlayTextColor?: AdvertisementOverlayTextColor;
  overlayOpacity?: number;
  buttonStyle?: AdvertisementButtonStyle;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  rotationIntervalOverrideMs?: number | null;
}

export interface AdvertisementDraftRequest {
  title: string;
  description: string | null;
  audience: AdvertisementAudience;
  layout: AdvertisementLayout;
  orientation?: AdvertisementOrientation;
  ctaLabel: string | null;
  ctaDestination: string | null;
  ctaPresentation?: AdvertisementCtaPresentation;
  publishAt: string | null;
  expiresAt: string | null;
  version?: number;
  imageOnly?: boolean;
  overlayStyle?: AdvertisementOverlayStyle;
  overlayPosition?: AdvertisementOverlayPosition;
  overlayTextColor?: AdvertisementOverlayTextColor;
  overlayOpacity?: number;
  buttonStyle?: AdvertisementButtonStyle;
  rotationIntervalOverrideMs: number | null;
}

export interface AdvertisementVersionRequest {
  version: number;
}

export interface AdvertisementDeleteRequest extends AdvertisementVersionRequest {
  confirm: true;
}

export interface AdvertisementPageResponse {
  content: Advertisement[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdvertisementSettings {
  id: number;
  teacherSectionEnabled: boolean;
  studentSectionEnabled: boolean;
  defaultRotationIntervalMs: number;
  transitionDurationMs: number;
  version: number;
}

export interface AdvertisementSettingsRequest {
  teacherSectionEnabled: boolean;
  studentSectionEnabled: boolean;
  defaultRotationIntervalMs: number;
  transitionDurationMs: number;
  version: number;
}

export interface AdvertisementDisplaySettings {
  defaultRotationIntervalMs: number;
  transitionDurationMs: number;
}

export interface AdvertisementFeed {
  advertisements: Advertisement[];
  displaySettings: AdvertisementDisplaySettings;
}
