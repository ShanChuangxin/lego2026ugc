// 微信js配置返回值
export type WechatJsConfig = {
    appId: string;
    timestamp: number;
    nonceStr: string;
    signature: string;
    jsApiList: string[];
}