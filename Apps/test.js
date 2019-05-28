
        function startup(Cesium) {
            var pointData = [
                [31.0840587516, 121.5301772615],
                [31.0842907516, 121.5307252615],
                [31.0847737516, 121.5305362615]
            ];

            var modelUrl = './SampleData/models/CesiumMilkTruck/CesiumMilkTruck.glb';

            var tilesUrl = 'http://localhost:8081/static/tiles/unistrong/tileset.json';

            var viewer = initView('cesiumContainer');
            var scene = viewer.scene;
            var clock = viewer.clock;
            var model = addModel(viewer, modelUrl, pointData[0]);

            var tiles = addTiles(viewer, tilesUrl);

            var cartoScratch = new Cesium.Cartographic.fromDegrees(pointData[0][1], pointData[0][0]);

            function start() {
              
                // scene.postRender.addEventListener(function () {
                //     var position = model.position.getValue(clock.currentTime);
                //     model.position = scene.clampToHeight(position, objectsToExclude);
                // });
            }

          
            function addTiles(viewer, url) {
                var tileset = new Cesium.Cesium3DTileset({
                    url: url
                });
                scene.primitives.add(tileset);
                viewer.zoomTo(tileset);
                return tileset;
            }

           
        }