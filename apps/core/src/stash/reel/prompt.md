# Reel Understanding Prompt

Analyze the provided video, caption, creator handle, and any attached images. Extract factual, structured information according to the rules below and return a valid JSON object matching the requested schema.

## Core Rules

1. **Summary**: Provide a single concise paragraph in English summarizing the primary subject, what was shown or demonstrated, and key claims or outcomes.
2. **Mentions**:
   - A mention is something a user could independently install, download, use, or bookmark on its own (e.g. a CLI tool, GitHub repo, Hugging Face model, agent skill, MCP server, web framework, UI kit).
   - `kind` MUST be one of: `repo`, `model`, `skill`, `plugin`, `mcp`, `tool`, `ui_ref`, `link`.
   - `name`: Canonical name (e.g. `gh-secure`, `GitHubSecurityLab/gh-secure`, `HydraFusion`).
   - `url`: Direct URL if shown or stated, else `null`.
   - `url_source`:
     - `on_screen`: URL appeared visually in text or terminal.
     - `caption`: URL appeared in the post caption.
     - `spoken`: URL was explicitly voiced.
     - `inferred`: You derived the URL from context (e.g. an install command like `gh extension install owner/repo` leading to `https://github.com/owner/repo`).
   - `evidence`: `spoken`, `on_screen`, or `caption`.
   - `at`: Timestamp in `MM:SS` format when first introduced, or `null`.
3. **Features**:
   - Features, subcommands, and settings of a mentioned tool go under `features[<tool_name>]`, NEVER as separate top-level mentions.
   - Example: For `gh-secure`, branch protection, secret scanning, and Dependabot are features of `gh-secure`. Do not create separate mentions for them.
4. **Takeaways**:
   - Benchmarks, performance statistics, comparisons, and general practices belong in `takeaways`, NEVER in `mentions`.
   - Example: "67% cost reduction on Terminal-Bench 2.1 compared to baseline" is a takeaway, not a mention.
5. **On-Screen Text**:
   - Include only text that carries factual or instructional information (commands run, error messages, code snippets, titles).
   - Omit decorative elements, dial numbers, UI chrome, and background logos.
6. **Transcript & Audio**:
   - `spoken_language`: 2-letter language code (e.g. `en`, `hi`) or `null`.
   - `transcript`: Exact spoken speech in original language, or `null` if no narration.
   - `transcript_source`: `audio` if transcribed from speech, `burned_subtitles` if read from video subtitles, or `none`.
7. **Call to Action (CTA)**:
   - Identify if the reel asks viewers to comment for a link or DM.
   - `type`: `comment`, `link_in_bio`, `url`, or `none`.
   - `keyword`: The specific word viewers are instructed to comment (e.g. "SECURE", "LINK"), or `null`.
   - `what_you_get`: Description of what is offered (e.g. "Direct link to setup guide"), or `null`.
8. **Discipline**:
   - When unsure, return `null`. NEVER guess or hallucinate URLs or features.
