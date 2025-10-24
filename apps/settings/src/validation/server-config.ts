/**
 * Zod validation schemas for MCP server configurations
 */
import { z } from 'zod';

// Single field schemas
export const tavilySchema = z.object({
  TAVILY_API_KEY: z.string()
    .min(1, 'API Key is required')
    .regex(/^tvly-[A-Za-z0-9]{32,}$/, 'Invalid Tavily API key format')
});

export const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string()
    .min(1, 'Secret Key is required')
    .regex(/^sk_(test|live)_[A-Za-z0-9]{24,}$/, 'Invalid Stripe secret key format')
});

export const figmaSchema = z.object({
  FIGMA_ACCESS_TOKEN: z.string()
    .min(1, 'Access Token is required')
    .regex(/^figd_[A-Za-z0-9_-]{40,}$/, 'Invalid Figma access token format')
});

export const githubSchema = z.object({
  GITHUB_PERSONAL_ACCESS_TOKEN: z.string()
    .min(1, 'Personal Access Token is required')
    .regex(/^gh[ps]_[A-Za-z0-9]{36,}$/, 'Invalid GitHub token format')
});

export const notionSchema = z.object({
  NOTION_API_KEY: z.string()
    .min(1, 'API Key is required')
    .regex(/^secret_[A-Za-z0-9]+$/, 'Invalid Notion API key format')
});

export const braveSearchSchema = z.object({
  BRAVE_API_KEY: z.string()
    .min(1, 'API Key is required')
    .regex(/^BSA[A-Za-z0-9]+$/, 'Invalid Brave API key format')
});

// Multiple field schemas
export const supabaseSchema = z.object({
  SUPABASE_URL: z.string()
    .min(1, 'Project URL is required')
    .url('Must be a valid URL')
    .regex(/^https:\/\/[a-z0-9]+\.supabase\.co$/, 'Must be a valid Supabase URL'),
  SUPABASE_ANON_KEY: z.string()
    .min(1, 'Anon Key is required')
    .regex(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Invalid JWT format')
});

export const supabaseSelfhostSchema = z.object({
  PG_DSN: z.string()
    .min(1, 'PostgreSQL DSN is required')
    .regex(/^postgres(?:ql)?:\/\/.+$/, 'Invalid PostgreSQL DSN format'),
  POSTGREST_URL: z.string()
    .min(1, 'PostgREST URL is required')
    .url('Must be a valid URL'),
  POSTGREST_JWT: z.string()
    .min(1, 'PostgREST JWT is required')
    .regex(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Invalid JWT format'),
  READ_ONLY: z.string()
    .optional()
    .refine((value) => !value || /^(true|false)$/i.test(value.trim()), 'READ_ONLY must be "true" or "false"'),
  FEATURES: z.string()
    .optional()
    .refine((value) => !value || /^[a-z][a-z\-]*(,[a-z][a-z\-]*)*$/.test(value.toLowerCase()), 'Invalid feature flag list')
});

export const slackSchema = z.object({
  SLACK_BOT_TOKEN: z.string()
    .min(1, 'Bot Token is required')
    .regex(/^xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+$/, 'Invalid Slack bot token format'),
  SLACK_TEAM_ID: z.string()
    .min(1, 'Team ID is required')
    .regex(/^T[A-Z0-9]{8,}$/, 'Invalid Slack team ID format')
});

export const sentrySchema = z.object({
  SENTRY_AUTH_TOKEN: z.string()
    .min(1, 'Auth Token is required')
    .regex(/^sntrys_[a-zA-Z0-9]+$/, 'Invalid Sentry auth token format'),
  SENTRY_ORG: z.string()
    .min(1, 'Organization is required')
    .regex(/^[a-z0-9-]+$/, 'Invalid organization format'),
  SENTRY_PROJECT_ID: z.string().optional(),
  SENTRY_PROJECT_SLUG: z.string().optional(),
  SENTRY_BASE_URL: z.string().url().optional()
});

export const twilioSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string()
    .min(1, 'Account SID is required')
    .regex(/^AC[a-f0-9]{32}$/, 'Invalid Account SID format'),
  TWILIO_API_KEY: z.string()
    .min(1, 'API Key is required')
    .regex(/^SK[a-f0-9]{32}$/, 'Invalid API Key format'),
  TWILIO_API_SECRET: z.string()
    .min(1, 'API Secret is required')
    .regex(/^[a-f0-9]{32}$/, 'Invalid API Secret format')
});

// Connection string schemas
export const mongodbSchema = z.object({
  MONGODB_CONNECTION_STRING: z.string()
    .min(1, 'Connection String is required')
    .regex(/^mongodb(\+srv)?:\/\/.+$/, 'Invalid MongoDB connection string format')
});

export const postgresqlSchema = z.object({
  POSTGRES_CONNECTION_STRING: z.string()
    .min(1, 'Connection String is required')
    .regex(/^postgresql:\/\/.+$/, 'Invalid PostgreSQL connection string format')
});

// Schema registry
export const SERVER_VALIDATION_SCHEMAS: Record<string, z.ZodObject<any>> = {
  tavily: tavilySchema,
  stripe: stripeSchema,
  figma: figmaSchema,
  github: githubSchema,
  notion: notionSchema,
  'brave-search': braveSearchSchema,
  supabase: supabaseSchema,
  'supabase-selfhost': supabaseSelfhostSchema,
  slack: slackSchema,
  sentry: sentrySchema,
  twilio: twilioSchema,
  mongodb: mongodbSchema,
  postgresql: postgresqlSchema
};

/**
 * Validate server configuration
 */
export function validateServerConfig(
  serverId: string,
  config: Record<string, string>
): { success: boolean; errors?: Record<string, string> } {
  const schema = SERVER_VALIDATION_SCHEMAS[serverId];

  if (!schema) {
    return { success: true }; // No validation schema = valid
  }

  try {
    schema.parse(config);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const fieldName = err.path[0] as string;
        errors[fieldName] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _general: 'Validation failed' } };
  }
}

/**
 * Validate a single field
 */
export function validateField(
  serverId: string,
  fieldName: string,
  value: string
): { valid: boolean; error?: string } {
  const schema = SERVER_VALIDATION_SCHEMAS[serverId];

  if (!schema) {
    return { valid: true };
  }

  try {
    const fieldSchema = schema.shape[fieldName];
    if (fieldSchema) {
      fieldSchema.parse(value);
      return { valid: true };
    }
    return { valid: true }; // Field not in schema = valid
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0]?.message };
    }
    return { valid: false, error: 'Validation failed' };
  }
}
