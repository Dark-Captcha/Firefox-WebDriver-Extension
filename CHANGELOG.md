# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `timeout` parameter for `element.subscribe` with `oneShot: true`
- Extension-side timeout handling for wait_for operations

### Fixed
- Mouse event logging now shows elementId or coordinates clearly (not "undefined")

### Changed
- Improved logging format for mouse operations

## [0.1.1] - 2025-12-26

### Added

#### Screenshot API
- `browsingContext.captureScreenshot` - Capture viewport screenshot
- `element.captureScreenshot` - Capture element screenshot with crop
- PNG and JPEG format support with quality option

#### Element Selectors
- Strategy-based element finding (replaces CSS-only selector)
- `css` - CSS selector
- `id` - Element ID
- `class` - Class name
- `tag` - Tag name
- `name` - Name attribute
- `xpath` - XPath expression
- `text` - Exact text content match
- `partialText` - Partial text content match
- `linkText` - Exact link text
- `partialLinkText` - Partial link text

#### Input
- Enter key form submission support

#### Tooling
- Prettier code formatter
- `npm run format` - Format all TypeScript files
- `npm run format:check` - Check formatting
- `npm run lint:fix` - Auto-fix ESLint issues
- `make format` target

### Fixed
- Subscriptions now survive page redirects (re-sent after navigation completes)
- `wait_for()` works correctly with redirect chains (e.g., OAuth flows)

### Changed
- Element find/findAll now use `{ strategy, value }` instead of `{ selector }`
- Element subscribe now uses `{ strategy, value }` instead of `{ selector }`

## [0.1.0] - 2025-12-23

### Added

#### Core
- WebSocket-based communication with Rust driver
- Content script injection for DOM interaction
- Background script for browser API access

#### BrowsingContext Module
- `navigate` - Navigate to URL
- `reload` - Reload page
- `back` / `forward` - History navigation
- `getTitle` / `getUrl` - Page info
- `focus` - Focus tab
- `close` - Close tab
- `newTab` - Create new tab
- `switchToFrame` - Frame switching
- `getFrameCount` / `getAllFrames` - Frame info

#### Element Module
- `find` / `findAll` - Element search
- `getProperty` / `setProperty` - Property access
- `callMethod` - Method invocation
- `subscribe` / `unsubscribe` - Element observation (MutationObserver)
- `watchRemoval` / `unwatchRemoval` - Removal observation
- `watchAttribute` / `unwatchAttribute` - Attribute observation

#### Input Module
- `typeKey` - Keyboard input with modifiers
- `typeText` - Text input
- `mouseClick` / `mouseMove` / `mouseDown` / `mouseUp` - Mouse input

#### Network Module
- Request/response interception
- Header modification
- Body modification
- URL blocking

#### Proxy Module
- HTTP/HTTPS/SOCKS proxy support
- Per-tab proxy configuration

#### Script Module
- `evaluate` - Execute JavaScript
- `preload` - Inject scripts before page load

#### Storage Module
- Cookie management
- localStorage access
- sessionStorage access

#### Session Module
- WebSocket connection management
- Event routing
- Log collection (`stealLogs`)

[Unreleased]: https://github.com/user/Firefox-WebDriver-Extension/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/user/Firefox-WebDriver-Extension/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/user/Firefox-WebDriver-Extension/releases/tag/v0.1.0
