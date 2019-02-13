define(['../Core/Cartesian2',
    '../Core/Cartesian3',
    '../Scene/VerticalOrigin',
    '../Scene/HorizontalOrigin',
    '../Core/Ellipsoid',
    '../Core/VertexFormat',
    '../Core/Color'

], function (Cartesian2, Cartesian3, VerticalOrigin, HorizontalOrigin, Ellipsoid, VertexFormat,Color) {
    'use strict';

    var OptionsUtil = {};

    OptionsUtil.billboard = {
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        pixelOffset: Cartesian2.ZERO,
        scale: 1.0,
        width: undefined,
        height: undefined
    };

    OptionsUtil.label = {
        fillColor: undefined,
        font: undefined,
        scale: 1.0,
        show: true,
        verticalOrigin: VerticalOrigin.BOTTOM,
        horizontalOrigin: HorizontalOrigin.CENTER,
        showBackground: false,
        backgroundColor: undefined,
        backgroundPadding: undefined,
        outlineColor: undefined,
        outlineWidth: undefined,
        pixelOffset: undefined,
        style: undefined
    };

    OptionsUtil.circle = {
        center: Cartesian3.ZERO,
        radius: 0.1,
        height: 0
    };

    OptionsUtil.drawOptions = {
        show: true,
        debugShowBoundingVolume: false,
        asynchronous : false,
        ellipsoid : Ellipsoid.WGS84,
        editable : false,
        width : 5,
        height : 0,
        queryPrimitive : false,
        color : new Color(0, 1, 1, 0.5)

    };


    return OptionsUtil;
});