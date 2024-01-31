# YMA UDFiler

文件上传与下载

## Uploader

文件上传的使用方法

```js
const {Uploader} = require('yma-udfiler');
const uploader = new Uploader({
    // 详见代码注释
});

uploader.bindDrop(el); // 将一个 divEl 变为可拖拽上传的区域
uploader.bindInput(el); // 给定一个 inputEl 绑定上传事件
```

### file-added

文件添加时执行的钩子

```js
uploader.on('file-added', function (file) {
    // file 当前文件
});
```

### files-added

```js
uploader.on('files-added', function (files, filesSkipped) {
    // files 当前文件
    // filesSkipped 跳过的文件
});
```

### upload-start

开始上传时执行的钩子

### pause

全部文件暂停上传时执行的钩子

### before-cancel

全部文件取消上传前执行的钩子

### cancel

全部文件取消上传后执行的钩子

### complete

全部文件完成上传时的钩子

### chunking-start

文件分片开始时的钩子

### chunking-complete

文件分片完成时的钩子

### file-progress

文件上传进度钩子

### file-cancel

文件取消上传时的钩子

### file-error

文件上传失败时的钩子

### file-uploaded

文件上传成功时的钩子

### file-retry

文件上传重试时的钩子

### file-merged

文件执行合并时的钩子

## Downloader

文件下载的使用方法

```js
const downloader = new Downloader();

downloader.bindEl(btnEl); // 需要将数据挂在到 data-url、data-filename 上

downloader.bindElClick(btnEl, url, filename, options); // 无需挂在

downloader.saveAs(url, filename, options); // 直接下载文件
```
