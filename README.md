# Firefox-WebDriver-Extension

Browser extension powering Firefox WebDriver.

## Architecture

```
Rust Driver ◄──── WebSocket ────► Extension
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              Background         Content Script      Popup
              (command router)   (DOM access)        (debug UI)
```

## Components

| Component         | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| Background Script | WebSocket client, command routing, browser APIs |
| Content Script    | DOM access, element store, MutationObserver     |
| Popup             | Debug UI for connection status                  |

## Requirements

- Node.js 20+
- Firefox 148+

## Commands

### Build

| Command        | Description              |
| -------------- | ------------------------ |
| `make install` | Install dependencies     |
| `make build`   | Production build         |
| `make dev`     | Watch mode (development) |

### Quality

| Command           | Description                 |
| ----------------- | --------------------------- |
| `make lint`       | Run ESLint                  |
| `make type-check` | Run TypeScript type checker |
| `make all`        | Type check + lint + build   |

### Clean

| Command      | Description                  |
| ------------ | ---------------------------- |
| `make clean` | Remove build output          |
| `make nuke`  | Remove node_modules and dist |

## Output

Built extension is output to `dist/`:

```
dist/
├── background.js
├── content.js
├── popup.js
├── popup.html
├── popup.css
├── manifest.json
└── icons/
```

## Usage

```rust
let driver = Driver::builder()
    .binary("/usr/bin/firefox")
    .extension("./extension/dist")
    .build()?;
```

## Permissions

| Permission      | Purpose                       |
| --------------- | ----------------------------- |
| `tabs`          | Tab management                |
| `activeTab`     | Current tab access            |
| `scripting`     | Script injection (CSP bypass) |
| `webRequest`    | Network interception          |
| `webNavigation` | Navigation events             |
| `cookies`       | Cookie management             |
| `proxy`         | Proxy configuration           |

## Protocol

| Message Type | Direction          | Purpose              |
| ------------ | ------------------ | -------------------- |
| Command      | Driver → Extension | Request operation    |
| Response     | Extension → Driver | Command result       |
| Event        | Extension → Driver | Browser notification |
| EventReply   | Driver → Extension | Event decision       |

See [ARCHITECTURE.md](https://github.com/Dark-Captcha/Firefox-WebDriver/blob/main/ARCHITECTURE.md) for full protocol specification.

## Structure

```
src/
├── background/          # Background script
│   ├── index.ts         # Entry point, message routing
│   └── modules/         # Command handlers by domain
│       ├── session/
│       ├── browsing-context/
│       ├── element/
│       ├── script/
│       ├── input/
│       ├── network/
│       ├── proxy/
│       └── storage/
├── content/             # Content script (per frame)
│   ├── index.ts         # Entry point
│   ├── bridge.ts        # WEBDRIVER_INIT forwarding
│   ├── elements.ts      # Element store, input handlers
│   ├── observer.ts      # MutationObserver
│   └── messaging.ts     # Message hub
├── core/                # Shared utilities
│   ├── registry.ts      # Handler registry
│   ├── session.ts       # WebSocket session
│   └── logger.ts        # Logging
├── types/               # TypeScript types
│   ├── protocol.ts      # Request, Response, Event
│   └── identifiers.ts   # ID types
└── popup/               # Debug popup
    └── index.ts
```

## License

Apache-2.0 - see [LICENSE](LICENSE)
