#!/bin/bash

# GitHub仓库信息
REPO="wzn99/obsidian_list_sidebar"
TAG="v1.0.0"
VERSION="1.0.0"

# 检查是否提供了GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "错误: 需要设置GITHUB_TOKEN环境变量"
    echo ""
    echo "请先获取GitHub Personal Access Token:"
    echo "1. 访问 https://github.com/settings/tokens"
    echo "2. 点击 'Generate new token (classic)'"
    echo "3. 选择 'repo' 权限"
    echo "4. 生成token后，运行:"
    echo "   export GITHUB_TOKEN=你的token"
    echo "   ./create-release.sh"
    exit 1
fi

echo "正在创建Release..."

# 创建Release
RELEASE_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/releases" \
  -d "{
    \"tag_name\": \"$TAG\",
    \"name\": \"v$VERSION\",
    \"body\": \"Initial release of List Sidebar plugin\\n\\nFeatures:\\n- Multiple collapsible lists\\n- Note links support\\n- Plain text items\\n- Add/delete operations\",
    \"draft\": false,
    \"prerelease\": false
  }")

RELEASE_ID=$(echo $RELEASE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$RELEASE_ID" ]; then
    echo "创建Release失败，可能Release已存在"
    echo "响应: $RELEASE_RESPONSE"
    exit 1
fi

echo "Release创建成功，ID: $RELEASE_ID"
echo "正在上传文件..."

# 上传文件
upload_file() {
    local file=$1
    local name=$(basename $file)
    echo "上传 $name..."
    
    curl -s -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Content-Type: application/octet-stream" \
      --data-binary @"$file" \
      "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=$name"
}

upload_file "main.js"
upload_file "manifest.json"
upload_file "styles.css"

echo ""
echo "完成! Release已创建并上传文件:"
echo "https://github.com/$REPO/releases/tag/$TAG"

