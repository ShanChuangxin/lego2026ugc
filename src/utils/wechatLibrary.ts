// 微信生态相关的库
import wx from "weixin-js-sdk"
import { wechatConfigAPI } from '@/apis/user' // 注意这个API可能会随着工程不同，进行配置
import { Toast } from 'vant'


// 配置微信分享链接
// 注意这个被改造为需要传页面地址(而不是自动获取当前页面的地址)
const configWechatShare = async (logo, title, description, realAuthUrl) => {
    console.log("配置微信分享链接")
    // 1. 从服务器获取分享配置信息
    const url = window.location.href;
    //const res = await getShareConfigAPI("https://plmirror.porsche.cn/projects")
    console.log(url)
    const res = await wechatConfigAPI({ url })
    console.log(res)

    // 2. 配置分享logo、标题、文案
    // const share_link = window.location.href + Math.random();
    // const share_link = window.location.href;
    const share_link = realAuthUrl;
    // 配置好友分享信息
    // const share_friend_logo = 'https://plmirror.porsche.cn/projects/h5booth/images/waic2024/shareh5.jpg';
    // const share_friend_title = '您的朋友给您发了条消息';
    // const share_friend_des = '快来帮帮忙，您的选择就是我最好的决定！';
    const share_friend_logo = logo;
    const share_friend_title = title;
    const share_friend_des = description;
    // 配置朋友圈分享信息。一般情况下都是统一的，也可以不一样
    const share_moments_logo = share_friend_logo;
    const share_moments_title = share_friend_title;

    wx.config({
        debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
        appId: res.data.data.appId, // 必填，公众号的唯一标识
        timestamp: res.data.data.timestamp, // 必填，生成签名的时间戳
        nonceStr: res.data.data.nonceStr, // 必填，生成签名的随机串
        signature: res.data.data.signature,// 必填，签名
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'hideOptionMenu', 'showOptionMenu', 'showMenuItems', 'hideMenuItems'],
        // jsApiList: res.jsApiList, // 必填，需要使用的JS接口列表
        openTagList: ['wx-open-launch-weapp', 'wx-open-launch-app'],
    });
    wx.ready(function () {

        // 隐藏底部导航条？
        // wx.hideMenuItems({
        //     menuList: ['menuItem:bottomNavigation'],
        //     success: function () {
        //         console.log('Successfully hide bottom navigation');
        //     },
        //     fail: function (res) {
        //         console.error('Failed to hide bottom navigation', res);
        //     },
        // });

        // 1 判断当前版本是否支持指定 JS 接口，支持批量判断
        wx.checkJsApi({
            jsApiList: [
                'updateAppMessageShareData',//朋友、QQ
                'updateTimelineShareData',//朋友圈、QQ空间
            ],
            success: function (res) {
                console.log("checkJsAPI成功");
                console.log(res);
            }
        });
        wx.error(function (res) {
            console.log("config信息验证失败");
            console.log(res);
            // config信息验证失败会执行error函数，如签名过期导致验证失败，具体错误信息可以打开config的debug模式查看，也可以在返回的res参数中查看，对于SPA可以在这里更新签名。
        });

        console.log('当前配置的分享地址为：', share_link)

        // 分享朋友,QQ
        wx.updateAppMessageShareData({
            title: share_friend_title, // 分享标题
            desc: share_friend_des,//分享描述
            link: share_link, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
            imgUrl: share_friend_logo, // 分享图标
            success: function () { console.log('好友分享配置成功') },
            fail: function (res) { console.log(res) },
        });
        // 分享朋友圈,QQ空间
        wx.updateTimelineShareData({
            title: share_moments_title, // 分享标题
            link: share_link, // 分享链接，该链接域名或路径必须与当前页面对应的公众号JS安全域名一致
            imgUrl: share_moments_logo, // 分享图标
            success: function () { console.log('朋友圈分享配置成功') }
        });
    })
}

// 唤起微信扫一扫
const wechatScan = async (successFunction) => {
    // 1. 从服务器中获取配置信息
    const url = window.location.href
    const res = await wechatConfigAPI({ url })
    console.log(res)
    if (res.data.errcode != 0)
        return Toast("微信jssdk配置失败")
    // 2. 配置扫描信息
    wx.config({
        debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
        appId: res.data.data.appId, // 必填，公众号的唯一标识
        timestamp: res.data.data.timestamp, // 必填，生成签名的时间戳
        nonceStr: res.data.data.nonceStr, // 必填，生成签名的随机串
        signature: res.data.data.signature,// 必填，签名
        jsApiList: ['scanQRCode'],
        // jsApiList: res.jsApiList, // 必填，需要使用的JS接口列表
        openTagList: ['wx-open-launch-weapp', 'wx-open-launch-app'],
    });
    // 3. 调起微信扫一扫
    wx.ready(function () {
        wx.scanQRCode({
            needResult: 1, // 默认为0，扫描结果由微信处理，1则直接返回扫描结果，
            scanType: ["qrCode", "barCode"], // 可以指定扫二维码还是一维码，默认二者都有
            success: function (res) {
                var result = res.resultStr; // 当needResult 为 1 时，扫码返回的结果
                console.log("扫描结果：", result)

                successFunction({ qr_code: result })
            },
            fail: (err) => {
                console.log("扫描动作错误：", err)
            }
        });
    })
}

// 配置H5跳转微信小程序
const configH5ToMp = async () => {
    console.log("配置H5跳转小程序")
    const url = window.location.href
    const res = await wechatConfigAPI({ url })
    console.log("服务器校验信息：", res)

    wx.config({
        debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
        appId: res.data.data.appId, // 必填，公众号的唯一标识
        timestamp: res.data.data.timestamp, // 必填，生成签名的时间戳
        nonceStr: res.data.data.nonceStr, // 必填，生成签名的随机串
        signature: res.data.data.signature,// 必填，签名
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'hideOptionMenu', 'showOptionMenu', 'showMenuItems', 'hideMenuItems'],
        // jsApiList: res.jsApiList, // 必填，需要使用的JS接口列表
        openTagList: ['wx-open-launch-weapp', 'wx-open-launch-app'],
    });
    wx.ready(function () {
        console.log("wx.ready")
    })
    wx.error(function (res) {
        console.log("config信息验证失败");
        console.log(res);
    })
}


// 导出
export {
    configWechatShare, wechatScan, configH5ToMp
}