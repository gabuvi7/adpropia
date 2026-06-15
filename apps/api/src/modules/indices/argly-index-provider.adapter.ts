import type { EconomicIndexType } from "@adpropia/database";
import { z } from "zod";
import type { IndexProviderAdapter, IndexProviderLookupInput, PublishedIndexValue } from "./indices.service";

const ARGLY_API_BASE_URL = "https://api.argly.com.ar/v1";
const ARGLY_FETCH_TIMEOUT_MS = 5_000;
const ARGLY_SUPPORTED_INDEX_TYPES = ["IPC", "ICL", "UVA"] as const satisfies readonly EconomicIndexType[];

type ArglySupportedIndexType = (typeof ARGLY_SUPPORTED_INDEX_TYPES)[number];
type FetchClient = typeof fetch;

const arglyDailyResponseSchema = z.object({
  data: z.array(
    z.object({
      fecha: z.string(),
      valor: z.union([z.number(), z.string()])
    })
  )
});

const arglyIpcResponseSchema = z.object({
  data: z.array(
    z.object({
      mes: z.number(),
      anio: z.number(),
      valor: z.union([z.number(), z.string()])
    })
  )
});

export class ArglyIndexProviderAdapter implements IndexProviderAdapter {
  readonly source = "ARGLY" as const;

  constructor(private readonly fetchClient: FetchClient = fetch) {}

  async fetchPublishedIndex(input: IndexProviderLookupInput): Promise<Omit<PublishedIndexValue, "source"> | null> {
    if (!isArglySupportedIndexType(input.type)) {
      return null;
    }

    if (input.type === "IPC") {
      const response = await this.fetchArglyIpcRange(input.periodDate);
      return response ? selectIpcIndexValue(response.data, input.periodDate) : null;
    }

    const response = await this.fetchArglyDailyRange(input.type, input.periodDate);
    return response ? selectLastValidDailyIndexValue(response.data, input.type, input.periodDate) : null;
  }

  private async fetchArglyDailyRange(type: ArglyDailyIndexType, periodDate: Date): Promise<ArglyDailyResponse | null> {
    const url = buildArglyDailyRangeUrl(type, periodDate);

    try {
      const body = await fetchJsonWithTimeout(this.fetchClient, url);
      const parsed = arglyDailyResponseSchema.safeParse(body);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private async fetchArglyIpcRange(periodDate: Date): Promise<ArglyIpcResponse | null> {
    const url = buildArglyIpcRangeUrl(periodDate);

    try {
      const body = await fetchJsonWithTimeout(this.fetchClient, url);
      const parsed = arglyIpcResponseSchema.safeParse(body);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}

type ArglyDailyIndexType = Exclude<ArglySupportedIndexType, "IPC">;
type ArglyDailyResponse = z.infer<typeof arglyDailyResponseSchema>;
type ArglyDailyRow = ArglyDailyResponse["data"][number];
type ArglyIpcResponse = z.infer<typeof arglyIpcResponseSchema>;
type ArglyIpcRow = ArglyIpcResponse["data"][number];

function isArglySupportedIndexType(type: EconomicIndexType): type is ArglySupportedIndexType {
  return ARGLY_SUPPORTED_INDEX_TYPES.includes(type as ArglySupportedIndexType);
}

function selectLastValidDailyIndexValue(
  rows: ArglyDailyRow[],
  type: ArglyDailyIndexType,
  requestedDate: Date
): Omit<PublishedIndexValue, "source"> | null {
  let selected: Omit<PublishedIndexValue, "source"> | null = null;

  for (const row of rows) {
    const periodDate = parseArglyDate(row.fecha);
    const value = normalizeArglyValue(row.valor);

    if (!periodDate || !isSameUtcDate(periodDate, requestedDate) || !value) {
      continue;
    }

    selected = {
      type,
      periodDate,
      value,
      publishedAt: periodDate
    };
  }

  return selected;
}

function selectIpcIndexValue(rows: ArglyIpcRow[], requestedDate: Date): Omit<PublishedIndexValue, "source"> | null {
  const requestedYear = requestedDate.getUTCFullYear();
  const requestedMonth = requestedDate.getUTCMonth() + 1;
  let selected: Omit<PublishedIndexValue, "source"> | null = null;

  for (const row of rows) {
    if (row.anio !== requestedYear || row.mes !== requestedMonth) {
      continue;
    }

    const value = normalizeArglyValue(row.valor);
    const periodDate = buildUtcMonthStart(row.anio, row.mes);
    if (!value || !periodDate) {
      continue;
    }

    selected = {
      type: "IPC",
      periodDate,
      value,
      publishedAt: periodDate
    };
  }

  return selected;
}

async function fetchJsonWithTimeout(fetchClient: FetchClient, url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARGLY_FETCH_TIMEOUT_MS);

  try {
    return await Promise.race([
      fetchJson(fetchClient, url, controller.signal),
      rejectOnAbort(controller.signal)
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(fetchClient: FetchClient, url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetchClient(url, { signal });
  if (!response.ok) {
    return null;
  }

  return response.json();
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
}

function buildUtcMonthStart(year: number, month: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== 1) {
    return null;
  }

  return date;
}

function isSameUtcDate(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

function normalizeArglyValue(value: number | string): string | null {
  const numericValue = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue.toFixed(6);
}

function parseArglyDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));

  if (date.getUTCFullYear() !== numericYear || date.getUTCMonth() !== numericMonth - 1 || date.getUTCDate() !== numericDay) {
    return null;
  }

  return date;
}

function buildArglyDailyRangeUrl(type: ArglyDailyIndexType, periodDate: Date): string {
  const date = formatArglyQueryDate(periodDate);
  const endpoint = type.toLowerCase();
  return `${ARGLY_API_BASE_URL}/${endpoint}?desde=${date}&hasta=${date}`;
}

function buildArglyIpcRangeUrl(periodDate: Date): string {
  const month = formatArglyQueryMonth(periodDate);
  return `${ARGLY_API_BASE_URL}/ipc?desde=${month}&hasta=${month}`;
}

function formatArglyQueryDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatArglyQueryMonth(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}
