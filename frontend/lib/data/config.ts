import { ConfigurationError } from "./errors";

export type DataMode = "mock" | "api";

export interface DataConfig {
  mode: DataMode;
  apiBaseUrl?: string;
  enableModeSwitch: boolean;
}

export const DATA_MODE_KEY = "campus247_data_mode";

export function getDataConfig(): DataConfig {
  const enableModeSwitch =
    process.env.NEXT_PUBLIC_ENABLE_DATA_MODE_SWITCH === "true";

  const configuredMode = process.env.NEXT_PUBLIC_DATA_MODE;
  let mode: DataMode = "mock";

  if (configuredMode === "mock" || configuredMode === "api") {
    mode = configuredMode;
  } else if (configuredMode !== undefined && configuredMode !== "") {
    throw new ConfigurationError(
      `Invalid NEXT_PUBLIC_DATA_MODE: ${configuredMode}. Expected 'mock' or 'api'.`
    );
  }

  // Runtime mode is intentionally read from one storage key only. A missing
  // value leaves the environment-selected mode unchanged.
  if (typeof window !== "undefined" && enableModeSwitch) {
    const savedMode = localStorage.getItem(DATA_MODE_KEY);
    if (savedMode === null) {
      // Keep the environment-selected mode.
    } else if (savedMode === "api" || savedMode === "mock") {
      mode = savedMode;
    } else {
      throw new ConfigurationError(
        `Invalid runtime data mode in ${DATA_MODE_KEY}: ${savedMode}. Expected 'mock' or 'api'.`
      );
    }
  }

  const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const normalizedApiBaseUrl = rawApiBaseUrl?.trim().replace(/\/$/, "");
  const apiBaseUrl = normalizedApiBaseUrl || undefined;
  if (mode === "api" && !apiBaseUrl) {
    throw new ConfigurationError(
      "NEXT_PUBLIC_API_BASE_URL is required when the final data mode is 'api'."
    );
  }

  return {
    mode,
    apiBaseUrl,
    enableModeSwitch,
  };
}
