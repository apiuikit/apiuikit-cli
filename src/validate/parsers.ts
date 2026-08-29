import type { ParsedSpec } from "../utils/spec.js";
import { loadOptionalPackage, type LoadOptions, type OptionalPackageSpec } from "./optionalPackage.js";

export const ASYNCAPI_PARSER: OptionalPackageSpec = {
  name: "@asyncapi/parser",
  versionRange: "^3.6.0",
  reason: "validate AsyncAPI documents",
};

export const OPENAPI_PARSER: OptionalPackageSpec = {
  name: "@scalar/openapi-parser",
  versionRange: "^0.28.10",
  reason: "validate OpenAPI documents",
};

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// Minimal structural shapes for the parts of each optional package we call,
// so this package's own emitted types don't depend on them being installed.
interface ScalarErrorObject {
  // Despite the package's .d.ts declaring `string[]`, it returns a plain string at runtime.
  path?: string | string[];
  message: string;
}

interface ScalarValidateResult {
  valid: boolean;
  errors?: ScalarErrorObject[];
}

interface ScalarOpenApiParserModule {
  validate(value: unknown): Promise<ScalarValidateResult>;
}

// Spectral's numeric DiagnosticSeverity: 0 = Error, 1 = Warning, 2 = Information, 3 = Hint.
interface AsyncApiDiagnostic {
  severity: number;
  message: string;
  path?: Array<string | number>;
}

interface AsyncApiParserModule {
  Parser: new () => {
    validate(input: string): Promise<AsyncApiDiagnostic[]>;
  };
}

export async function validateOpenApiDocument(
  parsed: ParsedSpec,
  opts: LoadOptions,
): Promise<ValidationResult> {
  const mod = await loadOptionalPackage<ScalarOpenApiParserModule>(OPENAPI_PARSER, opts);
  const { valid, errors } = await mod.validate(parsed);

  return {
    valid,
    issues: (errors ?? []).map((issue) => ({
      severity: "error",
      message: issue.message,
      path: Array.isArray(issue.path) ? issue.path.join(".") : issue.path || undefined,
    })),
  };
}

export async function validateAsyncApiDocument(raw: string, opts: LoadOptions): Promise<ValidationResult> {
  const mod = await loadOptionalPackage<AsyncApiParserModule>(ASYNCAPI_PARSER, opts);
  const parser = new mod.Parser();
  const diagnostics = await parser.validate(raw);

  const issues: ValidationIssue[] = diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity === 0 ? "error" : "warning",
    message: diagnostic.message,
    path: diagnostic.path?.join("."),
  }));

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}
