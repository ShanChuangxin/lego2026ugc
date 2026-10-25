interface ImportMetaEnv {
    BASE_URL: string; // 添加你需要的环境变量
    // 其他环境变量
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
