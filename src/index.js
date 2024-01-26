import EE from 'yma-ee';
import UploadFile from './upload-file';
import HashWorker from './hash.worker.js';

export {MERGED_STATUS} from './upload-file';
export {CHUNK_EXISTS_STATE} from './upload-chunk';

import {
    noop,
    each,
    isUndefined,
    createUniqueIdentifier,
    nextTick,
    attr,
    on,
    addClass,
    removeClass,
} from './util';

function defaults() {
    return {
        maxFiles: undefined, // 允许同时上传的最大文件数量
        minFileSize: 1, // 允许上传的最小文件大小（以字节为单位）
        maxFileSize: undefined, // 允许上传的最大文件大小（以字节为单位）
        maxFilesErrorCallback: noop, // 当达到 maxFiles 限制时调用的回调函数
        minFileSizeErrorCallback: noop, // 当文件大小低于 minFileSize 限制时调用的回调函数
        maxFileSizeErrorCallback: noop, // 当文件大小高于 maxFileSize 限制时调用的回调函数
        fileTypes: [], // 允许上传的文件类型数组
        fileTypeErrorCallback: noop, // 当文件类型不在 fileType 数组中时调用的回调函数

        forceChunkSize: false, // 是否强制将文件分割为指定大小的分片，即使文件小于chunkSize
        preprocessFile: null, // 件上传到服务器之前对每个文件进行处理

        chunkSize: 1 * 1024 * 1024, // 每个分片的大小（以字节为单位）
        query: {}, // 自定义查询参数

        method: 'multipart',
        testMethod: 'GET', // 测试上传
        url: '/', // 上传地址
        testUrl: null,

        xhrTimeout: 0, // XHR 上传超时时间
        withCredentials: false, // XHR 是否允许跨站点请求伪造
        headers: {}, // XHR 自定义请求头

        setChunkTypeFromFile: false, // 根据文件类型自动设置分片的 MIME 类型

        chunkFormat: 'blob', // 分片的格式
        fileParameterName: 'file', // 上传请求中使用的文件参数名称

        uploadMethod: 'POST', // 上传文件时要使用的 HTTP 请求方法

        permanentErrors: [400, 401, 403, 404, 409, 415, 500, 501], // 定义永久性错误
        maxChunkRetries: 100, // 每个分片的最大重试次数
        maxMergeRetries: 100, // 每个Merge请求最大重试次数

        simultaneousUploads: 3, // 同时上传的最大分片数量

        throttleProgressCallbacks: 0.5,

        chunkRetryInterval: undefined,

        chunkNumberParameterName: 'chunkNumber', // 上传文件的每个分块中，表示分块序号的参数名
        chunkSizeParameterName: 'chunkSize', // 上传文件的每个分块中，表示分块大小的参数名
        currentChunkSizeParameterName: 'currentChunkSize', // 当前分块大小
        totalSizeParameterName: 'totalSize', //  文件总大小
        typeParameterName: 'fileType', // 文件类型
        identifierParameterName: 'fileIdentifier', // 文件标识符
        fileNameParameterName: 'fileName', // 文件名
        filePathParameterName: 'filePath', // 文件路径
        totalChunksParameterName: 'totalChunks', // 总分块数
        fileHashParameterName: 'fileHash', // 文件 hash 值

        mergeUrl: '/merge', // 文件上传完后进行 Merge 操作

        precheckChunk: false, // 开启对 CHUNK 预检上传
        precheckChunkUrl: '/precheck', // Chunk 上传之前进行检查
    };
}

class Uploader extends EE {
    constructor(options) {
        super();

        this.support =
            typeof File !== 'undefined' &&
            typeof Blob !== 'undefined' &&
            typeof FileList !== 'undefined' &&
            (!!Blob.prototype.webkitSlice ||
                !!Blob.prototype.mozSlice ||
                !!Blob.prototype.slice ||
                false);

        if (!this.support) {
            throw new Error('当前浏览器不支持 Upload 插件');
        }

        this.options = Object.assign({}, defaults(), options);

        this.files = [];
    }

    pause() {
        each(this.files, function (file) {
            file.abort();
        });

        this.emit('pause');
    }

    cancel() {
        this.emit('before-cancel');

        for (let i = this.files.length - 1; i >= 0; i--) {
            this.files[i].cancel();
        }

        this.emit('cancel');
    }

    progress() {
        let done = 0;
        let size = 0;

        each(this.files, function (file) {
            done += file.progress() * file.size;
            size += file.size;
        });

        return size > 0 ? done / size : 0;
    }

    addFile(file, event) {
        this._addFile([file], event);
    }

    addFiles(files, event) {
        this._addFile(files, event);
    }

    _addFile(fileList, event) {
        const that = this;

        let errorCount = 0;

        if (
            !isUndefined(that.options.maxFiles) &&
            that.options.maxFiles < fileList.length + that.files.length
        ) {
            // 如果是单文件上传，文件已经被添加，只需进行文件替换即可
            if (
                that.options.maxFiles === 1 &&
                that.files.length === 1 &&
                fileList.length === 1
            ) {
                that.removeFile(that.files[0]);
            } else {
                that.options.maxFilesErrorCallback(fileList, errorCount++);

                return false;
            }
        }

        let files = [],
            filesSkipped = [],
            remaining = fileList.length;

        const decreaseReamining = function () {
            if (!--remaining) {
                if (!files.length && !filesSkipped.length) {
                    return;
                }

                that.emit('files-added', files, filesSkipped);
            }
        };

        each(fileList, function (file) {
            let fileName = file.name;
            let fileType = file.type;

            if (that.options.fileTypes.length > 0) {
                let fileTypeFound = false;
                for (let key in that.options.fileTypes) {
                    that.options.fileTypes[key] = that.fileTypes[key]
                        .replace(/\s/g, '')
                        .toLowerCase();

                    var extension =
                        (that.options.fileTypes[index].match(/^[^.][^/]+$/)
                            ? '.'
                            : '') + that.options.fileTypes[index];

                    if (
                        fileName.substr(-1 * extension.length).toLowerCase() ===
                            extension ||
                        (extension.indexOf('/') !== -1 &&
                            ((extension.indexOf('*') !== -1 &&
                                fileType.substr(0, extension.indexOf('*')) ===
                                    extension.substr(
                                        0,
                                        extension.indexOf('*')
                                    )) ||
                                fileType === extension))
                    ) {
                        fileTypeFound = true;
                        break;
                    }
                }

                if (!fileTypeFound) {
                    that.options.fileTypeErrorCallback(file, errorCount++);
                    return true;
                }
            }

            if (
                !isUndefined(that.options.minFileSize) &&
                file.size < that.options.minFileSize
            ) {
                that.options.minFileSizeErrorCallback(file, errorCount++);
                return true;
            }

            if (
                !isUndefined(that.options.maxFileSize) &&
                file.size > that.options.maxFileSize
            ) {
                that.options.maxFileSizeErrorCallback(file, errorCount++);
                return;
            }

            function addFile(uniqueIdentifier) {
                if (!that.getFromUniqueIdentifier(uniqueIdentifier)) {
                    file.uniqueIdentifier = uniqueIdentifier;

                    that._calcHash(file, function (fileHash) {
                        const uploadfile = new UploadFile(
                            that,
                            file,
                            uniqueIdentifier,
                            fileHash
                        );
                        that.files.push(uploadfile);
                        files.push(uploadfile);

                        uploadfile.container =
                            typeof event != 'undefined'
                                ? event.srcElement
                                : null;

                        nextTick(function () {
                            that.emit('file-added', uploadfile, event);
                        });
                    });
                } else {
                    filesSkipped.push(file);
                }

                decreaseReamining();
            }

            const uniqueIdentifier = createUniqueIdentifier(file, event);
            addFile(uniqueIdentifier);
        });
    }

    _calcHash(file, callback) {
        const worker = new HashWorker();

        worker.postMessage({file});

        worker.onmessage = e => {
            const {hash} = e.data;

            callback && callback(hash);
        };
    }

    removeFile(file) {
        const that = this;

        for (var i = that.files.length - 1; i >= 0; i--) {
            if (that.files[i] === file) {
                that.files.splice(i, 1);
            }
        }
    }

    getSize() {
        const that = this;

        let total = 0;
        each(that.files, function (file) {
            total += file.size;
        });

        return total;
    }

    updateQuery(query) {
        this.options.query = query;
    }

    uploadNextChunk() {
        const that = this;

        let found = false;

        each(that.files, function (file) {
            found = file.upload();

            if (found) {
                return false;
            }
        });

        if (found) {
            return true;
        }

        let outstanding = false;
        each(that.files, function (file) {
            if (!file.isComplete()) {
                outstanding = true;
                return false;
            }
        });

        if (!outstanding) {
            that.emit('complete');
        }

        return false;
    }

    isUploading() {
        const that = this;

        let uploading = false;
        each(that.files, function (file) {
            if (file.isUploading()) {
                uploading = true;

                return false;
            }
        });

        return uploading;
    }

    upload() {
        const that = this;

        if (that.isUploading()) {
            return;
        }

        that.emit('upload-start');

        for (let i = 1; i <= that.options.simultaneousUploads; i++) {
            that.uploadNextChunk();
        }
    }

    getFromUniqueIdentifier(uniqueIdentifier) {
        const that = this;
        let ret = false;

        each(that.files, function (file) {
            if (file.uniqueIdentifier === uniqueIdentifier) {
                ret = file;
            }
        });

        return ret;
    }

    bindElDrop(div) {
        on(div, 'dragover');
        on(div, 'dragenter');
        on(div, 'dragleave');
        on(div, 'drop');
    }

    bindInput(inputOrDiv, isDirectory) {
        const that = this;

        let inputEl;
        if (inputOrDiv.tagName === 'INPUT' && inputOrDiv.type === 'file') {
            inputEl = inputOrDiv;
        } else {
            inputEl = document.createElement('input');
            attr(inputEl, 'type', 'file');
            inputEl.style.display = 'none';

            on(inputOrDiv, 'click', function () {
                inputEl.focus();
                inputEl.click();
            });

            inputOrDiv.appendChild(inputEl);
        }

        let maxFiles = that.options.maxFiles;
        attr(
            inputEl,
            'multiple',
            isUndefined(maxFiles) || maxFiles != 1 ? 'multiple' : undefined
        );
        attr(
            inputEl,
            'webkitdirectory',
            isDirectory ? 'webkitdirectory' : undefined
        );

        let fileTypes = that.options.fileTypes;
        attr(
            inputEl,
            'accept',

            isUndefined(fileTypes) || fileTypes.length >= 1
                ? fileTypes
                      .map(function (e) {
                          e = e.replace(/\s/g, '').toLowerCase();
                          if (e.match(/^[^.][^/]+$/)) {
                              e = '.' + e;
                          }

                          return e;
                      })
                      .join(',')
                : undefined
        );

        on(inputEl, 'change', function (e) {
            that.addFiles(e.target.files, e);

            e.target.value = '';
        });
    }
}

const DRAG_CLASSNAME = 'yma-drag-enter';

function handleDragEnter(e) {
    e.preventDefault();

    const dt = e.dataTransfer;
    if (dt.types.indexOf('Files') >= 0) {
        // only for file drop
        e.stopPropagation();

        dt.dropEffect = 'copy';
        dt.effectAllowed = 'copy';

        addClass(e.currentTarget, DRAG_CLASSNAME);
    } else {
        // not work on IE/Edge....
        dt.dropEffect = 'none';
        dt.effectAllowed = 'none';
    }
}

function handleDragOver(e) {
    handleDragEnter(e);
}

function handleDragLeave(e) {
    removeClass(e.currentTarget, DRAG_CLASSNAME);
}

function handleDrop(e) {
    removeClass(e.currentTarget, DRAG_CLASSNAME);
    e.stopPropagation();
    e.preventDefault();

    if (e.dataTransfer && e.dataTransfer.items) {
        loadFiles(e.dataTransfer.items, e);
    } else if (e.dataTransfer && e.dataTransfer.files) {
        loadFiles(e.dataTransfer.files, e);
    }
}

export default Uploader;
