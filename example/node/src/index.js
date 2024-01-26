const Koa = require('koa');
const koaCors = require('koa2-cors');
const koaBody = require('koa-body').default;
const KoaRouter = require('koa-router');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const mime = require('mime');
const tempDir = path.resolve(__dirname, '../.temp');
const uploadDir = path.resolve(__dirname, '../.upload');

const app = new Koa();
const router = new KoaRouter();

async function sleep(delay) {
    return new Promise(resolve => {
        setTimeout(function () {
            resolve();
        }, delay);
    });
}

router.get('/merge', async function (ctx, next) {
    ctx.body = {
        code: 0,
        message: 'success',
    };
});

function write(file, query) {
    const chunkName = query.chunkNumber;
    const chunkDir = path.resolve(tempDir, query.fileHash);
    const chunkFilepath = path.resolve(chunkDir, chunkName);

    fse.ensureFileSync(chunkFilepath);

    const reader = fs.createReadStream(file.filepath);
    const writer = fs.createWriteStream(chunkFilepath);

    reader.pipe(writer);

    return new Promise(function (resolve) {
        writer.on('finish', function () {
            resolve();
        });
    });
}

router.post('/precheck', async function (ctx, next) {
    const query = ctx.request.query;

    const {fileHash, chunkNumber} = query;

    const isExists = fse.existsSync(
        path.resolve(tempDir, fileHash, chunkNumber)
    );

    ctx.body = {
        code: isExists ? 1 : 0,
        message: isExists ? 'exists' : 'not exists',
    };
});

router.post('/upload', async function (ctx, next) {
    const file = ctx.request.files.file;

    if (!file) {
        next();
    } else {
        const query = ctx.request.query;

        await write(file, query);

        ctx.status = 200;
        ctx.body = 'success';
    }
});

router.post('/merge', async function (ctx, next) {
    const query = ctx.request.query;

    const {totalChunks, fileType, fileName, fileHash} = query;
    const extension = mime.getExtension(fileType);
    const mergedFilepath = path.resolve(uploadDir, `${fileName}`);

    fse.ensureFileSync(mergedFilepath);

    const writer = fs.createWriteStream(mergedFilepath);

    const prom = new Promise(function (resolve) {
        writer.on('finish', function () {
            resolve();
        });
    });

    const merge = function (totalChunks, callback) {
        const helper = function (idx, cb) {
            const chunkFilepath = path.resolve(tempDir, fileHash, String(idx));
            const reader = fs.createReadStream(chunkFilepath);

            reader.on('end', function () {
                if (idx < totalChunks) {
                    helper(idx + 1, cb);
                } else {
                    cb();
                }
            });

            reader.pipe(writer, {end: false});
        };

        helper(1, callback);
    };

    merge(totalChunks, function () {
        writer.end();
    });

    await prom;

    ctx.status = 200;

    ctx.body = {
        code: 0, // 0: merged 1：merging
        message: 'success',
    };
});

app.use(koaCors());

app.use(
    koaBody({
        multipart: true,
        formidable: {
            maxFileSize: 2 * 1024 * 1024 * 1024, // 设置上传文件大小最大限制，默认2G
        },
    })
);

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
