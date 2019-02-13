define(function() {
    'use strict';

    /**
     * 计算多边形面积
     * @param {Array} positions
     * @return {number}
     * @constructor
     */
    function PolygonArea(positions) {
        var area = 0;
        if (positions && positions.length > 0) {
            area = computePolygonArea(positions);
        }
        return area;
    }

    function computePolygonArea(positions) {
        var t, r, i, n, o, a, s = 0,
            l = positions.length;
        if (l > 2) {
            for (var u = 0; u < l; u++) {
                if (u === l - 2) {
                    n = l - 2;
                    o = l - 1;
                    a = 0;
                } else if (u === l - 1) {
                    n = l - 1;
                    o = 0;
                    a = 1;
                } else {
                    n = u;
                    o = u + 1;
                    a = u + 2;
                }

                t = positions[n];
                r = positions[o];
                i = positions[a];
                s += (i.longitude - t.longitude) * Math.sin(r.latitude);
            }
            s = 6378137 * s * 6378137 / 2;
        }
        return s;
    }

    return PolygonArea;
});
