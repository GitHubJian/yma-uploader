<template>
    <div>
        <button @click="handleClick">点我</button>

        <input class="yma-upload__input" ref="input" id="upload" type="file" />

        <div ref="upload" class="upload"></div>

        <div v-for="(file, id) in files">
            <div :key="id">
                {{ file.fileName }}
                progress:
                {{
                    file.isCompleted
                        ? 100
                        : Math.floor(file.progress() * 100 || 0)
                }}
            </div>
        </div>
    </div>
</template>

<script>
import Uploader from '../../../../../src';

export default {
    data() {
        const uploader = new Uploader({
            url: 'http://127.0.0.1:3000/upload',
            minFileSize: undefined,
            testChunks: false,
            chunkSize: 10 * 1024,
            mergeUrl: 'http://127.0.0.1:3000/merge',
            precheckChunk: false,
            precheckChunkUrl: 'http://127.0.0.1:3000/precheck',
        });

        return {
            uploader: Object.freeze(uploader),
            files: [],
        };
    },
    mounted() {
        const that = this;

        that.uploader.bindInput(this.$refs.upload);

        that.uploader.on('file-added', function (file) {
            that.files.push(file);

            file.upload();
        });

        that.uploader.on('file-chunk-precheck', function (chunk) {
            console.log(chunk);
        });

        that.uploader.on('file-chunk-prechecked', function (chunk, status) {
            console.log(status);
        });

        that.uploader.on('file-success', function (file) {
            file.merge();
        });

        that.uploader.on('file-merged', function (file) {
            console.log(file);
        });
    },
    methods: {
        handleClick() {
            this.$refs.input.click();
        },
        handleFileChange(e) {
            var files = e.target.files;
            this.uploader.addFiles(Object.values(files));
            // this.uploader.addFile(file);
            this.uploader.upload();
        },
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
