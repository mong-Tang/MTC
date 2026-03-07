export interface SerializableAppError {
  code: string;
  message: string;
}

export type IpcResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: SerializableAppError;
    };

