import { generatedLabel } from "./kinds";

it.each([
  ["github:owner/agent-kit", "Agent Kit", ["agent-kit", "owner"]],
  ["hf:model:qwen/qwen3-8b-gguf", "Qwen3 8B GGUF", ["qwen3-8b-gguf", "qwen"]],
  [
    "practice:plan-before-edits",
    "Plan mode before multi-file edits always",
    ["Plan mode before multi-file edits always", null],
  ],
  [
    "practice:long",
    "one two three four five six seven eight",
    ["one two three four five six…", null],
  ],
  ["ollama:qwen3:8b", "qwen3:8b", ["qwen3:8b", null]],
  ["url:example.com/a/b", "Example article", ["Example article", null]],
  ["mcp:@scope/server", "Scoped server", ["server", "@scope"]],
] as const)("%s -> %j", (key, title, expected) => {
  expect(generatedLabel(key, title)).toEqual(expected);
});
