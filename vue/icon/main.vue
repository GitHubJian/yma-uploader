<template>
    <span :class="['yma-icon', 'yma-icon-' + name]" :style="customStyle">
        <svg class="yma-icon__inner">
            <use :xlink:href="href"/>
        </svg>
    </span>
</template>

<script>
export default {
    name: 'YmaIcon',
    props: {
        name: String,
        size: {
            type: String,
            default: null,
        },
    },
    computed: {
        href() {
            return `#${this.name}`;
        },
        customStyle() {
            if (this.size) {
                return `width: ${this.size}; height: ${this.size};`;
            }

            return null;
        },
    },
};
</script>

<style>
.yma-icon {
    display: inline-block;
    width: 16px;
    height: 16px;
    font-size: 0;
}

.yma-icon.is-cover {
    width: 100%;
    height: 100%;
}

.yma-icon .yma-icon__inner {
    width: 100%;
    height: 100%;
}
</style>
