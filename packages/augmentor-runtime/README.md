# @airis-mcp/augmentor-runtime

Shared helpers for building Augmentor packages that can run inside SuperClaude, Codex CLI, or the AIRIS MCP Gateway. This package only exports types and lightweight utilities – no host-specific logic.

```ts
import {
  AugmentorCommand,
  AugmentorAgent,
  AugmentorContext,
  AugmentorError,
} from "@airis-mcp/augmentor-runtime";

const echo: AugmentorCommand = {
  name: "echo",
  schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  async run(args, ctx: AugmentorContext) {
    if (typeof args !== "object" || args === null || typeof (args as any).text !== "string") {
      throw new AugmentorError("invalid_input", "text is required");
    }

    return { output: (args as any).text, cwd: ctx.cwd };
  },
};

export function factory() {
  return { commands: [echo], agents: [] } satisfies AugmentorPackage;
}
```

See `docs/guides/augmentor-abi.md` for the full ABI specification.
