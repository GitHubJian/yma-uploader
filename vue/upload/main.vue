<template>
    <div class="yma-upload">
        <div ref="inputRef" class="yma-upload-zone">
            <div class="yma-upload-zone__tip">
                <div class="yma-upload-zone__icon">
                    <yma-icon name="symbol_cross" />
                </div>
                <div class="yma-upload-zone__title">拖拽文件到此处进行上传</div>
            </div>
        </div>

        <div class="yma-upload-process">
            <div
                v-if="uploadFilesList.length !== 0"
                class="yma-upload-process__inner"
            >
                <div class="yma-upload-process__header">
                    <div class="yma-upload-process__header-left">
                        <span class="yma-upload__icon">
                            <yma-icon name="doc_upload_flat" />
                        </span>
                        <span class="yma-vertical-top"> 上传总进度 </span>
                    </div>

                    <div class="yma-upload-process__header-main">
                        <yma-process :percentage="percentage" />
                    </div>

                    <div class="yma-upload-process__header-right">
                        <!-- Hash 添加 -->
                        <span
                            v-if="status === UPLOAD_STATUS.beforeReady"
                            class="yma-upload__icon"
                        >
                            <yma-icon name="loading_ai" />
                        </span>

                        <!-- Start 按钮-->
                        <span
                            v-if="
                                [
                                    UPLOAD_STATUS.ready,
                                    UPLOAD_STATUS.pause,
                                ].includes(status)
                            "
                            :class="{
                                'yma-upload__icon': true,
                                'yma-upload__icon--disabled':
                                    status == UPLOAD_STATUS.uploaded,
                            }"
                            @click="handleUploadAllClick()"
                            title="开始"
                        >
                            <yma-icon name="play_two" />
                        </span>

                        <!-- Pause 按钮-->
                        <span
                            v-if="status === UPLOAD_STATUS.uploading"
                            class="yma-upload__icon"
                            @click="handlePauseAllClick()"
                            title="暂停"
                        >
                            <yma-icon name="pause_normal" />
                        </span>

                        <!-- Merge 按钮-->
                        <span
                            v-if="status === UPLOAD_STATUS.uploaded"
                            class="yma-upload__icon"
                            @click="handleMergeAllClick()"
                            title="合并"
                        >
                            <yma-icon name="merge" />
                        </span>

                        <!-- Merging Icon -->
                        <span
                            v-if="status === UPLOAD_STATUS.merging"
                            class="yma-upload__icon yma-upload__icon--disabled"
                            title="合并中"
                        >
                            <yma-icon name="doc_merge" />
                        </span>

                        <!-- Completed 完成 -->
                        <span
                            v-if="status === UPLOAD_STATUS.completed"
                            class="yma-upload__icon yma-upload__icon--normal"
                            title="完成"
                        >
                            <yma-icon name="success_normal" />
                        </span>

                        <span
                            class="yma-upload__icon"
                            @click="handleRemoveAllClick"
                            title="移除"
                        >
                            <yma-icon name="trash_can" />
                        </span>
                    </div>
                </div>

                <div class="yma-hr">
                    <div class="yma-hr__inner"></div>
                </div>

                <div class="yma-upload-files">
                    <yma-scrollbar
                        :options="{
                            outerYEnabled: true,
                        }"
                    >
                        <div class="yma-scrollbar_inner">
                            <div
                                v-for="(file, id) in uploadFilesList"
                                :key="id"
                                class="yma-upload-files__file"
                            >
                                <div class="yma-upload-files__file-icon">
                                    <yma-icon name="archive_format_s" />
                                </div>
                                <div
                                    class="yma-upload-files__file-name"
                                    :title="file.fileName"
                                >
                                    {{ file.fileName }}
                                </div>
                                <div class="yma-upload-files__file-size">
                                    {{ file.fileFormatSize }}
                                </div>
                                <div class="yma-upload-files__file-process">
                                    <yma-process :percentage="file.progress" />
                                </div>
                                <div class="yma-upload-files__file-opts">
                                    <!-- Hash 按钮-->
                                    <span
                                        v-if="
                                            file.status ===
                                            UPLOAD_FILE_STATUS.beforeReady
                                        "
                                        class="yma-upload__icon"
                                    >
                                        <yma-icon name="loading_ai" />
                                    </span>

                                    <!-- Start 按钮-->
                                    <span
                                        v-if="
                                            [
                                                UPLOAD_FILE_STATUS.ready,
                                                UPLOAD_FILE_STATUS.pause,
                                            ].includes(file.status)
                                        "
                                        :class="{
                                            'yma-upload__icon': true,
                                            'yma-upload__icon--disabled':
                                                file.status ==
                                                UPLOAD_FILE_STATUS.uploaded,
                                        }"
                                        @click="handleUploadClick(file)"
                                    >
                                        <yma-icon name="play_two" />
                                    </span>

                                    <!-- Pause 按钮-->
                                    <span
                                        v-if="
                                            file.status ===
                                            UPLOAD_FILE_STATUS.uploading
                                        "
                                        class="yma-upload__icon"
                                        @click="handlePauseClick(file)"
                                    >
                                        <yma-icon name="pause_normal" />
                                    </span>

                                    <!-- Merge 按钮-->
                                    <span
                                        v-if="
                                            UPLOAD_FILE_STATUS.uploaded ===
                                            file.status
                                        "
                                        class="yma-upload__icon"
                                        @click="handleMergeClick(file)"
                                    >
                                        <yma-icon name="merge" />
                                    </span>

                                    <!-- Merging Icon -->
                                    <span
                                        v-if="
                                            UPLOAD_FILE_STATUS.merging ===
                                            file.status
                                        "
                                        class="yma-upload__icon yma-upload__icon--disabled"
                                    >
                                        <yma-icon name="doc_merge" />
                                    </span>

                                    <!-- Completed 完成 -->
                                    <span
                                        v-if="
                                            UPLOAD_FILE_STATUS.completed ===
                                            file.status
                                        "
                                        class="yma-upload__icon yma-upload__icon--normal"
                                    >
                                        <yma-icon name="success_normal" />
                                    </span>

                                    <span
                                        class="yma-upload__icon"
                                        @click="handleRemoveClick(file)"
                                    >
                                        <yma-icon name="trash_can" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </yma-scrollbar>
                </div>
            </div>

            <div v-else class="yma-upload-process__empty">
                <div class="yma-upload-process__empty-content">
                    <yma-icon
                        name="blank_contents_two_empty"
                        size="60px"
                    ></yma-icon>

                    <div>上传文件列表为空</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {Uploader} from '../../src';
import YmaIcon from '../icon';
import YmaProcess from '../process';
import YmaScrollbar from 'yma-scrollbar/vue';

export default {
    name: 'YmaUpload',
    components: {
        YmaIcon,
        YmaProcess,
        YmaScrollbar,
    },
    props: {
        uploadOptions: {
            type: Object,
            default: () => {},
        },
        customQuery: {
            type: Object,
            default: () => {},
        },
        tokenInvalidCodes: {
            type: Array,
            default: () => ['404'],
        },
        tokenInvalidCallback: {
            type: Function,
            default: () => {},
        },
        updateStatusHandler: {
            type: Function,
            default: (status) => {},
        }
    },
    data() {
        const that = this;

        const uploader = new Uploader({
            ...this.uploadOptions,
            query: this.customQuery,
        });

        uploader.on('filesize-min-error', function (file, count) {
            console.log(file);
        });

        uploader.on('added', function (ctx) {
            that.status = ctx._status;

            that.updateStatusHandler(that.status);
        });

        uploader.on('before-upload', function (ctx) {
            that.status = ctx._status;

            that.updateStatusHandler(that.status);
        });

        uploader.on('paused', function (ctx) {
            that.status = ctx._status;

            that.updateStatusHandler(that.status);
        });

        // 监控全局上传进度
        uploader.on('progress', function (uploader) {
            that.percentage = Math.floor(uploader.progress() * 100 || 0);
        });

        uploader.on('uploaded', function (ctx) {
            that.status = ctx._status;

            that.updateStatusHandler(that.status);
        });

        uploader.on('completed', function (ctx) {
            that.status = ctx._status;

            that.updateStatusHandler(that.status);
        });

        uploader.on('removed', function (uploader) {
            that.uploadFilesList = [];
            that.percentage = 0;
        });

        uploader.on('file-before-add', function (ctx, uploadFile) {
            that.status = ctx._status;

            const newUploadFile = {
                id: uploadFile.id,
                fileName: uploadFile.fileName,
                fileFormatSize: uploadFile.fileFormatSize,

                pause: uploadFile._pause,

                status: uploadFile.getStatus(),

                progress: 0,

                uploadFile: uploadFile,
            };

            that.uploadFilesList.push(newUploadFile);
        });

        uploader.on('file-added', function (ctx, uploadFile) {
            that.status = ctx._status;

            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });

            that.percentage = Math.floor(ctx.progress() * 100 || 0);
        });

        uploader.on('file-before-upload', function (uploadFile) {
            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });
        });

        uploader.on('file-progress', function (uploadFile) {
            that.update(uploadFile, {
                progress: Math.floor(uploadFile.progress() * 100 || 0),
            });
        });

        uploader.on('file-error', function (uploadFile, messageJson) {
            if (messageJson) {
                let message = JSON.parse(messageJson);
                if (that.tokenInvalidCodes.indexOf(message.code) > -1) {
                    that.tokenInvalidCallback(message.code);
                }
            }
        });

        uploader.on('file-uploaded', function (uploadFile) {
            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });
        });

        uploader.on('file-paused', function (uploadFile) {
            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });
        });

        uploader.on('file-merge-request', function (uploadFile) {
            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });
        });

        uploader.on('file-before-merge', function (uploadFile) {
            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });
        });

        uploader.on('file-completed', function (uploadFile) {
            that.update(uploadFile, {
                status: uploadFile.getStatus(),
            });
        });

        uploader.on('file-removed', function (uploadFile) {
            that.remove(uploadFile);
        });

        return {
            UPLOAD_STATUS: Uploader.UPLOAD_STATUS,
            UPLOAD_FILE_STATUS: Uploader.UPLOAD_FILE_STATUS,
            uploader: uploader,
            status: uploader._status,
            uploadFilesList: [],
            percentage: 0,
        };
    },
    mounted() {
        const that = this;

        that.uploader.bindDrop(that.$refs.inputRef);

        that.uploader.bindInput(that.$refs.inputRef);
    },
    methods: {
        handleUploadAllClick() {
            const that = this;
            if (that.uploader._status === that.UPLOAD_STATUS.completed) {
                return;
            }

            that.uploader.pause(false);
            that.uploader.upload();
        },
        handlePauseAllClick() {
            const that = this;

            that.uploader.pause(true);
        },
        handleRemoveAllClick() {
            const that = this;

            that.uploader.remove();
        },
        handleMergeAllClick() {},
        handleUploadClick(file) {
            if (file.uploadFile.isCompleted()) {
                return;
            }

            file.uploadFile.pause(false);
            file.uploadFile.upload();
        },
        handlePauseClick(file) {
            file.uploadFile.pause();
        },
        handleMergeClick(file) {
            file.uploadFile.merge();
        },
        handleRemoveClick(file) {
            file.uploadFile.remove();
        },

        update(uploadFile, state) {
            const that = this;

            const idx = that.uploadFilesList.findIndex(function (file) {
                return file.id === uploadFile.id;
            });

            if (idx > -1) {
                const curUploadFile = that.uploadFilesList[idx];
                const newFile = {
                    ...curUploadFile,
                };

                Object.keys(state).forEach(function (key) {
                    const value = state[key];

                    newFile[key] = value;
                });

                that.uploadFilesList.splice(idx, 1, newFile);
            }
        },

        remove(uploadFile) {
            const that = this;

            const idx = that.uploadFilesList.findIndex(function (file) {
                return file.id === uploadFile.id;
            });

            if (idx > -1) {
                that.uploadFilesList.splice(idx, 1);
            }
        },
    },
    watch: {
        uploadOptions(newVal) {
            this.uploader.config(newVal);
        },
        customQuery(newVal) {
            this.uploader.updateQuery(newVal);
        },
    },
};
</script>

<style lang="scss">
@import 'yma-csskit/bem.scss';

@include b(upload) {
    @include e(icon) {
        display: inline-block;
        vertical-align: middle;
        box-sizing: border-box;
        width: 32px;
        height: 32px;
        padding-top: 8px;
        font-size: 0;
        text-align: center;
        cursor: pointer;

        & + & {
            margin-left: 8px;
        }

        @include m(disabled) {
            opacity: 0.5;
            cursor: not-allowed;
        }

        @include m(normal) {
            cursor: auto;
        }
    }

    width: 600px;
    padding: 12px;
    background: #f5f5f5;
    font-family: 'PingFang SC';
}

@include b(upload-zone) {
    @include e(tip) {
        position: relative;
        height: auto;
        font-size: 0;
        text-align: center;
    }

    @include e((icon, title)) {
        vertical-align: middle;
    }

    @include e(icon) {
        display: inline-block;
        margin-right: 6px;
    }

    @include e(title) {
        display: inline-block;
        color: rgba(13, 13, 13, 0.9);
        font-weight: 400;
        font-style: normal;
        font-size: 14px;
        line-height: 22px;
    }

    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
    height: 120px;
    border: 1px solid rgba(13, 13, 13, 0.06);
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    user-select: none;
}

@include b(upload-process) {
    @include e(inner) {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }

    @include e(empty) {
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 100%;
    }

    @include e(empty-content) {
        text-align: center;
        color: rgba(13, 13, 13, 0.9);
        font-weight: 400;
        font-style: normal;
        font-size: 14px;
        line-height: 22px;
    }

    @include e(header) {
        display: flex;
        gap: 8px;
        height: 57px;
        padding: 24px 24px 0 24px;
        line-height: 32px;
    }

    @include e(header-main) {
        flex: 1;
    }

    @include e(header-right) {
        font-size: 0;
    }

    box-sizing: border-box;
    width: 100%;
    height: 433px;
    margin-top: 8px;
    padding-bottom: 24px;
    border: 1px solid rgba(13, 13, 13, 0.06);
    border-radius: 8px;
    background: #fff;
}

@include b(hr) {
    @include e(inner) {
        border-bottom: 1px solid rgba(13, 13, 13, 0.06);
    }

    box-sizing: border-box;
    height: 33px;
    padding: 16px 24px;
}

@include b(upload-files) {
    @include e(file) {
        display: flex;
        gap: 8px;
        line-height: 32px;
        cursor: default;

        & + & {
            margin-top: 12px;
        }
    }

    @include e(file-icon) {
        width: 32px;
        height: 32px;
        text-align: center;
    }

    @include e(file-name) {
        overflow: hidden;
        width: 180px;
        color: rgba(13, 13, 13, 0.9);
        font-weight: 400;
        font-style: normal;
        font-size: 14px;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
    }

    @include e(file-size) {
        width: 60px;
        color: rgba(13, 13, 13, 0.46);
        font-weight: 400;
        font-style: normal;
        font-size: 12px;
    }

    @include e(file-process) {
        width: 150px;
    }

    flex: 1;
    overflow: hidden;
    height: 100%;
    padding: 0 8px 0 24px;
}
</style>
