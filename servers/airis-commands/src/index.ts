/**
 * AIRIS Commands MCP Server
 *
 * Provides workspace scaffolding and management tools for AIRIS workspaces.
 *
 * Tools:
 * - airis_init: Initialize or scaffold new apps/libs in an AIRIS workspace
 * - airis_manifest: Query manifest.toml information
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { simpleGit } from "simple-git";

// =============================================================================
// Types
// =============================================================================

interface RepositoryInfo {
  name: string;
  path: string;
  branch: string;
}

interface ManifestInfo {
  exists: boolean;
  path: string;
  project?: {
    id: string;
    description: string;
  };
  workspace?: {
    name: string;
    package_manager: string;
  };
  packages?: {
    workspaces: string[];
  };
}

interface ScaffoldPlan {
  kind: "app" | "lib" | "service";
  name: string;
  framework: string;
  path: string;
  files: ScaffoldFile[];
  commands: string[];
  warnings: string[];
}

interface ScaffoldFile {
  path: string;
  content: string;
  reason: string;
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "airis-commands",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// Helper Functions
// =============================================================================

async function detectRepository(cwd: string = process.cwd()): Promise<RepositoryInfo | null> {
  try {
    const git = simpleGit(cwd);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      return null;
    }

    const root = await git.revparse(["--show-toplevel"]);
    const repoPath = root.trim();
    const repoName = path.basename(repoPath);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

    return {
      name: repoName,
      path: repoPath,
      branch: branch.trim(),
    };
  } catch {
    return null;
  }
}

async function checkGitDirty(repoPath: string): Promise<boolean> {
  try {
    const git = simpleGit(repoPath);
    const status = await git.status();
    return !status.isClean();
  } catch {
    return false;
  }
}

function findManifest(startPath: string): ManifestInfo {
  const manifestPath = path.join(startPath, "manifest.toml");

  if (!fs.existsSync(manifestPath)) {
    return {
      exists: false,
      path: manifestPath,
    };
  }

  // Simple TOML parsing (basic key-value extraction)
  const content = fs.readFileSync(manifestPath, "utf-8");

  const getSection = (name: string): Record<string, string> => {
    const sectionRegex = new RegExp(`\\[${name}\\]([^\\[]*)`);
    const match = content.match(sectionRegex);
    if (!match) return {};

    const result: Record<string, string> = {};
    const lines = match[1].trim().split("\n");
    for (const line of lines) {
      const kvMatch = line.match(/^(\w+)\s*=\s*"?([^"]*)"?/);
      if (kvMatch) {
        result[kvMatch[1]] = kvMatch[2];
      }
    }
    return result;
  };

  const getArray = (section: string, key: string): string[] => {
    const sectionRegex = new RegExp(`\\[${section}\\]([^\\[]*)`);
    const match = content.match(sectionRegex);
    if (!match) return [];

    const arrayRegex = new RegExp(`${key}\\s*=\\s*\\[([^\\]]+)\\]`);
    const arrayMatch = match[1].match(arrayRegex);
    if (!arrayMatch) return [];

    return arrayMatch[1]
      .split(",")
      .map(s => s.trim().replace(/"/g, ""))
      .filter(s => s.length > 0);
  };

  const project = getSection("project");
  const workspace = getSection("workspace");
  const workspaces = getArray("packages", "workspaces");

  return {
    exists: true,
    path: manifestPath,
    project: project.id ? {
      id: project.id,
      description: project.description || "",
    } : undefined,
    workspace: workspace.name ? {
      name: workspace.name,
      package_manager: workspace.package_manager || "pnpm@10.22.0",
    } : undefined,
    packages: workspaces.length > 0 ? {
      workspaces,
    } : undefined,
  };
}

function generateScaffoldPlan(
  kind: "app" | "lib" | "service",
  name: string,
  framework: string,
  repoPath: string
): ScaffoldPlan {
  const baseDir = kind === "lib" ? "libs" : "apps";
  const projectPath = path.join(baseDir, name);
  const fullPath = path.join(repoPath, projectPath);

  const files: ScaffoldFile[] = [];
  const commands: string[] = [];
  const warnings: string[] = [];

  // Check if directory exists
  if (fs.existsSync(fullPath)) {
    warnings.push(`Directory ${projectPath} already exists. Files will be written to *.airis.new`);
  }

  // Generate files based on framework
  switch (framework) {
    case "nextjs":
      files.push(
        {
          path: `${projectPath}/package.json`,
          content: generateNextJsPackageJson(name),
          reason: "Next.js package configuration",
        },
        {
          path: `${projectPath}/next.config.js`,
          content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  output: 'standalone',\n}\n\nmodule.exports = nextConfig\n`,
          reason: "Next.js configuration",
        },
        {
          path: `${projectPath}/tsconfig.json`,
          content: generateNextJsTsConfig(),
          reason: "TypeScript configuration",
        },
        {
          path: `${projectPath}/src/app/layout.tsx`,
          content: generateNextJsLayout(name),
          reason: "Root layout component",
        },
        {
          path: `${projectPath}/src/app/page.tsx`,
          content: generateNextJsPage(name),
          reason: "Home page component",
        },
        {
          path: `${projectPath}/.gitignore`,
          content: "node_modules/\n.next/\nout/\n*.log\n.env\n.env.local\n",
          reason: "Git ignore patterns",
        }
      );
      commands.push(
        "airis install",
        `airis dev --filter ${name}`
      );
      break;

    case "hono":
      files.push(
        {
          path: `${projectPath}/package.json`,
          content: generateHonoPackageJson(name),
          reason: "Hono API package configuration",
        },
        {
          path: `${projectPath}/tsconfig.json`,
          content: generateHonoTsConfig(),
          reason: "TypeScript configuration",
        },
        {
          path: `${projectPath}/src/index.ts`,
          content: generateHonoIndex(name),
          reason: "Hono API entry point",
        },
        {
          path: `${projectPath}/src/routes/health.ts`,
          content: generateHonoHealthRoute(),
          reason: "Health check endpoint",
        },
        {
          path: `${projectPath}/Dockerfile`,
          content: generateHonoDockerfile(name),
          reason: "Docker build configuration",
        },
        {
          path: `${projectPath}/.gitignore`,
          content: "node_modules/\ndist/\n*.log\n.env\n.env.local\n",
          reason: "Git ignore patterns",
        }
      );
      commands.push(
        "airis install",
        `airis dev --filter ${name}`
      );
      break;

    case "ts":
    case "typescript":
      files.push(
        {
          path: `${projectPath}/package.json`,
          content: generateTsLibPackageJson(name),
          reason: "TypeScript library package configuration",
        },
        {
          path: `${projectPath}/tsconfig.json`,
          content: generateTsLibTsConfig(),
          reason: "TypeScript configuration",
        },
        {
          path: `${projectPath}/src/index.ts`,
          content: `/**\n * ${name} - A TypeScript library\n */\n\nexport function hello(name: string): string {\n  return \`Hello, \${name}!\`\n}\n\nexport default { hello }\n`,
          reason: "Library entry point",
        },
        {
          path: `${projectPath}/.gitignore`,
          content: "node_modules/\ndist/\n*.log\n",
          reason: "Git ignore patterns",
        }
      );
      commands.push(
        "airis install",
        `pnpm --filter ${name} build`
      );
      break;

    default:
      warnings.push(`Unknown framework: ${framework}. Supported: nextjs, hono, ts`);
  }

  return {
    kind,
    name,
    framework,
    path: projectPath,
    files,
    commands,
    warnings,
  };
}

// =============================================================================
// Template Generators
// =============================================================================

function generateNextJsPackageJson(name: string): string {
  return JSON.stringify({
    name,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "catalog:",
      react: "catalog:",
      "react-dom": "catalog:",
    },
    devDependencies: {
      typescript: "catalog:",
      "@types/node": "catalog:",
      "@types/react": "catalog:",
      "@types/react-dom": "catalog:",
    },
  }, null, 2);
}

function generateNextJsTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2);
}

function generateNextJsLayout(name: string): string {
  return `export const metadata = {
  title: '${name}',
  description: 'Generated by airis init',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`;
}

function generateNextJsPage(name: string): string {
  return `export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>${name}</h1>
      <p>Welcome to your new Next.js app!</p>
    </main>
  )
}
`;
}

function generateHonoPackageJson(name: string): string {
  return JSON.stringify({
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsup src/index.ts --format esm --dts",
      start: "node dist/index.js",
      test: "vitest",
      lint: "biome check src/",
    },
    dependencies: {
      hono: "catalog:",
      "@hono/node-server": "catalog:",
    },
    devDependencies: {
      typescript: "catalog:",
      tsx: "catalog:",
      tsup: "catalog:",
      vitest: "catalog:",
      "@types/node": "catalog:",
    },
  }, null, 2);
}

function generateHonoTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ES2022"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "./dist",
      rootDir: "./src",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  }, null, 2);
}

function generateHonoIndex(name: string): string {
  return `import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { health } from './routes/health'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors())

// Routes
app.route('/health', health)

app.get('/', (c) => {
  return c.json({ message: 'Welcome to ${name}' })
})

const port = parseInt(process.env.PORT || '3000', 10)

console.log(\`Server is running on port \${port}\`)

serve({
  fetch: app.fetch,
  port,
})

export default app
`;
}

function generateHonoHealthRoute(): string {
  return `import { Hono } from 'hono'

export const health = new Hono()

health.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})
`;
}

function generateHonoDockerfile(name: string): string {
  return `FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
`;
}

function generateTsLibPackageJson(name: string): string {
  return JSON.stringify({
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
    },
    scripts: {
      build: "tsup src/index.ts --format esm --dts",
      dev: "tsup src/index.ts --format esm --dts --watch",
      test: "vitest",
      lint: "biome check src/",
    },
    devDependencies: {
      typescript: "catalog:",
      tsup: "catalog:",
      vitest: "catalog:",
    },
  }, null, 2);
}

function generateTsLibTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ES2022"],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "./dist",
      rootDir: "./src",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"],
  }, null, 2);
}

// =============================================================================
// Tool Definitions
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "airis_init",
        description: `Initialize or scaffold new apps/libs in an AIRIS workspace.

WHEN TO USE:
- When user asks to create a new app, service, or library
- When user says "airis new", "create app", "scaffold", "add new project"
- When user wants to add a Next.js app, Hono API, or TypeScript library

BEHAVIOR:
- By default, returns a PLAN of what would be created (dry-run)
- With apply=true, actually writes files to disk
- Never overwrites existing files (uses *.airis.new suffix)
- Automatically detects git repository and manifest.toml

SUPPORTED FRAMEWORKS:
- nextjs: Next.js web application (apps/)
- hono: Hono API service (apps/)
- ts: TypeScript library (libs/)`,
        inputSchema: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["app", "lib", "service"],
              description: "Type of project to create",
            },
            name: {
              type: "string",
              description: "Project name (alphanumeric, hyphens, underscores)",
              minLength: 1,
            },
            framework: {
              type: "string",
              enum: ["nextjs", "hono", "ts", "typescript"],
              description: "Framework/template to use",
            },
            apply: {
              type: "boolean",
              description: "Actually write files (default: false, dry-run mode)",
              default: false,
            },
            force: {
              type: "boolean",
              description: "Proceed even if git working tree is dirty",
              default: false,
            },
          },
          required: ["kind", "name", "framework"],
        },
      },
      {
        name: "airis_manifest",
        description: `Query manifest.toml information from the current AIRIS workspace.

WHEN TO USE:
- When user asks about workspace configuration
- When checking if manifest.toml exists
- When getting project info, workspace settings, or catalog entries`,
        inputSchema: {
          type: "object",
          properties: {
            cwd: {
              type: "string",
              description: "Working directory to search from (default: current directory)",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// =============================================================================
// Tool Implementations
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "airis_init": {
        const {
          kind,
          name: projectName,
          framework,
          apply = false,
          force = false,
        } = args as {
          kind: "app" | "lib" | "service";
          name: string;
          framework: string;
          apply?: boolean;
          force?: boolean;
        };

        // Validate project name
        if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
          return {
            content: [{
              type: "text",
              text: `Invalid project name: ${projectName}\nProject name can only contain alphanumeric characters, hyphens, and underscores.`,
            }],
            isError: true,
          };
        }

        // Detect repository
        const repo = await detectRepository();
        if (!repo) {
          return {
            content: [{
              type: "text",
              text: "Not in a git repository. Run this command from within an AIRIS workspace.",
            }],
            isError: true,
          };
        }

        // Check manifest
        const manifest = findManifest(repo.path);
        if (!manifest.exists) {
          return {
            content: [{
              type: "text",
              text: `manifest.toml not found at ${manifest.path}\nRun 'airis init' first to create a manifest.`,
            }],
            isError: true,
          };
        }

        // Check git dirty
        if (!force) {
          const isDirty = await checkGitDirty(repo.path);
          if (isDirty) {
            return {
              content: [{
                type: "text",
                text: "Working tree has uncommitted changes.\nCommit or stash your changes first, or use force=true to proceed.",
              }],
              isError: true,
            };
          }
        }

        // Generate scaffold plan
        const plan = generateScaffoldPlan(kind, projectName, framework, repo.path);

        if (plan.warnings.length > 0 && plan.files.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Warnings:\n${plan.warnings.map(w => `  - ${w}`).join("\n")}`,
            }],
            isError: true,
          };
        }

        // Dry-run mode (default)
        if (!apply) {
          let output = `SCAFFOLD PLAN for ${kind} "${projectName}" (${framework})\n`;
          output += `${"=".repeat(60)}\n\n`;
          output += `Location: ${plan.path}/\n`;
          output += `Repository: ${repo.name} (${repo.branch})\n\n`;

          if (plan.warnings.length > 0) {
            output += `WARNINGS:\n`;
            for (const warning of plan.warnings) {
              output += `  ${warning}\n`;
            }
            output += "\n";
          }

          output += `FILES TO CREATE (${plan.files.length}):\n`;
          for (const file of plan.files) {
            output += `  [CREATE] ${file.path}\n`;
            output += `           ${file.reason}\n`;
          }

          output += `\nPOST-INSTALL COMMANDS:\n`;
          for (const cmd of plan.commands) {
            output += `  $ ${cmd}\n`;
          }

          output += `\nTo apply this plan, call airis_init with apply=true`;

          return {
            content: [{
              type: "text",
              text: output,
            }],
          };
        }

        // Apply mode - write files
        let output = `APPLYING SCAFFOLD for ${kind} "${projectName}" (${framework})\n`;
        output += `${"=".repeat(60)}\n\n`;

        const written: string[] = [];
        const skipped: string[] = [];

        for (const file of plan.files) {
          const fullPath = path.join(repo.path, file.path);
          const dir = path.dirname(fullPath);

          // Create directory if needed
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Check if file exists
          if (fs.existsSync(fullPath)) {
            // Write to .airis.new instead
            const newPath = fullPath + ".airis.new";
            fs.writeFileSync(newPath, file.content);
            skipped.push(`${file.path} -> ${file.path}.airis.new (exists)`);
          } else {
            fs.writeFileSync(fullPath, file.content);
            written.push(file.path);
          }
        }

        output += `WRITTEN (${written.length}):\n`;
        for (const f of written) {
          output += `  [WRITE] ${f}\n`;
        }

        if (skipped.length > 0) {
          output += `\nSKIPPED (${skipped.length}):\n`;
          for (const f of skipped) {
            output += `  [SKIP] ${f}\n`;
          }
        }

        output += `\nNEXT STEPS:\n`;
        for (const cmd of plan.commands) {
          output += `  $ ${cmd}\n`;
        }

        if (skipped.length > 0) {
          output += `\nReview *.airis.new files and merge manually.`;
        }

        return {
          content: [{
            type: "text",
            text: output,
          }],
        };
      }

      case "airis_manifest": {
        const { cwd } = args as { cwd?: string };
        const searchPath = cwd || process.cwd();

        const repo = await detectRepository(searchPath);
        const repoPath = repo?.path || searchPath;
        const manifest = findManifest(repoPath);

        if (!manifest.exists) {
          return {
            content: [{
              type: "text",
              text: `manifest.toml not found.\n\nSearched in: ${repoPath}\n\nRun 'airis init' to create a new manifest.`,
            }],
          };
        }

        let output = `MANIFEST INFO\n`;
        output += `${"=".repeat(40)}\n\n`;
        output += `Path: ${manifest.path}\n`;

        if (repo) {
          output += `Repository: ${repo.name} (${repo.branch})\n`;
        }

        if (manifest.project) {
          output += `\n[project]\n`;
          output += `  id: ${manifest.project.id}\n`;
          if (manifest.project.description) {
            output += `  description: ${manifest.project.description}\n`;
          }
        }

        if (manifest.workspace) {
          output += `\n[workspace]\n`;
          output += `  name: ${manifest.workspace.name}\n`;
          output += `  package_manager: ${manifest.workspace.package_manager}\n`;
        }

        if (manifest.packages) {
          output += `\n[packages]\n`;
          output += `  workspaces: ${manifest.packages.workspaces.join(", ")}\n`;
        }

        return {
          content: [{
            type: "text",
            text: output,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Error: ${errorMessage}`,
      }],
      isError: true,
    };
  }
});

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AIRIS Commands MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
