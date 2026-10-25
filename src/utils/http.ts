// axios基础的封装
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { useRouter } from 'vue-router' // 带r的是调用方法，不带r的是获取参数 
import router from '@/router' // 注意：useRouter只能在vue里用，不能在其它js里用

const httpInstance: AxiosInstance = axios.create({
    baseURL: 'https://www.mbcstyle.cn/api/ciie2026lego/',
    // baseURL: 'http://127.0.0.1:8000/api/ciie2025lego/',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json', // 确保设置 Content-Type 为 application/json
    }
})

// 拦截器
// axios请求拦截器
httpInstance.interceptors.request.use(config => {
    /* 
    // 1. 从pinia中获取token数据
    const userStore = useUserStore()
    // 2. 按照后端的要求拼接token数据
    console.log(userStore.userInfo)
    const token = userStore.userInfo.token
    if (token) {
        config.headers.Authorization = `Bearer ${token}` // 根据后端的API文档进行拼接
    }
    */
    return config
}, e => Promise.reject(e))

// 定义一个接口来表示希望返回的类型
export interface ResponseData<T> {
    errcode: number;
    errmsg: string;
    data?: T;
}

// axios 响应拦截器
httpInstance.interceptors.response.use(
    (response: AxiosResponse<ResponseData<any>>) => {
        return response; // 返回完整的响应对象
    },
    (error) => {
        return Promise.reject(error);
    }
);

// // axios响应式拦截器
// httpInstance.interceptors.response.use(res => res.data, e => {
//     /* 
//     const userStore = useUserStore()
//     // const router = useRouter()    // vue3不能在setup外使用useRouter
//     // 统一错误提示
//     ElMessage({
//         type: 'warning',
//         message: e.response.data.message
//     })
//     // 401token失效处理
//     // 1. 清除本地用户数据
//     // 2. 跳转到登录页
//     if (e.response.status === 401) {
//         userStore.clearUserInfo()
//         router.push('/login')
//     }
//     */
//     return Promise.reject(e)
// })

// 微信生态相关的http
const wechatHttp = axios.create({
    baseURL: 'https://www.mbcstyle.cn/api/wechat',
    // baseURL: 'http://127.0.0.1:8000/api/wechat',
    timeout: 5000,
    headers: {
        'Content-type': 'application/x-www-form-urlencoded'
    }
})

export { httpInstance, wechatHttp }