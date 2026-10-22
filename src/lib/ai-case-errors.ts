export class CaseWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseWorkflowError";
  }
}
