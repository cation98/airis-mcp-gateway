#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync, copyFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const program = new Command();

// Gateway installation directory
const GATEWAY_DIR = join(homedir(), '.airis-mcp-gateway');
const ENV_FILE_PATH = join(GATEWAY_DIR, '.env');
const REPO_URL = 'https://github.com/agiletec-inc/airis-mcp-gateway.git';

// Service directories that need .env files
const SERVICE_ENV_DIRS = [
  'apps/settings',
  'apps/api',
  'servers/mindbase',
  'servers/airis-mcp-gateway-control',
];

const loadEnvFromFile = (filePath: string) => {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }

    const [rawKey, ...rest] = line.split('=');
    const key = rawKey.trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = rest.join('=').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadEnvFromFile(ENV_FILE_PATH);

const GATEWAY_PUBLIC_URL = process.env.GATEWAY_PUBLIC_URL ?? 'http://gateway.localhost:9390';
const UI_PUBLIC_URL = process.env.UI_PUBLIC_URL ?? 'http://ui.gateway.localhost:5273';
const GATEWAY_API_URL = process.env.GATEWAY_API_URL ?? 'http://api.gateway.localhost:9400/api';
const HEALTH_URL = 'http://api.gateway.localhost:9400/health';

// Check if Docker is running
const isDockerRunning = (): boolean => {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

// Ensure Docker is running (auto-start on macOS)
const ensureDockerRunning = async (spinner: ReturnType<typeof ora>): Promise<boolean> => {
  if (isDockerRunning()) {
    spinner.succeed('Docker is running');
    return true;
  }

  // Try to start Docker Desktop on macOS
  if (process.platform === 'darwin') {
    spinner.text = 'Starting Docker...';
    try {
      // Try OrbStack first (faster startup)
      try {
        execSync('open -a OrbStack', { stdio: 'pipe' });
        spinner.text = 'Starting OrbStack...';
      } catch {
        // Fall back to Docker Desktop
        execSync('open -a Docker', { stdio: 'pipe' });
        spinner.text = 'Starting Docker Desktop...';
      }

      // Wait for Docker to be ready (max 60 seconds)
      const maxWait = 60;
      for (let i = 0; i < maxWait; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        spinner.text = `Waiting for Docker to start... (${i + 1}s)`;
        if (isDockerRunning()) {
          spinner.succeed('Docker is running');
          return true;
        }
      }
      spinner.fail('Docker failed to start within 60 seconds');
      return false;
    } catch {
      spinner.fail('Could not start Docker Desktop');
      console.log(chalk.yellow('Please start Docker manually and try again'));
      return false;
    }
  }

  // On Linux, Docker should be managed by systemd
  if (process.platform === 'linux') {
    spinner.fail('Docker is not running');
    console.log(chalk.yellow('Start Docker with: sudo systemctl start docker'));
    return false;
  }

  spinner.fail('Docker is not running');
  console.log(chalk.yellow('Please start Docker and try again'));
  return false;
};

// Create .env files for services
const createServiceEnvFiles = (gatewayDir: string): void => {
  // Root .env
  const envPath = join(gatewayDir, '.env');
  const envExamplePath = join(gatewayDir, '.env.example');
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
  }

  // Service .env files
  for (const dir of SERVICE_ENV_DIRS) {
    const dirPath = join(gatewayDir, dir);
    const serviceEnvPath = join(dirPath, '.env');
    const serviceEnvExamplePath = join(dirPath, '.env.example');

    if (existsSync(dirPath) && !existsSync(serviceEnvPath)) {
      if (existsSync(serviceEnvExamplePath)) {
        copyFileSync(serviceEnvExamplePath, serviceEnvPath);
      } else {
        writeFileSync(serviceEnvPath, '');
      }
    }
  }
};

// Wait for health check
const waitForHealth = async (spinner: ReturnType<typeof ora>, maxAttempts = 30): Promise<boolean> => {
  spinner.start('Waiting for Gateway to be ready...');
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`curl -sf ${HEALTH_URL}`, { stdio: 'pipe' });
      spinner.succeed('Gateway is healthy');
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  spinner.warn('Gateway may still be starting up');
  return false;
};

// Register with Claude Code
const registerWithClaudeCode = (spinner: ReturnType<typeof ora>): void => {
  try {
    const result = spawnSync('which', ['claude'], { stdio: 'pipe' });
    if (result.status !== 0) {
      return;
    }

    spinner.start('Registering with Claude Code...');
    execSync(
      'claude mcp add --transport http airis-mcp-gateway http://api.gateway.localhost:9400/api/v1/mcp',
      { stdio: 'pipe' }
    );
    spinner.succeed('Registered with Claude Code');
  } catch {
    // Already registered or Claude not available
  }
};

// Enable brew services for auto-start
const enableBrewServices = (spinner: ReturnType<typeof ora>): void => {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    const result = spawnSync('which', ['brew'], { stdio: 'pipe' });
    if (result.status !== 0) {
      return;
    }

    spinner.start('Enabling auto-start on login...');
    execSync('brew services start airis-mcp-gateway', { stdio: 'pipe' });
    spinner.succeed('Auto-start enabled (brew services)');
  } catch {
    // brew services not available or already running
  }
};

program
  .name('airis-gateway')
  .description('AIRIS MCP Gateway - Unified MCP server management')
  .version(version);

program
  .command('install')
  .description('Install and start AIRIS Gateway (clones repo, starts Docker, registers IDEs)')
  .option('--no-auto-start', 'Skip enabling auto-start on login')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🚀 AIRIS MCP Gateway Installation\n'));

    const spinner = ora('Checking installation...').start();

    // Step 1: Clone repository if not exists
    if (!existsSync(GATEWAY_DIR)) {
      spinner.text = 'Cloning AIRIS Gateway repository...';
      try {
        execSync(`git clone ${REPO_URL} ${GATEWAY_DIR}`, { stdio: 'pipe' });
        spinner.succeed('Repository cloned');
      } catch (error) {
        spinner.fail('Failed to clone repository');
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    } else {
      spinner.succeed('Gateway already installed');

      // Update to latest
      spinner.start('Updating to latest version...');
      try {
        execSync('git pull origin main', { cwd: GATEWAY_DIR, stdio: 'pipe' });
        spinner.succeed('Updated to latest version');
      } catch {
        spinner.warn('Could not update (continuing with current version)');
      }
    }

    // Step 2: Create .env files
    spinner.start('Creating .env files...');
    createServiceEnvFiles(GATEWAY_DIR);
    spinner.succeed('Service .env files created');

    // Step 3: Ensure Docker is running
    spinner.start('Checking Docker...');
    const dockerReady = await ensureDockerRunning(spinner);
    if (!dockerReady) {
      process.exit(1);
    }

    // Step 4: Start containers
    spinner.start('Starting Gateway containers...');
    try {
      execSync('docker compose up -d', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Gateway containers started');
    } catch (error) {
      spinner.fail('Failed to start containers');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    // Step 5: Wait for health
    await waitForHealth(spinner);

    // Step 6: Register with Claude Code
    registerWithClaudeCode(spinner);

    // Step 7: Enable auto-start (unless --no-auto-start)
    if (options.autoStart !== false) {
      enableBrewServices(spinner);
    }

    // Success message
    console.log(chalk.green.bold('\n✅ Installation complete!\n'));
    console.log(chalk.cyan('🔗 Gateway: ' + GATEWAY_PUBLIC_URL));
    console.log(chalk.cyan('🎨 Settings UI: ' + UI_PUBLIC_URL));
    console.log(chalk.cyan('📡 API: ' + GATEWAY_API_URL));
    console.log(chalk.gray('\n💡 Restart your IDE to start using MCP tools'));
    console.log('');
  });

program
  .command('uninstall')
  .description('Uninstall AIRIS Gateway and restore original configs')
  .action(async () => {
    console.log(chalk.yellow.bold('\n🗑️  AIRIS Gateway Uninstallation\n'));

    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not found. Nothing to uninstall.'));
      process.exit(0);
    }

    const spinner = ora('Stopping brew services...').start();

    // Stop brew services first
    if (process.platform === 'darwin') {
      try {
        execSync('brew services stop airis-mcp-gateway', { stdio: 'pipe' });
        spinner.succeed('Brew services stopped');
      } catch {
        spinner.warn('Brew services not running');
      }
    }

    spinner.start('Stopping Docker containers...');
    try {
      execSync('docker compose down', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Docker containers stopped');
    } catch {
      spinner.warn('Could not stop containers (may not be running)');
    }

    spinner.start('Restoring editor configs...');
    try {
      execSync('python3 scripts/install_all_editors.py uninstall', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Editor configs restored');
    } catch {
      spinner.warn('Could not restore editor configs');
    }

    console.log(chalk.green('\n✅ Uninstallation complete\n'));
  });

program
  .command('start')
  .description('Start AIRIS Gateway containers (auto-starts Docker if needed)')
  .action(async () => {
    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not installed. Run: airis-gateway install'));
      process.exit(1);
    }

    const spinner = ora('Checking Docker...').start();

    // Ensure Docker is running
    const dockerReady = await ensureDockerRunning(spinner);
    if (!dockerReady) {
      process.exit(1);
    }

    // Ensure .env files exist
    createServiceEnvFiles(GATEWAY_DIR);

    spinner.start('Starting Gateway containers...');
    try {
      execSync('docker compose up -d', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Gateway started');
    } catch (error) {
      spinner.fail('Failed to start');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    // Health check
    await waitForHealth(spinner);

    console.log(chalk.green.bold('\n✅ AIRIS Gateway is running\n'));
    console.log(chalk.cyan('🔗 Gateway: ' + GATEWAY_PUBLIC_URL));
    console.log(chalk.cyan('🎨 Settings UI: ' + UI_PUBLIC_URL));
    console.log(chalk.cyan('📡 API: ' + GATEWAY_API_URL));
    console.log(chalk.gray('\n💡 Run `airis-gateway logs -f` to view logs'));
  });

program
  .command('stop')
  .description('Stop AIRIS Gateway containers')
  .action(() => {
    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not installed'));
      process.exit(1);
    }

    const spinner = ora('Stopping Gateway...').start();
    try {
      execSync('docker compose down', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Gateway stopped');
    } catch (error) {
      spinner.fail('Failed to stop');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check AIRIS Gateway status')
  .action(() => {
    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not installed'));
      process.exit(1);
    }

    try {
      console.log(chalk.blue.bold('\n📊 AIRIS Gateway Status\n'));
      execSync('docker compose ps', { cwd: GATEWAY_DIR, stdio: 'inherit' });

      // Check brew services status on macOS
      if (process.platform === 'darwin') {
        try {
          console.log('');
          execSync('brew services info airis-mcp-gateway', { stdio: 'inherit' });
        } catch {
          // brew services not available
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('Show AIRIS Gateway logs')
  .option('-f, --follow', 'Follow log output')
  .action((options) => {
    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not installed'));
      process.exit(1);
    }

    try {
      const cmd = options.follow ? 'docker compose logs -f' : 'docker compose logs';
      execSync(cmd, { cwd: GATEWAY_DIR, stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update AIRIS Gateway to latest version')
  .action(async () => {
    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not installed. Run: airis-gateway install'));
      process.exit(1);
    }

    console.log(chalk.blue.bold('\n🔄 Updating AIRIS Gateway\n'));

    const spinner = ora('Pulling latest changes...').start();
    try {
      execSync('git pull origin main', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Updated to latest version');
    } catch (error) {
      spinner.fail('Failed to update');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    // Ensure Docker is running
    spinner.start('Checking Docker...');
    const dockerReady = await ensureDockerRunning(spinner);
    if (!dockerReady) {
      process.exit(1);
    }

    spinner.start('Rebuilding and restarting Gateway...');
    try {
      execSync('docker compose up -d --build', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Gateway restarted with new version');
    } catch (error) {
      spinner.fail('Failed to restart');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    await waitForHealth(spinner);

    console.log(chalk.green('\n✅ Update complete\n'));
  });

program.parse();
