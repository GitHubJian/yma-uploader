import Upload from './upload';
import Download from './download';

const components = [Upload, Download];

const install = function (Vue) {
    components.forEach(Component => {
        Vue.component(Component.name, Component);
    });
};

export default {
    install,
    Upload,
    Download,
};
