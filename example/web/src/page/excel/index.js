import '@/lib/util/reset.css';

import Vue from 'vue';
import App from './app.vue';

import udfiler from '../../../../../vue';
Vue.use(udfiler);

new Vue({
    render: h => h(App),
}).$mount('#app');
