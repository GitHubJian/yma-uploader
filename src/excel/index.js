import * as XLSX from 'xlsx';

function s2ab(s) {
    let buf = new ArrayBuffer(s.length);
    let view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
        view[i] = s.charCodeAt(i) & 0xff;
    }
    return buf;
}

export default function exportExcelFile(data, headers, options) {
    const sheetname = options.sheetname || 'sheet';
    const filename = options.filename || 'data.xlsx';

    let workbook = XLSX.utils.book_new();
    const sheetHeader = headers.map(function (header) {
        return header[1];
    });

    let mergedData = data.map(function (item) {
        const res = [];
        headers.forEach(function (header) {
            const [key, , convert] = header;
            const val = convert ? convert(item[key]) : item[key];
            res.push(val);
        });

        return res;
    });

    let worksheet = XLSX.utils.aoa_to_sheet([sheetHeader, ...mergedData]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetname);
    let excelData = XLSX.write(workbook, {type: 'binary'});

    let blob = new Blob([s2ab(excelData)], {type: 'application/octet-stream'});

    download(URL.createObjectURL(blob), filename);
}

function download(url, filename) {
    let a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
