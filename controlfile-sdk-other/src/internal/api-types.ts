export interface PresignUploadResponse {
  success: boolean;
  uploadSessionId: string;
  uploadUrl: string;
  method?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string>;
  fileKey: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
  fileId: string;
  message: string;
}

export interface ShareCreateApiResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt: Date | string;
  fileName: string;
}

export interface ShareInfoApiResponse {
  fileName: string;
  fileSize: number;
  mime: string;
  expiresAt: Date | string | null;
  downloadCount: number;
}
