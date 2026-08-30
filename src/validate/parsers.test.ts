import { describe, it, expect } from "vitest";
import { validateOpenApiDocument, validateAsyncApiDocument } from "./parsers.js";

const VALID_OPENAPI = {
  openapi: "3.1.0",
  info: { title: "Widgets API", version: "1.0.0" },
  paths: {},
};

const INVALID_OPENAPI = {
  openapi: "3.1.0",
  paths: {}, // missing required "info"
};

const VALID_ASYNCAPI = `
asyncapi: 3.0.0
info:
  title: Events API
  version: 1.0.0
channels: {}
`;

const INVALID_ASYNCAPI = `
asyncapi: 3.0.0
info: {}
channels: {}
`; // missing required "info.title" and "info.version"

describe("validateOpenApiDocument", () => {
  it("reports a valid OpenAPI document as valid with no issues", async () => {
    const result = await validateOpenApiDocument(VALID_OPENAPI, { assumeYes: false });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("reports an invalid OpenAPI document as invalid with error issues", async () => {
    const result = await validateOpenApiDocument(INVALID_OPENAPI, { assumeYes: false });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
  });
});

describe("validateAsyncApiDocument", () => {
  it("reports a valid AsyncAPI document as valid with no error issues", async () => {
    const result = await validateAsyncApiDocument(VALID_ASYNCAPI, { assumeYes: false });
    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("reports an invalid AsyncAPI document as invalid with error issues", async () => {
    const result = await validateAsyncApiDocument(INVALID_ASYNCAPI, { assumeYes: false });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});
