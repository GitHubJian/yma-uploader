<template>
    <yma-excel :transport="transport"></yma-excel>
</template>

<script>
function nextTick(fn, delay = 1000) {
    setTimeout(fn, delay);
}

export default {
    data() {
        return {};
    },
    methods: {
        transport(callback) {
            const data = [
                {
                    orderid: '1',
                    name: 'xws',
                },
                {
                    orderid: '2',
                    name: 'xws',
                },
            ];

            const headers = [
                ['orderid', '订单编号'],
                ['name', '姓名'],
            ];

            const options = {
                sheetname: 'sheet',
                filename: '授权详情.xlsx',
            };

            nextTick(function () {
                callback(data, headers, options);
            });
        },
    },
};
</script>
