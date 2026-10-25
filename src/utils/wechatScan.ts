// 对微信扫一扫的性能优化
import wx from 'weixin-js-sdk'
import { wechatConfigAPI } from '@/apis/user'
import { Toast } from 'vant'

let isConfiged = false
let isReady = false
let readyPromise: Promise<void> | null = null

/**
 * 初始化微信 JSSDK（只允许调用一次）
 */
export function initWechatJSSDK(jsApiList: string[] = []) {
  if (isConfiged && readyPromise) {
    return readyPromise
  }

  isConfiged = true

  readyPromise = new Promise(async (resolve, reject) => {
    try {
      const url = window.location.href.split('#')[0]
      const res = await wechatConfigAPI({ url })

      if (res.data.errcode !== 0) {
        Toast('微信 JSSDK 配置失败')
        return reject(res)
      }

      const cfg = res.data.data

      wx.config({
        debug: false,
        appId: cfg.appId,
        timestamp: cfg.timestamp,
        nonceStr: cfg.nonceStr,
        signature: cfg.signature,
        jsApiList: jsApiList as any
      })

      wx.ready(() => {
        isReady = true
        console.log('[wechat] wx.ready')
        resolve()
      })

      wx.error(err => {
        console.error('[wechat] wx.error', err)
        reject(err)
      })
    } catch (e) {
      reject(e)
    }
  })

  return readyPromise
}

/**
 * 调起微信扫一扫（必须在 initWechatJSSDK 之后）
 */
export function scanQRCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isReady) {
      return reject('微信 JSSDK 尚未 ready')
    }

    wx.scanQRCode({
      needResult: 1,
      scanType: ['qrCode', 'barCode'],
      success(res) {
        resolve(res.resultStr)
      },
      fail(err) {
        reject(err)
      },
      cancel() {
        reject('cancel')
      }
    })
  })
}

/**
 * 调起微信拍照或相册选择。
 * 返回微信本地图片 localId。
 */
export function chooseWechatImage(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isReady) {
      reject(new Error('微信 JSSDK 尚未 ready'))
      return
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],

      success(res) {
        const localId = res.localIds?.[0]

        if (!localId) {
          reject(new Error('没有获取到图片'))
          return
        }

        resolve(localId)
      },

      cancel() {
        reject(new Error('用户取消了选择'))
      },

      fail(err) {
        console.error('[wechat] chooseImage 失败', err)
        reject(err)
      }
    })
  })
}

/**
 * 将微信本地图片上传到微信服务器。
 * 返回 serverId，供 Django 后端下载图片并上传 COS。
 */
export function uploadWechatImage(localId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isReady) {
      reject(new Error('微信 JSSDK 尚未 ready'))
      return
    }

    wx.uploadImage({
      localId,
      isShowProgressTips: 1,

      success(res) {
        if (!res.serverId) {
          reject(new Error('微信未返回图片 serverId'))
          return
        }

        resolve(res.serverId)
      },

      fail(err) {
        console.error('[wechat] uploadImage 失败', err)
        reject(err)
      }
    })
  })
}

/**
 * 获取微信选择的图片数据
 * localId 来自 wx.chooseImage
 * 返回可转换成 Blob 的 Base64 数据
 */
export function getWechatImageData(
  localId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.getLocalImgData({
      localId,

      success(res) {
        if (!res.localData) {
          reject(new Error('未能获取图片数据'))
          return
        }

        resolve(res.localData)
      },

      fail(err) {
        console.error('[wechat] getLocalImgData 失败', err)
        reject(err)
      }
    })
  })
}
