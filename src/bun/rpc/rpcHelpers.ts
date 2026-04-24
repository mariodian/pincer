import { logger } from "../services/loggerService";

/**
 * Wrap an async function with error logging.
 * Logs errors and re-throws them.
 */
export async function withErrorLogging<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(label, "Failed:", error);
    throw error;
  }
}

/**
 * Wrap an async function with error logging.
 * Logs errors and returns a default value instead of throwing.
 */
export async function withErrorResult<T>(
  label: string,
  fn: () => Promise<T>,
  defaultValue: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(label, "Failed:", error);
    return defaultValue;
  }
}
