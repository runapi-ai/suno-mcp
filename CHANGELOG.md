# Changelog

## [v0.1.10](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.10) - 2026-07-20

### Added
- Add advanced stem separation parameters, validation, and response metadata to the Suno MCP server.

### Fixed
- Enforce the two-item upload URL requirement for Create Mashup tools.


## [v0.1.9](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.9) - 2026-07-08

### Fixed
- Publish corrected MCP runtime metadata for the login release.

## [v0.1.8](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.8) - 2026-07-08

### Changed
- Publish MCP login onboarding, optional API key metadata, and the updated core dependency.

## [v0.1.7](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.7) - 2026-07-08

### Changed
- Publish the v0.1.7 Suno MCP package.

## [v0.1.6](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.6) - 2026-06-24

### Changed
- Publish MCP server v0.1.6.
- Pin the package to @runapi.ai/mcp-core v0.1.3.
- Refresh package and MCP Registry metadata for this release.

## [v0.1.5](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.5) - 2026-06-24

### Changed
- Refresh public README metadata for the focused Suno MCP package.

### Fixed
- Correct the GitHub repository badge URL so package README badges render cleanly on npm and GitHub.

## [v0.1.4](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.4) - 2026-06-24

### Changed
- Refresh the public README with focused install paths, model links, and agent prompt examples.
- Update npm and GitHub metadata for developer discovery.
- Keep server.json and packaged contract/pricing data aligned with the release artifact.

## [v0.1.3](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.3) - 2026-06-24

### Changed
- Distinct per-line README, npm keywords/description, and GitHub topics for Suno so the package is discoverable on its own name and capabilities. No tool, schema, or behavior changes.

## [v0.1.2](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.2) - 2026-06-23

### Added
- `generate_lyrics` tool (lyrics generation), now fully working via mcp-core 0.1.1 no-model endpoint support.

### Note
- Supersedes 0.1.1, which shipped `generate_lyrics` against an older core where task creation failed.

## [v0.1.0](https://github.com/runapi-ai/suno-mcp/releases/tag/v0.1.0) - 2026-06-23

### RunAPI Suno MCP Server v0.1.0

First release. An MCP server for the Suno music model line: create music generation tasks, poll task status, and check pricing with a single RunAPI API key.

Install: `npx @runapi.ai/suno-mcp`
