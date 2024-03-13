import {isFunction, isUndefined, nextTick, on, contains, each, createUrl} from '../util';

const PRECHECK_STATE = {
    ready: '0',
    pending: '1',
    unuploaded: '2',
    uploaded: '3',
};

export const CHUNK_EXISTS_STATE = {
    exists: '1',
    notexists: '0',
};

class UploadChunk {
    constructor(uploader, filer, offset, callback) {
        this.uploader = uploader;
        this.filer = filer;
        this.offset = offset;
        this.callback = callback;
        this.lastProgressCallback = Date.now();
        this.retries = 0;
        this.pendingRetry = false;

        this._precheckState = PRECHECK_STATE.ready;

        this.markComplete = false;

        let chunkSize = this.uploader.options.chunkSize;
        this.loaded = 0;
        this.startByte = this.offset * chunkSize;
        this.endByte = Math.min(this.filer.fileSize, (this.offset + 1) * chunkSize);
        if (this.filer.fileSize - this.endByte < chunkSize && !this.uploader.options.forceChunkSize) {
            this.endByte = this.filer.fileSize;
        }

        this.xhr = null;
    }

    precheck() {
        const that = this;

        const xhr = new XMLHttpRequest();

        const doneHandler = function () {
            if (xhr.status === 200 || xhr.status === 201) {
                const responseJson = xhr.responseText;
                let res;
                try {
                    res = JSON.parse(responseJson);
                }
                catch (err) {
                    throw err;
                }

                if (res.code === '0') {
                    const data = res.data;

                    if (data.status === CHUNK_EXISTS_STATE.notexists) {
                        // 不存在
                        that.precheckFinished(PRECHECK_STATE.unuploaded);
                    }
                    else if (data.status === CHUNK_EXISTS_STATE.exists) {
                        // 已存在
                        that.precheckFinished(PRECHECK_STATE.uploaded);
                    }
                }
                else {
                    that.callback('error', res);
                }
            }
        };

        on(xhr, 'load', doneHandler);
        on(xhr, 'error', doneHandler);
        on(xhr, 'timeout', doneHandler);

        let query = [
            ['chunkNumberParameterName', that.offset + 1],
            ['typeParameterName', that.filer.file.type],
            ['idParameterName', that.filer.id],
            ['fileNameParameterName', that.filer.fileName],
            ['filePathParameterName', that.filer.filePath],
            ['fileHashParameterName', that.filer.fileHash],
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

        let data = {};
        each(query, function (k, v) {
            data[k] = v;
            params.push([encodeURIComponent(k), encodeURIComponent(v)].join('='));
        });

        const url = createUrl(that.uploader.options.precheckChunkUrl, params);

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

        xhr.send(JSON.stringify(data));
    }

    precheckFinished(precheckState) {
        const that = this;

        that._precheckState = precheckState;

        this.send();
    }

    send(multiple) {
        const that = this;

        if (that.uploader.options.precheckChunk) {
            switch (that._precheckState) {
                case PRECHECK_STATE.ready:
                    that._precheckState = PRECHECK_STATE.pending;

                    that.precheck();

                    return;
                case PRECHECK_STATE.uploaded:
                    that.callback('uploaded');

                    that.markComplete = true;

                    if (multiple) {
                        that.uploader._uploadNextFile();
                    }
                    else {
                        that.filer._uploadNextChunk();
                    }

                    return;
                case PRECHECK_STATE.unuploaded:
                    break;
            }
        }

        that.xhr = new XMLHttpRequest();

        on(that.xhr.upload, 'progress', function (e) {
            const now = Date.now();
            if (now - that.lastProgressCallback > that.uploader.options.throttleProgressCallbacks * 1000) {
                that.callback('progress');
                that.lastProgressCallback = now;
            }

            that.loaded = e.loaded || 0;
        });

        that.loaded = 0;
        that.pendingRetry = false;

        that.callback('progress');

        const doneHandler = function (e) {
            const status = that.status();

            if (status === 'uploaded') {
                // 上传完成
                that.callback('uploaded', that.message());

                if (multiple) {
                    that.uploader._uploadNextFile();
                }
                else {
                    that.filer._uploadNextChunk();
                }
            }
            else if (status === 'error') {
                // 上传失败
                that.callback('error', that.message());

                if (multiple) {
                    that.uploader._uploadNextFile();
                }
                else {
                    that.filer._uploadNextChunk();
                }
            }
            else {
                that.callback('retry', that.message());

                that.abort();

                that.retries++;

                const retryInterval = that.uploader.options.chunkRetryInterval;
                if (!isUndefined(retryInterval)) {
                    that.pendingRetry = true;
                    nextTick(that.send, retryInterval);
                }
                else {
                    that.send();
                }
            }
        };

        on(that.xhr, 'load', doneHandler);
        on(that.xhr, 'error', doneHandler);
        on(that.xhr, 'timeout', doneHandler);

        let query = [
            ['chunkNumberParameterName', that.offset + 1],
            ['chunkSizeParameterName', that.uploader.options.chunkSize],
            ['currentChunkSizeParameterName', that.endByte - that.startByte],
            ['totalSizeParameterName', that.filer.fileSize],
            ['typeParameterName', that.filer.file.type],
            ['idParameterName', that.filer.id],
            ['fileNameParameterName', that.filer.fileName],
            ['filePathParameterName', that.filer.filePath],
            ['totalChunksParameterName', that.filer.chunks.length],
            ['fileHashParameterName', that.filer.fileHash],
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

        const slice = that.filer.file.slice
            ? 'slice'
            : that.filer.file.mozSlice
                ? 'mozSlice'
                : that.filer.file.webkitSlice
                    ? 'webkitSlice'
                    : 'slice';
        const bytes = that.filer.file[slice](
            that.startByte,
            that.endByte,
            that.uploader.options.setChunkTypeFromFile ? that.filer.file.type : ''
        );

        let data = null;
        let params = [];
        if (that.uploader.options.method === 'octet') {
            data = bytes;
            each(query, function (k, v) {
                params.push([encodeURIComponent(k), encodeURIComponent(v)].join('='));
            });
        }
        else {
            data = new FormData();
            each(query, function (k, v) {
                data.append(k, v);
                params.push([encodeURIComponent(k), encodeURIComponent(v)].join('='));
            });

            if (that.uploader.options.chunkFormat === 'blob') {
                data.append(that.uploader.options.fileParameterName, bytes, that.filer.fileName);
            }
            else if (that.uploader.options.chunkFormat === 'base64') {
                const reader = new FileReader();
                reader.onload = function (e) {
                    data.append(that.uploader.options.fileParameterName, reader.result);

                    that.xhr.send(data);
                };
                reader.readAsDataURL(bytes);
            }
        }

        const url = createUrl(this.uploader.options.url, params);
        const method = that.uploader.options.uploadMethod;

        that.xhr.open(method, url);

        if (that.uploader.options.method === 'octet') {
            that.xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        }
        that.xhr.timeout = that.uploader.options.xhrTimeout;
        that.xhr.withCredentials = that.uploader.options.withCredentials;

        let headers = that.uploader.options.headers;
        if (isFunction(headers)) {
            headers = headers(that.filer, that);
        }

        each(headers, function (k, v) {
            that.xhr.setRequestHeader(k, v);
        });

        if (that.uploader.options.chunkFormat === 'blob') {
            that.xhr.send(data);
        }
    }

    // 取消上传
    abort() {
        const that = this;
        if (that.xhr) {
            that.xhr.abort();
        }

        that.xhr = null;
    }

    status() {
        const that = this;

        if (that.pendingRetry) {
            return 'uploading';
        }
        else if (that.markComplete) {
            return 'uploaded';
        }
        else if (!that.xhr) {
            return 'pending';
        }
        else if (that.xhr?.readyState < 4) {
            return 'uploading';
        }
        if (that.xhr?.status === 200 || that.xhr?.status === 201) {
            let res;
            try {
                res = JSON.parse(that.xhr.responseText);
            }
            catch (e) {
                console.error(e);

                return 'error';
            }

            if (res.code === '0') {
                return 'uploaded';
            }
            return 'error';

        }
        else if (
            contains(that.uploader.options.permanentErrors, that.xhr?.status)
            || that.retries >= that.uploader.options.maxChunkRetries
        ) {
            return 'error';
        }

        that.abort();

        return 'pending';
    }

    message() {
        const that = this;

        return that.xhr ? that.xhr.responseText : '';
    }

    progress(relative = false) {
        const that = this;
        let factor = relative ? (that.endByte - that.startByte) / that.filer.fileSize : 1;

        if (that.pendingRetry) {
            return 0;
        }

        if ((!that.xhr || !that.xhr.status) && !that.markComplete) {
            factor *= 0.95;
        }

        const s = that.status();
        switch (s) {
            case 'uploaded':
            case 'error':
                return 1 * factor;
            case 'pending':
                return 0 * factor;
            default:
                return (that.loaded / (that.endByte - that.startByte)) * factor;
        }
    }
}

export default UploadChunk;
