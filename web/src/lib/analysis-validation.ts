/** Shared errors/checks; these checks do not claim exhaustive runtime JSON validation. */
export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

export function assertUnique(values: readonly string[], description: string): void {
  if (new Set(values).size !== values.length) {
    throw new AnalysisValidationError(`Duplicate ${description}`);
  }
}

export function assertSafeToken(value: number | null, description: string): void {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
    throw new AnalysisValidationError(`${description} is not a safe non-negative integer`);
  }
}
