import type { Tool } from '../../../Tool.js';
import { zodToJsonSchema } from '../../../utils/zodToJsonSchema.js';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | unknown };

const GEMINI_ALLOWED_SCHEMA_KEYS = new Set([
  'type',
  'description',
  'properties',
  'required',
  'items',
  'enum',
  'nullable',
  'format',
]);

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(v => typeof v === 'string') as string[];
}

function normalizeSchemaType(
  typeValue: unknown,
): { type: string | undefined; nullable: boolean } {
  if (typeof typeValue === 'string') {
    return {
      type: typeValue,
      nullable: false,
    };
  }

  if (Array.isArray(typeValue)) {
    const nullable = typeValue.includes('null');
    const firstConcrete = typeValue.find(
      v => typeof v === 'string' && v !== 'null',
    ) as string | undefined;
    return {
      type: firstConcrete,
      nullable,
    };
  }

  return {
    type: undefined,
    nullable: false,
  };
}

function chooseUnionCandidate(schema: Record<string, unknown>): unknown {
  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    return oneOf[0];
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    return anyOf[0];
  }

  const allOf = schema.allOf;
  if (Array.isArray(allOf) && allOf.length > 0) {
    return allOf[0];
  }

  return undefined;
}

function sanitizeGeminiSchemaInner(schema: unknown): Record<string, unknown> {
  const raw = asObject(schema);
  if (!raw) {
    return {
      type: 'object',
      properties: {},
    };
  }

  const unionCandidate = chooseUnionCandidate(raw);
  if (unionCandidate) {
    return sanitizeGeminiSchemaInner(unionCandidate);
  }

  const { type, nullable } = normalizeSchemaType(raw.type);
  const result: Record<string, unknown> = {};

  if (type) {
    result.type = type;
  }
  if (nullable) {
    result.nullable = true;
  }

  if (typeof raw.description === 'string') {
    result.description = raw.description;
  }

  if (typeof raw.format === 'string') {
    result.format = raw.format;
  }

  const enumValues = raw.enum;
  if (Array.isArray(enumValues)) {
    result.enum = enumValues.filter(
      v => ['string', 'number', 'boolean'].includes(typeof v) || v === null,
    );
  }

  const required = toStringArray(raw.required);
  if (required.length > 0) {
    result.required = required;
  }

  if (raw.items !== undefined) {
    const items = sanitizeGeminiSchemaInner(raw.items);
    if (items.type || items.properties || items.enum || items.items) {
      result.items = items;
    }
  }

  const properties = asObject(raw.properties);
  if (properties) {
    const sanitizedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      sanitizedProps[key] = sanitizeGeminiSchemaInner(value);
    }
    result.properties = sanitizedProps;
  }

  for (const key of Object.keys(result)) {
    if (!GEMINI_ALLOWED_SCHEMA_KEYS.has(key)) {
      delete result[key];
    }
  }

  if (!result.type) {
    result.type = result.properties ? 'object' : 'string';
  }

  if (result.type !== 'array') {
    delete result.items;
  }

  if (result.type === 'object' && !result.properties) {
    result.properties = {};
  }

  return result;
}

export type ProviderToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

function extractRawSchema(tool: Tool | Record<string, unknown>): unknown {
  const objectTool = tool as Record<string, unknown>;

  if (objectTool.input_schema) {
    return objectTool.input_schema;
  }
  if (objectTool.inputSchema) {
    return objectTool.inputSchema;
  }
  if (objectTool.parameters) {
    return objectTool.parameters;
  }

  const maybeFunction = asObject(objectTool.function);
  if (maybeFunction?.parameters) {
    return maybeFunction.parameters;
  }

  if ('inputJSONSchema' in tool && (tool as Tool).inputJSONSchema) {
    return (tool as Tool).inputJSONSchema;
  }

  if ('inputSchema' in tool) {
    return zodToJsonSchema((tool as Tool).inputSchema);
  }

  return {
    type: 'object',
    properties: {},
  };
}

function extractToolDescription(tool: Tool | Record<string, unknown>): string {
  const objectTool = tool as Record<string, unknown>;
  if (typeof objectTool.description === 'string') {
    return objectTool.description;
  }
  return '';
}

function extractToolName(tool: Tool | Record<string, unknown>): string {
  const objectTool = tool as Record<string, unknown>;
  return typeof objectTool.name === 'string' ? objectTool.name : 'unnamed_tool';
}

export function toProviderToolDefinitions(
  tools: readonly (Tool | Record<string, unknown>)[],
): ProviderToolDefinition[] {
  return tools.map(tool => {
    const rawSchema = extractRawSchema(tool);
    const rawObject = asObject(rawSchema);
    const schema = rawObject
      ? (rawObject as Record<string, unknown>)
      : {
          type: 'object',
          properties: {},
        };

    return {
      name: extractToolName(tool),
      description: extractToolDescription(tool),
      parameters: schema,
    };
  });
}

export function sanitizeGeminiToolDefinitions(
  tools: ProviderToolDefinition[],
): ProviderToolDefinition[] {
  return tools.map(tool => ({
    ...tool,
    parameters: (() => {
      const sanitized = sanitizeGeminiSchemaInner(tool.parameters);
      return {
        type: 'object',
        properties: {},
        ...sanitized,
        type: 'object',
        properties: asObject(sanitized.properties) ?? {},
      };
    })(),
  }));
}

export type SchemaValidationIssue = {
  toolName: string;
  issue: string;
};

export function validateGeminiToolDefinitions(
  tools: ProviderToolDefinition[],
): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];

  for (const tool of tools) {
    const params = asObject(tool.parameters);
    if (!params) {
      issues.push({
        toolName: tool.name,
        issue: 'parameters must be an object',
      });
      continue;
    }

    const properties = params.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      issues.push({
        toolName: tool.name,
        issue: 'parameters.properties must be an object',
      });
    }

    const unsupportedKeys = Object.keys(params).filter(
      key => !GEMINI_ALLOWED_SCHEMA_KEYS.has(key),
    );
    if (unsupportedKeys.length > 0) {
      issues.push({
        toolName: tool.name,
        issue: `unsupported keys present after sanitization: ${unsupportedKeys.join(', ')}`,
      });
    }
  }

  return issues;
}