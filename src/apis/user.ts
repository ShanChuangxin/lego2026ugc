import { httpInstance, wechatHttp } from "../utils/http"
import type { ResponseType } from "@/types/http"
import type { WechatJsConfig } from "@/types/wechat"
import { AxiosResponse } from "axios";
import type { UserInfo, RequestDraw, ResposeDraw, LuckyNum, CheckResult } from "@/types/user";

// 获取用户信息
// export const getUserInfoAPI = (data: UserInfo) => {
//     return httpInstance<ResponseType<UserInfo>>({
//         url: 'get_user_info',
//         method: 'POST',
//         data
//     })
// }

// // 抽奖接口
// export const withdrawAPI = (data: RequestDraw) => {
//     return httpInstance<ResponseType<ResposeDraw>>
// }

// // 核销奖品
// export const checkPrizeAPI = (data: string) => {
//     return httpInstance<ResponseType<CheckResult>>({
//         url: 'check_prize',
//         method: 'POST',
//         data
//     })
// }

// 获取用户信息
export const getUserInfoAPI = (data: UserInfo): Promise<AxiosResponse<ResponseType<UserInfo>>> => {
    return httpInstance.post<ResponseType<UserInfo>>('get_user_info', data);
}

// 获取cos的Token
export const getCosUploadTokenAPI = (data: { "extension": string }): Promise<AxiosResponse<ResponseType<UserInfo>>> => {
    return httpInstance.post<ResponseType<UserInfo>>('get_cos_upload_token', data);
}

// 上传UGC原照片的链接到服务器
export const updateUgcAPI = (data: { user_id: string, photo_url: string }): Promise<AxiosResponse<ResponseType<ResposeDraw>>> => {
    return httpInstance.post<ResponseType<ResposeDraw>>('update_ugc', data);
}

// 抽奖接口
export const withdrawAPI = (data: RequestDraw): Promise<AxiosResponse<ResponseType<ResposeDraw>>> => {
    return httpInstance.post<ResponseType<ResposeDraw>>('withdraw', data); // 添加 URL
}

// 微信jssdk配置接口
export const wechatConfigAPI = (data: { url: string }): Promise<AxiosResponse<ResponseType<WechatJsConfig>>> => {
    return wechatHttp.post<ResponseType<WechatJsConfig>>('h5_share', data); // 添加 URL
}

// 获取核销成功人数
export const getLuckyNumAPI = (): Promise<AxiosResponse<ResponseType<LuckyNum>>> => {
    return httpInstance.post<ResponseType<LuckyNum>>('get_lucky_num')
}

// 核销奖品
export const checkPrizeAPI = (data: { qr_code: string }): Promise<AxiosResponse<ResponseType<CheckResult>>> => {
    return httpInstance.post<ResponseType<CheckResult>>('check_prize', data);
}

// debug接口
// 清除用户抽奖信息
export const clearDrawInfoAPI = (data: UserInfo): Promise<AxiosResponse<ResponseType<CheckResult>>> => {
    return httpInstance.post<ResponseType<CheckResult>>('clear_draw_info', data);
}
