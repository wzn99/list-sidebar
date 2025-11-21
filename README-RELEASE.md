# 创建GitHub Release说明

## 方法1: 使用脚本（推荐）

1. 获取GitHub Personal Access Token:
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 选择 `repo` 权限
   - 生成并复制token

2. 运行脚本:
   ```bash
   export GITHUB_TOKEN=你的token
   ./create-release.sh
   ```

## 方法2: 手动在GitHub网页创建

1. 访问: https://github.com/wzn99/obsidian_list_sidebar/releases/new

2. 填写信息:
   - **Tag**: 选择 `v1.0.0` (如果不存在，输入 `v1.0.0`)
   - **Title**: `v1.0.0`
   - **Description**: 
     ```
     Initial release of List Sidebar plugin
     
     Features:
     - Multiple collapsible lists
     - Note links support
     - Plain text items
     - Add/delete operations
     ```

3. **重要**: 在 "Attach binaries" 部分，拖拽或选择以下文件:
   - `main.js`
   - `manifest.json`
   - `styles.css`

4. 点击 "Publish release"

## 验证

创建Release后，访问 https://github.com/wzn99/obsidian_list_sidebar/releases

你应该看到Release包含:
- ✅ main.js
- ✅ manifest.json
- ✅ styles.css
- Source code (zip)
- Source code (tar.gz)

然后就可以在Obsidian中使用BRAT插件安装了！

