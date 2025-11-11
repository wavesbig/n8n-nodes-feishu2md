# n8n-nodes-feishu2md

将 GitHub 项目 `Wsine/feishu2md` 封装为 n8n 自定义节点，支持输入飞书新版文档 URL，导出为 Markdown 并以二进制输出（Zip 或单文件）。

## 功能特性

- 输入飞书新版文档 URL，调用 `feishu2md` CLI 下载为 Markdown
- 支持输出模式：Zip（包含图片、附件等资源）或单 Markdown 文件（每个文件一条）
- 通过 n8n 凭据传入 `App ID` 与 `App Secret`，节点自动执行 `feishu2md config`

## 环境准备

1. 预置或安装 feishu2md 可执行文件
   - 推荐：将可执行文件放入本包的 `bin/` 目录，支持两种方式：
     - 直接放置：`bin/feishu2md`（Linux/macOS，需 `chmod +x`）或 `bin/feishu2md.exe`（Windows）
     - 平台分目录：`bin/feishu2md-vX.Y.Z-<os>-<arch>/feishu2md[.exe]`
       - `<os>` 取值：`windows`、`linux`、`darwin`
       - `<arch>` 取值：`amd64` 或 `arm64`
       - 示例：`bin/feishu2md-v2.4.5-windows-amd64/feishu2md.exe`
   - 备选：将可执行文件加入系统 `PATH`
   - 节点会优先查找平台匹配的 `bin/` 子目录，其次查找 `bin/` 根目录，最后回退到 `PATH`
   - 命令行帮助参考：
     - `feishu2md -h`
     - `feishu2md config -h`
     - `feishu2md dl -h`
2. n8n 版本建议 ≥ 1.6x。

> feishu2md 项目介绍与使用方法参考：Wsine/feishu2md 仓库（命令行与权限说明、配置步骤等）

## 安装（作为自定义节点包）

1. 在该目录执行：
   ```bash
   npm install
   npm run build
   ```
2. 将本包发布至私有 npm 或将 `dist` 打包至 n8n `custom` 节点目录（具体做法取决于你的部署方式）。常见方法：
   - 在 n8n 容器或主机内安装：`npm install <path-to-n8n-nodes-feishu2md>`
   - 或按 n8n 的自定义节点加载约定放置编译产物。

## 在 n8n 中使用

1. 在 n8n 的 Credentials 新建 `Feishu API`，填写：
   - `App ID`
   - `App Secret`
2. 新建工作流，添加节点 `Feishu2md`：
   - `文档 URL`：粘贴飞书文档链接（需开启链接分享“互联网上可读”）
   - `输出模式`：选择 `Zip（推荐）` 或 `文件`
   - `文件名前缀`（可选）：输出文件名的前缀
3. 运行节点：
   - `Zip` 模式下，输出的 `binary.data` 是一个 zip 压缩包（包含 Markdown 与资源）
   - `文件` 模式下，每个 Markdown 文件会分别作为一条 `binary.data`

## 注意事项

- 节点会在执行时自动运行：
  - `feishu2md config --appId <id> --appSecret <secret>`
  - `feishu2md dl -o <临时目录> <url>`
- 请确保 feishu2md 已提供（优先 bin/，备选 PATH），且具备所需 API 权限（docx、drive、wiki 等）。
- Windows 环境建议将 `feishu2md.exe` 放入包内 `bin/`。
- 如果选择 `文件` 输出而未找到 `.md` 文件，节点会回退为 Zip 输出。

## 许可

MIT
