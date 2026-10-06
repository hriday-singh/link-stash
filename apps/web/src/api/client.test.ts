import { describe, expect, it } from "vitest";
import { ApiError, createApiClient, unwrap } from "./client";

describe("ApiError and unwrap", () => {
  it("unwraps successful response data", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const result = await unwrap(
      Promise.resolve({
        data: { message: "hello" },
        response: mockResponse,
      }),
    );
    expect(result).toEqual({ message: "hello" });
  });

  it("throws ApiError on error response with structured body", async () => {
    const mockResponse = new Response(null, { status: 404, statusText: "Not Found" });
    const promise = Promise.resolve({
      error: {
        error: {
          code: "NOT_FOUND",
          message: "Card not found",
          details: { slug: "missing" },
        },
      },
      response: mockResponse,
    });

    await expect(unwrap(promise)).rejects.toThrow(ApiError);

    try {
      await unwrap(promise);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe("NOT_FOUND");
      expect(apiErr.message).toBe("Card not found");
      expect(apiErr.details).toEqual({ slug: "missing" });
    }
  });

  it("throws ApiError on error response with flat error body", async () => {
    const mockResponse = new Response(null, { status: 409, statusText: "Conflict" });
    const promise = Promise.resolve({
      error: {
        code: "STALE_HASH",
        message: "File has been modified",
      },
      response: mockResponse,
    });

    try {
      await unwrap(promise);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe("STALE_HASH");
      expect(apiErr.message).toBe("File has been modified");
    }
  });

  it("throws ApiError with statusText when error body is not structured", async () => {
    const mockResponse = new Response(null, { status: 500, statusText: "Internal Server Error" });
    const promise = Promise.resolve({
      error: "Something went wrong",
      response: mockResponse,
    });

    try {
      await unwrap(promise);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.code).toBe("UNKNOWN_ERROR");
      expect(apiErr.message).toBe("Internal Server Error");
    }
  });

  it("supports createApiClient with custom fetch", async () => {
    const customFetch = async () => {
      return new Response(JSON.stringify({ version: "1.0.0" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = createApiClient({
      baseUrl: "http://localhost",
      fetch: customFetch as typeof fetch,
    });
    const { data } = await client.GET("/api/meta");
    expect(data).toBeDefined();
  });
});
