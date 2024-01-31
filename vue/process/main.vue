<template>
    <div class="yma-process">
        <div class="yma-process__bar">
            <div class="yma-process__bar-outer">
                <div class="yma-process__bar-inner" :style="barStyle"></div>
            </div>
        </div>

        <div class="yma-process__text">{{ percentage }}%</div>
    </div>
</template>

<script>
export default {
    name: 'YmaProcess',
    props: {
        percentage: {
            type: Number,
            default: 0,
            required: true,
            validator: val => val >= 0 && val <= 100,
        },
        width: {
            type: Number,
            default: 100,
        },
    },
    computed: {
        barStyle() {
            const style = {};
            style.width = this.percentage + '%';

            return style;
        },
    },
    data() {
        return {};
    },
};
</script>

<style lang="scss">
@import 'yma-csskit/bem.scss';

@include b(process) {
    @include e(bar) {
        @include e(bar-outer) {
            position: relative;
            vertical-align: middle;
            flex: 1;
            overflow: hidden;
            height: 6px;
            border-radius: 100px;
            background: #eee;
        }

        @include e(bar-inner) {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            border-radius: 100px;
            background-color: #1f69e0;
            line-height: 1;
            text-align: right;
            white-space: nowrap;
            transition: width .6s ease;
        }

        display: inline-flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }

    @include e(text) {
        box-sizing: border-box;
        width: 54px;
        padding-left: 12px;
        color: rgba(13, 13, 13, .9);
        font-weight: 400;
        font-style: normal;
        font-size: 14px;
        font-family: 'PingFang SC';
    }

    position: relative;
    display: flex;
    flex-direction: row;
    height: 32px;
    line-height: 1;
    line-height: 32px;
}
</style>
