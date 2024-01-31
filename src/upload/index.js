import EE from 'yma-ee';
import HashWorker from './hash.worker';
import UploadFile, {UPLOAD_FILE_STATUS, MERGED_STATUS} from './upload-file';
import {CHUNK_EXISTS_STATE} from './upload-chunk';

import {
    noop,
    each,
    isUndefined,
    createId,
    attr,
    on,
    addClass,
    removeClass,
    isFunction,
    formatSize,
    isNumber,
    isBoolean,
} from '../util';

const DRAG_CLASSNAME = 'yma-drag-enter';

function processCallbacks(items, cb) {
    if (!items || items.length === 0) {
        return cb();
    }

    items[0](function () {
        processCallbacks(items.slice(1), cb);
    });
}

function processItem(item, path, items, cb) {
    let entry;
    if (item.isFile) {
        return item.file(function (file) {
            file.relativePath = path + file.name;
            items.push(file);
            cb();
        });
    } else if (item.isDirectory) {
        entry = item;
    } else if (item instanceof File) {
        items.push(item);
    }

    if (isFunction(item.webkitGetAsEntry)) {
        entry = item.webkitGetAsEntry();
    }

    if (entry && entry.isDirectory) {
        return processDirectory(entry, path + entry.name + '/', items, cb);
    }

    if (isFunction(item.getAsFile)) {
        item = item.getAsFile();

        if (item instanceof File) {
            item.relativePath = path + item.name;
            items.push(item);
        }
    }

    cb();
}

function processDirectory(directory, path, items, cb) {
    let dirReader = directory.createReader();
    let allEntries = [];

    function readEntries() {
        dirReader.readEntries(function (entries) {
            if (entries.length) {
                allEntries = allEntries.concat(entries);

                return readEntries();
            }

            processCallbacks(
                allEntries.map(function (entry) {
                    return processItem.bind(null, entry, path, items);
                }),
                cb
            );
        });
    }

    readEntries();
}

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

        simultaneousUploads: 3, // 同时上传的最大分片数量

        throttleProgressCallbacks: 0.5,

        chunkRetryInterval: undefined,

        chunkNumberParameterName: 'chunkNumber', // 上传文件的每个分块中，表示分块序号的参数名
        chunkSizeParameterName: 'chunkSize', // 上传文件的每个分块中，表示分块大小的参数名
        currentChunkSizeParameterName: 'currentChunkSize', // 当前分块大小
        totalSizeParameterName: 'totalSize', //  文件总大小
        typeParameterName: 'fileType', // 文件类型
        idParameterName: 'fileId', // 文件标识符
        fileNameParameterName: 'fileName', // 文件名
        filePathParameterName: 'filePath', // 文件路径
        totalChunksParameterName: 'totalChunks', // 总分块数
        fileHashParameterName: 'fileHash', // 文件 hash 值

        mergeUrl: '/merge', // 文件上传完后进行 Merge 操作
        maxMergeRetries: 100, // 每个Merge请求最大重试次数
        autoMerge: true,

        precheckChunk: false, // 开启对 CHUNK 预检上传
        precheckChunkUrl: '/precheck', // Chunk 上传之前进行检查
    };
}

const UPLOAD_STATUS = {
    beforeReady: 'beforeReady',
    ready: 'ready',
    pause: 'pause',
    uploading: 'uploading',
    uploaded: 'uploaded',
    error: 'error',
    merging: 'merging',
    completed: 'completed',
};

class Uploader extends EE {
    constructor(options) {
        super();

        const that = this;
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

        if (
            !isNumber(this.options.minFileSize) ||
            (isNumber(this.options.minFileSize) && this.options.minFileSize < 1)
        ) {
            throw 'Uploader options.minFileSize 必须是一个大于 0 的数值';
        }

        this.uploadFiles = [];

        this._bindEl = false;

        this._status = UPLOAD_STATUS.beforeReady;

        if (this.options.autoMerge) {
            this.on('merge-request', function () {
                that.merge();
            });
        }

        this.bindEvent();
    }

    bindEvent() {
        const that = this;

        that.on('before-upload', function () {
            that._status = that._getStatus();
        });

        that.on('paused', function () {
            that._status = that._getStatus();
        });

        that.on('uploaded', function () {
            that._status = that._getStatus();
        });

        that.on('completed', function () {
            that._status = that._getStatus();
        });
    }

    merge() {
        const that = this;

        each(that.uploadFiles, function (uploadFile) {
            uploadFile.merge();
        });
    }

    _getStatus() {
        const that = this;

        // 如果存在一个 beforeReady 那么 beforeReady
        if (that._isBeforeReady()) {
            return UPLOAD_STATUS.beforeReady;
        }

        // 如果所有的都 uploaded 那么 uploaded
        if (that._isUploaded()) {
            return UPLOAD_STATUS.uploaded;
        }

        // 如果所有的都 completed 那么 completed
        if (that._isCompleted()) {
            return UPLOAD_STATUS.completed;
        }

        // 如果存在一个 uploading 那么 uploading
        if (that._isUploading()) {
            return UPLOAD_STATUS.uploading;
        }

        // 如果存在一个 Pause || Ready 那么 Ready
        if (that._isReady()) {
            return UPLOAD_STATUS.ready;
        }

        // 如果存在一个 merging 那么 merging
        if (that._isMerging()) {
            return UPLOAD_STATUS.merging;
        }
    }

    _isBeforeReady() {
        const that = this;

        let flag = false;
        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.getStatus() === UPLOAD_FILE_STATUS.beforeReady) {
                flag = true;

                return false;
            }
        });

        return flag;
    }

    _isReady() {
        const that = this;

        let flag = true;
        each(that.uploadFiles, function (uploadFile) {
            if (
                ![
                    UPLOAD_FILE_STATUS.ready,
                    UPLOAD_FILE_STATUS.pause,
                    UPLOAD_FILE_STATUS.upload,
                    UPLOAD_FILE_STATUS.completed,
                ].includes(uploadFile.getStatus())
            ) {
                flag = false;

                return false;
            }
        });

        return flag;
    }

    _isUploading() {
        const that = this;

        let flag = false;
        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.getStatus() === UPLOAD_FILE_STATUS.uploading) {
                flag = true;

                return false;
            }
        });

        return flag;
    }

    _isUploaded() {
        const that = this;

        let flag = true;
        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.getStatus() !== UPLOAD_FILE_STATUS.uploaded) {
                flag = false;

                return false;
            }
        });

        return flag;
    }

    _isCompleted() {
        const that = this;

        let flag = true;
        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.getStatus() !== UPLOAD_FILE_STATUS.completed) {
                flag = false;

                return false;
            }
        });

        return flag;
    }

    _isMerging() {
        const that = this;

        let flag = false;
        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.getStatus() === UPLOAD_FILE_STATUS.merging) {
                flag = true;

                return false;
            }
        });

        return flag;
    }

    // 暂停
    pause(pause) {
        const that = this;

        if (!isBoolean(pause)) {
            throw 'uploader.pause() 中 arguments[0] 必须是 boolean 值';
        }

        that._pause = pause;

        if (that._pause) {
            that._status = UPLOAD_STATUS.ready;
        } else {
            that._status = UPLOAD_STATUS.pause;
        }

        this.emit('before-pause', that);

        each(this.uploadFiles, function (uploadFile) {
            uploadFile.pause(pause);
        });

        this.emit('paused', that);
    }

    // 取消
    remove() {
        this.emit('before-remove');

        for (let i = this.uploadFiles.length - 1; i >= 0; i--) {
            this.uploadFiles[i].remove();
        }

        this.emit('removed');
    }

    // 获取整体上传进度
    progress() {
        let done = 0;
        let size = 0;

        each(this.uploadFiles, function (uploadFile) {
            done += uploadFile.progress() * uploadFile.fileSize;
            size += uploadFile.fileSize;
        });

        return size > 0 ? done / size : 0;
    }

    addFile(file, event) {
        this._addFiles([file], event);
    }

    addFiles(files, event) {
        this._addFiles(files, event);
    }

    removeFile(file) {
        const that = this;

        for (let i = that.uploadFiles.length - 1; i >= 0; i--) {
            if (that.uploadFiles[i] === file) {
                that.uploadFiles.splice(i, 1);
            }
        }
    }

    _addFiles(fileList, event) {
        const that = this;

        let errorCount = 0;

        if (
            !isUndefined(that.options.maxFiles) &&
            that.options.maxFiles < fileList.length + that.uploadFiles.length
        ) {
            // 如果是单文件上传，文件已经被添加，只需进行文件替换即可
            if (
                that.options.maxFiles === 1 &&
                that.uploadFiles.length === 1 &&
                fileList.length === 1
            ) {
                that.removeFile(that.uploadFiles[0]);
            } else {
                that.options.maxFilesErrorCallback(fileList, errorCount++);

                that.emit('max-files-error', fileList, errorCount++);

                return false;
            }
        }

        let files = [];
        let filesSkipped = [];
        let remaining = fileList.length;
        // 整体文件添加完成
        const decreaseReamining = function () {
            if (!--remaining) {
                if (!files.length && !filesSkipped.length) {
                    return;
                }

                that._status = UPLOAD_STATUS.ready;

                that.emit('added', that, files, filesSkipped);
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

                    let extension =
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

            if (file.size < that.options.minFileSize) {
                that.options.minFileSizeErrorCallback(file, errorCount++);

                that.emit('filesize-min-error', file, errorCount++);

                return true;
            }

            if (
                !isUndefined(that.options.maxFileSize) &&
                file.size > that.options.maxFileSize
            ) {
                that.options.maxFileSizeErrorCallback(file, errorCount++);

                that.emit('filesize-max-error', file, errorCount++);

                return;
            }

            function addFile(id) {
                if (!that.getFromId(id)) {
                    file.id = id;

                    that._status = UPLOAD_STATUS.beforeReady;

                    const uploadFile = new UploadFile(that, file, id);

                    that.emit('file-before-add', that, uploadFile);

                    uploadFile.chunked();

                    that._calcHash(file, function (fileHash) {
                        uploadFile._updateHash(fileHash);

                        that.uploadFiles.push(uploadFile);
                        files.push(uploadFile);

                        uploadFile.container =
                            typeof event !== 'undefined'
                                ? event.srcElement
                                : null;

                        uploadFile._status = UPLOAD_FILE_STATUS.ready;
                        // 单个文件添加完成
                        that.emit('file-added', that, uploadFile, event);

                        decreaseReamining();
                    });
                } else {
                    filesSkipped.push(file);

                    decreaseReamining();
                }
            }

            const id = createId(file, event);
            addFile(id);
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

    _uploadNextFile() {
        const that = this;

        let found = false;

        each(that.uploadFiles, function (uploadFile) {
            found = uploadFile._uploadNext();

            if (found) {
                return false;
            }
        });

        if (found) {
            return true;
        }

        let outstanding = false;
        each(that.uploadFiles, function (uploadFile) {
            if (!uploadFile.isCompleted()) {
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

        let flag = false;
        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.isUploading()) {
                flag = true;

                return false;
            }
        });

        return flag;
    }

    upload() {
        const that = this;

        if (that.isUploading()) {
            return;
        }

        that._status = UPLOAD_STATUS.uploading;

        that.emit('before-upload', that);

        for (let i = 1; i <= that.options.simultaneousUploads; i++) {
            that._uploadNextFile();
        }
    }

    getSize(format) {
        const that = this;

        let totalSize = 0;
        each(that.uploadFiles, function (uploadFile) {
            totalSize += uploadFile.fileSize;
        });

        return format ? formatSize(totalSize) : totalSize;
    }

    getChunked() {
        const that = this;

        let chunked = true;
        each(that.uploadFiles, function (uploadFile) {
            if (!uploadFile._chunked) {
                chunked = false;

                return false;
            }
        });

        return chunked;
    }

    getFromId(id) {
        const that = this;
        let ret = false;

        each(that.uploadFiles, function (uploadFile) {
            if (uploadFile.id === id) {
                ret = uploadFile;
            }
        });

        return ret;
    }

    bindDrop(div) {
        const that = this;

        on(div, 'dragover', this._handleDragOver.bind(that));
        on(div, 'dragenter', this._handleDragEnter.bind(that));
        on(div, 'dragleave', this._handleDragLeave.bind(that));
        on(div, 'drop', this._handleDrop.bind(that));

        this.emit('bind-drop-created', this);
    }

    _handleDragEnter(e) {
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

    _handleDragOver(e) {
        this._handleDragEnter(e);
    }

    _handleDragLeave(e) {
        removeClass(e.currentTarget, DRAG_CLASSNAME);
    }

    _handleDrop(e) {
        removeClass(e.currentTarget, DRAG_CLASSNAME);
        e.stopPropagation();
        e.preventDefault();

        if (e.dataTransfer && e.dataTransfer.items) {
            this._loadFiles(e.dataTransfer.items, e);
        } else if (e.dataTransfer && e.dataTransfer.files) {
            this._loadFiles(e.dataTransfer.files, e);
        }
    }

    _loadFiles(items, event) {
        const that = this;

        if (!items.length) {
            return;
        }

        let files = [];

        processCallbacks(
            Array.prototype.map.call(items, function (item) {
                let entry = item;

                if (isFunction(item.webkitGetAsEntry)) {
                    entry = item.webkitGetAsEntry();
                }

                return processItem.bind(null, entry, '', files);
            }),
            function () {
                if (files.length) {
                    that._addFiles(files, event);
                }
            }
        );
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

        this.emit('bind-input-created', this);
    }
}

Uploader.UPLOAD_STATUS = UPLOAD_STATUS;

Uploader.UPLOAD_FILE_STATUS = UPLOAD_FILE_STATUS;
Uploader.MERGED_STATUS = MERGED_STATUS;
Uploader.CHUNK_EXISTS_STATE = CHUNK_EXISTS_STATE;

export default Uploader;
