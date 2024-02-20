export function isUndefined(v) {
    return typeof v === 'undefined';
}

export function isString(v) {
    return typeof v === 'string';
}

export function isBoolean(v) {
    return v === true || v === false;
}

export function isNumber(v) {
    return typeof v === 'number';
}

export function isFunction(v) {
    return typeof v === 'function';
}

export function noop(a, b, c) {}

export function identity(_) {
    return _;
}

export function createId(file) {
    let filepath = file.webkitRelativePath || file.relativePath || file.fileName || file.name;
    let size = file.size;

    return size + '-' + filepath.replace(/[^0-9a-zA-Z_-]/gim, '');
}

export function formatSize(size) {
    if (size < 1024) {
        return size + ' bytes';
    }
    else if (size < 1024 * 1024) {
        return (size / 1024.0).toFixed(0) + ' KB';
    }
    else if (size < 1024 * 1024 * 1024) {
        return (size / 1024.0 / 1024.0).toFixed(1) + ' MB';
    }
    return (size / 1024.0 / 1024.0 / 1024.0).toFixed(1) + ' GB';
}

export function each(objOrArray, callback) {
    if (!isUndefined(objOrArray.length)) {
        for (let i = 0; i < objOrArray.length; i++) {
            if (callback(objOrArray[i]) === false) {
                return;
            }
        }
    }
    else {
        for (let key in objOrArray) {
            if (callback(key, objOrArray[key]) === false) {
                return;
            }
        }
    }
}

export function nextTick(fn, delay = 0) {
    window.setTimeout(function () {
        fn && fn();
    }, delay);
}

export function on(el, event, handler) {
    if (document.addEventListener) {
        if (el && event && handler) {
            el.addEventListener(event, handler, false);
        }
    }
    else {
        if (el && event && handler) {
            el.attachEvent('on' + event, handler);
        }
    }
}

export function getAttr(el, name) {
    return el.getAttribute(name);
}

export function attr(el, name, value) {
    if (!value) {
        el.removeAttribute(name);
    }
    else {
        el.setAttribute(name, value);
    }
}

export function off(el, event, handler) {
    if (document.removeEventListener) {
        if (el && event) {
            el.removeEventListener(event, handler, false);
        }
    }
    else {
        if (el && event) {
            el.detachEvent('on' + event, handler);
        }
    }
}

export function contains(list, target) {
    let result = false;

    each(list, function (val) {
        if (val == target) {
            result = true;
            return false;
        }
        return true;
    });

    return result;
}

export function createUrl(url, params) {
    let separator = url.indexOf('?') < 0 ? '?' : '&';
    let joinedParams = params.join('&');

    if (joinedParams) {
        url = url + separator + joinedParams;
    }

    return url;
}

export function hasClass(obj, cls) {
    return obj.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
}

export function addClass(obj, cls) {
    if (!hasClass(obj, cls)) {
        obj.className += ' ' + cls;
    }
}

export function removeClass(obj, cls) {
    if (hasClass(obj, cls)) {
        const reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
        obj.className = obj.className.replace(reg, ' ');
    }
}

export function toggleClass(obj, cls) {
    if (hasClass(obj, cls)) {
        removeClass(obj, cls);
    }
    else {
        addClass(obj, cls);
    }
}
