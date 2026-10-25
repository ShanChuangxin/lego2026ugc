
// 返回值信息
export type ResponseType<T> = {
    errcode: number;
    errmsg: string;
    data?: T
}

// src/utils/http.d.ts
declare const httpInstance: any; // 根据实际类型修改
export default httpInstance;
