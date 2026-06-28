import type { ExtractedTool } from './swagger-converter.js';
export interface PythonGeneratorOptions {
    authBasic?: string;
    apiKey?: string;
}
export declare class PythonGenerator {
    private outDir;
    private opts;
    constructor(outDir: string, opts?: PythonGeneratorOptions);
    generate(tools: ExtractedTool[]): Promise<void>;
    private _requirements;
    private _toPyIdent;
    private _renderHandlers;
    private _renderServer;
    private _renderAgentsMd;
}
