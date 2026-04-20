import type { TimeRange } from "../../shared/types";
import {
  ONE_DAY_SEC,
  SEVEN_DAYS_SEC,
  THIRTY_DAYS_SEC,
  NINETY_DAYS_SEC,
  ONE_SECOND_MS,
} from "./constants";

const RANGE_SECONDS: Record<TimeRange, number> = {
  "24h": ONE_DAY_SEC,
  "7d": SEVEN_DAYS_SEC,
  "30d": THIRTY_DAYS_SEC,
  "90d": NINETY_DAYS_SEC,
};

export function getRangeTimestamps(range: TimeRange): {
  from: number;
  to: number;
} {
  const to = Math.floor(Date.now() / ONE_SECOND_MS);
  return { from: to - RANGE_SECONDS[range], to };
}
