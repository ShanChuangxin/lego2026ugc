<script setup lang="ts">
import { ref, onMounted } from 'vue'
// import { wechatScan } from '@/utils/wechatLibrary';
import { initWechatJSSDK, scanQRCode } from '@/utils/wechatScan'
import { getLuckyNumAPI, checkPrizeAPI } from '@/apis/user'
import { Toast } from 'vant'
// 定义页面
const pageNum = ref(0)

// 扫描结果控制
const checkNum = ref(0) // 核销人数
const isCorrect = ref(true)    // 是否核销成功
const checkPrizeData = async (data) => {
    console.log("data:", data)
    const res = await checkPrizeAPI(data)
    console.log("获取到校验二维码的数据: ", res)
    if (0 == res.data.errcode) {
        checkNum.value = res.data.data.check_num
        pageNum.value = 1
        isCorrect.value = res.data.data.check_status
        if (!res.data.data.check_status){
            Toast(res.data.data.check_status_msg);
        }
    }
}

// 扫描功能相关
const scanning = ref(false)
/**
 * 页面初始化时，只初始化一次微信 JSSDK
 */
onMounted(async () => {
  try {
    await initWechatJSSDK(['scanQRCode'])
    console.log('微信 JSSDK 初始化完成')
  } catch (err) {
    console.error(err)
    Toast('微信初始化失败')
  }
})
async function scanQrCode() {
    if (scanning.value) {
        Toast("调起扫描中..");
        return;
    }
    scanning.value = true;
    try {
        const result = await scanQRCode();
        console.log('扫码结果:', result);

        const res = await checkPrizeAPI({ qr_code: result });
        // pageNum.value = 1;

        if (res.data.errcode === 0) {
            checkNum.value = res.data.data.check_num
            pageNum.value = 1
            isCorrect.value = res.data.data.check_status
            if (!res.data.data.check_status){
                Toast(res.data.data.check_status_msg);
            }
        } 
    } catch (err) {
        console.log('扫码取消或失败:', err);
    } finally {
        scanning.value = false;
    }

    // console.log("调起扫描")
    // const res = await wechatScan(checkPrizeData)
    // // if (0 == res.errcode) {
    // //     pageNum.value = 1
    // //     console.log(res.result)
    // // } else {
    // //     console.log(res.errmsg)
    // // }
    // console.log("扫描动作完成")
}

// 回到主页
function backIndex() {
    isCorrect.value = false
    pageNum.value = 0
}

// 获取已核销的中奖人数
const getLuckyNum = async () => {
    const res = await getLuckyNumAPI();
    console.log(res);
    if (res.data.errcode == 0){
        checkNum.value = res.data.data.lucky_num
    }
}
onMounted(() => getLuckyNum())

</script>

<template>
    <div class="page-body">
        <!-- 通用内容 -->
        <div class="index-logo"></div>
        <div class="slogan-cn"></div>
        <div class="slogan-en"></div>
        <div class="statement"></div>

        <!-- 扫描主界面 -->
        <div class="check-index" v-show="pageNum == 0">
            <div class="scan-container">
                <div class="scan-icon" @click="scanQrCode()"></div>
                <div class="scan-btn" @click="scanQrCode()"></div>
                <div class="check-num">已核销人数：{{ checkNum }}</div>
            </div>
        </div>
        <!-- 扫描结果页面 -->
        <div class="check-result" v-show="pageNum == 1">
            <!-- 中奖界面 -->
            <div class="status-correct" v-show="isCorrect" @click="backIndex">
                <!-- <div class="icon-bg" @click="backIndex">
                    <div class="icon"></div>
                </div>
                <div class="index-btn" @click="backIndex"></div> -->
            </div>
            <!-- 未中奖界面 -->
            <div class="status-error" v-show="!isCorrect" @click="backIndex">
                <!-- <div class="icon-bg"  @click="backIndex">
                    <div class="icon"></div>
                </div>
                <div class="index-btn" @click="backIndex"></div> -->
            </div>

        </div>
    </div>
</template>

<style lang="scss" scoped>
.page-body {
    // 通用页面
    position: absolute;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    // background: url("https://www.mbcstyle.cn/projects/lego/2025/images/bg.jpg") top center no-repeat;
    // background-size: cover;
    background-color: black;

    // logo加主题
    .index-logo {
        margin: .4rem 0 0 .4rem;
        width: .62rem;
        height: .6266rem;
        background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/logo.jpg") top center no-repeat;
        background-size: 100% 100%;
    }

    // 游戏主题
    .slogan-cn {
        position: absolute;
        top: 1.2rem;
        margin-left: 50%;
        transform: translateX(-50%);
        width: .6933rem;
        height: .7666rem;
        background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/slogan-cn.png") top center no-repeat;
        background-size: 100% 100%;
    }
    // .slogan-en {
    //         position: absolute;
    //         top: 2.2rem;
    //         margin-left: 50%;
    //         transform: translateX(-50%);
    //         width: 2.8266rem;
    //         height: 3.6933rem;
    //         background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/slogan-en.png") top center no-repeat;
    //         background-size: 100% 100%;
    //         z-index: 1;
    // }
    // /* 黑色半透明遮罩 */
    // .slogan-en::after {
    //     content: "";
    //     position: absolute;
    //     top: 0;
    //     left: 0;
    //     width: 100%;
    //     height: 100%;
    //     background: rgba(0, 0, 0, 0.6);
    // }
    .slogan-en {
        position: absolute;
        top: 2.2rem;
        left: 50%;
        transform: translateX(-50%);
        width: 2.8266rem;
        height: 3.6933rem;

        background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/slogan-en.png")
            top center no-repeat;
        background-size: 100% 100%;

        /* 限制内部层叠 */
        isolation: isolate;
        z-index: 0;
    }

    .slogan-en::after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: -1;
    }

    // 免责声明
    .statement {
        position: absolute;
        bottom: .5rem;
        margin-left: 50%;
        transform: translateX(-50%);
        width: 3.96rem;
        height: .19333rem;
        background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/privacy.png") top center no-repeat;
        background-size: 100% 100%;
    }

    // 调起扫码页面
    .check-index {
        .scan-container {
            margin-top: 2rem;
            margin-left: 50%;
            transform: translateX(-50%);

            width: 3.2rem;
            height: 4.6rem;
            // background-color: pink;

            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;

            .scan-icon {
                width: 2.04rem;
                height: 2.04rem;
                background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/扫描-icon.png") top center no-repeat;
                background-size: 100% 100%;
            }

            .scan-btn {
                width: 2.0666rem;
                height: .7466rem;
                background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/扫描-按钮.png") top center no-repeat;
                background-size: 100% 100%;
            }
            .check-num {
                // position: relative;
                // background-color: blue;
                width: 4rem;
                height: .4rem;
                // padding-left: 1.55rem;
                text-align: center;
                line-height: .4rem;
                font-size: .24rem;
                font-weight: 700;
                // color: #762a54;
                color: rgb(203, 51, 46);
            }
            // .check-num::before {
            //     content: '';
            //     position: absolute;
            //     top: 50%;
            //     left: .2rem;
            //     transform: translateY(-50%);
            //     width: 1.2666rem;
            //     height: .2466rem;
            //     background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/check-num-none.png") top center no-repeat;
            //     background-size: 100% 100%;
            // }
        }
    }

    // 扫码结果页面
    .check-result {
        // margin-top: 4rem;
        // margin-left: 50%;
        // transform: translateX(-50%);
        position: relative;
        margin: 2.2rem auto 0;
        width: 2.7066rem;
        height: 2.5066rem;
        // background-color: pink;
        z-index: 2;

        // 核销成功
        .status-correct {
            // width: 100%;
            // height: 100%;
            // display: flex;
            // flex-direction: column;
            // justify-content: center;
            // align-items: center;
            width: 2.7066rem;
            height: 2.5066rem;
            background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/核销成功.png") center no-repeat;
            background-size: 100% 100%;

            // .icon-bg {
            //     width: 1.6333rem;
            //     height: 1.6333rem;
            //     background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/bg-result.png") center no-repeat;
            //     background-size: 100% 100%;
            //     display: flex;
            //     justify-content: center;
            //     align-items: center;
            //     .icon {
            //         width: .6rem;
            //         height: .4rem;
            //         background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/icon-correct.png") top center no-repeat;
            //         background-size: 100% 100%;
            //     }
            // }
            // .index-btn {
            //     width: 2.7066rem;
            //     height: .5866rem;
            //     background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/btn-success.png") top center no-repeat;
            //     background-size: 100% 100%;
            // }
        }

        // 核销失败
        .status-error {
            // width: 100%;
            // height: 100%;
            // display: flex;
            // flex-direction: column;
            // justify-content: space-between;
            // align-items: center;
            width: 2.7066rem;
            height: 2.5066rem;
            background: url("https://www.mbcstyle.cn/projects/static/ciie2026lego/核销失败.png") center no-repeat;
            background-size: 100% 100%;

            // .icon-bg {
            //     width: 1.6333rem;
            //     height: 1.6333rem;
            //     background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/bg-result.png") center no-repeat;
            //     background-size: 100% 100%;
            //     display: flex;
            //     justify-content: center;
            //     align-items: center;
            //     .icon {
            //         width: .6666rem;
            //         height: .6666rem;
            //         background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/icon-error.png") top center no-repeat;
            //         background-size: 100% 100%;
            //     }
            // }
            // .index-btn {
            //     width: 2.7066rem;
            //     height: .5866rem;
            //     background: url("https://www.mbcstyle.cn/projects/lego/2025/images/check/btn-error.png") top center no-repeat;
            //     background-size: 100% 100%;
            // }
        }
    }
}
</style>