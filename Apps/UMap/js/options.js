var markerLayerOptions = function(options) {
    'use strict';
    return {
        viewer : options.viewer,
        url : options.url,
        id : options.id,
        codeNum : options.codeNum,
        layerProperty : options.layerProperty,
        layerStyle : options.layerStyle,
        selectable : options.selectable,
        codeName : options.codeName,
        labelText : options.labelText,
        layerCategory : options.layerCategory,
        imgPath : options.imgPath,
        type : options.type,
        showLabel : options.showLabel
    };
};
var options = {};
var x = {
    id : options.id,
    url : options.url,
    layerProperty : options.layerProperty,
    layerStyle : options.layerStyle,
    selectable : options.selectable,
    codeName : options.codeName,
    labelText : options.labelText,
    layerCategory : options.layerCategory,
    imgPath : options.imgPath,
    type : options.type,
    showLabel : options.showLabel
};

var billboardOptions = function(options) {
        return{
            width : '',
            height:'',
            verticalOrigin : '',
            heightReference : '',
            scale:'',
            pixelOffset : Cartesian2.zero
        };
} ;

var labelOptions = function(options) {
    'use strict';
    return {
        fillColor : '',
        font  : '',
        scale : '',
        show : '',
        verticalOrigin : '',
        horizontalOrigin:'',
        showBackground : options.showBackground,
        backgroundColor : options.backgroundColor,
        backgroundPadding : options.backgroundPadding,
        outlineColor : options.outlineColor,
        outlineWidth : options.outlineWidth,
        pixelOffset : options.pixelOffset,
        style  : options.labelStyle
    };
};
