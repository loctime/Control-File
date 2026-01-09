export class FeedbackError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "FeedbackError";
    }
  }
  
  export class FeedbackAuthError extends FeedbackError {
    constructor() {
      super("Authentication required");
      this.name = "FeedbackAuthError";
    }
  }
  
  export class FeedbackValidationError extends FeedbackError {
    constructor(message: string) {
      super(message);
      this.name = "FeedbackValidationError";
    }
  }
  
  export class FeedbackNetworkError extends FeedbackError {
    constructor(message = "Network error") {
      super(message);
      this.name = "FeedbackNetworkError";
    }
  }
  
  export class FeedbackServerError extends FeedbackError {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "FeedbackServerError";
    }
  }
  