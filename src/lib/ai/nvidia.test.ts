import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiError, callJson, extractJson, pingNvidia } from "@/lib/ai/nvidia";

const schema = z.object({ n: z.number() });
const reply = (content: string, status = 200) =>
  new Response(JSON.stringify({ model: "test-model", choices: [{ message: { content } }] }), { status });

beforeEach(() => {
  process.env.NVIDIA_API_KEY = "nvapi-test-key";
  process.env.NVIDIA_BASE_URL = "https://nim.test/v1";
  process.env.NVIDIA_MODEL = "test-model";
  process.env.NVIDIA_TIMEOUT_MS = "500";
});
afterEach(() => {
  delete process.env.NVIDIA_API_KEY;
  vi.restoreAllMocks();
});

describe("extractJson", () => {
  it("parses plain, fenced and chatty output", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go: {"a":{"b":"}"}} hope it helps')).toEqual({ a: { b: "}" } });
    expect(extractJson("[1,2]")).toEqual([1, 2]);
  });
  it("throws a typed error when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow(AiError);
    expect(() => extractJson('{"a": ')).toThrow(AiError);
  });
});

describe("callJson", () => {
  const base = { kind: "test", system: "s", user: "u", schema };

  it("sends the key as a bearer token to the configured endpoint and returns validated data", async () => {
    const f = vi.fn().mockResolvedValue(reply('{"n": 3}'));
    const log = vi.fn();
    const out = await callJson({ ...base, fetchImpl: f as unknown as typeof fetch, log });
    expect(out).toEqual({ data: { n: 3 }, model: "test-model" });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://nim.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer nvapi-test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "test-model", stream: false });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ kind: "test", ok: true }));
  });

  it("retries once with the validation error when the first reply is invalid", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply('{"n": "three"}')).mockResolvedValueOnce(reply('{"n": 3}'));
    const out = await callJson({ ...base, fetchImpl: f as unknown as typeof fetch });
    expect(out.data.n).toBe(3);
    expect(f).toHaveBeenCalledTimes(2);
    const second = JSON.parse((f.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(second.messages.at(-1).content).toContain("rejected");
  });

  it("fails with code 'invalid' after two invalid replies and logs the failure", async () => {
    const f = vi.fn().mockImplementation(async () => reply('{"n": "x"}'));
    const log = vi.fn();
    await expect(callJson({ ...base, fetchImpl: f as unknown as typeof fetch, log })).rejects.toMatchObject({ code: "invalid" });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("surfaces HTTP errors without leaking the response body", async () => {
    const f = vi.fn().mockResolvedValue(new Response("secret details: nvapi-test-key", { status: 401 }));
    const err = await callJson({ ...base, fetchImpl: f as unknown as typeof fetch }).catch((e) => e as AiError);
    expect(err).toMatchObject({ code: "http", status: 401 });
    expect(String((err as Error).message)).not.toContain("nvapi");
  });

  it("retries once on 429/5xx", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(reply('{"n": 1}'));
    expect((await callJson({ ...base, fetchImpl: f as unknown as typeof fetch })).data.n).toBe(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("maps aborted requests to a timeout error", async () => {
    const f = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(callJson({ ...base, fetchImpl: f as unknown as typeof fetch })).rejects.toMatchObject({ code: "timeout" });
  });

  it("reports an empty completion", async () => {
    const f = vi.fn().mockResolvedValue(reply("   "));
    await expect(callJson({ ...base, fetchImpl: f as unknown as typeof fetch })).rejects.toMatchObject({ code: "empty" });
  });

  it("throws when the API key is not configured", async () => {
    delete process.env.NVIDIA_API_KEY;
    await expect(callJson({ ...base, fetchImpl: vi.fn() as unknown as typeof fetch })).rejects.toThrow();
  });
});

describe("pingNvidia", () => {
  it("reports reachability and never returns the key", async () => {
    const ok = await pingNvidia(vi.fn().mockResolvedValue(new Response("{}", { status: 200 })) as unknown as typeof fetch);
    expect(ok).toEqual({ ok: true, model: "test-model", detail: "Reachable" });
    const bad = await pingNvidia(vi.fn().mockRejectedValue(new Error("blocked")) as unknown as typeof fetch);
    expect(bad.ok).toBe(false);
    delete process.env.NVIDIA_API_KEY;
    expect((await pingNvidia()).detail).toContain("not set");
  });
});
