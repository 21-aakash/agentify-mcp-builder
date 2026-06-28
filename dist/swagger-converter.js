import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
function openApiTypeToJsonSchema(type) {
    const map = {
        integer: 'number',
        number: 'number',
        boolean: 'boolean',
        array: 'array',
        object: 'object',
        string: 'string',
    };
    return map[type] ?? 'string';
}
function toCamel(str) {
    return str
        .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (c) => c.toLowerCase());
}
const READ_ONLY_METHODS = ['get', 'head'];
const ALL_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head'];
function parseApi(api, servicePrefix, readOnly = false) {
    const tools = [];
    const methods = readOnly ? READ_ONLY_METHODS : ALL_METHODS;
    for (const [routePath, pathItem] of Object.entries(api.paths ?? {})) {
        for (const method of methods) {
            const op = pathItem[method];
            if (!op)
                continue;
            const operationId = op.operationId ??
                `${method}_${routePath.replace(/\//g, '_').replace(/[{}]/g, '').replace(/^_/, '')}`;
            const allParams = [
                ...(pathItem.parameters ?? []),
                ...(op.parameters ?? []),
            ];
            const bodyParams = [];
            const bodyTypes = [];
            if (op.requestBody?.content) {
                const jsonContent = op.requestBody.content['application/json'] ??
                    op.requestBody.content['*/*'];
                if (jsonContent?.schema?.properties) {
                    for (const [propName, propSchema] of Object.entries(jsonContent.schema.properties)) {
                        bodyParams.push(propName);
                        bodyTypes.push(openApiTypeToJsonSchema(propSchema.type ?? 'string'));
                    }
                }
            }
            // Merge path/query params + body params, deduplicating by name (path param wins)
            const seenNames = new Set();
            const mergedParams = [];
            const mergedTypes = [];
            for (const p of allParams) {
                if (!seenNames.has(p.name)) {
                    seenNames.add(p.name);
                    mergedParams.push(p.name);
                    mergedTypes.push(openApiTypeToJsonSchema(p.schema?.type ?? p.type ?? 'string'));
                }
            }
            for (let i = 0; i < bodyParams.length; i++) {
                if (!seenNames.has(bodyParams[i])) {
                    seenNames.add(bodyParams[i]);
                    mergedParams.push(bodyParams[i]);
                    mergedTypes.push(bodyTypes[i]);
                }
            }
            const toolName = `${servicePrefix}_${toCamel(operationId)}`;
            tools.push({
                name: toolName,
                description: op.summary ?? op.description ?? `${method.toUpperCase()} ${routePath}`,
                params: mergedParams,
                paramTypes: mergedTypes,
                httpMethod: method.toUpperCase(),
                httpPath: routePath,
                service: servicePrefix,
            });
        }
    }
    return tools;
}
export async function fromUrl(url, servicePrefix, readOnly = false) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch spec from ${url}: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    let spec;
    if (contentType.includes('yaml') || contentType.includes('text/plain')) {
        const text = await response.text();
        spec = yaml.load(text);
    }
    else {
        const text = await response.text();
        try {
            spec = JSON.parse(text);
        }
        catch {
            spec = yaml.load(text);
        }
    }
    const api = await SwaggerParser.validate(spec);
    return parseApi(api, servicePrefix, readOnly);
}
export async function fromFile(filePath, servicePrefix, readOnly = false) {
    const { readFileSync } = await import('fs');
    const raw = readFileSync(filePath, 'utf-8');
    let spec;
    try {
        spec = JSON.parse(raw);
    }
    catch {
        spec = yaml.load(raw);
    }
    const api = await SwaggerParser.validate(spec);
    return parseApi(api, servicePrefix, readOnly);
}
