import { describe, expect, it, vi, beforeEach } from "vitest";

const mock = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  openAiChat: vi.fn(),
  openAiResponses: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mock.anthropicCreate };
  },
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: mock.openAiChat } };
    responses = { create: mock.openAiResponses };
  },
}));
import { parseTranscription, recognizeDocument } from "./ai-document-recognition";

const settings = { provider: "openai" as const, apiKey: "synthetic-only", model: "any-vision-model" };
const jpeg = { name: "scan.jpg", mime: "image/jpeg" as const, bytes: Buffer.from("synthetic-image") };
const pdf = { name: "scan.pdf", mime: "application/pdf" as const, bytes: Buffer.from("synthetic-pdf") };
const answer = JSON.stringify({ text: "Rechnung 47,20 €\n[unleserlich]", unclear: ["Kontonummer unklar"] });

describe("provider-independent AI transcription contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.openAiChat.mockResolvedValue({ choices: [{ message: { content: answer } }] });
    mock.openAiResponses.mockResolvedValue({ output_text: answer });
    mock.anthropicCreate.mockResolvedValue({ content: [{ type: "text", text: answer }] });
  });
  it("only accepts literal JSON transcription plus uncertainty list", () => {
    expect(parseTranscription(answer)).toEqual({ text: "Rechnung 47,20 €\n[unleserlich]", unclear: ["Kontonummer unklar"] });
    expect(() => parseTranscription('{"text":"47","unclear":[],"sendMoney":true}')).toThrow();
    expect(() => parseTranscription('rate: 47')).toThrow();
    expect(() => parseTranscription('{"text":"","unclear":[]}')).toThrow();
    expect(() => parseTranscription('{"text":"x","unclear":["x".repeat]}')).toThrow();
  });
  it("passes user-selected model and base64 image to compatible vision chat", async () => {
    expect(await recognizeDocument(jpeg, settings)).toEqual(parseTranscription(answer));
    const args = mock.openAiChat.mock.calls[0][0];
    expect(args.model).toBe(settings.model);
    expect(args.messages[1].content[1].image_url.url).toContain("data:image/jpeg;base64,");
    expect(mock.openAiResponses).not.toHaveBeenCalled();
  });
  it("uses Responses PDF input_file for model supporting that endpoint", async () => {
    await recognizeDocument(pdf, settings);
    const args = mock.openAiResponses.mock.calls[0][0];
    expect(args.model).toBe(settings.model);
    expect(args.input[0].content[1].file_data).toContain("data:application/pdf;base64,");
    expect(mock.openAiChat).not.toHaveBeenCalled();
  });
  it("supports Anthropic image and PDF with any explicitly chosen model", async () => {
    const cfg = { ...settings, provider: "anthropic" as const, model: "any-selected-claude" };
    await recognizeDocument(jpeg, cfg);
    expect(mock.anthropicCreate.mock.calls[0][0].messages[0].content[0].type).toBe("image");
    await recognizeDocument(pdf, cfg);
    expect(mock.anthropicCreate.mock.calls[1][0].messages[0].content[0].type).toBe("document");
    expect(mock.anthropicCreate.mock.calls[1][0].model).toBe(cfg.model);
  });
  it("accepts local HTTP endpoints but refuses remote cleartext or URL credentials", async () => {
    await recognizeDocument(jpeg, { ...settings, baseUrl: "http://127.0.0.1:1234/v1" });
    expect(mock.openAiChat).toHaveBeenCalledOnce();
    await expect(recognizeDocument(jpeg, { ...settings, baseUrl: "http://example.org/v1" }))
      .rejects.toThrow("HTTPS");
    await expect(recognizeDocument(jpeg, { ...settings, baseUrl: "https://user:pwd@example.org/v1" }))
      .rejects.toThrow("HTTPS");
  });
  it("rejects provider incompatibility with generic message, never spills credential", async () => {
    mock.openAiResponses.mockRejectedValue(new Error("API_KEY synthetic-only in internal trace"));
    await expect(recognizeDocument(pdf, settings)).rejects.not.toThrow("synthetic-only");
  });
});
