# ESLint Setup for Client Service

## What was installed:
- `eslint` - Core ESLint package
- `eslint-config-next` - Next.js ESLint configuration
- `@typescript-eslint/eslint-plugin` - TypeScript ESLint plugin
- `@typescript-eslint/parser` - TypeScript parser for ESLint
- `typescript` - TypeScript compiler (required for TypeScript linting)
- `globals` - Global variables definitions

## Configuration file:
- `eslint.config.mjs` - Modern flat config format (ESLint 9+)

## Available scripts:
```bash
# Check for linting issues
yarn lint

# Auto-fix linting issues
yarn lint:fix

# Same as lint:fix
yarn format
```

## Current rules:
- **Disabled strict rules:**
  - Unused variables trigger warnings (not errors)
  - No-undef disabled (React is global in Next.js)

- **Enforced rules:**
  - `prefer-const` - Use const when variable isn't reassigned
  - `no-console` - Only console.warn and console.error allowed
  - `eqeqeq` - Always use === instead of ==
  - `curly` - Always use curly braces with if/else

- **Ignored files:**
  - node_modules/, .next/, out/, build/, dist/
  - Log files, env files, and generated files

## Usage:
Run `yarn lint:fix` to automatically format all JavaScript and JSX files according to the configured rules.
