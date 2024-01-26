import {isFunction, nextTick, each, isUndefined, on, createUrl} from './util';
import UploadChunk from './upload-chunk';

export const MERGED_STATUS = {
    merging: 1,
    merged: 0,
};

class UploadFile {
    constructor(uploader, file, uniqueIdentifier, fileHash) {
        this._prevProgress = 0;
        this.uploader = uploader;
        this.file = file;
        this.fileHash = fileHash;
        this.fileName = file.fileName || file.name;
        this.size = file.size;
        this.filePath =
            file.relativePath || file.webkitRelativePath || this.fileName;
        this.uniqueIdentifier = uniqueIdentifier;
        this._pause = false;
        this.container = '';

        this.retries = 0;

        this._error = uniqueIdentifier !== undefined;

        this.chunks = [];

        this.uploader.emit('chunking-start', this);

        this.start();

        // 通过属性监控，感知是否完成
        this.isCompleted = false;
    }

    abort() {
        const that = this;

        let abortCount = 0;
        each(that.chunks, function (chunk) {
            if (chunk.status() == 'uploading') {
                chunk.abort();
                abortCount++;
            }
        });

        if (abortCount > 0) {
            that.uploader.emit('file-progress', that);
        }
    }

    cancel() {
        const that = this;

        const _chunks = that.chunks;
        that.chunks = [];

        each(_chunks, function (chunk) {
            if (chunk.status() === 'uploading') {
                chunk.abort();
                that.uploader.uploadNextChunk();
            }
        });

        that.uploader.removeFile(that);

        that.uploader.emit('file-progress', that);
    }

    retry() {
        const that = this;

        that.start();

        let retry = false;
        that.uploader.on('chunking-complete', function () {
            if (!retry) {
                that.uploader.upload();
            }
            retry = true;
        });
    }

    start() {
        const that = this;

        that.abort();

        that._error = false;
        that.chunks = [];
        that._prevProgress = 0;

        let round = that.uploader.options.forceChunkSize
            ? Math.ceil
            : Math.floor;
        let maxOffset = Math.max(
            round(that.file.size / that.uploader.options.chunkSize),
            1
        );

        for (let offset = 0; offset < maxOffset; offset++) {
            (function (offset) {
                that.chunks.push(
                    new UploadChunk(that.uploader, that, offset, function (
                        event,
                        message
                    ) {
                        switch (event) {
                            case 'progress':
                                that.uploader.emit(
                                    'file-progress',
                                    that,
                                    message
                                );

                                break;
                            case 'error':
                                that.abort();
                                that._error = true;
                                that.chunks = [];
                                that.uploader.emit('file-error', that, message);

                                break;
                            case 'success':
                                if (that._error) return;

                                that.uploader.emit(
                                    'file-progress',
                                    that,
                                    message
                                ); // it's at least progress

                                if (that.isComplete()) {
                                    that.isCompleted = true;

                                    that.uploader.emit(
                                        'file-success',
                                        that,
                                        message
                                    );
                                }

                                break;
                            case 'retry':
                                that.uploader.emit('file-retry', that);

                                break;
                        }
                    })
                );
            })(offset);
        }

        nextTick(function () {
            that.uploader.emit('chunking-complete', that);
        });
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
            if (chunk.status() == 'uploading') {
                uploading = true;
                return false;
            }
        });

        return uploading;
    }

    isComplete() {
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

    pause(pause) {
        const that = this;

        if (typeof pause === 'undefined') {
            that._pause = that._pause ? false : true;
        } else {
            that._pause = pause;
        }
    }

    isPaused() {
        return this._pause;
    }

    upload() {
        const that = this;

        let found = false;

        if (that.isPaused() === false) {
            each(that.chunks, function (chunk) {
                if (chunk.status() === 'pending') {
                    chunk.send();
                    found = true;

                    return false;
                }
            });
        }

        return found;
    }

    markChunksCompleted(chunkCount) {
        const that = this;

        if (!that.chunks || that.chunks.length <= chunkCount) {
            return;
        }

        for (let i = 0; i < chunkCount; i++) {
            that.chunks[num].markComplete = true;
        }
    }

    merge() {
        const that = this;

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
                    that.uploader.emit('file-merged', that, status);
                }
            }
        };

        on(xhr, 'load', doneHandler);
        on(xhr, 'error', doneHandler);
        on(xhr, 'timeout', doneHandler);

        let query = [
            ['totalChunksParameterName', that.chunks.length],
            ['totalSizeParameterName', that.size],
            ['typeParameterName', that.file.type],
            ['identifierParameterName', that.uniqueIdentifier],
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
