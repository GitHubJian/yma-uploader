import Main from './main.vue';
import '../icon/plugin';

Main.install = function (Vue) {
    Vue.component(Main.name, Main);
};

export default Main;
