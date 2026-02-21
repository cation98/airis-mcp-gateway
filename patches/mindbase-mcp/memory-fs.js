/**
 * MindBase MCP Server - File System Memory Storage
 *
 * Markdown-based memory storage inspired by Serena's approach.
 * Stores memories as .md files in .mindbase/memories/
 */
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { Pool } from 'pg';
export class FileSystemMemoryBackend {
    baseDir;
    pool;
    ollamaUrl;
    embeddingModel;
    constructor(baseDir, connectionString, ollamaUrl, embeddingModel) {
        // Default: ~/Library/Application Support/mindbase/memories
        this.baseDir =
            baseDir || join(homedir(), 'Library', 'Application Support', 'mindbase', 'memories');
        this.ollamaUrl = ollamaUrl;
        this.embeddingModel = embeddingModel;
        // Optional: PostgreSQL for semantic search
        if (connectionString) {
            this.pool = new Pool({ connectionString });
        }
    }
    /**
     * Get memory directory path
     */
    getMemoryPath(name, project) {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        if (project) {
            return join(this.baseDir, project, fileName);
        }
        return join(this.baseDir, fileName);
    }
    /**
     * Ensure memory directory exists
     */
    async ensureMemoryDir(project) {
        const dir = project ? join(this.baseDir, project) : this.baseDir;
        await fs.mkdir(dir, { recursive: true });
        return dir;
    }
    /**
     * Parse markdown frontmatter and content
     */
    parseFrontmatter(content) {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);
        if (!match) {
            return { frontmatter: {}, body: content };
        }
        const frontmatterText = match[1];
        const body = match[2];
        const frontmatter = {};
        // Simple YAML parsing (key: value)
        frontmatterText.split('\n').forEach((line) => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                // Handle arrays (tags: [tag1, tag2])
                if (value.startsWith('[') && value.endsWith(']')) {
                    frontmatter[key.trim()] = value
                        .slice(1, -1)
                        .split(',')
                        .map((v) => v.trim());
                }
                else {
                    frontmatter[key.trim()] = value;
                }
            }
        });
        return { frontmatter, body };
    }
    /**
     * Serialize memory to markdown with frontmatter
     */
    serializeMemory(memory) {
        const frontmatter = [];
        if (memory.category) {
            frontmatter.push(`category: ${memory.category}`);
        }
        if (memory.project) {
            frontmatter.push(`project: ${memory.project}`);
        }
        if (memory.tags && memory.tags.length > 0) {
            frontmatter.push(`tags: [${memory.tags.join(', ')}]`);
        }
        frontmatter.push(`createdAt: ${memory.createdAt.toISOString()}`);
        frontmatter.push(`updatedAt: ${memory.updatedAt.toISOString()}`);
        if (frontmatter.length === 0) {
            return memory.content;
        }
        return `---\n${frontmatter.join('\n')}\n---\n\n${memory.content}`;
    }
    /**
     * Generate embedding using Ollama
     */
    async generateEmbedding(text) {
        if (!this.pool) {
            return undefined; // Skip embedding if no database
        }
        try {
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: text,
                }),
            });
            if (!response.ok) {
                console.error(`Ollama API error: ${response.statusText}`);
                return undefined;
            }
            const data = await response.json();
            return data.embedding;
        }
        catch (error) {
            console.error('Failed to generate embedding:', error);
            return undefined;
        }
    }
    /**
     * Save memory to PostgreSQL
     */
    async saveToDatabase(memory) {
        if (!this.pool) {
            return; // Skip database if not configured
        }
        const query = `
      INSERT INTO memories (name, content, category, project, tags, embedding, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (name, project) DO UPDATE SET
        content = EXCLUDED.content,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        embedding = EXCLUDED.embedding,
        updated_at = EXCLUDED.updated_at
    `;
        await this.pool.query(query, [
            memory.name,
            memory.content,
            memory.category || null,
            memory.project || null,
            memory.tags || [],
            memory.embedding ? `[${memory.embedding.join(',')}]` : null,
            memory.createdAt,
            memory.updatedAt,
        ]);
    }
    /**
     * Write memory to both markdown and database
     */
    async writeMemory(name, content, options) {
        const now = new Date();
        const filePath = this.getMemoryPath(name, options?.project);
        // Check if file exists to preserve createdAt
        let createdAt = now;
        try {
            const existing = await this.readMemory(name, options?.project);
            if (existing) {
                createdAt = existing.createdAt;
            }
        }
        catch {
            // New file, use current time
        }
        const memory = {
            name,
            content,
            category: options?.category,
            project: options?.project,
            tags: options?.tags,
            createdAt,
            updatedAt: now,
        };
        // Generate embedding for database search
        const embedding = await this.generateEmbedding(content);
        // 1. Write to markdown file
        await this.ensureMemoryDir(options?.project);
        const markdown = this.serializeMemory(memory);
        await fs.writeFile(filePath, markdown, 'utf-8');
        // 2. Save to database with embedding
        await this.saveToDatabase({ ...memory, embedding });
        return filePath;
    }
    /**
     * Read memory by name
     */
    async readMemory(name, project) {
        const filePath = this.getMemoryPath(name, project);
        try {
            const markdown = await fs.readFile(filePath, 'utf-8');
            const { frontmatter, body } = this.parseFrontmatter(markdown);
            return {
                name,
                content: body.trim(),
                category: frontmatter.category,
                project: frontmatter.project || project,
                tags: frontmatter.tags,
                createdAt: frontmatter.createdAt ? new Date(frontmatter.createdAt) : new Date(),
                updatedAt: frontmatter.updatedAt ? new Date(frontmatter.updatedAt) : new Date(),
            };
        }
        catch (error) {
            // File doesn't exist, try database fallback
            if (this.pool) {
                const query = `SELECT * FROM memories WHERE name = $1 AND (project = $2 OR project IS NULL)`;
                const result = await this.pool.query(query, [name, project || null]);
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    return {
                        name: row.name,
                        content: row.content,
                        category: row.category,
                        project: row.project,
                        tags: row.tags,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                    };
                }
            }
            return null;
        }
    }
    /**
     * List all memories with optional filtering
     * PATCHED: Falls back to database when filesystem is empty (transient container)
     */
    async listMemories(filters) {
        const dir = filters?.project ? join(this.baseDir, filters.project) : this.baseDir;
        let fsMemories = [];
        try {
            await fs.access(dir);
            const files = await fs.readdir(dir);
            for (const file of files) {
                if (!file.endsWith('.md')) {
                    continue;
                }
                const filePath = join(dir, file);
                const stats = await fs.stat(filePath);
                const content = await fs.readFile(filePath, 'utf-8');
                const { frontmatter } = this.parseFrontmatter(content);
                // Apply filters
                if (filters?.category && frontmatter.category !== filters.category) {
                    continue;
                }
                if (filters?.tags &&
                    (!frontmatter.tags ||
                        !filters.tags.some((tag) => frontmatter.tags.includes(tag)))) {
                    continue;
                }
                fsMemories.push({
                    name: basename(file, '.md'),
                    category: frontmatter.category,
                    project: frontmatter.project || filters?.project,
                    tags: frontmatter.tags,
                    size: stats.size,
                    createdAt: frontmatter.createdAt ? new Date(frontmatter.createdAt) : stats.birthtime,
                    updatedAt: frontmatter.updatedAt ? new Date(frontmatter.updatedAt) : stats.mtime,
                });
            }
        }
        catch {
            // Directory doesn't exist - will fall through to DB
        }
        // If filesystem returned results, use them
        if (fsMemories.length > 0) {
            return fsMemories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        // DB fallback: filesystem empty or missing (transient container)
        if (this.pool) {
            try {
                const conditions = [];
                const params = [];
                let paramIndex = 1;
                if (filters?.project) {
                    conditions.push(`project = $${paramIndex++}`);
                    params.push(filters.project);
                }
                if (filters?.category) {
                    conditions.push(`category = $${paramIndex++}`);
                    params.push(filters.category);
                }
                const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
                const sqlQuery = `SELECT name, content, category, project, tags, created_at, updated_at FROM memories ${whereClause} ORDER BY updated_at DESC`;
                const result = await this.pool.query(sqlQuery, params);
                let dbMemories = result.rows.map((row) => ({
                    name: row.name,
                    category: row.category,
                    project: row.project,
                    tags: row.tags,
                    size: row.content ? Buffer.byteLength(row.content, 'utf-8') : 0,
                    createdAt: new Date(row.created_at),
                    updatedAt: new Date(row.updated_at),
                }));
                // Apply tag filter (DB query doesn't handle array overlap)
                if (filters?.tags) {
                    dbMemories = dbMemories.filter((m) => m.tags && filters.tags.some((tag) => m.tags.includes(tag)));
                }
                return dbMemories;
            }
            catch (error) {
                console.error('DB fallback for listMemories failed:', error);
                return [];
            }
        }
        return [];
    }
    /**
     * Delete memory from both markdown and database
     * PATCHED: Separate try/catch so DB deletion proceeds even when file doesn't exist
     */
    async deleteMemory(name, project) {
        const filePath = this.getMemoryPath(name, project);
        let fileDeleted = false;
        let dbDeleted = false;
        // 1. Try to delete markdown file (may not exist in transient container)
        try {
            await fs.unlink(filePath);
            fileDeleted = true;
        }
        catch {
            // File doesn't exist - that's OK, continue to DB deletion
        }
        // 2. Delete from database (independent of file deletion)
        if (this.pool) {
            try {
                const result = await this.pool.query(`DELETE FROM memories WHERE name = $1 AND (project = $2 OR project IS NULL)`, [
                    name,
                    project || null,
                ]);
                dbDeleted = result.rowCount > 0;
            }
            catch (error) {
                console.error('DB deletion failed for memory:', name, error);
            }
        }
        return fileDeleted || dbDeleted;
    }
    /**
     * Semantic search across memories (requires database)
     */
    async searchMemories(query, options) {
        if (!this.pool) {
            throw new Error('Database not configured for semantic search');
        }
        const limit = options?.limit ?? 10;
        const threshold = options?.threshold ?? 0.7;
        // Generate query embedding
        const queryEmbedding = await this.generateEmbedding(query);
        if (!queryEmbedding) {
            return [];
        }
        const conditions = ['embedding IS NOT NULL'];
        const params = [`[${queryEmbedding.join(',')}]`, threshold, limit];
        let paramIndex = 4;
        if (options?.project) {
            conditions.push(`project = $${paramIndex++}`);
            params.push(options.project);
        }
        if (options?.category) {
            conditions.push(`category = $${paramIndex++}`);
            params.push(options.category);
        }
        const whereClause = conditions.join(' AND ');
        const sqlQuery = `
      SELECT
        *,
        1 - (embedding <=> $1::vector) as similarity
      FROM memories
      WHERE ${whereClause}
        AND 1 - (embedding <=> $1::vector) > $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
        const result = await this.pool.query(sqlQuery, params);
        return result.rows.map((row) => ({
            memory: {
                name: row.name,
                content: row.content,
                category: row.category,
                project: row.project,
                tags: row.tags,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            },
            similarity: row.similarity,
            path: this.getMemoryPath(row.name, row.project),
        }));
    }
    /**
     * Close database connection
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}
//# sourceMappingURL=memory-fs.js.map