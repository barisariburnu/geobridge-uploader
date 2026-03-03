import { Client, ConnectConfig } from 'ssh2';
import { Readable } from 'stream';
import { existsSync, readFileSync } from 'fs';

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  sudoEnabled: boolean;
  sudoPassword?: string;
  tempUploadPath: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  filePath?: string;
}

interface FileListItem {
  name: string;
  size: number;
  modifiedDate: string;
  isDirectory: boolean;
}

function cleanEnv(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function resolvePrivateKey(rawPrivateKey?: string): string | undefined {
  const keyValue = cleanEnv(rawPrivateKey);
  if (!keyValue) return undefined;

  const normalized = keyValue.replace(/\\n/g, '\n');

  if (normalized.includes('BEGIN OPENSSH PRIVATE KEY') || normalized.includes('BEGIN RSA PRIVATE KEY')) {
    return normalized;
  }

  if (existsSync(normalized)) {
    return readFileSync(normalized, 'utf8');
  }

  return normalized;
}

function getSSHConfig(): SSHConfig {
  const sshPassword = cleanEnv(process.env.SSH_PASSWORD);
  return {
    host: cleanEnv(process.env.SSH_HOST) || '',
    port: parseInt(cleanEnv(process.env.SSH_PORT) || '22', 10),
    username: cleanEnv(process.env.SSH_USERNAME) || '',
    password: sshPassword,
    privateKey: resolvePrivateKey(process.env.SSH_PRIVATE_KEY),
    sudoEnabled: parseBoolean(cleanEnv(process.env.SUDO_ENABLED), true),
    sudoPassword: cleanEnv(process.env.SUDO_PASSWORD) || sshPassword,
    tempUploadPath: cleanEnv(process.env.TEMP_UPLOAD_PATH) || '/tmp',
  };
}

function validateSSHConfig(config: SSHConfig) {
  if (!config.host) {
    throw new Error('SSH_HOST tanımlı değil');
  }

  if (!config.username) {
    throw new Error('SSH_USERNAME tanımlı değil');
  }

  if (!config.password && !config.privateKey) {
    throw new Error('SSH_PASSWORD veya SSH_PRIVATE_KEY tanımlı olmalı');
  }
}

function expandPath(path: string, username: string): string {
  if (!path) return `/home/${username}`;
  if (path === '~') return `/home/${username}`;
  if (path.startsWith('~/')) return `/home/${username}/${path.slice(2)}`;
  return path;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildConnectConfig(config: SSHConfig): ConnectConfig {
  const connectConfig: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    tryKeyboard: true,
  };

  if (config.privateKey) connectConfig.privateKey = config.privateKey;
  if (config.password) connectConfig.password = config.password;

  return connectConfig;
}

function attachKeyboardInteractiveHandler(conn: Client, config: SSHConfig) {
  conn.on('keyboard-interactive', (_name, _instructions, _lang, _prompts, finish) => {
    if (config.password) return finish([config.password]);
    finish([]);
  });
}

function parseLsOutput(output: string): FileListItem[] {
  const lines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line && !line.startsWith('total '));

  const files: FileListItem[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const permissions = parts[0];
    const isDirectory = permissions.startsWith('d');
    const size = parseInt(parts[4], 10) || 0;
    const date = `${parts[5]} ${parts[6]} ${parts[7]}`;
    const name = parts.slice(8).join(' ');

    if (name !== '.' && name !== '..') {
      files.push({ name, size, modifiedDate: date, isDirectory });
    }
  }

  return files;
}

function buildSudoCommand(command: string, config: SSHConfig): string {
  if (!config.sudoEnabled) return command;
  if (config.sudoPassword) {
    return `echo ${shellEscape(config.sudoPassword)} | sudo -S bash -lc ${shellEscape(command)}`;
  }
  return `sudo -n bash -lc ${shellEscape(command)}`;
}

function executeCommand(conn: Client, command: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let output = '';
      stream.on('data', (data: Buffer) => {
        output += data.toString();
      });
      stream.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });
      stream.on('close', (code: number) => {
        resolve({ code: code ?? 1, output });
      });
    });
  });
}

function uploadBufferToPath(conn: Client, fileBuffer: Buffer, destinationPath: string, onProgress?: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const readable = new Readable();
    readable.push(fileBuffer);
    readable.push(null);

    const totalSize = fileBuffer.length;
    let uploadedSize = 0;

    conn.sftp((err, sftp) => {
      if (err) return reject(new Error(`SFTP hatası: ${err.message}`));

      const writeStream = sftp.createWriteStream(destinationPath, {
        flags: 'w',
        mode: 0o644,
      });

      writeStream.on('close', () => {
        onProgress?.(100);
        resolve();
      });

      writeStream.on('error', (writeErr) => {
        reject(new Error(`Dosya yazma hatası: ${writeErr.message}`));
      });

      readable.on('data', (chunk) => {
        uploadedSize += chunk.length;
        const progress = Math.round((uploadedSize / totalSize) * 100);
        onProgress?.(progress);
      });

      readable.pipe(writeStream);
    });
  });
}

export async function uploadFileViaSSH(fileName: string, fileBuffer: Buffer, onProgress?: (progress: number) => void): Promise<UploadResult> {
  const config = getSSHConfig();
  validateSSHConfig(config);

  const targetPathRaw = process.env.TARGET_PATH || '~/workspace/geoserver-docker/geoserver_data/uploads';
  const targetPath = expandPath(targetPathRaw, config.username);
  const targetFilePath = `${targetPath.replace(/\/$/, '')}/${fileName}`;
  const tempFilePath = `${config.tempUploadPath.replace(/\/$/, '')}/geoserver-upload-${Date.now()}-${fileName}`;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const finishResolve = (value: UploadResult) => {
      if (!settled) {
        settled = true;
        conn.end();
        resolve(value);
      }
    };
    const finishReject = (error: Error) => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(error);
      }
    };

    attachKeyboardInteractiveHandler(conn, config);

    conn.on('ready', async () => {
      try {
        const mkTarget = await executeCommand(conn, `mkdir -p ${shellEscape(targetPath)}`);
        let directUploadError: string | null = null;

        if (mkTarget.code === 0) {
          try {
            await uploadBufferToPath(conn, fileBuffer, targetFilePath, onProgress);
            return finishResolve({
              success: true,
              message: 'Dosya başarıyla hedef klasöre yüklendi',
              filePath: targetFilePath,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
            directUploadError = message;

            if (!config.sudoEnabled) {
              return finishReject(new Error(`Doğrudan yükleme başarısız: ${message}`));
            }
          }
        } else if (!config.sudoEnabled) {
          return finishReject(
            new Error(`Hedef dizin oluşturulamadı/yazılamıyor ve sudo kapalı. Ayrıntı: ${mkTarget.output}`)
          );
        }

        if (!config.sudoEnabled) {
          return finishReject(new Error('Yükleme başarısız ve sudo kapalı'));
        }

        const mkTemp = await executeCommand(conn, `mkdir -p ${shellEscape(config.tempUploadPath)}`);
        if (mkTemp.code !== 0) {
          return finishReject(new Error(`Geçici dizin oluşturulamadı. ${mkTemp.output}`));
        }

        await uploadBufferToPath(conn, fileBuffer, tempFilePath, onProgress);

        const moveCmd = buildSudoCommand(
          `mkdir -p ${shellEscape(targetPath)} && mv -f ${shellEscape(tempFilePath)} ${shellEscape(targetFilePath)} && chmod 644 ${shellEscape(targetFilePath)}`,
          config
        );
        const moveRes = await executeCommand(conn, moveCmd);
        if (moveRes.code !== 0) {
          const directDetail = directUploadError ? ` | Doğrudan yükleme hatası: ${directUploadError}` : '';
          return finishReject(new Error(`Dosya sudo ile taşınamadı. ${moveRes.output}${directDetail}`));
        }

        finishResolve({
          success: true,
          message: 'Dosya geçici dizine yüklenip sudo ile hedef klasöre taşındı',
          filePath: targetFilePath,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        finishReject(new Error(message));
      }
    });

    conn.on('error', (err) => {
      finishReject(new Error(`SSH bağlantı hatası: ${err.message}`));
    });

    conn.connect(buildConnectConfig(config));
  });
}

export async function listUploadedFiles(): Promise<FileListItem[]> {
  const config = getSSHConfig();
  validateSSHConfig(config);

  const targetPathRaw = process.env.TARGET_PATH || '~/workspace/geoserver-docker/geoserver_data/uploads';
  const targetPath = expandPath(targetPathRaw, config.username);

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const finishResolve = (value: FileListItem[]) => {
      if (!settled) {
        settled = true;
        conn.end();
        resolve(value);
      }
    };
    const finishReject = (error: Error) => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(error);
      }
    };

    attachKeyboardInteractiveHandler(conn, config);

    conn.on('ready', async () => {
      try {
        const normal = await executeCommand(conn, `ls -la ${shellEscape(targetPath)}`);
        if (normal.code === 0) {
          return finishResolve(parseLsOutput(normal.output));
        }

        if (!config.sudoEnabled) {
          return finishReject(new Error(`Dosya listeleme komutu başarısız oldu. ${normal.output}`));
        }

        const sudoList = await executeCommand(conn, buildSudoCommand(`ls -la ${shellEscape(targetPath)}`, config));
        if (sudoList.code !== 0) {
          return finishReject(new Error(`Dosya listeleme komutu başarısız oldu. ${sudoList.output}`));
        }

        finishResolve(parseLsOutput(sudoList.output));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        finishReject(new Error(message));
      }
    });

    conn.on('error', (err) => {
      finishReject(new Error(`SSH bağlantı hatası: ${err.message}`));
    });

    conn.connect(buildConnectConfig(config));
  });
}

export async function deleteFileFromServer(fileName: string): Promise<UploadResult> {
  const config = getSSHConfig();
  validateSSHConfig(config);

  const targetPathRaw = process.env.TARGET_PATH || '~/workspace/geoserver-docker/geoserver_data/uploads';
  const targetPath = expandPath(targetPathRaw, config.username);
  const filePath = `${targetPath.replace(/\/$/, '')}/${fileName}`;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const finishResolve = (value: UploadResult) => {
      if (!settled) {
        settled = true;
        conn.end();
        resolve(value);
      }
    };
    const finishReject = (error: Error) => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(error);
      }
    };

    attachKeyboardInteractiveHandler(conn, config);

    conn.on('ready', async () => {
      try {
        const normal = await executeCommand(conn, `rm -f ${shellEscape(filePath)}`);
        if (normal.code === 0) {
          return finishResolve({ success: true, message: 'Dosya başarıyla silindi' });
        }

        if (!config.sudoEnabled) {
          return finishResolve({ success: false, message: `Dosya silme başarısız. ${normal.output}` });
        }

        const sudoDelete = await executeCommand(conn, buildSudoCommand(`rm -f ${shellEscape(filePath)}`, config));
        if (sudoDelete.code === 0) {
          return finishResolve({ success: true, message: 'Dosya sudo ile başarıyla silindi' });
        }

        finishResolve({ success: false, message: `Dosya silme başarısız. ${sudoDelete.output}` });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        finishReject(new Error(message));
      }
    });

    conn.on('error', (err) => {
      finishReject(new Error(`SSH bağlantı hatası: ${err.message}`));
    });

    conn.connect(buildConnectConfig(config));
  });
}

export async function testSSHConnection(): Promise<{ success: boolean; message: string }> {
  const config = getSSHConfig();

  try {
    validateSSHConfig(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SSH yapılandırması geçersiz';
    return { success: false, message };
  }

  return new Promise((resolve) => {
    const conn = new Client();
    attachKeyboardInteractiveHandler(conn, config);

    conn.on('ready', () => {
      conn.end();
      resolve({ success: true, message: 'SSH bağlantısı başarılı' });
    });

    conn.on('error', (err) => {
      resolve({ success: false, message: `SSH bağlantı hatası: ${err.message}` });
    });

    conn.connect(buildConnectConfig(config));
  });
}
