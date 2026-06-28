export interface ExtractedTool {
    name: string;
    description: string;
    params: string[];
    paramTypes: string[];
    httpMethod: string;
    httpPath: string;
    service: string;
}
export declare function fromUrl(url: string, servicePrefix: string, readOnly?: boolean): Promise<ExtractedTool[]>;
export declare function fromFile(filePath: string, servicePrefix: string, readOnly?: boolean): Promise<ExtractedTool[]>;
