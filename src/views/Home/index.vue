
<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  initWechatJSSDK,
  chooseWechatImage,
  getWechatImageData,
} from '@/utils/wechatScan'
import { uploadWechatImageToCOS } from '@/utils/cosUpload'
import { Toast } from 'vant'
import {
  getUserInfoAPI,
  updateUgcAPI,
  clearDrawInfoAPI,
} from '@/apis/user'
import type { UserInfo } from '@/types/user'

// ============================================================
// 一、页面及海报状态
// ============================================================

/** 页面容器，用于读取原页面各个元素的位置和尺寸 */
const pageBodyRef = ref<HTMLElement | null>(null)

/** Canvas 合成完成后的海报 Base64 地址 */
const posterUrl = ref('')

/**
 * 页面状态：
 * 0：拍照 / 选择照片页面
 * 1：照片海报页面
 */
const pageNum = ref(0)

/** 上传到 COS 后得到的用户原始照片地址 */
const photoUrl = ref('')

/**
 * 是否正在执行照片处理流程。
 *
 * 从用户选择完照片后开始：
 * 获取图片数据 -> 校验图片 -> 上传 COS -> Canvas 合成
 * -> 将 COS 地址同步到服务器。
 *
 * 整个过程都会显示“处理中...”。
 */
const isProcessing = ref(false)

/**
 * 防止用户连续点击拍照按钮。
 *
 * photoLoading 从开始调起微信选择图片就置为 true，
 * 即使此时还在微信的选择界面，也可以防止重复调用。
 */
const photoLoading = ref(false)

/** 用户信息 */
const userInfo = ref<UserInfo>()

/** 用户流程状态 */
const flowStatus = ref('0')

const route = useRoute()

let auth_code: string | undefined

// ============================================================
// 二、图片加载
// ============================================================

/**
 * 加载图片。
 *
 * 注意：
 * 1. 跨域图片必须由图片服务器允许 CORS，否则无法导出 Canvas。
 * 2. 必须在设置 img.src 之前设置 crossOrigin。
 * 3. 这里用于加载 COS 照片和页面背景素材。
 */
function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('图片尺寸异常'))
        return
      }

      resolve(img)
    }

    img.onerror = () => {
      reject(new Error(`图片加载失败：${src}`))
    }

    img.src = src
  })
}

/**
 * 从 CSS background-image 中提取图片 URL。
 *
 * 例如：
 * url("https://example.com/image.png")
 *
 * 返回：
 * https://example.com/image.png
 */
function getBackgroundUrl(backgroundImage: string): string | null {
  const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/)

  return match?.[1] || null
}

// ============================================================
// 三、Canvas 绘制工具
// ============================================================

/**
 * 将照片按照 CSS object-fit: cover 的规则居中裁剪。
 *
 * 原图较宽：裁剪左右两侧。
 * 原图较高：裁剪上下两侧。
 *
 * 参数：
 * ctx：Canvas 绘制上下文
 * img：已经加载完成的图片
 * x、y：图片在 Canvas 中的位置
 * width、height：图片在 Canvas 中的显示尺寸
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const sourceWidth = img.naturalWidth
  const sourceHeight = img.naturalHeight

  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('照片尺寸无效')
  }

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = width / height

  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight

  if (sourceRatio > targetRatio) {
    // 原图较宽：保留中间部分，裁剪左右两侧
    sw = sourceHeight * targetRatio
    sx = (sourceWidth - sw) / 2
  } else if (sourceRatio < targetRatio) {
    // 原图较高：保留中间部分，裁剪上下两侧
    sh = sourceWidth / targetRatio
    sy = (sourceHeight - sh) / 2
  }

  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    x,
    y,
    width,
    height
  )
}

/**
 * 获取元素相对于海报容器的位置。
 *
 * 使用实际 DOM 坐标，保留原有 rem、居中和 transform 布局。
 */
function getElementRect(
  el: HTMLElement,
  containerRect: DOMRect
) {
  const rect = el.getBoundingClientRect()

  return {
    x: rect.left - containerRect.left,
    y: rect.top - containerRect.top,
    width: rect.width,
    height: rect.height,
  }
}

// ============================================================
// 四、海报合成
// ============================================================

/**
 * 使用原生 Canvas 合成高清海报。
 *
 * 合成内容：
 * 1. 黑色背景
 * 2. 页面标题背景素材
 * 3. Logo
 * 4. 用户上传的照片
 * 5. 底部 privacy.png 声明素材
 *
 * .tips 仅用于提示用户长按保存，不绘制到最终海报中。
 *
 * 注意：
 * 本方法执行失败时会向外抛出错误，
 * 由 getPhoto() 统一处理异常。
 */
async function generatePoster() {
  // 等待 Vue 更新 DOM
  await nextTick()

  // 等待浏览器完成一次布局和绘制调度
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

  const element = pageBodyRef.value

  if (!element) {
    throw new Error('找不到海报容器')
  }

  // 获取当前海报容器的实际尺寸
  const width = element.clientWidth
  const height = element.clientHeight

  if (width <= 0 || height <= 0) {
    throw new Error('海报尺寸异常，请检查页面布局')
  }

  // 输出分辨率为 CSS 尺寸的 3 倍，改善保存后的清晰度
  const scale = 3

  const canvas = document.createElement('canvas')

  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('浏览器无法创建 Canvas')
  }

  // 使用高分辨率坐标系，后续仍以 CSS 像素定位元素
  ctx.scale(scale, scale)

  // 先绘制黑色背景，避免海报出现透明区域
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  // 固定本次合成的坐标基准
  const containerRect = element.getBoundingClientRect()

  // 按 DOM 顺序获取页面元素，确保素材叠放顺序与原页面一致
  const elements = Array.from(
    element.querySelectorAll<HTMLElement>('*')
  )

  // 保存已加载的素材，避免重复加载相同图片
  const imageCache = new Map<string, HTMLImageElement>()

  /**
   * 第一步：预加载所有需要绘制的图片。
   *
   * 必须等待全部图片加载完成后再开始绘制，
   * 否则可能出现某些背景图没有画出来的情况。
   */
  for (const el of elements) {
    // 提示长按保存的图片不进入海报
    if (el.classList.contains('tips')) {
      continue
    }

    // 用户照片单独处理
    if (el.classList.contains('photo-container')) {
      if (!photoUrl.value) {
        throw new Error('没有找到用户照片地址')
      }

      if (!imageCache.has(photoUrl.value)) {
        const photoImage = await loadCanvasImage(photoUrl.value)
        imageCache.set(photoUrl.value, photoImage)
      }

      continue
    }

    // 读取 CSS 背景图片
    const backgroundImage = getComputedStyle(el).backgroundImage
    const imageUrl = getBackgroundUrl(backgroundImage)

    // 仅加载尚未加载过的图片
    if (imageUrl && !imageCache.has(imageUrl)) {
      const backgroundImg = await loadCanvasImage(imageUrl)
      imageCache.set(imageUrl, backgroundImg)
    }
  }

  /**
   * 第二步：按照页面元素的 DOM 顺序绘制。
   */
  for (const el of elements) {
    // 不将“提示长按保存”绘制到海报中
    if (el.classList.contains('tips')) {
      continue
    }

    // 忽略隐藏元素
    const style = getComputedStyle(el)

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0
    ) {
      continue
    }

    // 获取当前元素相对于海报容器的位置
    const rect = getElementRect(el, containerRect)

    if (rect.width <= 0 || rect.height <= 0) {
      continue
    }

    // 用户照片：使用 cover 算法绘制
    if (el.classList.contains('photo-container')) {
      const img = imageCache.get(photoUrl.value)

      if (!img) {
        throw new Error('用户照片加载失败')
      }

      drawImageCover(
        ctx,
        img,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      )

      // 已经绘制照片容器，跳过后续内部 img 的重复绘制
      continue
    }

    // 绘制 CSS background-image 素材
    const backgroundImage = getComputedStyle(el).backgroundImage
    const imageUrl = getBackgroundUrl(backgroundImage)

    if (imageUrl) {
      const img = imageCache.get(imageUrl)

      if (!img) {
        throw new Error(`找不到背景素材：${imageUrl}`)
      }

      ctx.drawImage(
        img,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      )
    }
  }

  /**
   * 第三步：导出最终海报。
   *
   * 如果出现跨域污染或浏览器不允许导出，
   * toDataURL 会抛出异常，由外层捕获。
   */
  const result = canvas.toDataURL('image/jpeg', 1)

  if (!result || result === 'data:,') {
    throw new Error('海报导出失败')
  }

  // 合成成功后才更新海报地址
  posterUrl.value = result
}

// ============================================================
// 五、获取用户信息
// ============================================================

const loadUserInfo = async () => {
  console.log('获取的参数信息为：', route.query)

  if (!route.query.authCode) {
    Toast('参数不正确，请重新扫描太阳码进入~')
    return
  }

  try {
    auth_code = route.query.authCode as string

    console.log('auth_code：', auth_code)

    const res = await getUserInfoAPI({ auth_code })

    console.log(res)

    if (res.data.errcode === 0) {
      userInfo.value = res.data.data
      flowStatus.value = res.data.data!.flow_status!
    } else {
      Toast(res.data.errmsg)
    }
  } catch (error) {
    console.error('获取用户信息失败：', error)
    Toast('获取用户信息失败，请重试')
  }
}

// ============================================================
// 六、获取微信图片尺寸
// ============================================================

/**
 * 获取微信返回的图片宽高。
 *
 * 微信返回的数据可能是：
 * 1. data:image/jpeg;base64,...
 * 2. data:image/png;base64,...
 * 3. 不包含前缀的纯 Base64 字符串。
 *
 * 对纯 Base64 数据补充正确的图片前缀后再读取尺寸。
 */
function getImageDimensions(
  localData: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let imageData = localData.trim()

    // 如果已经有 data:image/ 前缀，就直接使用
    if (!/^data:image\//i.test(imageData)) {
      if (imageData.startsWith('iVBORw0KGgo')) {
        // PNG 文件的 Base64 特征开头
        imageData = `data:image/png;base64,${imageData}`
      } else if (imageData.startsWith('/9j/')) {
        // JPEG 文件的 Base64 特征开头
        imageData = `data:image/jpeg;base64,${imageData}`
      } else {
        reject(new Error('无法识别图片格式，请重新选择照片'))
        return
      }
    }

    const img = new Image()

    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('无法读取图片尺寸'))
        return
      }

      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }

    img.onerror = () => {
      reject(new Error('图片解析失败，请重新选择'))
    }

    img.src = imageData
  })
}

// ============================================================
// 七、同步 COS 图片地址到服务器
// ============================================================

/**
 * 将 COS 原照片地址记录到 Django 服务器。
 *
 * 提交参数：
 * user_id：当前用户 ID
 * photo_url：上传到 COS 后返回的原照片网络地址
 *
 * 注意：
 * 这里记录的是 COS 原照片地址，不是 Canvas 合成后的海报 Base64。
 */
async function saveUgcRecord() {
  // 必须先获取用户信息，才能知道要将照片记录到哪个用户名下
  if (!userInfo.value || !userInfo.value.user_id) {
    throw new Error('用户信息尚未获取，无法保存照片记录')
  }

  if (!photoUrl.value) {
    throw new Error('COS 照片地址为空，无法保存照片记录')
  }

  const data = {
    user_id: String(userInfo.value.user_id),
    photo_url: photoUrl.value,
  }

  console.log('准备同步 UGC 照片地址到服务器：', data)

  const res = await updateUgcAPI(data)

  console.log('UGC 照片记录接口返回：', res)

  // 根据项目现有 API 结构，使用 errcode 判断业务是否成功
  if (res.data.errcode !== 0) {
    throw new Error(
      res.data.errmsg || '服务器保存照片记录失败'
    )
  }

  console.log('UGC 照片地址同步成功')
}

// ============================================================
// 八、拍照、上传 COS、生成海报、同步服务器
// ============================================================

/**
 * 完整照片处理流程。
 *
 * 执行顺序：
 *
 * 1. 调起微信拍照或相册。
 * 2. 用户选好照片后，立即切换到第二页。
 * 3. 显示“处理中...”。
 * 4. 获取图片 Base64 数据。
 * 5. 检查照片比例。
 * 6. 上传原始照片到 COS。
 * 7. 使用 COS 图片地址合成高清海报。
 * 8. 海报生成成功后，将 COS 图片地址同步到服务器。
 * 9. 处理结束，隐藏“处理中...”。
 *
 * 不显示“图片上传成功”Toast。
 */
async function getPhoto() {
  // 防止重复点击
  if (photoLoading.value || isProcessing.value) {
    return
  }

  console.log('调起微信拍照或相册')

  // 调起微信选择照片期间也禁止重复操作
  photoLoading.value = true

  try {
    // --------------------------------------------------------
    // 第一步：调起微信拍照或相册
    // --------------------------------------------------------

    const localId = await chooseWechatImage()

    // 如果没有拿到图片标识，则结束本次操作
    if (!localId) {
      return
    }

    // --------------------------------------------------------
    // 第二步：用户选择完照片后，立即切换到第二页
    // --------------------------------------------------------

    /**
     * 这一步放在获取 Base64 和上传 COS 之前。
     * 这样后续即使需要等待网络上传或 Canvas 绘制，
     * 用户也已经进入第二页。
     */
    pageNum.value = 1

    // 清除上一次可能残留的海报和照片地址
    posterUrl.value = ''
    photoUrl.value = ''

    // 打开处理中提示
    isProcessing.value = true

    // 让 Vue 更新第二页 DOM
    await nextTick()

    // 等待浏览器绘制一帧，确保提示有机会显示出来
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    // --------------------------------------------------------
    // 第三步：获取微信图片 Base64 数据
    // --------------------------------------------------------

    const localData = await getWechatImageData(localId)

    if (!localData) {
      throw new Error('获取照片数据失败')
    }

    // --------------------------------------------------------
    // 第四步：读取图片真实宽高
    // --------------------------------------------------------

    const { width, height } = await getImageDimensions(localData)

    console.log('图片宽度：', width)
    console.log('图片高度：', height)

    // --------------------------------------------------------
    // 第五步：检查照片方向
    // --------------------------------------------------------

    /**
     * 保留原来的要求：
     * 图片高度 / 图片宽度 >= 1.2。
     *
     * 不符合要求时，返回第一页，让用户重新选择。
     */
    const portraitRatio = height / width

    if (portraitRatio < 1.2) {
      pageNum.value = 0
      posterUrl.value = ''
      photoUrl.value = ''

      Toast('请上传竖版照片，建议使用 3:4 或 4:5 比例')

      return
    }

    // --------------------------------------------------------
    // 第六步：上传原始照片到 COS
    // --------------------------------------------------------

    /**
     * 保留原来的上传函数和参数。
     * 上传成功后，得到 COS 图片网络地址。
     */
    const url = await uploadWechatImageToCOS(localData)

    // 防止上传函数返回空地址时继续生成海报
    if (!url || typeof url !== 'string') {
      throw new Error('COS 上传没有返回有效的图片地址')
    }

    photoUrl.value = url

    console.log('COS 图片地址：', photoUrl.value)

    // --------------------------------------------------------
    // 第七步：等待 Vue 将 COS 照片地址渲染到第二页
    // --------------------------------------------------------

    /**
     * Canvas 合成时需要读取 photo-container 的真实尺寸。
     */
    await nextTick()

    // --------------------------------------------------------
    // 第八步：合成高清海报
    // --------------------------------------------------------

    /**
     * 这里必须先完成海报合成。
     * 只有 Canvas 成功导出后，才会继续向服务器提交记录。
     */
    await generatePoster()

    console.log('海报合成完成')

    // --------------------------------------------------------
    // 第九步：将 COS 原照片地址同步到服务器
    // --------------------------------------------------------

    /**
     * 注意：
     * 此时 posterUrl 已经生成成功。
     *
     * 向服务器提交的是：
     * {
     *   user_id: 当前用户 ID,
     *   photo_url: COS 原照片网络地址
     * }
     *
     * 不是 posterUrl（Canvas 合成后的 Base64）。
     */
    try {
      await saveUgcRecord()

      console.log('照片记录已成功保存到服务器')
    } catch (recordError) {
      /**
       * 这里单独捕获服务器记录失败。
       *
       * 因为此时 COS 上传和海报合成都已经成功，
       * 所以不清空 posterUrl，也不返回第一页。
       *
       * 保留已经生成的海报，让用户仍然可以长按保存。
       */
      console.error('同步 UGC 照片记录失败：', recordError)

      Toast.fail('海报已生成，但照片记录保存失败')
    }

    // 不显示“图片上传成功”Toast

  } catch (error) {
    /**
     * 这里处理：
     * 1. 微信图片数据获取失败
     * 2. 图片尺寸读取失败
     * 3. COS 上传失败
     * 4. Canvas 海报合成失败
     *
     * 服务器记录接口的异常已在上面的内部 try/catch 中处理，
     * 不会进入这里。
     */
    console.error('拍照、上传或海报合成失败：', error)

    // 清空未完成的海报结果
    posterUrl.value = ''
    photoUrl.value = ''

    // 返回第一页，允许用户重新选择照片
    pageNum.value = 0

    // 用户取消选择时不显示错误提示
    const message =
      error instanceof Error ? error.message : String(error)

    if (!message.includes('取消')) {
      Toast.fail('照片处理失败，请重试')
    }

  } finally {
    // 成功、失败或照片比例不符合要求，都会关闭处理中提示
    isProcessing.value = false

    // 释放点击锁
    photoLoading.value = false
  }
}

// ============================================================
// 九、微信 JSSDK 初始化
// ============================================================

onMounted(async () => {
  // 获取用户信息，保留原有逻辑
  loadUserInfo()

  // 初始化微信公众号 JSSDK
  try {
    await initWechatJSSDK([
      'chooseImage',
      'getLocalImgData',
    ])

    console.log('微信 JSSDK 初始化完成')
  } catch (err) {
    console.error('微信 JSSDK 初始化失败：', err)
    Toast('微信初始化失败')
  }
})

// ============================================================
// 十、清除用户抽奖信息（当前关闭）
// ============================================================

const clearDrawInfo = async () => {
  // 保留原来关闭此功能的逻辑
  return

  // 以下为原有逻辑，当前不会执行
  console.log('清除用户信息中..')

  if (!userInfo.value) {
    return
  }

  const res = await clearDrawInfoAPI({
    user_id: userInfo.value.user_id,
  })

  console.log(res)

  if (res.data.errcode === 0) {
    console.log('清除成功')
    Toast('用户抽奖信息清除成功！')
  } else {
    Toast(res.data.errmsg)
    console.log('清除失败')
  }
}
</script>

<template>
  <!-- ========================================================
       主页面
       ======================================================== -->
  <div ref="pageBodyRef" class="page-body">
    <!--
      海报还未生成时，显示原始页面素材。
      Canvas 将读取这些元素的实际位置进行合成。
    -->
    <template v-if="!posterUrl">
      <!-- 中文标题 -->
      <div class="slogan-cn"></div>

      <!-- 根据页面状态显示白色或红色标题 -->
      <div v-if="pageNum === 0" class="slogan-white"></div>
      <div v-else class="slogan-red"></div>

      <!-- Logo -->
      <div class="index-logo" @click="clearDrawInfo"></div>

      <!-- 第一页：选择照片 -->
      <div
        v-if="pageNum === 0"
        class="get-photo"
        @click="getPhoto"
      ></div>

      <!-- 第二页：用户照片 -->
      <div v-else class="photo-container">
        <img
          v-if="photoUrl"
          :src="photoUrl"
          alt="用户上传的照片"
        />
      </div>

      <!--
        第二页处理完成后显示长按保存提示。
        处理中时不显示，且 Canvas 合成会跳过此元素。
      -->
      <div
        v-if="pageNum === 1 && !isProcessing"
        class="tips"
      ></div>

      <!-- 底部声明图片 -->
      <div class="statement"></div>
    </template>

    <!--
      Canvas 合成完成后，使用最终海报替换原始页面。
      用户长按此图片保存的就是合成后的完整海报。
    -->
    <img
      v-else
      class="poster-image"
      :src="posterUrl"
      alt="合成海报"
    />
  </div>

  <!-- ========================================================
       处理中提示
       ========================================================

       放在主页面容器外部，确保不会被 Canvas 合成进去。
       只有用户选好照片后才显示，处理完成后自动隐藏。
  -->
  <div
    v-if="isProcessing"
    class="processing-mask"
  >
    <div class="processing-toast">
      <span class="loading-spinner"></span>
      <span>处理中...</span>
    </div>
  </div>

  <!--
    海报生成完成后显示的长按保存提示。
    该元素位于 page-body 外部，不参与 Canvas 合成。
    位置仍然使用 top: 8.2rem，和原页面保持一致。
  -->
  <div
    v-if="posterUrl && !isProcessing"
    class="save-tip"
  >
    <div class="tips"></div>
  </div>
</template>

<style lang="scss" scoped>
/* ============================================================
   一、页面整体
   ============================================================ */

.page-body {
  position: absolute;
  left: 0;
  top: 0;

  width: 100vw;
  height: 100vh;

  overflow: hidden;
  background-color: #000000;
}

/* ============================================================
   二、最终海报
   ============================================================ */

.poster-image {
  position: absolute;
  left: 0;
  top: 0;

  display: block;
  width: 100%;
  height: 100%;

  object-fit: fill;
}

/* ============================================================
   三、中文标题
   ============================================================ */

.slogan-cn {
  position: absolute;
  top: 0.6rem;
  left: 50%;
  transform: translateX(-50%);

  width: 0.8733rem;
  height: 0.9733rem;

  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/slogan-cn.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

/* ============================================================
   四、白色 / 红色标题
   ============================================================ */

.slogan-white,
.slogan-red {
  position: absolute;
  top: 1.98rem;
  left: 50%;
  transform: translateX(-50%);

  width: 3.5666rem;
  height: 4.66rem;

  background-size: 100% 100%;
  background-repeat: no-repeat;
}

.slogan-white {
  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/slogan-white.png');
}

.slogan-red {
  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/slogan-red.png');
}

/* ============================================================
   五、Logo
   ============================================================ */

.index-logo {
  position: absolute;
  top: 7.2rem;
  left: 50%;
  transform: translateX(-50%);

  width: 0.62rem;
  height: 0.6266rem;

  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/logo.jpg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

/* ============================================================
   六、第一页：选择照片入口
   ============================================================ */

.get-photo {
  position: absolute;
  top: 2.6rem;
  left: 50%;
  transform: translateX(-50%);

  width: 2.5666rem;
  height: 3.46rem;

  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/get-photo.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

/* ============================================================
   七、第二页：照片容器
   ============================================================ */

.photo-container {
  position: absolute;
  top: 2.6rem;
  left: 50%;
  transform: translateX(-50%);

  width: 2.5666rem;
  aspect-ratio: 3 / 4;

  overflow: hidden;
  background-color: transparent;
}

.photo-container img {
  display: block;

  width: 100%;
  height: 100%;

  object-fit: cover;
  object-position: center;
}

/* ============================================================
   八、长按保存提示
   ============================================================ */

.tips {
  position: absolute;
  top: 8.2rem;
  left: 50%;
  transform: translateX(-50%);

  width: 1.1866rem;
  height: 0.19333rem;

  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/tips.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;

  pointer-events: none;
}

/* ============================================================
   九、底部声明
   ============================================================ */

.statement {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);

  width: 3.96rem;
  height: 0.19333rem;

  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/privacy.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

/* ============================================================
   十、处理中提示层
   ============================================================

   类似 Toast 的半透明提示框。
   不拦截页面交互，也不会进入最终合成图片。
   */

.processing-mask {
  position: fixed;
  inset: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  z-index: 9999;
  pointer-events: none;
}

.processing-toast {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 0.2rem;
  min-width: 1.8rem;
  padding: 0.3rem;

  box-sizing: border-box;

  color: #ffffff;
  font-size: 0.22rem;

  background: rgba(0, 0, 0, 0.72);
  border-radius: 0.12rem;
}

/* 旋转加载动画 */
.loading-spinner {
  display: block;

  width: 0.36rem;
  height: 0.36rem;

  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  border-radius: 50%;

  animation: loading-rotate 0.8s linear infinite;
}

@keyframes loading-rotate {
  to {
    transform: rotate(360deg);
  }
}

/* ============================================================
   十一、海报生成后的长按保存提示
   ============================================================

   放在 page-body 外部，因此不会被 Canvas 绘制。
   位置仍然使用 top: 8.2rem，和原页面保持一致。
   */

.save-tip {
  position: fixed;
  top: 8.2rem;
  left: 0;

  width: 100%;
  height: 0.19333rem;

  display: flex;
  justify-content: center;
  align-items: center;

  z-index: 100;
  pointer-events: none;
}

.save-tip .tips {
  position: relative;
  top: auto;
  left: auto;

  width: 1.1866rem;
  height: 0.19333rem;

  margin: 0;
  transform: none;

  background-image: url('https://www.mbcstyle.cn/projects/static/lego2026ugc/tips.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
</style>
