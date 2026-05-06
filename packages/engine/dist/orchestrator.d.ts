export interface OrchestratorOptions {
    /**
     * Model identifier in the "<provider>:<model>[@<baseUrl>]" format
     * (see config/model-factory.ts). Defaults to $ASST_ORCHESTRATOR_MODEL or
     * google:gemini-2.5-flash.
     */
    model?: string;
}
export declare class Orchestrator {
    private llm;
    private subAgents;
    private persistence;
    private repoRoot;
    private initPromise?;
    readonly model: string;
    constructor(repoRoot: string, opts?: OrchestratorOptions);
    /**
     * Initialize persistence. Safe to call multiple times (idempotent) —
     * subsequent calls reuse the in-flight or resolved promise so `chat()`
     * and `runFullScan()` can call it lazily without racing the CLI's
     * explicit `await orchestrator.init()`.
     */
    init(): Promise<void>;
    /**
     * Process a user message through the orchestrator → sub-agents pipeline.
     */
    chat(input: string, onStatus?: (msg: string) => void): Promise<string>;
    /**
     * Ask the orchestrator LLM to decide which sub-agents to invoke.
     */
    private route;
    /**
     * Deterministic scan — runs ALL sub-agents in order (no LLM routing needed).
     */
    runFullScan(onStatus?: (agent: string, status: string) => void): Promise<{
        agent: string;
        output: string;
    }[]>;
    private formatContent;
    close(): Promise<void>;
    getRecentHistory(limit?: number): Promise<{
        role: string;
        content: string;
        timestamp: string;
    }[]>;
}
