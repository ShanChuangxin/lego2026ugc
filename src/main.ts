import './assets/main.css'
import 'vant/lib/index.css';

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vant from 'vant'
import VConsole from 'vconsole';

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Vant)
const vConsole = new VConsole()
app.use(vConsole as any)

app.mount('#app')
