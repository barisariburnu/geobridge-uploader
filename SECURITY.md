# Security Policy

## Supported Versions

Security updates are provided for the latest `main` branch.

## Reporting a Vulnerability

Please do **not** open public issues for security vulnerabilities.

Report vulnerabilities privately via repository security advisories or by contacting the maintainers listed in the repository profile.

Include:

- Vulnerability type and impact
- Reproduction steps
- Suggested mitigation (if available)

## Security Best Practices for Deployments

- Use strong secrets in [`.env`](.env): `AUTH_PASSWORD`, `SESSION_SECRET`.
- Prefer SSH key auth over password auth (`SSH_PRIVATE_KEY`).
- Scope SSH and sudo permissions minimally.
- Restrict network access to the application and SSH host.
- Keep dependencies updated and run regular audits.
