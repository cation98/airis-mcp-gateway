export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface JsonSchema {
  readonly type?: string | string[];
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: string[];
  readonly items?: JsonSchema;
  readonly description?: string;
  readonly enum?: JsonValue[];
  readonly format?: string;
  readonly additionalProperties?: boolean | JsonSchema;
}

export interface AugmentorManifest {
  name: string;
  version: string;
  description?: string;
  entry: string;
  runtime: "python" | "node" | string;
  caps?: string[];
  permissions?: {
    filesystem?: "none" | "read" | "write" | "read-write";
    network?: "none" | "https" | "all";
    secrets?: string[];
  };
  mcp?: {
    tool_prefix?: string;
  };
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface AugmentorStreamChunk {
  type: "text" | "event";
  data: JsonValue;
}

export type StreamHandler = (chunk: AugmentorStreamChunk) => void;

export interface AugmentorContext {
  runId: string;
  cwd: string;
  env: Record<string, string>;
  telemetry?: Record<string, JsonValue>;
  mcpClient?: unknown;
  history?: JsonValue[];
  stream?: StreamHandler;
}

export interface AugmentorCommand {
  name: string;
  schema: JsonSchema;
  description?: string;
  run(args: unknown, ctx: AugmentorContext): Promise<JsonValue> | JsonValue;
}

export interface AugmentorAgent {
  id: string;
  schema: JsonSchema;
  description?: string;
  handle(
    message: string,
    ctx: AugmentorContext,
    extras?: { history?: JsonValue[] }
  ): Promise<JsonValue> | JsonValue;
}

export interface AugmentorPackage {
  commands?: AugmentorCommand[];
  agents?: AugmentorAgent[];
  tools?: McpToolDescriptor[];
  shutdown?: () => Promise<void> | void;
}

export class AugmentorError extends Error {
  readonly code: string;
  readonly data?: JsonValue;

  constructor(code: string, message: string, data?: JsonValue) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export interface ContextOptions {
  cwd?: string;
  env?: Record<string, string>;
  runId?: string;
  history?: JsonValue[];
  telemetry?: Record<string, JsonValue>;
  stream?: StreamHandler;
}

export function createContext(options: ContextOptions = {}): AugmentorContext {
  return {
    runId: options.runId ?? `run_${Date.now().toString(36)}`,
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? { ...process.env } as Record<string, string>,
    history: options.history,
    telemetry: options.telemetry,
    stream: options.stream,
  };
}

export function isAugmentorCommand(value: unknown): value is AugmentorCommand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AugmentorCommand>;
  return typeof candidate.name === "string" && typeof candidate.run === "function";
}

export function isAugmentorAgent(value: unknown): value is AugmentorAgent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AugmentorAgent>;
  return typeof candidate.id === "string" && typeof candidate.handle === "function";
}

export function normalizePackage(pkg: AugmentorPackage): Required<AugmentorPackage> {
  return {
    commands: pkg.commands ?? [],
    agents: pkg.agents ?? [],
    tools: pkg.tools ?? [],
    shutdown: pkg.shutdown ?? (() => {}),
  };
}

export type { AugmentorManifest as Manifest };
