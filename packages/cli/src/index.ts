#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const program = new Command();

// Gateway installation directory
const GATEWAY_DIR = join(homedir(), '.airis-mcp-gateway');
const ENV_FILE_PATH = join(GATEWAY_DIR, '.env');
const REPO_URL = 'https://github.com/agiletec-inc/airis-mcp-gateway.git';

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

const GATEWAY_PUBLIC_URL = process.env.GATEWAY_PUBLIC_URL ?? 'http://gateway.localhost:9090';
const UI_PUBLIC_URL = process.env.UI_PUBLIC_URL ?? 'http://ui.gateway.localhost:5173';
const GATEWAY_API_URL = process.env.GATEWAY_API_URL ?? 'http://api.gateway.localhost:9100/api';

program
  .name('airis-gateway')
  .description('AIRIS MCP Gateway - Unified MCP server management')
  .version('1.0.0');

program
  .command('install')
  .description('Install AIRIS Gateway to all supported editors')
  .option('--claude-only', 'Install to Claude Code only')
  .option('--no-docker', 'Skip Docker container startup')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🌉 AIRIS MCP Gateway Installation\n'));

    // Step 1: Clone repository if not exists
    const spinner = ora('Checking Gateway installation...').start();

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
    }

    // Step 2: Update to latest version
    spinner.start('Updating to latest version...');
    try {
      execSync('git pull origin master', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Updated to latest version');
    } catch (error) {
      spinner.warn('Could not update (continuing with current version)');
    }

    const installCmd = options.claudeOnly ? 'make install-claude' : 'make install';

    // Step 3: Run unified install (Docker + editors)
    if (options.docker !== false) {
      spinner.start('Running unified install (Docker + editor configs)...');
      try {
        execSync(installCmd, { cwd: GATEWAY_DIR, stdio: 'inherit' });
        spinner.succeed('Gateway ready and editors configured');
      } catch (error) {
        spinner.fail('Unified install failed');
        console.error(chalk.red('Please ensure Docker is running and try again'));
        process.exit(1);
      }
    } else {
      // Step 4: Configure editors only (no Docker restart)
      spinner.start('Configuring editors only...');
      try {
        execSync(installCmd, { cwd: GATEWAY_DIR, stdio: 'inherit' });
        spinner.succeed('Editors configured');
      } catch (error) {
        spinner.fail('Failed to configure editors');
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    }

    // Success message
    console.log(chalk.green.bold('\n✅ Installation complete!\n'));
    console.log(chalk.blue('Next steps:'));
    console.log('  1. ' + chalk.yellow('Restart all editors') + ' (Claude Code, Cursor, Zed, etc.)');
    console.log('  2. Test MCP tools in any editor');
    console.log('  3. Access Settings UI: ' + chalk.cyan(UI_PUBLIC_URL));
    console.log('     ' + chalk.gray("(Need internal-only mode? Run 'make up-dev'.)"));
    console.log('\n');
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

    const spinner = ora('Uninstalling Gateway...').start();

    try {
      execSync('make uninstall', { cwd: GATEWAY_DIR, stdio: 'inherit' });
      spinner.succeed('Gateway uninstalled');
    } catch (error) {
      spinner.fail('Failed to uninstall');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    console.log(chalk.green('\n✅ Uninstallation complete\n'));
  });

program
  .command('start')
  .description('Start AIRIS Gateway containers')
  .action(() => {
    if (!existsSync(GATEWAY_DIR)) {
      console.log(chalk.red('Gateway not installed. Run: airis-gateway install'));
      process.exit(1);
    }

    const spinner = ora('Starting Gateway...').start();
    try {
      execSync('make up', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Gateway started');
      console.log(chalk.cyan('\n🔗 Gateway (public): ' + GATEWAY_PUBLIC_URL));
      console.log(chalk.cyan('🎨 Settings UI: ' + UI_PUBLIC_URL));
      console.log(chalk.gray("💡 Need internal-only networking? Run 'make up-dev'."));
    } catch (error) {
      spinner.fail('Failed to start');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
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
      execSync('make down', { cwd: GATEWAY_DIR, stdio: 'pipe' });
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
      execSync('make ps', { cwd: GATEWAY_DIR, stdio: 'inherit' });
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
      const cmd = options.follow ? 'make logs' : 'docker compose logs';
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
      execSync('git pull origin master', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Updated to latest version');
    } catch (error) {
      spinner.fail('Failed to update');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    spinner.start('Restarting Gateway...');
    try {
      execSync('make restart', { cwd: GATEWAY_DIR, stdio: 'pipe' });
      spinner.succeed('Gateway restarted with new version');
    } catch (error) {
      spinner.fail('Failed to restart');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }

    console.log(chalk.green('\n✅ Update complete\n'));
  });

program.parse();
