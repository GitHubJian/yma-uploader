<template>
    <div>
        <yma-upload
            :upload-options="{
                url: 'http://127.0.0.1:3000/upload',
                chunkSize: 10 * 1024,
                mergeUrl: 'http://127.0.0.1:3000/merge',
                precheckChunk: false,
                precheckChunkUrl: 'http://127.0.0.1:3000/precheck',
                autoMerge: true,
            }"
        />

        <yma-download
            url="http://img.zcool.cn/community/037b68f58cf359ba801219c77cdb30d.jpg"
            filename="test.jpg"
        />
    </div>
</template>

<script>
export default {
    components: {},
    data() {
        return {};
    },
    mounted() {},
    methods: {},
};
</script>

<style lang="scss">
.yma-upload__input {
    // display: none;
}

.upload {
    width: 300px;
    height: 300px;
    border: 1px solid red;
}
</style>
