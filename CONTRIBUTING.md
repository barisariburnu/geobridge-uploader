# Contributing to GeoBridge Uploader

Thanks for your interest in contributing.

## Development Setup

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

3. Install dependencies:

```bash
bun install
```

4. Create local environment file from [`.env.example`](.env.example):

```bash
copy .env.example .env
```

5. Run the app:

```bash
bun run dev
```

## Quality Checks

Run before opening a pull request:

```bash
bun run lint
bun run build
```

## Pull Request Guidelines

- Keep PRs focused and small.
- Write clear commit messages.
- Include a short testing summary in PR description.
- Update documentation when behavior or config changes.

## Coding Style

- TypeScript strict mode is enabled.
- Follow existing folder conventions in [`src/`](src).
- Reuse shared UI components from [`src/components/ui`](src/components/ui).

## Reporting Bugs

Open an issue with:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node/Bun version)
