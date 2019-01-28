define(['../Core/Cartesian2',
        '../Core/Cartesian3',
        '../Scene/VerticalOrigin',
        '../Scene/HorizontalOrigin'

], function(Cartesian2, Cartesian3, VerticalOrigin, HorizontalOrigin) {
    'use strict';

    var OptionsUtil = {};

    OptionsUtil.billboard = {
        verticalOrigin : VerticalOrigin.BOTTOM,
        horizontalOrigin : HorizontalOrigin.CENTER,
        pixelOffset : Cartesian2.ZERO,
        scale : 1.0,
        width : undefined,
        height : undefined
    };

    OptionsUtil.label = {
        fillColor : undefined,
        font : undefined,
        scale : 1.0,
        show : true,
        verticalOrigin : VerticalOrigin.BOTTOM,
        horizontalOrigin : HorizontalOrigin.CENTER,
        showBackground : false,
        backgroundColor : undefined,
        backgroundPadding : undefined,
        outlineColor : undefined,
        outlineWidth : undefined,
        pixelOffset : undefined,
        style : undefined
    };

    return OptionsUtil;
});
