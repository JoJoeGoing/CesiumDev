define(['../../Core/defined',
        '../../Core/Cartesian3',
        '../../Core/Ellipsoid',
], function(defined, Cartesian3,Ellipsoid) {
    'use strict';

    var ellipsoid = new Ellipsoid();

    /**
     *
     * @param CesiumScene
     * @param windowPosition
     * @param aboveHeight 最终高度
     * @returns {*}
     */
    function pickGlobe(CesiumScene, windowPosition, aboveHeight) {
        if(!defined(CesiumScene)){
            return;
        }
        if (CesiumScene.pickPositionSupported) {
            return CesiumScene.pickPosition(windowPosition);
        }

        var globe = CesiumScene.globe;
        var camera = CesiumScene.camera;
        var height = 0;
        if (defined(globe)) {
            ellipsoid = globe.ellipsoid;
            if (defined(aboveHeight)) {
                height += parseFloat(aboveHeight);
                return  getPosition(camera,windowPosition,height);
            }
            else{
               return camera.pickEllipsoid(windowPosition, ellipsoid);
            }
        }
    }
    function getPosition(CesiumCamera,windowPosition,height) {
        var cartesian3 = Cartesian3.fromElements(6378137 + height, 6378137 + height, 6356752.314245179 + height);
        var newEllipsoid = Ellipsoid.fromCartesian3(cartesian3);
        return CesiumCamera.pickEllipsoid(windowPosition, newEllipsoid);
    }

    return pickGlobe;
});
