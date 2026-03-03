# GeoBridge Uploader

GeoBridge Uploader is an open-source Next.js application for securely uploading geospatial files to a remote GeoServer data directory over SSH/SFTP.

## Highlights

- Secure web login with server-side session management
- Upload geospatial files directly from browser to remote Linux server
- Optional sudo fallback for restricted target directories
- File listing and file deletion from the web UI
- Confirmation dialog before file deletion
- Environment-based configuration (`.env`)

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS + Radix UI components
- `ssh2` for SSH/SFTP operations
- `iron-session` for authentication sessions

## How It Works

1. User signs in from the web interface.
2. File is sent to [`POST /api/upload`](src/app/api/upload/route.ts).
3. Server connects to remote host using SSH credentials from [`.env`](.env).
4. Upload flow in [`uploadFileViaSSH()`](src/lib/ssh.ts:210):
   - First tries direct write into `TARGET_PATH`.
   - If permission fails and sudo is enabled, uploads to `TEMP_UPLOAD_PATH` then moves with sudo.
5. File listing/deletion is handled via [`/api/files`](src/app/api/files/route.ts).

## Requirements

- Node.js 18+
- Bun or npm
- SSH access to target Linux server
- Write access to `TARGET_PATH`, or sudo permissions for fallback flow

## Installation

```bash
bun install
```

or

```bash
npm install
```

## Environment Variables

Copy [`.env.example`](.env.example) to [`.env`](.env) and update values.

```env
# SSH Connection
SSH_HOST=your-server-ip
SSH_PORT=22
SSH_USERNAME=your-ssh-username
SSH_PASSWORD=your-ssh-password
SSH_PRIVATE_KEY=

# Remote target path
TARGET_PATH=~/workspace/geoserver-docker/geoserver_data/uploads

# Web authentication
AUTH_USERNAME=admin
AUTH_PASSWORD=your-secure-password

# Session secret (min 32 chars)
SESSION_SECRET=your-super-secret-key-for-session-encryption-min-32-chars

# Optional sudo fallback
SUDO_ENABLED=true
SUDO_PASSWORD=
TEMP_UPLOAD_PATH=/tmp
```

## Scripts

From [`package.json`](package.json):

```bash
bun run dev
bun run lint
bun run build
bun run start
```

npm equivalents:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## API Endpoints

- Login: [`POST /api/auth/login`](src/app/api/auth/login/route.ts)
- Logout: [`POST /api/auth/logout`](src/app/api/auth/logout/route.ts)
- Session: [`GET /api/auth/session`](src/app/api/auth/session/route.ts)
- Upload: [`POST /api/upload`](src/app/api/upload/route.ts)
- Files list: [`GET /api/files`](src/app/api/files/route.ts)
- File delete: [`DELETE /api/files`](src/app/api/files/route.ts)

## Security Notes

- Use strong values for `AUTH_PASSWORD` and `SESSION_SECRET`.
- Prefer SSH key authentication (`SSH_PRIVATE_KEY`) in production.
- Restrict SSH user permissions to minimum required scope.
- Keep `TARGET_PATH` limited to intended upload directory.

## Open Source

This project is licensed under the terms of the [MIT License](LICENSE).

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.
If you discover a vulnerability, see [SECURITY.md](SECURITY.md).
