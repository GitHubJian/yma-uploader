import {
    isFunction,
    nextTick,
    each,
    isUndefined,
    on,
    createUrl,
    formatSize,
} from '../util';
import UploadChunk from './upload-chunk';

export const MERGED_STATUS = {
    merging: 1,
    merged: 0,
};

export const UPLOAD_FILE_STATUS = {
    beforeReady: 'beforeReady',
    ready: 'ready',
    pause: 'pause',
    uploading: 'uploading',
    uploaded: 'uploaded',
    error: 'error',
    merging: 'merging',
    completed: 'completed',
};

class UploadFile {
    constructor(uploader, file, id, fileHash) {
        const that = this;
        this._prevProgress = 0;
        this.uploader = uploader;
        this.file = file;
        this.fileName = file.fileName || file.name;
        this.fileSize = file.size;
        this.filePath =
            file.relativePath || file.webkitRelativePath || this.fileName;
        this.id = id;

        this.fileType = file.type;
        this.fileHash = fileHash;
        this.fileFormatSize = formatSize(this.fileSize);

        this._pause = false;

        this._chunked = false;

        this.container = '';

        this.retries = 0;

        this._error = id !== undefined;

        this._fileBeforeUpload = false; // 首次上传时的状态

        this._isUploadNext = false;

        this.chunks = [];

        this._status = UPLOAD_FILE_STATUS.beforeReady;

        if (this.uploader.options.autoMerge) {
            this.uploader.on('file-merge-request', function () {
                that.merge();
            });
        }
    }

    // 开始分片
    chunked() {
        const that = this;

        this._status = UPLOAD_FILE_STATUS.beforeReady;

        that.uploader.emit('file-before-chunk', that);

        // 可能文件正在上传，防止二次上传
        that._abort();

        that._error = false;
        that.chunks = [];
        that._prevProgress = 0;

        let round = that.uploader.options.forceChunkSize
            ? Math.ceil
            : Math.floor;
        let maxOffset = Math.max(
            round(that.fileSize / that.uploader.options.chunkSize),
            1
        );

        function chunkEvent(event, message) {
            switch (event) {
                case 'progress':
                    that._status = UPLOAD_FILE_STATUS.uploading;

                    that.uploader.emit('file-progress', that, message);

                    that.uploader.emit('progress', that.uploader);

                    break;
                case 'error':
                    that._status = UPLOAD_FILE_STATUS.error;

                    that._abort();

                    that._error = true;
                    that.chunks = [];

                    that.uploader.emit('file-error', that, message);

                    break;
                case 'uploaded':
                    if (that._error) {
                        return;
                    }

                    that.uploader.emit('file-progress', that, message); // it's at least progress

                    if (that.isUploaded()) {
                        that._status = UPLOAD_FILE_STATUS.uploaded;

                        that.uploader.emit('file-uploaded', that, message);

                        that.uploader.emit('uploaded', that.uploader, that);

                        that.uploader.emit('file-merge-request', that);

                        that.uploader.emit(
                            'merge-request',
                            that.uploader,
                            that
                        );
                    }

                    // 整体上传进度
                    that.uploader.emit('progress', that.uploader);

                    break;
                case 'retry':
                    that.uploader.emit('file-retry', that);

                    break;
            }
        }

        for (let offset = 0; offset < maxOffset; offset++) {
            (function (offset) {
                that.chunks.push(
                    new UploadChunk(that.uploader, that, offset, chunkEvent)
                );
            })(offset);
        }

        nextTick(function () {
            that._chunked = true;

            that._status = UPLOAD_FILE_STATUS.ready;

            that.uploader.emit('file-chunked', that);

            that.uploader.emit(
                'chunked',
                that.uploader,
                that.uploader.getChunked()
            );
        }, 0);
    }

    _updateHash(fileHash) {
        this.fileHash = fileHash;
    }

    // 中止上传
    _abort() {
        const that = this;

        let count = 0;
        each(that.chunks, function (chunk) {
            if (chunk.status() === 'uploading') {
                chunk.abort();

                count++;
            }
        });

        if (count > 0) {
            that.uploader.emit('file-progress', that);
        }
    }

    // 直接中止当前 chunk 的上传
    abort() {
        const that = this;

        that.uploader.emit('file-before-abort', that);

        let count = 0;
        each(that.chunks, function (chunk) {
            if (chunk.status() === 'uploading') {
                chunk.abort();

                count++;
            }
        });

        that._status = UPLOAD_FILE_STATUS.pause;

        that.uploader.emit('file-aborted', that);

        if (count > 0) {
            that.uploader.emit('file-progress', that);
        }
    }

    remove() {
        const that = this;

        that.uploader.emit('file-before-remove', that);

        const _chunks = that.chunks;
        that.chunks = [];

        each(_chunks, function (chunk) {
            if (chunk.status() === 'uploading') {
                chunk.abort();

                that.uploader._uploadNextFile();
            }
        });

        that.uploader.removeFile(that);

        that.uploader.emit('file-progress', that);

        that.uploader.emit('file-removed', that);
    }

    progress() {
        const that = this;

        if (that._error) {
            return 1;
        }

        let ret = 0;
        let error = false;

        each(that.chunks, function (chunk) {
            if (chunk.status() == 'error') {
                error = true;
            }

            ret += chunk.progress(true);
        });

        ret = error ? 1 : ret > 0.99999 ? 1 : ret;

        ret = Math.max(that._prevProgress, ret);

        that._prevProgress = ret;

        return ret;
    }

    isUploading() {
        const that = this;

        let uploading = false;
        each(that.chunks, function (chunk) {
            if (chunk.status() === 'uploading') {
                uploading = true;

                return false;
            }
        });

        return uploading;
    }

    isUploaded() {
        const that = this;

        let outstanding = false;
        each(that.chunks, function (chunk) {
            let status = chunk.status();

            if (status === 'pending' || status === 'uploading') {
                outstanding = true;

                return false;
            }
        });

        return !outstanding;
    }

    // 上传完成
    isCompleted() {
        const that = this;

        return that._status === UPLOAD_FILE_STATUS.completed;
    }

    // 待当前 Chunk 上传结束后，中止上传
    pause(pause) {
        const that = this;
        if (
            [
                UPLOAD_FILE_STATUS.uploaded,
                UPLOAD_FILE_STATUS.completed,
            ].includes(that._status)
        ) {
            return;
        }

        if (isUndefined(pause)) {
            that._pause = that._pause ? false : true;
        } else {
            that._pause = pause;
        }

        if (that._pause) {
            that._status = UPLOAD_FILE_STATUS.pause;
        } else {
            that._status = UPLOAD_FILE_STATUS.uploading;
        }

        that.uploader.emit('file-paused', that);

        that.uploader.emit('paused', that.uploader, that);
    }

    upload() {
        const that = this;
        if (that._status === UPLOAD_FILE_STATUS.completed) {
            // ignore
            // that._status = UPLOAD_FILE_STATUS.completed;
            // that.uploader.emit('file-completed', that);
            // that.uploader.emit('completed', that.uploader, that);
        } else {
            this._upload();
        }
    }

    // 循环上传
    _upload(isAutoUpload) {
        const that = this;
        let found = false;

        if (that._pause === false) {
            that._status = UPLOAD_FILE_STATUS.uploading;

            if (!that._fileBeforeUpload) {
                that._fileBeforeUpload = true;

                that.uploader.emit('file-before-upload', that);
                that.uploader.emit('before-upload', that.uploader);
            }

            each(that.chunks, function (chunk) {
                if (chunk.status() === 'pending') {
                    chunk.send(isAutoUpload);

                    found = true;

                    return false;
                }
            });
        } else {
            that._fileBeforeUpload = false;
        }

        return found;
    }

    _uploadNextChunk() {
        const that = this;

        that._upload();
    }

    _uploadNext() {
        const that = this;

        if (this.isCompleted()) {
            that._status = UPLOAD_FILE_STATUS.completed;

            that.uploader.emit('file-completed', that);

            if (!that._isUploadNext) {
                that._isUploadNext = true;

                that.uploader.emit('completed', that.uploader, that);
            }

            return false;
        } else {
            return that._upload(true);
        }
    }

    getStatus() {
        return this._status;
    }

    merge() {
        const that = this;

        // 如果没有上传完成，拒绝 Merge 操作
        if (that._status !== UPLOAD_FILE_STATUS.uploaded) {
            return;
        }

        that._status = UPLOAD_FILE_STATUS.merging;

        that.uploader.emit('file-before-merge', that);

        const xhr = new XMLHttpRequest();

        const doneHandler = function () {
            if (xhr.status === 200 || xhr.status === 201) {
                const statusJson = xhr.responseText;

                let status;
                try {
                    status = JSON.parse(statusJson);
                } catch (err) {
                    throw err;
                }

                if (status.code === MERGED_STATUS.merging) {
                    // 未 merge 完成
                    that.uploader.emit('file-merge-retry', that, status);

                    that.retries++;

                    const retryInterval =
                        that.uploader.options.chunkRetryInterval;
                    if (!isUndefined(retryInterval)) {
                        that.pendingRetry = true;

                        nextTick(that.merge, retryInterval);
                    } else {
                        that.merge();
                    }
                } else if (status.code === MERGED_STATUS.merged) {
                    // 已 merge 完成
                    that._status = UPLOAD_FILE_STATUS.completed;

                    that.uploader.emit('file-completed', that, status);

                    that.uploader.emit('completed', that.uploader, that);
                }
            }
        };

        on(xhr, 'load', doneHandler);
        on(xhr, 'error', doneHandler);
        on(xhr, 'timeout', doneHandler);

        let query = [
            ['totalChunksParameterName', that.chunks.length],
            ['totalSizeParameterName', that.fileSize],
            ['typeParameterName', that.fileType],
            ['idParameterName', that.id],
            ['fileNameParameterName', that.fileName],
            ['filePathParameterName', that.filePath],
            ['fileHashParameterName', that.fileHash],
        ]
            .filter(function (pair) {
                return that.uploader.options[pair[0]];
            })
            .reduce(function (prev, pair) {
                prev[that.uploader.options[pair[0]]] = pair[1];

                return prev;
            }, {});

        let customQuery = that.uploader.options.query;
        each(customQuery, function (k, v) {
            query[k] = v;
        });

        let params = [];

        each(query, function (k, v) {
            params.push(
                [encodeURIComponent(k), encodeURIComponent(v)].join('=')
            );
        });

        const url = createUrl(that.uploader.options.mergeUrl, params);

        xhr.open('POST', url);

        xhr.timeout = that.uploader.options.xhrTimeout;
        xhr.withCredentials = that.uploader.options.withCredentials;

        let headers = that.uploader.options.headers;
        if (isFunction(headers)) {
            headers = headers(that, that);
        }

        each(headers, function (k, v) {
            xhr.setRequestHeader(k, v);
        });

        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.send();
    }
}

export default UploadFile;
