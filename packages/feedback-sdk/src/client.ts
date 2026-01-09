import {
    FeedbackAuthError,
    FeedbackNetworkError,
    FeedbackServerError
  } from "./errors";
  
  export interface ControlFileClientConfig {
    baseUrl: string;
    getToken: () => Promise<string | null>;
  }
  
  export class ControlFileClient {
    private baseUrl: string;
    private getToken: () => Promise<string | null>;
  
    constructor(config: ControlFileClientConfig) {
      this.baseUrl = config.baseUrl.replace(/\/$/, "");
      this.getToken = config.getToken;
    }
  
    async postForm<T>(path: string, formData: FormData): Promise<T> {
      const token = await this.getToken();
      if (!token) throw new FeedbackAuthError();
  
      let response: Response;
  
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });
      } catch {
        throw new FeedbackNetworkError();
      }
  
      if (!response.ok) {
        const text = await response.text();
        throw new FeedbackServerError(response.status, text);
      }
  
      return response.json();
    }
  }
  