import type {
  INodeType,
  INodeTypeDescription,
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import archiver from "archiver";

async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      cwd: options.cwd,
      env: options.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function zipDirectoryToBuffer(dirPath: string): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    archive.on("error", reject);
    archive.directory(dirPath, false);
    archive.on("data", (data: Buffer) => chunks.push(data));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.finalize().catch(reject);
  });
}

function ensureExecutable(filePath: string): void {
  try {
    if (process.platform !== "win32") {
      const stat = fs.statSync(filePath);
      // If no execute bit, add it (u/g/o)
      if ((stat.mode & 0o111) === 0) {
        fs.chmodSync(filePath, stat.mode | 0o755);
      }
    }
  } catch {}
}

function detectTypeFromUrl(u: string): "docx" | "batch" | "wiki" {
  const s = u.toLowerCase();
  if (s.includes("/wiki/")) return "wiki";
  if (s.includes("/drive/folder/")) return "batch";
  if (s.includes("/docx/")) return "docx";
  if (s.includes("wiki/settings") || s.includes("wiki/space")) return "wiki";
  if (s.includes("/drive/")) return "batch";
  return "docx";
}

function resolveFeishu2mdPath(): string {
  const isWin = process.platform === "win32";
  const osLabel = isWin
    ? "windows"
    : process.platform === "darwin"
    ? "darwin"
    : "linux";
  const archLabel = process.arch === "arm64" ? "arm64" : "amd64";
  const binName = isWin ? "feishu2md.exe" : "feishu2md";

  // Env override: allow explicit path (useful in Docker)
  const envPath = process.env.FEISHU2MD_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  // Prefer packaged bin directories: both package root and dist root
  const pkgRoot = path.resolve(__dirname, "..", "..", ".."); // <package>/
  const distRoot = path.resolve(__dirname, "..", ".."); // <package>/dist
  const binRoots = [
    path.join(pkgRoot, "bin"),
    path.join(distRoot, "bin"),
  ];

  for (const binRoot of binRoots) {
    try {
      // Direct binary under bin/
      const directBin = path.join(binRoot, binName);
      if (fs.existsSync(directBin)) {
        return directBin;
      }
      if (!fs.existsSync(binRoot)) continue;
      const entries = fs.readdirSync(binRoot, { withFileTypes: true });
      // Prefer folders whose name includes the exact os-arch suffix
      const preferred = entries.filter(
        (e) => e.isDirectory() && e.name.includes(`-${osLabel}-${archLabel}`)
      );
      for (const dirent of preferred) {
        const candidate = path.join(binRoot, dirent.name, binName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      // Fallback: scan all folders and pick the first that contains the binary
      for (const dirent of entries) {
        if (!dirent.isDirectory()) continue;
        const candidate = path.join(binRoot, dirent.name, binName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch {}
  }

  // Fallback to PATH
  const pathEnv = process.env.PATH || "";
  const pathParts = pathEnv.split(path.delimiter);
  for (const p of pathParts) {
    const candidate = path.join(p, binName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "未找到 feishu2md 可执行文件，请在包根或 dist/bin、或设置 FEISHU2MD_PATH、或添加到系统 PATH"
  );
}

async function ensureFeishu2mdConfigured(
  cmdPath: string,
  appId: string,
  appSecret: string
): Promise<void> {
  await runCommand(cmdPath, [
    "config",
    "--appId",
    appId,
    "--appSecret",
    appSecret,
  ]);
}

async function downloadWithFeishu2md(
  cmdPath: string,
  url: string,
  outDir: string
): Promise<void> {
  await runCommand(cmdPath, ["dl", "-o", outDir, url]);
}

export class Feishu2md implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Feishu2md",
    name: "feishu2md",
    group: ["transform"],
    version: 1,
    description: "下载飞书文档为 Markdown（使用 feishu2md CLI）",
    icon: 'file:icons/feishu2md.svg',
    defaults: {
      name: "Feishu2md",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "feishuApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "文档 URL",
        name: "url",
        type: "string",
        default: "",
        required: true,
        description: "飞书新版文档 URL（需开启链接分享可读）",
      },
      {
        displayName: "输出模式",
        name: "outputMode",
        type: "options",
        options: [
          { name: "Zip（推荐）", value: "zip" },
          { name: "文件（每个 Markdown 输出一条）", value: "files" },
        ],
        default: "files",
      },
      {
        displayName: "下载类型",
        name: "downloadType",
        type: "options",
        options: [
          { name: "单文档 docx", value: "docx" },
          { name: "批量（云盘文件夹）", value: "batch" },
          { name: "知识库 wiki", value: "wiki" },
        ],
        default: "docx",
        description: "手动选择下载类型；默认单文档",
      },
      {
        displayName: "文件名前缀",
        name: "filePrefix",
        type: "string",
        default: "",
        description: "可选，为输出的文件名增加前缀",
      },
    ],
  };

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const returnItems: INodeExecutionData[] = [];

    const credentials = await this.getCredentials("feishuApi");
    const appId = (credentials as any).appId as string;
    const appSecret = (credentials as any).appSecret as string;

    const url = this.getNodeParameter("url", 0) as string;
    const outputMode = this.getNodeParameter("outputMode", 0) as string;
    const downloadType = (this.getNodeParameter("downloadType", 0) as string) || "docx";
    const filePrefix = (this.getNodeParameter("filePrefix", 0) as string) || "";

    if (!url) {
      throw new NodeOperationError(this.getNode(), "未提供文档 URL");
    }
    if (!appId || !appSecret) {
      throw new NodeOperationError(
        this.getNode(),
        "未配置 Feishu API 的 App ID 或 App Secret"
      );
    }

    // Prepare temp output dir
    const tmpBase = await fsp.mkdtemp(path.join(os.tmpdir(), "feishu2md-"));

    try {
      // Resolve CLI path from local bin or PATH, then configure and download
      const cmdPath = resolveFeishu2mdPath();
      // Ensure it is executable (handles missing x-bit on mounted volumes)
      ensureExecutable(cmdPath);
      await ensureFeishu2mdConfigured(cmdPath, appId, appSecret);
      const normalizedUrl = String(url).trim().replace(/^`+|`+$/g, "");
      const finalType = downloadType;
      const args = ["dl"];
      if (finalType === "batch") args.push("--batch");
      if (finalType === "wiki") args.push("--wiki");
      args.push("-o", tmpBase, normalizedUrl);
      await runCommand(cmdPath, args);

      // After download, either zip or return files
      if (outputMode === "zip") {
        const buffer = await zipDirectoryToBuffer(tmpBase);
        const binary = await this.helpers.prepareBinaryData(
          buffer,
          `${filePrefix}feishu2md.zip`
        );
        returnItems.push({ json: {} as IDataObject, binary: { data: binary } });
      } else {
        // Each markdown file becomes an item; also attach static assets compatibility
        const files = await fsp.readdir(tmpBase);
        const mdFiles = files.filter((f) => f.toLowerCase().endsWith(".md"));
        if (mdFiles.length === 0) {
          // If none found, zip as fallback
          const buffer = await zipDirectoryToBuffer(tmpBase);
          const binary = await this.helpers.prepareBinaryData(
            buffer,
            `${filePrefix}feishu2md.zip`
          );
          returnItems.push({ json: {} as IDataObject, binary: { data: binary } });
        } else {
          // Rewrite /static/ -> static/ in markdown to make relative paths work
          for (const f of mdFiles) {
            const full = path.join(tmpBase, f);
            const raw = await fsp.readFile(full, "utf-8");
            const rewritten = raw.replace(/\/static\//g, "static/");
            const binary = await this.helpers.prepareBinaryData(
              Buffer.from(rewritten, "utf-8"),
              `${filePrefix}${f}`
            );
            returnItems.push({
              json: { fileName: f } as IDataObject,
              binary: { data: binary },
            });
          }

          // Additionally output static assets as file items for n8n compatibility
          const staticDir = path.join(tmpBase, "static");
          try {
            const stat = await fsp.stat(staticDir);
            if (stat.isDirectory()) {
              const assetFiles = await fsp.readdir(staticDir);
              for (const af of assetFiles) {
                const full = path.join(staticDir, af);
                const content = await fsp.readFile(full);
                const binary = await this.helpers.prepareBinaryData(
                  content,
                  `${filePrefix}static/${af}`
                );
                returnItems.push({
                  json: { fileName: `static/${af}` } as IDataObject,
                  binary: { data: binary },
                });
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      throw new NodeOperationError(this.getNode(), err?.message || String(err));
    } finally {
      // Cleanup temp dir
      try {
        const entries = await fsp.readdir(tmpBase);
        await Promise.all(
          entries.map(async (e) =>
            fsp.rm(path.join(tmpBase, e), { recursive: true, force: true })
          )
        );
        await fsp.rm(tmpBase, { recursive: true, force: true });
      } catch {}
    }

    return this.prepareOutputData(returnItems);
  }
}
