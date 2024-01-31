import SparkMD5 from 'spark-md5';

onmessage = e => {
    const {file} = e.data;
    const spark = new SparkMD5.ArrayBuffer();

    const reader = new FileReader();

    reader.onload = e => {
        spark.append(e.target.result);

        const hash = spark.end();

        self.postMessage({
            hash,
        });
    };

    reader.readAsArrayBuffer(file);
};
