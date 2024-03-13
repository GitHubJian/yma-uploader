<template>
    <yma-link iconName="doc_export" text="导出" @click="handleClick"></yma-link>
</template>

<script>
import YmaLink from '../link';
import excel from '../../src/excel';

export default {
    name: 'YmaExcel',
    components: {
        YmaLink,
    },
    props: {
        transport: {
            type: Function,
            required: true,
            default: () => {},
        },
    },
    data() {
        return {};
    },
    methods: {
        handleClick(e) {
            return this.transport(function (data, headers, options) {
                return excel(data, headers, options);
            });
        },
    },
};
</script>
