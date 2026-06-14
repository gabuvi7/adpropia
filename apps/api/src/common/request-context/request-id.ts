export type RequestIdHeaderValue = string | string[] | undefined;

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function normalizeRequestIdHeader(value: RequestIdHeaderValue): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const requestId = firstValue?.trim();

  if (!requestId || requestId.length > MAX_REQUEST_ID_LENGTH || !SAFE_REQUEST_ID_PATTERN.test(requestId)) {
    return undefined;
  }

  return requestId;
}
