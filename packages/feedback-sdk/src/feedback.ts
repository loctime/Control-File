import { ControlFileClient } from "./client";
import {
  CreateFeedbackInput,
  CreateFeedbackResult
} from "./types";
import {
  FeedbackValidationError
} from "./errors";
import {
  generateClientRequestId
} from "./utils";

export interface FeedbackModuleConfig {
  appId: string;
}

export class FeedbackModule {
  private client: ControlFileClient;
  private appId: string;

  constructor(client: ControlFileClient, config: FeedbackModuleConfig) {
    this.client = client;
    this.appId = config.appId;
  }

  async create(input: CreateFeedbackInput): Promise<CreateFeedbackResult> {
    if (!input.screenshot) {
      throw new FeedbackValidationError("Screenshot is required");
    }

    if (!input.comment?.trim()) {
      throw new FeedbackValidationError("Comment is required");
    }

    if (!input.context) {
      throw new FeedbackValidationError("Context is required");
    }

    // Validar estructura de context según backend
    if (!input.context.page || typeof input.context.page !== 'object') {
      throw new FeedbackValidationError("Context.page is required");
    }

    if (!input.context.viewport || typeof input.context.viewport !== 'object') {
      throw new FeedbackValidationError("Context.viewport is required");
    }

    const { viewport } = input.context;
    if (
      typeof viewport.x !== 'number' ||
      typeof viewport.y !== 'number' ||
      typeof viewport.width !== 'number' ||
      typeof viewport.height !== 'number' ||
      typeof viewport.dpr !== 'number'
    ) {
      throw new FeedbackValidationError("Context.viewport must have x, y, width, height and dpr as numbers");
    }

    // Construir context con source si está presente
    const context = {
      ...input.context,
      ...(input.source && { source: input.source })
    };

    const payload = {
      appId: this.appId,
      tenantId: input.tenantId ?? null,
      userRole: input.userRole,
      comment: input.comment,
      context: context,
      clientRequestId: generateClientRequestId()
    };

    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    formData.append("screenshot", input.screenshot);

    return this.client.postForm<CreateFeedbackResult>(
      "/api/feedback",
      formData
    );
  }
}
