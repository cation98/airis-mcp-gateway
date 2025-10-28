/**
 * MCP Server Configuration Types
 * Supports single and multiple field configurations
 */

export type ConfigFieldType = 'text' | 'password' | 'textarea' | 'url';

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  placeholder: string;
  required: boolean;
  validation?: RegExp;
  helpText?: string;
}

export type ConfigType = 'single' | 'multiple' | 'connection_string';

export interface ServerConfigSchema {
  id: string;
  name: string;
  configType: ConfigType;
  fields: ConfigField[];
}

/**
 * Configuration schemas for MCP servers requiring API keys
 */
export const SERVER_CONFIG_SCHEMAS: Record<string, ServerConfigSchema> = {
  // Single field configurations
  tavily: {
    id: 'tavily',
    name: 'Tavily',
    configType: 'single',
    fields: [
      {
        key: 'TAVILY_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'tvly-xxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^tvly-[A-Za-z0-9]{32,}$/,
        helpText: 'Get your API key from https://tavily.com/dashboard'
      }
    ]
  },

  stripe: {
    id: 'stripe',
    name: 'Stripe',
    configType: 'single',
    fields: [
      {
        key: 'STRIPE_SECRET_KEY',
        label: 'Secret Key',
        type: 'password',
        placeholder: 'sk_test_xxxxxxxxxxxxxxxxxx or sk_live_xxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^sk_(test|live)_[A-Za-z0-9]{24,}$/,
        helpText: 'Use test key for development, live key for production'
      }
    ]
  },

  figma: {
    id: 'figma',
    name: 'Figma',
    configType: 'single',
    fields: [
      {
        key: 'FIGMA_ACCESS_TOKEN',
        label: 'Access Token',
        type: 'password',
        placeholder: 'figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^figd_[A-Za-z0-9_-]{40,}$/,
        helpText: 'Generate from Figma Account Settings > Personal access tokens'
      }
    ]
  },

  github: {
    id: 'github',
    name: 'GitHub',
    configType: 'single',
    fields: [
      {
        key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        label: 'Personal Access Token',
        type: 'password',
        placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^gh[ps]_[A-Za-z0-9]{36,}$/,
        helpText: 'Generate from GitHub Settings > Developer settings > Personal access tokens'
      }
    ]
  },

  notion: {
    id: 'notion',
    name: 'Notion',
    configType: 'single',
    fields: [
      {
        key: 'NOTION_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        helpText: 'Create an integration at https://www.notion.so/my-integrations'
      }
    ]
  },

  'brave-search': {
    id: 'brave-search',
    name: 'Brave Search',
    configType: 'single',
    fields: [
      {
        key: 'BRAVE_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'BSAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        helpText: 'Get API key from https://brave.com/search/api/'
      }
    ]
  },

  // Multiple field configurations
  supabase: {
    id: 'supabase',
    name: 'Supabase',
    configType: 'multiple',
    fields: [
      {
        key: 'SUPABASE_URL',
        label: 'Project URL',
        type: 'url',
        placeholder: 'https://xxxxx.supabase.co',
        required: true,
        validation: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
        helpText: 'Find in Project Settings > API > Project URL'
      },
      {
        key: 'SUPABASE_ANON_KEY',
        label: 'Anon/Public Key',
        type: 'password',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        required: true,
        validation: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
        helpText: 'Find in Project Settings > API > Project API keys > anon public'
      }
    ]
  },

  slack: {
    id: 'slack',
    name: 'Slack',
    configType: 'multiple',
    fields: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: 'Bot User OAuth Token',
        type: 'password',
        placeholder: 'xoxb-xxxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxxxxxx',
        required: true,
        validation: /^xoxb-[0-9]+-[0-9]+-[A-Za-z0-9]+$/,
        helpText: 'OAuth & Permissions > Bot User OAuth Token'
      },
      {
        key: 'SLACK_TEAM_ID',
        label: 'Team ID',
        type: 'text',
        placeholder: 'T01234567',
        required: true,
        validation: /^T[A-Z0-9]{8,}$/,
        helpText: 'Find in Slack workspace settings or your workspace URL'
      }
    ]
  },
  'supabase-selfhost': {
    id: 'supabase-selfhost',
    name: 'Supabase Self-host',
    configType: 'multiple',
    fields: [
      {
        key: 'PG_DSN',
        label: 'PostgreSQL DSN',
        type: 'text',
        placeholder: 'postgres://user:password@postgres:5432/postgres',
        required: true,
        helpText: 'Use read-only role. Example: postgres://mcp_ro:password@postgres:5432/postgres'
      },
      {
        key: 'POSTGREST_URL',
        label: 'PostgREST URL',
        type: 'url',
        placeholder: 'http://postgrest:3000/rest/v1',
        required: true,
        helpText: 'Self-hosted Supabase PostgREST endpoint (rest/v1)'
      },
      {
        key: 'POSTGREST_JWT',
        label: 'PostgREST JWT',
        type: 'password',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        required: true,
        helpText: 'Anon key or service_role key for PostgREST access'
      },
      {
        key: 'READ_ONLY',
        label: 'READ_ONLY (optional)',
        type: 'text',
        placeholder: 'true',
        required: false,
        helpText: 'true/false (default: true). Controls sbsh_execute_sql behaviour.'
      },
      {
        key: 'FEATURES',
        label: 'Feature Flags (optional)',
        type: 'text',
        placeholder: 'database,docs,postgrest',
        required: false,
        helpText: 'Comma-separated features: database,docs,postgrest,functions,storage'
      }
    ]
  },

  sentry: {
    id: 'sentry',
    name: 'Sentry',
    configType: 'multiple',
    fields: [
      {
        key: 'SENTRY_AUTH_TOKEN',
        label: 'Auth Token',
        type: 'password',
        placeholder: 'sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        helpText: 'Settings > Developer Settings > Auth Tokens'
      },
      {
        key: 'SENTRY_ORG',
        label: 'Organization Slug',
        type: 'text',
        placeholder: 'my-organization',
        required: true,
        helpText: 'Your Sentry organization name (in URL)'
      }
    ]
  },

  twilio: {
    id: 'twilio',
    name: 'Twilio',
    configType: 'multiple',
    fields: [
      {
        key: 'TWILIO_ACCOUNT_SID',
        label: 'Account SID',
        type: 'text',
        placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^AC[a-f0-9]{32}$/,
        helpText: 'Find in Twilio Console Dashboard'
      },
      {
        key: 'TWILIO_API_KEY',
        label: 'API Key SID',
        type: 'text',
        placeholder: 'SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^SK[a-f0-9]{32}$/,
        helpText: 'Account > API keys & tokens > Create API key'
      },
      {
        key: 'TWILIO_API_SECRET',
        label: 'API Secret',
        type: 'password',
        placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        validation: /^[a-f0-9]{32}$/,
        helpText: 'Shown once when creating API key - save it!'
      }
    ]
  },

  // Connection string configurations
  mongodb: {
    id: 'mongodb',
    name: 'MongoDB',
    configType: 'connection_string',
    fields: [
      {
        key: 'MONGODB_CONNECTION_STRING',
        label: 'Connection String',
        type: 'textarea',
        placeholder: 'mongodb+srv://username:password@cluster.mongodb.net/database',
        required: true,
        helpText: 'MongoDB Atlas: Database > Connect > Connect your application'
      }
    ]
  },

  postgresql: {
    id: 'postgresql',
    name: 'PostgreSQL',
    configType: 'connection_string',
    fields: [
      {
        key: 'POSTGRES_CONNECTION_STRING',
        label: 'Connection String',
        type: 'textarea',
        placeholder: 'postgresql://username:password@host:5432/database',
        required: true,
        helpText: 'Format: postgresql://user:pass@host:port/db'
      }
    ]
  }
};

/**
 * Get configuration schema for a server
 */
export function getServerConfigSchema(serverId: string): ServerConfigSchema | null {
  return SERVER_CONFIG_SCHEMAS[serverId] || null;
}

/**
 * Validate a configuration value against its schema
 */
export function validateConfigField(field: ConfigField, value: string): { valid: boolean; error?: string } {
  if (field.required && !value.trim()) {
    return { valid: false, error: `${field.label} is required` };
  }

  if (field.validation && value && !field.validation.test(value)) {
    return { valid: false, error: `Invalid format for ${field.label}` };
  }

  return { valid: true };
}
