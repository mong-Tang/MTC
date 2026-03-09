export type AppErrorCode =
  | 'ZIP_OPEN_FAILED'
  | 'ZIP_INVALID_FORMAT'
  | 'ZIP_CORRUPTED'
  | 'ZIP_ENCRYPTED'
  | 'ZIP_NO_IMAGE'
  | 'ZIP_PAGE_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'FILE_ACCESS_DENIED'
  | 'UNKNOWN';

export class AppError extends Error {
  public readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AppError';
  }
}
