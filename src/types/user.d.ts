


// 用户信息
export type UserInfo = {
    auth_code?: stirng;
    user_id?: string;
    qr_code?: string;
    draw_status?: boolean;
    draw_time?: boolean | string;
    verify_status?: boolean;
    flow_status?: string;
    nick_name?: string;
    avatar?: string;
    join_time?: string;

}

// 请求抽奖
export type RequestDraw = {
    user_id: string;
    // withdraw_type?: '1' | '2';
}

// 抽奖结果
export type ResposeDraw = {
    draw_result: boolean
    lucky_num: number;

}

// 已核销中奖人数
export type LuckyNum = {
    lucky_num: number;
}

// 核销结果
export type CheckResult = {
    check_status?: boolean;
    check_status_msg?: string;
    check_num?: number;
}