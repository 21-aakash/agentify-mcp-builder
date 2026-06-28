import type { ExtractedTool } from './swagger-converter.js';
export interface GeneratorOptions {
    authBasic?: string;
    apiKey?: string;
}
export declare class McpGenerator {
    private outDir;
    private opts;
    constructor(outDir: string, opts?: GeneratorOptions);
    generate(tools: ExtractedTool[]): Promise<void>;
    private _validateGenerated;
    private _packageJson;
    private _tsConfig;
    private _renderSchemas;
    private _toVarName;
    private _renderTools;
    private _renderHandlers;
    private _renderServer;
    private _renderAgentsMd;
}
