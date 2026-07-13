export class DataAccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function dataError(error: unknown, fallback: string) {
  if (error instanceof DataAccessError) return error;
  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.code === "PGRST116") return new DataAccessError("NOT_FOUND", fallback, 404);
  return new DataAccessError("DATABASE_ERROR", fallback, 500);
}
