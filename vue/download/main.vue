<template>
    <span class="yma-link" @click="handleClick">
        <span class="yma-link__content">
            <span class="yma-link__inner"> {{ text }}</span>
        </span>
    </span>
</template>

<script>
import {Downloader} from '../../src';

export default {
    name: 'YmaDownload',
    props: {
        text: {
            type: String,
            default: '下载',
        },
        url: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        },
    },
    data() {
        return {};
    },
    methods: {
        handleClick() {
            Downloader.saveAs(this.url, this.filename);
        },
    },
};
</script>

<style lang="scss">
@import 'yma-csskit/bem.scss';

@include b(link) {
    @include e(content) {
        display: flex;
        align-items: center;
    }

    @include e(inner) {
        position: relative;
        line-height: 22px;
    }

    @include pseudo(hover) {
        @include e(inner) {
            @include pseudo(after) {
                content: '';
                position: absolute;
                right: 0;
                bottom: 0;
                left: 0;
                height: 0;
                border-bottom: 1px solid rgba(30, 95, 199, 1);
            }
        }
    }

    position: relative;
    display: inline-flex;
    vertical-align: middle;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: rgba(30, 95, 199, 1);
    outline: none;
    font-weight: 400;
    font-size: 14px;
    text-decoration: none;
    cursor: pointer;
}
</style>
