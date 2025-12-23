# TypeScript Coding Standards

> **Version:** 2.0.0 | **Status:** Active | **Updated:** 2025-12-23

Universal TypeScript style guide for consistent, maintainable, type-safe code.

---

## Core Principle

> [!IMPORTANT]
> **Type everything. Avoid `any`. Explicit over implicit.**

### Quick Reference

| Rule      | Do                     | Don't              |
| --------- | ---------------------- | ------------------ |
| Types     | Explicit types         | `any`              |
| Imports   | Named imports          | `import *`         |
| Null      | Optional chaining `?.` | Nested `if` checks |
| Async     | `async/await`          | Callback chains    |
| Logging   | Structured logger      | `console.log`      |
| Equality  | `===` and `!==`        | `==` and `!=`      |
| Variables | `const` by default     | `let` everywhere   |

### Strict Config

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## File Structure

### Module Layout

```typescript
/**
 * @fileoverview User service for managing operations.
 * @module services/user
 */

// ============================================================================
// Imports
// ============================================================================

import { readFile } from "fs/promises"; // Node.js
import type { Logger } from "pino"; // External (types)
import { z } from "zod"; // External
import type { User } from "../types.js"; // Internal (types)
import { validateEmail } from "../utils.js"; // Internal

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Types
// ============================================================================

interface FindOptions {
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class UserService {
  /* ... */
}

// ============================================================================
// Exports
// ============================================================================

export { UserService };
export type { FindOptions };
```

### Section Order

| Order | Section         | Required      |
| ----- | --------------- | ------------- |
| 1     | `@fileoverview` | Yes           |
| 2     | Imports         | Yes           |
| 3     | Constants       | If any        |
| 4     | Types           | If any        |
| 5     | Implementation  | Yes           |
| 6     | Exports         | If not inline |

---

## Imports

### Grouping (blank lines between)

| Group    | Order | Example                                   |
| -------- | ----- | ----------------------------------------- |
| Node.js  | 1     | `import { readFile } from "fs/promises";` |
| External | 2     | `import { z } from "zod";`                |
| Internal | 3     | `import { User } from "../types.js";`     |

### Type-Only Imports

```typescript
// ✅ GOOD — separate type imports
import type { User, UserId } from "../types.js";
import { createUser } from "../types.js";

// ❌ BAD — mixed
import { User, UserId, createUser } from "../types.js";
```

### Rules

| Rule               | Good                            | Bad                           |
| ------------------ | ------------------------------- | ----------------------------- |
| Named imports      | `import { foo } from "mod";`    | `import * as mod from "mod";` |
| Type-only          | `import type { T } from "mod";` | Mixed with values             |
| File extensions    | `from "./mod.js";`              | `from "./mod";`               |
| No default exports | `export { MyClass };`           | `export default MyClass;`     |

---

## Naming

### Conventions

| Item              | Convention        | Example               |
| ----------------- | ----------------- | --------------------- |
| Types/Interfaces  | `PascalCase`      | `User`, `HttpClient`  |
| Functions/Methods | `camelCase`       | `findUser`, `isValid` |
| Constants         | `SCREAMING_SNAKE` | `MAX_RETRIES`         |
| Variables         | `camelCase`       | `userId`, `isActive`  |
| Files/Folders     | `kebab-case`      | `user-service.ts`     |

### Prefixes/Suffixes

| Pattern               | Use For         | Example                     |
| --------------------- | --------------- | --------------------------- |
| `is*`, `has*`, `can*` | Booleans        | `isActive`, `hasPermission` |
| `get*`, `set*`        | Getters/setters | `getName()`, `setConfig()`  |
| `create*`             | Factories       | `createUser()`              |
| `handle*`             | Event handlers  | `handleClick()`             |
| `*Params`             | Parameter types | `CreateUserParams`          |
| `*Result`             | Return types    | `SearchResult`              |
| `*Options`            | Optional config | `RequestOptions`            |

---

## Types

### Interfaces vs Type Aliases

| Use Interface         | Use Type Alias        |
| --------------------- | --------------------- |
| Object shapes         | Unions, intersections |
| Extendable contracts  | Computed types        |
| Class implementations | Branded types         |

```typescript
// Interface — object shapes
interface User {
  id: UserId;
  name: string;
}

// Type alias — unions
type Result<T> = Success<T> | Failure;

// Type alias — branded types
type UserId = string & { readonly __brand: "UserId" };
```

### Branded Types (Type-Safe IDs)

```typescript
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function createUserId(id: string): UserId {
  return id as UserId;
}

// ✅ Type-safe
getUser(createUserId("user-123"));

// ❌ Compile error
getUser(createOrderId("order-456"));
```

### Discriminated Unions

```typescript
type Result<T> =
  | { type: "success"; data: T }
  | { type: "error"; error: string };

function handle<T>(result: Result<T>): T | null {
  if (result.type === "success") {
    return result.data; // TypeScript knows it's success
  }
  console.error(result.error);
  return null;
}
```

### Type Guards

```typescript
function isUser(value: unknown): value is User {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.name === "string";
}

const data: unknown = await fetchData();
if (isUser(data)) {
  console.log(data.name); // data is User
}
```

### Const Objects (Not Enums)

```typescript
// ✅ GOOD — const object
export const UserStatus = {
  Active: "active",
  Inactive: "inactive",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

// ❌ BAD — TypeScript enum (runtime overhead)
enum UserStatus {
  Active = "active",
}
```

---

## Functions

### Explicit Return Types

```typescript
// ✅ GOOD
async function findUser(id: UserId): Promise<User | null> {}

// ❌ BAD — inferred
async function findUser(id: UserId) {}
```

### Parameter Objects (3+ params)

```typescript
// ✅ GOOD
interface CreateUserParams {
  name: string;
  email: string;
  role?: UserRole;
}

async function createUser(params: CreateUserParams): Promise<User> {}

// ❌ BAD — too many positional
async function createUser(
  name: string,
  email: string,
  role: UserRole,
): Promise<User> {}
```

### Early Returns

```typescript
// ✅ GOOD — early returns
async function updateUser(id: UserId, data: UpdateData): Promise<User> {
  if (!id) throw new Error("ID required");
  if (!data.name && !data.email) throw new Error("No fields");

  const user = await findUser(id);
  if (!user) throw new Error("Not found");

  return await saveUser({ ...user, ...data });
}

// ❌ BAD — nested conditions
async function updateUser(id: UserId, data: UpdateData): Promise<User> {
  if (id) {
    if (data.name || data.email) {
      const user = await findUser(id);
      if (user) {
        /* ... */
      }
    }
  }
}
```

### Explicit Temporaries

```typescript
// ✅ GOOD — easy to debug
const response = await fetch(url);
const json = await response.json();
const validated = schema.parse(json);

// ❌ BAD — nested, hard to debug
const data = schema.parse(await (await fetch(url)).json());
```

---

## Error Handling

### Custom Errors

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404);
  }
}
```

### Result Pattern

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Usage
async function parseConfig(path: string): Promise<Result<Config, string>> {
  try {
    const content = await readFile(path, "utf-8");
    return ok(JSON.parse(content));
  } catch (e) {
    return err(`Failed: ${e}`);
  }
}
```

### Catch at Boundaries

```typescript
// ✅ GOOD — catch at boundary
export async function handleRequest(req: Request): Promise<Response> {
  try {
    const user = await findUser(req.params.id);
    return Response.json({ user });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
```

---

## Async

### Always async/await

```typescript
// ✅ GOOD
async function fetchData(id: UserId): Promise<UserData> {
  const user = await fetchUser(id);
  const orders = await fetchOrders(user.id);
  return { user, orders };
}

// ❌ BAD — promise chains
function fetchData(id: UserId): Promise<UserData> {
  return fetchUser(id).then((user) =>
    fetchOrders(user.id).then((orders) => ({ user, orders })),
  );
}
```

### Parallel Operations

```typescript
// ✅ GOOD — parallel
const [user, orders, notifications] = await Promise.all([
  fetchUser(userId),
  fetchOrders(userId),
  fetchNotifications(userId),
]);

// ❌ BAD — sequential when parallel possible
const user = await fetchUser(userId);
const orders = await fetchOrders(userId);
const notifications = await fetchNotifications(userId);
```

### Fire-and-Forget

```typescript
// ✅ GOOD — explicit void
void logAnalytics("page_view", { page: "/home" });

// ❌ BAD — floating promise
logAnalytics("page_view", { page: "/home" });
```

### Timeouts

```typescript
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]);
}
```

---

## Classes

### When to Use

| Use Classes          | Use Functions          |
| -------------------- | ---------------------- |
| Stateful services    | Stateless utilities    |
| Dependency injection | Pure functions         |
| Complex lifecycle    | Simple transformations |

### Structure

```typescript
export class UserService {
  // Static members
  private static readonly DEFAULT_PAGE = 20;

  // Instance members
  private readonly cache = new Map<UserId, User>();

  // Constructor
  constructor(
    private readonly repository: UserRepository,
    private readonly logger: Logger,
  ) {}

  // Public methods
  async findById(id: UserId): Promise<User | null> {}

  // Private methods
  private validate(id: UserId): void {}
}
```

### Prefer Composition

```typescript
// ✅ GOOD — composition
class UserService {
  constructor(
    private readonly repository: Repository<User>,
    private readonly logger: Logger,
  ) {}
}

// ❌ BAD — deep inheritance
class UserService extends BaseService<User> {}
```

---

## Testing

### Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("UserService", () => {
  let service: UserService;
  let mockRepo: UserRepository;

  beforeEach(() => {
    mockRepo = { findById: vi.fn() };
    service = new UserService(mockRepo);
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      // Arrange
      vi.mocked(mockRepo.findById).mockResolvedValue(testUser);

      // Act
      const result = await service.findById("user-1");

      // Assert
      expect(result).toEqual(testUser);
    });

    it("should throw on invalid id", async () => {
      await expect(service.findById("")).rejects.toThrow("ID required");
    });
  });
});
```

### Naming

```typescript
it("should return user when found", async () => {});
it("should return null when not found", async () => {});
it("should throw ValidationError when email invalid", async () => {});
```

### Assertions

```typescript
// ✅ GOOD — specific
expect(result).toEqual(expectedUser);
expect(result.orders).toHaveLength(3);
expect(mockFn).toHaveBeenCalledWith("arg");

// ❌ BAD — vague
expect(result).toBeTruthy();
```

---

## Documentation

### JSDoc

```typescript
/**
 * Finds a user by email.
 *
 * @param email - Email to search
 * @param options - Search options
 * @returns User if found, null otherwise
 * @throws {ValidationError} If email invalid
 *
 * @example
 *     const user = await findByEmail("alice@example.com");
 */
export async function findByEmail(
  email: string,
  options?: FindOptions,
): Promise<User | null> {}
```

### Interface Properties

```typescript
interface HttpClientConfig {
  /** Base URL for requests. */
  baseUrl: string;
  /** Timeout in milliseconds. */
  timeout?: number;
  /** Default headers. */
  headers?: Record<string, string>;
}
```

---

## Forbidden Patterns

### Never Use

| Pattern       | Why             | Alternative       |
| ------------- | --------------- | ----------------- |
| `any`         | No type safety  | `unknown` + guard |
| `@ts-ignore`  | Hides errors    | Fix the type      |
| `import *`    | Unclear imports | Named imports     |
| `console.log` | Unstructured    | Logger            |
| `eval()`      | Security risk   | Safe alternatives |
| `==`, `!=`    | Type coercion   | `===`, `!==`      |
| `var`         | Hoisting issues | `const`, `let`    |

### Exceptions

| Pattern            | Allowed When              |
| ------------------ | ------------------------- |
| `any`              | Missing third-party types |
| `@ts-expect-error` | With explanation comment  |
| `console.log`      | Development only          |

---

## Pre-Commit Checklist

```bash
npx tsc --noEmit          # Type check
npx eslint .              # Lint
npm test                  # Test
```

| Check                           | Status |
| ------------------------------- | ------ |
| TypeScript compiles             | ☐      |
| ESLint passes                   | ☐      |
| Tests pass                      | ☐      |
| No `any` types                  | ☐      |
| No `@ts-ignore`                 | ☐      |
| All public functions have JSDoc | ☐      |
| Explicit return types           | ☐      |

---

## Common Patterns

### Result Type

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const ok = <T>(data: T): Result<T, never> => ({ success: true, data });
const err = <E>(error: E): Result<never, E> => ({ success: false, error });
```

### Builder

```typescript
class RequestBuilder {
  private url = "";
  private method = "GET";
  private headers: Record<string, string> = {};

  setUrl(url: string): this {
    this.url = url;
    return this;
  }
  setMethod(method: string): this {
    this.method = method;
    return this;
  }
  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  build(): Request {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
    });
  }
}
```

---

## Recommended Packages

| Category   | Package                 | Use                 |
| ---------- | ----------------------- | ------------------- |
| Validation | `zod`                   | Schema validation   |
| HTTP       | `ky`, `axios`           | HTTP client         |
| Testing    | `vitest`, `msw`         | Unit tests, mocking |
| Logging    | `pino`, `winston`       | Structured logging  |
| CLI        | `commander`, `inquirer` | CLI tools           |
| Utils      | `date-fns`, `nanoid`    | Date/ID handling    |

---

_End of TypeScript Coding Standards._
