export type FeedbackStatus = "open" | "in_progress" | "resolved" | "archived";

export interface FeedbackContext {
  page: {
    url: string;
    route: string;
  };
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
    dpr: number;
  };
  selection?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  source?: Record<string, any>;
}

export interface CreateFeedbackInput {
  screenshot: File;
  comment: string;
  context: FeedbackContext;
  tenantId?: string;
  userRole?: string;
  source?: Record<string, any>;
}

export interface CreateFeedbackResult {
  success?: boolean;
  feedbackId: string;
  screenshotFileId?: string;
  status: FeedbackStatus;
  createdAt: string;
}
