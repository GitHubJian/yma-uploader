<template>
    <span
        class="yma-link"
        :class="{
            'is-disabled': disabled,
        }"
        @click="handleClick"
    >
        <span class="yma-link__content">
            <span class="yma-link__inner">
                <span v-if="iconName" class="yma-link__icon">
                    <yma-icon :name="iconName" />
                </span>

                <span class="yma-link__text">
                    <template v-if="$slots.default">
                        <slot></slot>
                    </template>
                    <template v-else>
                        {{ text }}
                    </template>
                </span>
            </span>
        </span>
    </span>
</template>

<script>
import YmaIcon from '../icon';

export default {
    name: 'YmaLink',
    components: {
        YmaIcon
    },
    props: {
        iconName: {
            type: String,
            default: 'anchor',
        },
        text: {
            type: String,
            default: '超链接',
        },
        disabled: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {};
    },
    methods: {
        handleClick(e) {
            if (!this.disabled) {
                this.$emit('click', e);
            }
        },
    },
};
</script>

<style lang="scss">
@import 'yma-csskit/bem.scss';

@include b(link) {
    @include when(disabled) {
        opacity: 0.3;
        cursor: not-allowed;
    }

    @include e(content) {
        display: flex;
        align-items: center;
    }

    @include e(inner) {
        position: relative;
        line-height: 22px;
        padding: 0 2px;
    }

    &:not(.is-disabled):hover {
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

    @include e(icon) {
        width: 14px;
        height: 14px;
        font-size: 0;
        margin-right: 8px;
    }

    @include e((icon, text)) {
        display: inline-block;
        vertical-align: middle;
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
