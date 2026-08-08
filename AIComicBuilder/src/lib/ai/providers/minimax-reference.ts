export interface MiniMaxReferenceErrorResponse {
  base_resp?: {
    status_code?: number;
  };
}

/**
 * MiniMax image-01 accepts one subject reference per request. Preserve caller
 * ordering so frame generation can put the most useful anchor first: a
 * relevant character for a first frame, or the generated first frame for a
 * last frame. Invalid paths can be skipped by returning undefined from prepare.
 */
export function prepareFirstMiniMaxReference<T>(
  imagePaths: readonly string[],
  labels: readonly string[] | undefined,
  prepare: (imagePath: string, label?: string) => T | undefined,
): T | undefined {
  for (const [index, imagePath] of imagePaths.entries()) {
    const reference = prepare(imagePath, labels?.[index]);
    if (reference !== undefined) return reference;
  }
  return undefined;
}

/**
 * Status 2013 can mean the supplied image does not contain exactly one clear
 * subject (for example, a four-view character sheet). A single text-only retry
 * is safe; callers must not retry other validation or service errors.
 */
export function shouldRetryMiniMaxImageWithoutReference(
  response: MiniMaxReferenceErrorResponse,
  hasReference: boolean,
): boolean {
  return hasReference && response.base_resp?.status_code === 2013;
}
