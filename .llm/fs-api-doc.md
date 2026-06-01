# REST API 文档

本文只覆盖常规 REST API，不包含 WebDAV。面向照片墙 Web App 时，核心链路是：

1. 通过列表 API 拉取文件记录。
2. 用 `/file/{fileId}` 作为图片或文件访问地址。
3. 通过 `/upload` 上传新文件。
4. 通过 `/api/manage/delete/{fileId}` 删除文件。

下文示例中的 `https://img.example.com` 替换为你的部署域名。

## 鉴权

### 推荐：API Token

API Token 通过管理端创建，接口请求放到 `Authorization` 请求头：

```http
Authorization: Bearer imgbed_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

代码同时兼容不带 `Bearer ` 前缀的写法，但新接入建议统一使用 Bearer。

常用权限：

| 权限     | 用途                        |
| -------- | --------------------------- |
| `list`   | 调用 `/api/manage/list`     |
| `upload` | 调用 `/upload`              |
| `delete` | 调用 `/api/manage/delete/*` |

照片墙后端服务建议创建至少带 `list,upload,delete` 的 token。只读前端不要暴露带删除或上传权限的 token。

### 兼容：authCode

`/upload` 支持用户认证码 `authCode`，来源优先级为：

1. URL 查询参数：`?authCode=...`
2. `Referer` URL 中的 `authCode`
3. 请求头：`authCode: ...`
4. Cookie：`authCode=...`

不建议在第三方 Web App 里使用查询参数传 authCode，容易进入日志、浏览器历史和 Referer。

### 管理会话

管理端登录后的 cookie session 也能访问管理 API，但照片墙应用一般不应依赖浏览器管理会话。

## 文件访问

### GET `/file/{fileId}`

读取文件内容。`fileId` 就是列表接口返回的 `name`，可能包含目录，例如 `photos/2026/a.jpg`。

```http
GET /file/photos/2026/a.jpg
```

响应：

- 成功时返回文件二进制内容。
- 文件不存在返回 `404`。
- 外链渠道文件会 `302` 跳转到外部地址。
- 支持部分存储渠道的 `HEAD`、`Range`、缓存头和文件名下载头。

照片墙里直接拼 URL 即可：

```text
https://img.example.com/file/{encodeURIComponent(fileId)}
```

注意：如果 `fileId` 包含 `/`，拼路径时应保留斜杠，只编码每个路径段，别把整个 `photos/a.jpg` 编成 `photos%2Fa.jpg`。

## 拉取文件列表

列表有两个入口：公开列表和管理列表。

### GET `/api/public/list`

公开浏览列表。适合直接给浏览器前端用，但必须在系统设置里启用公开浏览，并配置允许目录。

```http
GET /api/public/list?dir=photos&recursive=true&type=image&start=0&count=50
```

查询参数：

| 参数        | 默认值  | 说明                                             |
| ----------- | ------- | ------------------------------------------------ |
| `dir`       | 空      | 目录。`photos` 和 `photos/` 等价                 |
| `recursive` | `false` | 是否递归包含子目录文件                           |
| `type`      | 空      | 文件类型过滤：`image`、`video`、`audio`、`other` |
| `search`    | 空      | 按文件 ID 小写包含匹配                           |
| `start`     | `0`     | 分页起点                                         |
| `count`     | `50`    | 返回数量                                         |

响应示例：

```json
{
  "files": [
    {
      "name": "photos/2026/a.jpg",
      "metadata": {
        "FileType": "image/jpeg",
        "TimeStamp": 1780272000000,
        "FileSize": "2.31"
      }
    }
  ],
  "directories": ["photos/2026"],
  "totalCount": 1,
  "returnedCount": 1,
  "allowedDirs": ["photos"],
  "fromCache": false
}
```

公开列表只返回有限元数据：`FileType`、`TimeStamp`、`FileSize`。它会缓存目录结果，缓存命中时 `fromCache=true`。

### GET `/api/manage/list`

管理列表。适合照片墙后端服务调用，返回字段更完整，支持更多筛选。需要 `list` 权限。

```bash
curl 'https://img.example.com/api/manage/list?dir=photos&recursive=true&fileType=image&start=0&count=50' \
  -H 'Authorization: Bearer imgbed_xxx'
```

查询参数：

| 参数           | 默认值  | 说明                                                                 |
| -------------- | ------- | -------------------------------------------------------------------- |
| `dir`          | 空      | 目录。服务端会标准化为以 `/` 结尾                                    |
| `recursive`    | `false` | 是否包含子目录文件                                                   |
| `start`        | `0`     | 分页起点                                                             |
| `count`        | `50`    | 返回数量；`count=-1&sum=true` 只返回总数                             |
| `search`       | 空      | 搜索文件 ID                                                          |
| `fileType`     | 空      | 文件类型过滤，支持逗号分隔。常用：`image`、`video`、`audio`、`other` |
| `channel`      | 空      | 存储渠道过滤，支持逗号分隔                                           |
| `channelName`  | 空      | 渠道名称过滤，支持逗号分隔                                           |
| `listType`     | 空      | 黑白名单状态过滤，支持逗号分隔                                       |
| `accessStatus` | 空      | 访问状态过滤，支持逗号分隔                                           |
| `label`        | 空      | 审查标签过滤，支持逗号分隔                                           |
| `includeTags`  | 空      | 必须包含的标签，逗号分隔                                             |
| `excludeTags`  | 空      | 必须排除的标签，逗号分隔                                             |

响应示例：

```json
{
  "files": [
    {
      "name": "photos/2026/a.jpg",
      "metadata": {
        "FileName": "a.jpg",
        "FileType": "image/jpeg",
        "FileSize": "2.31",
        "FileSizeBytes": 2422210,
        "UploadIP": "203.0.113.10",
        "UploadAddress": "example",
        "ListType": "None",
        "TimeStamp": 1780272000000,
        "Label": "None",
        "Directory": "photos/2026/",
        "Tags": [],
        "Width": 4032,
        "Height": 3024,
        "Channel": "CloudflareR2",
        "ChannelName": "default"
      }
    }
  ],
  "directories": ["photos/2026"],
  "totalCount": 1,
  "directFileCount": 1,
  "directFolderCount": 1,
  "returnedCount": 1,
  "indexLastUpdated": 1780272010000,
  "isIndexedResponse": true
}
```

照片墙建议优先使用：

```http
GET /api/manage/list?dir=photos&recursive=true&fileType=image&start=0&count=100
```

然后按 `metadata.TimeStamp`、`metadata.Width`、`metadata.Height`、`metadata.Tags` 做展示。

## 上传文件

### POST `/upload`

上传单个文件。需要 `upload` 权限，Content-Type 使用 `multipart/form-data`。

```bash
curl -X POST 'https://img.example.com/upload?uploadChannel=cfr2&uploadFolder=photos/2026&uploadNameType=origin&returnFormat=full' \
  -H 'Authorization: Bearer imgbed_xxx' \
  -F 'file=@/path/to/a.jpg;type=image/jpeg'
```

表单字段：

| 字段   | 必填         | 说明                                    |
| ------ | ------------ | --------------------------------------- |
| `file` | 是           | 要上传的文件                            |
| `url`  | 外链渠道必填 | `uploadChannel=external` 时写入外链地址 |

查询参数：

| 参数             | 默认值     | 说明                                                                     |
| ---------------- | ---------- | ------------------------------------------------------------------------ |
| `uploadChannel`  | `telegram` | `telegram`、`cfr2`、`s3`、`discord`、`huggingface`、`external`           |
| `channelName`    | 空         | 指定具体渠道名称；不传则使用默认或负载均衡                               |
| `uploadFolder`   | 空         | 上传目录，例如 `photos/2026`                                             |
| `uploadNameType` | `default`  | 文件命名：`default`、`index`、`origin`、`short`                          |
| `returnFormat`   | `default`  | `default` 返回 `/file/...`；`full` 返回完整 URL                          |
| `autoRetry`      | `true`     | 失败后是否自动切换渠道重试；传 `false` 关闭                              |
| `serverCompress` | 依配置     | Telegram 图片上传时，传 `false` 会强制按文档发送，避免 Telegram 压缩图片 |

`uploadNameType` 行为：

| 值        | 结果                                         |
| --------- | -------------------------------------------- |
| `default` | `{timestamp_random}_{sanitizedOriginalName}` |
| `index`   | `{timestamp_random}.{ext}`                   |
| `origin`  | 使用清洗后的原文件名，重名自动追加 `(1)`     |
| `short`   | 8 位短 ID 加扩展名                           |

上传响应：

```json
[
  {
    "src": "https://img.example.com/file/photos/2026/a.jpg"
  }
]
```

返回值是数组，不是对象。调用方应取 `response[0].src`。

### 外链上传

外链渠道只写入一个转跳记录，不搬运文件内容。

```bash
curl -X POST 'https://img.example.com/upload?uploadChannel=external&uploadFolder=photos&uploadNameType=origin&returnFormat=full' \
  -H 'Authorization: Bearer imgbed_xxx' \
  -F 'file=@placeholder.jpg;type=image/jpeg' \
  -F 'url=https://cdn.example.net/photo.jpg'
```

实现里仍会读取 `file` 的文件名、类型和大小来生成元数据，所以需要提供一个 `file` 字段。

## 大文件分块上传

普通照片墙通常用不上。只有你要上传超出 Worker 请求体限制或渠道单次限制的大文件时再接。

### 初始化

```bash
curl -X POST 'https://img.example.com/upload?initChunked=true&uploadChannel=cfr2&channelName=default' \
  -H 'Authorization: Bearer imgbed_xxx' \
  -F 'originalFileName=large.jpg' \
  -F 'originalFileType=image/jpeg' \
  -F 'totalChunks=4'
```

响应：

```json
{
  "success": true,
  "uploadId": "upload_1780272000000_abcdefghi",
  "message": "Chunked upload initialized successfully",
  "sessionInfo": {
    "uploadId": "upload_1780272000000_abcdefghi",
    "originalFileName": "large.jpg",
    "totalChunks": 4,
    "uploadChannel": "cfr2",
    "channelName": "default"
  }
}
```

### 上传分块

```bash
curl -X POST 'https://img.example.com/upload?chunked=true&uploadChannel=cfr2' \
  -H 'Authorization: Bearer imgbed_xxx' \
  -F 'file=@chunk-0.bin' \
  -F 'chunkIndex=0' \
  -F 'totalChunks=4' \
  -F 'uploadId=upload_1780272000000_abcdefghi' \
  -F 'originalFileName=large.jpg' \
  -F 'originalFileType=image/jpeg'
```

响应：

```json
{
  "success": true,
  "message": "Chunk 1/4 received and being uploaded",
  "uploadId": "upload_1780272000000_abcdefghi",
  "chunkIndex": 0
}
```

### 合并

```bash
curl -X POST 'https://img.example.com/upload?chunked=true&merge=true&uploadChannel=cfr2&uploadFolder=photos/2026&returnFormat=full' \
  -H 'Authorization: Bearer imgbed_xxx' \
  -F 'uploadId=upload_1780272000000_abcdefghi' \
  -F 'totalChunks=4' \
  -F 'originalFileName=large.jpg' \
  -F 'originalFileType=image/jpeg'
```

成功响应和普通上传一致：

```json
[
  {
    "src": "https://img.example.com/file/photos/2026/1780272000000_large.jpg"
  }
]
```

### 清理分块

```bash
curl -X POST 'https://img.example.com/upload?cleanup=true&uploadId=upload_1780272000000_abcdefghi&totalChunks=4' \
  -H 'Authorization: Bearer imgbed_xxx'
```

## 删除文件

### DELETE `/api/manage/delete/{fileId}`

删除单个文件。需要 `delete` 权限。

```bash
curl -X DELETE 'https://img.example.com/api/manage/delete/photos/2026/a.jpg' \
  -H 'Authorization: Bearer imgbed_xxx'
```

成功响应：

```json
{
  "success": true,
  "fileId": "photos/2026/a.jpg"
}
```

删除是幂等的：数据库里找不到文件记录时，底层删除函数会按成功处理。

### 删除文件夹

```bash
curl -X DELETE 'https://img.example.com/api/manage/delete/photos/2026?folder=true' \
  -H 'Authorization: Bearer imgbed_xxx'
```

响应：

```json
{
  "success": true,
  "deleted": ["photos/2026/a.jpg"],
  "failed": []
}
```

文件夹删除会递归列出目录并逐个删除文件。这个操作不可恢复，照片墙 UI 里不要把它做成一键误触。

## 错误响应

常见状态码：

| 状态码 | 场景                                  |
| ------ | ------------------------------------- |
| `200`  | 成功                                  |
| `204`  | CORS 预检成功                         |
| `400`  | 参数错误、删除失败、分块会话不匹配    |
| `401`  | 鉴权失败                              |
| `403`  | IP 被封禁、公开浏览未启用、目录不允许 |
| `404`  | 文件不存在                            |
| `405`  | 方法不允许                            |
| `410`  | 分块上传会话过期                      |
| `500`  | 存储、数据库或索引内部错误            |

错误体不完全统一：有的接口返回纯文本，例如 `Unauthorized`；有的接口返回 JSON，例如：

```json
{
  "success": false,
  "error": "Delete file failed"
}
```

客户端不要假设所有错误都是 JSON。

## 照片墙推荐接入方式

后端代理模式：

1. 照片墙前端请求你的应用后端。
2. 你的后端持有 ImgBed API Token。
3. 后端调用 `/api/manage/list` 拉取完整元数据。
4. 前端只拿公开可展示字段和 `/file/{fileId}` URL。
5. 上传、删除也走你的后端，再由后端调用 ImgBed。

纯前端公开浏览模式：

1. 在 ImgBed 开启公开浏览并限制允许目录。
2. 前端调用 `/api/public/list?dir=photos&recursive=true&type=image`。
3. 前端用 `/file/{name}` 展示图片。
4. 上传和删除不要放在公开前端，除非你能接受 token 泄露后的后果。

最小照片对象可以整理为：

```json
{
  "id": "photos/2026/a.jpg",
  "url": "https://img.example.com/file/photos/2026/a.jpg",
  "type": "image/jpeg",
  "sizeMB": "2.31",
  "width": 4032,
  "height": 3024,
  "createdAt": 1780272000000,
  "tags": []
}
```
