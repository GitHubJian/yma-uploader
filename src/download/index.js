import {isString, isUndefined, nextTick, getAttr, on} from '../util';

const $global =
    typeof window === 'object' && window.window === window
        ? window
        : typeof self === 'object' && self.self === self
        ? self
        : typeof global === 'object' && global.global === global
        ? global
        : this;

const isMacOSWebView =
    $global.navigator &&
    /Macintosh/.test($global.navigator.userAgent) &&
    /AppleWebKit/.test($global.navigator.userAgent) &&
    !/Safari/.test($global.navigator.userAgent);

class Downloader {
    constructor() {
        this.saveAs = this.createSaveAs();
    }

    _bom(blob, options) {
        if (isUndefined(options)) {
            options = {
                autoBom: false,
            };
        } else if (typeof options !== 'object') {
            console.warn('Deprecated: Expected third argument to be a object');
            options = {
                autoBom: !options,
            };
        }

        if (
            options.autoBom &&
            /^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)
        ) {
            return new Blob([String.fromCharCode(0xfeff), blob], {
                type: blob.type,
            });
        }

        return blob;
    }

    _download(url, name, options) {
        const that = this;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';

        on(xhr, 'load', function () {
            that.saveAs(xhr.response, name, options);
        });

        on(xhr, 'error', function () {
            console.error('could not download file');
        });

        xhr.send();
    }

    _corsEnabled(url) {
        const xhr = new XMLHttpRequest();

        // 同步请求
        xhr.open('HEAD', url, false);

        try {
            xhr.send();
        } catch (e) {}

        return xhr.status >= 200 && xhr.status <= 299;
    }

    _click(el) {
        try {
            el.dispatchEvent(new MouseEvent('click'));
        } catch (error) {
            const evt = document.createEvent('MouseEvents');
            evt.initMouseEvent('click', true, true, window, 0, 0, 0, 80, 20, false, false, false, false, 0, null);

            el.dispatchEvent(evt);
        }
    }

    createSaveAs() {
        const that = this;

        if (typeof window !== 'object' || window !== $global) {
            return function saveAs() {};
        }

        if ($global.saveAs) {
            return saveAs;
        }

        if ('download' in HTMLAnchorElement.prototype && !isMacOSWebView) {
            return function saveAs(blob, name, options) {
                const URL = $global.URL || $global.webkitURL;

                const a = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
                name = name || blob.name || 'download';

                a.download = name;
                a.rel = 'noopener'; // tabnabbing

                if (isString(blob)) {
                    a.href = blob;

                    if (a.origin !== location.origin) {
                        that._corsEnabled(a.href)
                            ? that._download(blob, name, options)
                            : that._click(a, (a.target = '_blank'));
                    } else {
                        that._click(a);
                    }
                } else {
                    a.href = URL.createObjectURL(blob);

                    nextTick(function () {
                        URL.revokeObjectURL(a.href);
                    }, 4e4); // 40s

                    nextTick(function () {
                        that._click(a);
                    }, 0);
                }
            };
        }

        if ('msSaveOrOpenBlob' in navigator) {
            return function saveAs(blob, name, options) {
                name = name || blob.name || 'download';

                if (isString(blob)) {
                    if (that._corsEnabled(blob)) {
                        that._download(blob, name, options);
                    } else {
                        const a = document.createElement('a');
                        a.href = blob;
                        a.target = '_blank';

                        nextTick(function () {
                            that._click(a);
                        });
                    }
                } else {
                    navigator.msSaveOrOpenBlob(that._bom(blob, options), name);
                }
            };
        }

        return function saveAs(blob, name, options) {
            const popup = open('', '_blank');
            if (popup) {
                popup.document.title = '';
                popup.document.body.innerText = 'downloading...';
            }

            if (isString(blob)) {
                return that._download(blob, name, options);
            }

            const force = blob.type === 'application/octet-stream';
            const isSafari = /constructor/i.test($global.HTMLElement) || $global.safari;
            const isChromeIOS = /CriOS\/[\d]+/.test(navigator.userAgent);

            if ((isChromeIOS || (force && isSafari) || isMacOSWebView) && !isUndefined(FileReader)) {
                // Safari doesn't allow downloading of blob URLs
                const reader = new FileReader();

                on(reader, 'loadend', function () {
                    let url = reader.result;
                    url = isChromeIOS ? url : url.replace(/^data:[^;]*;/, 'data:attachment/file;');

                    if (popup) {
                        popup.location.href = url;
                    } else {
                        location = url;
                    }

                    popup = null;
                });

                reader.readAsDataURL(blob);
            } else {
                const URL = $global.URL || $global.webkitURL;
                const url = URL.createObjectURL(blob);
                if (popup) {
                    popup.location = url;
                } else {
                    location.href = url;
                }

                popup = null; // reverse-tabnabbing #460

                nextTick(function () {
                    URL.revokeObjectURL(url);
                }, 4e4); // 40s
            }
        };
    }

    bindEl(el) {
        const that = this;

        const url = getAttr(el, 'data-url');
        const filename = getAttr(el, 'data-filename');

        that.bindElClick(el, url, filename);
    }

    bindElClick(el, url, filename, options) {
        const that = this;

        on(el, 'click', function () {
            that.saveAs.call(this, url, filename, options);
        });
    }
}

const saveAs = ($global.saveAs = new Downloader().saveAs);

Downloader.saveAs = saveAs;

export default Downloader;
