import COS from 'cos-js-sdk-v5'
import { getCosUploadTokenAPI } from '@/apis/user'

interface CosTokenResponse {
  errcode: number
  errmsg: string
  data: {
    bucket: string
    region: string
    key: string
    startTime: number
    expiredTime: number
    credentials: {
      tmpSecretId: string
      tmpSecretKey: string
      sessionToken: string
    }
  }
}

/**
 * 将微信 JS-SDK 返回的图片数据转换为 Blob。
 * iOS / Android 可能返回带 data URL 前缀或纯 Base64。
 */
function base64ToBlob(localData: string): Blob {
  let base64 = localData.trim()

  // 兼容 data:image/jpeg;base64,... 形式
  if (base64.includes(',')) {
    base64 = base64.substring(base64.indexOf(',') + 1)
  }

  // 兼容部分环境的换行和空白字符
  base64 = base64.replace(/\s/g, '')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes], { type: 'image/jpeg' })
}

// 获取图片类型
function getImageExtension(localData: string): 'jpg' | 'png' {
  const value = localData.trim()

  if (/^data:image\/png;base64,/i.test(value)) {
    return 'png'
  }

  if (/^data:image\/jpe?g;base64,/i.test(value)) {
    return 'jpg'
  }

  // PNG 文件头：iVBORw0KGgo
  const base64 = value.replace(/^data:image\/[^;]+;base64,/i, '')

  if (base64.startsWith('iVBORw0KGgo')) {
    return 'png'
  }

  // JPEG 文件头通常以 /9j/ 开头
  if (base64.startsWith('/9j/')) {
    return 'jpg'
  }

  throw new Error('无法识别图片格式')
}

/**
 * 将微信 JS-SDK 获取的图片数据直接上传 COS。
 * 图片不会经过 Django。
 */
export async function uploadWechatImageToCOS(
  localData: string
): Promise<string> {
  // 1. 转换图片
  const blob = base64ToBlob(localData)

  if (!blob.size) {
    throw new Error('图片数据为空')
  }

  // 2. 向 Django 申请临时凭证
  const extension = getImageExtension(localData)  // 获取图片类型
  const response = await getCosUploadTokenAPI({ extension })
  const result = response.data as CosTokenResponse

  if (result.errcode !== 0) {
    throw new Error(result.errmsg || '获取上传凭证失败')
  }

  const data = result.data
  const credentials = data.credentials

  // 3. 使用短时凭证初始化 COS
  const cos = new COS({
    SecretId: credentials.tmpSecretId,
    SecretKey: credentials.tmpSecretKey,
    SecurityToken: credentials.sessionToken,
    StartTime: data.startTime,
    ExpiredTime: data.expiredTime
  })

  // 4. 直接上传二进制数据至 COS
  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: data.bucket,
        Region: data.region,
        Key: data.key,
        Body: blob,
        ContentType: 'image/jpeg'
      },
      (err) => {
        if (err) {
          console.error('[COS] 上传失败', err)
          reject(err)
          return
        }

        resolve()
      }
    )
  })

  // 5. 拼接图片访问 URL
  // 如果配置了 COS 自定义域名或 CDN 域名，就填写完整域名。
  // 例如：https://cdn.example.com
  // 不使用自定义域名时，保持空字符串。
  const customDomain: string = ''

  const host: string = customDomain
    ? customDomain.replace(/\/$/, '')
    : `https://${data.bucket}.cos.${data.region}.myqcloud.com`

  return `${host}/${data.key}`
}