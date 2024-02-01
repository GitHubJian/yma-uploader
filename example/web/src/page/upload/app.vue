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
    </div>
</template>

<script>
export default {
    components: {},
    data() {
        return {};
    },
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
