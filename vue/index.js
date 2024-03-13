import Upload from './upload';
import Download from './download';
import Excel from './excel';

const components = [Upload, Download, Excel];

const install = function (Vue) {
    components.forEach(Component => {
        Vue.component(Component.name, Component);
    });
};

export default {
    install,
    Upload,
    Download,
    Excel,
};
