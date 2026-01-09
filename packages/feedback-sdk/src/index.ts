import { ControlFileClient } from "./client";
import { FeedbackModule } from "./feedback";

export interface CreateFeedbackClientConfig {
  appId: string;
  baseUrl: string;
  getToken: () => Promise<string | null>;
}

export function createFeedbackClient(config: CreateFeedbackClientConfig) {
  const client = new ControlFileClient({
    baseUrl: config.baseUrl,
    getToken: config.getToken
  });

  return new FeedbackModule(client, {
    appId: config.appId
  });
}
