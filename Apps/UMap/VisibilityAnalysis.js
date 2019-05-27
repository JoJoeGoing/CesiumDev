// define([
//   "../Core/BoundingRectangle",
//   "../Core/BoundingSphere",
//   "../Core/Cartesian3",
//   "../Core/Color",
//   "../Core/ComponentDatatype",
//   "../Core/defined",
//   "../Core/defineProperties",
//   "../Core/destroyObject",
//   "../Core/IndexDatatype",
//   "../Core/Intersect",
//   "../Core/Math",
//   "../Core/Matrix3",
//   "../Core/Matrix4",
//   "../Core/PixelFormat",
//   "../Core/PrimitiveType",
//   "../Core/Transforms",
//   "../Renderer/Buffer",
//   "../Renderer/BufferUsage",
//   "../Renderer/ClearCommand",
//   "../Renderer/DrawCommand",
//   "../Renderer/Framebuffer",
//   "../Renderer/Pass",
//   "../Renderer/PassState",
//   "../Renderer/PixelDatatype",
//   "../Renderer/RenderState",
//   "../Renderer/Sampler",
//   "../Renderer/ShaderProgram",
//   "../Renderer/ShaderSource",
//   "../Renderer/Texture",
//   "../Renderer/TextureMagnificationFilter",
//   "../Renderer/TextureMinificationFilter",
//   "../Renderer/VertexArray",
//   "../Scene/BlendingState",
//   "../Scene/Camera",
//   "../Scene/Scene",
//   "../Shaders/ViewshedLineFS",
//   "../Shaders/ViewshedLineVS"
// ], function(BoundingRectangle,BoundingSphere,Cartesian3,Color,ComponentDatatype,
//   defined,defineProperties,destroyObject,IndexDatatype,Intersect, Math,Matrix3,
//   Matrix4, PixelFormat, PrimitiveType,Transforms,Buffer,BufferUsage,ClearCommand,
//   DrawCommand,Framebuffer,Pass,PassState,PixelDatatype,RenderState,Sampler,ShaderProgram,
//   ShaderSource,Texture,TextureMagnificationFilter,TextureMinificationFilter,VertexArray,
//   BlendingState,Camera,Scene,ViewshedLineFS,ViewshedLineVS
// ) {
//   "use strict";

//   function VisibilityAnalysis(viewer) {
//       this._viewer = viewer;
//       this._viewerPosition = new Cartesian3(0, 0, 0);
//       this._direction = 0;
//       this._pitch = 0;
//       this._horizontalFov = 60;
//       this._verticalFov = 60;
//       this._distance = 100;
//       this._visibleAreaColor = new Color(0, 1, 0, 0.5);
//       this._hiddenAreaColor = new Color(1, 0, 0, 0.5);
//       this._targetPoint = new Cartesian3(0, 0, 0);
//       this._modelMatrix = new Matrix4();
//       this._lineColor = Color.YELLOW;
//       this._hintLineUpdated = false;
//       this._initialized = false;
//       this._cameraUpdated = false;
//       this._indices = undefined;
//       this._positions = undefined;
//       this._drawLineCommand = undefined;
//       this._depthPassState = undefined;
//       this._depthCamera = undefined;
//       this._textureViewMatrix = new Matrix4();
//       this._textureProjMatrix = new Matrix4();
//       this._resultFrameBuffer = [];
//       this._resultTextures = [];
//       this._lastResultTexture = undefined;
//       this._parentViewshed = undefined;
//       this._childViewsheds = [];
//       this._analysisCommand = undefined;
//       this._mapDrawCommand = undefined;
//       this._valid = false;
//   }

//   function F(e, t, context) {
//     var state = RenderState.fromCache({
//       depthTest: {
//         enabled: false
//       },
//       depthMask: false
//     });
//     var n =
//       "precision highp float;\n\nuniform sampler2D u_sceneDepthTexture;\nuniform sampler2D u_depthTexture;\nuniform sampler2D u_lastResultTexture;\nuniform mat4 u_textureViewMatrix;\nuniform mat4 u_textureProjMatrix;\nuniform float u_farDist;\nuniform vec4 u_visibleAreaColor;\nuniform vec4 u_hiddenAreaColor;\n\nvarying vec2 v_textureCoordinates;\n\nvoid main()\n{\n    // result.x: 0-不在可视域范围内，0.5-不可见，1.0-可见。\n    vec4 result = texture2D(u_lastResultTexture, v_textureCoordinates);\n    // 可见就直接赋值为可见。\n    if (result.x != 1.0) {\n       float sceneDepth = czm_unpackDepth(texture2D(u_sceneDepthTexture, v_textureCoordinates));\n       sceneDepth = sceneDepth>0.0 ? sceneDepth : 1.0;\n       vec4 projPos = vec4(v_textureCoordinates*2.0-1.0, sceneDepth*2.0-1.0, 1.0);\n       vec4 texViewPos = u_textureViewMatrix * projPos;\n       vec4 texProjPos = u_textureProjMatrix * texViewPos;\n       texProjPos /= texProjPos.w;\n       texProjPos.xyz = texProjPos.xyz * 0.5 + 0.5;\n\n       // 计算最远距离的深度\n       texViewPos /= texViewPos.w;\n       texViewPos.xyz *= u_farDist / length(texViewPos.xyz);\n       vec4 farPos = u_textureProjMatrix * texViewPos;\n       float farDepth = farPos.z / farPos.w;\n       farDepth = farDepth * 0.5 + 0.5;\n       farDepth = min(farDepth, 1.0);\n\n       if (texProjPos.x > 0.0 && texProjPos.x < 1.0 &&\n           texProjPos.y > 0.0 && texProjPos.y < 1.0 &&\n           texProjPos.z > 0.5 && texProjPos.z < farDepth) {\n           float depth = texture2D(u_depthTexture, texProjPos.xy).r;\n           if (depth < 1.0 && depth - texProjPos.z < -1.0e-5) {\n               result.x = 0.5;\n           } else {\n               result.x = 1.0;\n           }\n       }\n   }\n   gl_FragColor = result;\n}";
   
//     var fragmentShaderSource = new ShaderSource({
//       sources: [n]
//     });
   
//     var uniforms = {
//       u_sceneDepthTexture: function() {
//         return e._viewer.scene._pickDepths[0]._depthTexture;
//       },
//       u_depthTexture: function() {
//         return e._depthPassState.framebuffer.depthStencilTexture;
//       },
//       u_lastResultTexture: function() {
//         return t._lastResultTexture;
//       },
//       u_textureViewMatrix: function() {
//         return e._textureViewMatrix;
//       },
//       u_textureProjMatrix: function() {
//         return e._textureProjMatrix;
//       },
//       u_farDist: function() {
//         return e._distance;
//       }
//     };
//     return context.createViewportQuadCommand(fragmentShaderSource, {
//       renderState: state,
//       uniformMap: uniforms,
//       owner: e
//     });
//   }

//   function U(e, context) {
//     var state = RenderState.fromCache({
//       depthTest: {
//         enabled: false
//       },
//       depthMask: false,
//       blending: BlendingState.ALPHA_BLEND
//     });
//     var i =
//       "precision highp float;\n\nuniform sampler2D u_resultTexture;\nuniform vec4 u_visibleAreaColor;\nuniform vec4 u_hiddenAreaColor;\n\nvarying vec2 v_textureCoordinates;\n\nvoid main()\n{\n    vec4 color = vec4(0.0);\n    // result.x: 0-不在可视域范围内，0.5-不可见，1.0-可见。\n    vec4 result = texture2D(u_resultTexture, v_textureCoordinates);\n    if (result.x > 0.9)\n       color = u_visibleAreaColor;\n    else if (result.x > 0.4)\n       color = u_hiddenAreaColor;\n    gl_FragColor = color;\n}";
//     var fragmentShaderSource = new ShaderSource({
//       sources: [i]
//     });
//     var uniforms = {
//       u_resultTexture: function() {
//         return e._lastResultTexture;
//       },
//       u_visibleAreaColor: function() {
//         return e._visibleAreaColor;
//       },
//       u_hiddenAreaColor: function() {
//         return e._hiddenAreaColor;
//       }
//     };
//     return context.createViewportQuadCommand(fragmentShaderSource, {
//       renderState: state,
//       uniformMap: uniforms,
//       owner: e
//     });
//   }

//   defineProperties(VisibilityAnalysis.prototype, {
//     viewerPosition: {
//       get: function() {
//         return this._viewerPosition;
//       },
//       set: function(position) {
//         this._viewerPosition = position;
//         this._cameraUpdated = false;
//       }
//     },
//     direction: {
//       get: function() {
//         return this._direction;
//       },
//       set: function(direction) {
//         this._direction = direction;
//         this._cameraUpdated = false;
//       }
//     },
//     pitch: {
//       get: function() {
//         return this._pitch;
//       },
//       set: function(e) {
//         this._pitch = e;
//         this._cameraUpdated = false;
//       }
//     },
//     horizontalFov: {
//       get: function() {
//         return this._horizontalFov;
//       },
//       set: function(horizontalFov) {
//         this._horizontalFov = horizontalFov;
//         this._cameraUpdated = false;
//         this._hintLineUpdated = false;
//       }
//     },
//     verticalFov: {
//       get: function() {
//         return this._verticalFov;
//       },
//       set: function(verticalFov) {
//         this._verticalFov = verticalFov,
//         this._cameraUpdated = false,
//         this._hintLineUpdated = false;
//       }
//     },
//     distance: {
//       get: function() {
//         return this._distance;
//       },
//       set: function(distance) {
//         this._distance = distance,
//         this._cameraUpdated = false,
//         this._hintLineUpdated = false;
//       }
//     },
//     visibleAreaColor: {
//       get: function() {
//         return this._visibleAreaColor;
//       },
//       set: function(visibleAreaColor) {
//         this._visibleAreaColor = visibleAreaColor;
//       }
//     },
//     hiddenAreaColor: {
//       get: function() {
//         return this._hiddenAreaColor;
//       },
//       set: function(hiddenAreaColor) {
//         this._hiddenAreaColor = hiddenAreaColor;
//       }
//     }
//   });

//   VisibilityAnalysis.prototype.setPoseByTargetPoint = function(targetPointPosition) {
//     this.distance = Cartesian3.distance(this._viewerPosition, targetPointPosition);
//     var t = new Cartesian3();
//     var i = Transforms.eastNorthUpToFixedFrame(this._viewerPosition);
//     Matrix4.inverse(i, i);
//     Matrix4.multiplyByPoint(i, targetPointPosition, t);
//     Cartesian3.normalize(t, t);
//     this.direction = Math.toDegrees(Math.atan2(t.x, t.y));
//     this.pitch = Math.toDegrees(Math.asin(t.z));
//   };

//   VisibilityAnalysis.prototype.attachViewshed = function(e) {
//       if(defined(e) && !defined(e._parentViewshed)){
//         this._childViewsheds.push(e);
//         e._parentViewshed = this;
//       }
//       return true;
//   };

//   VisibilityAnalysis.prototype.detachViewshed = function(e) {
//     if (!defined(e)) {
//         return false;
//     }
//     var t = this._childViewsheds.length
//     for (var r = 0; r < t; ++r)
//       if (this._childViewsheds[r] === e) {
//         e._childViewsheds.splice(r, 1);
//         e._parentViewshed = undefined;
//         return true;
//       }

//     return false;
//   };

//   VisibilityAnalysis.prototype.locateToViewer = function() {
//     this._viewer.camera.setView({
//       destination: this._depthCamera.position,
//       orientation: {
//         direction: this._depthCamera.direction,
//         up: this._depthCamera.up
//       }
//     });
//   };

//   VisibilityAnalysis.prototype.update = function(e) {
//     e.viewshed3ds.push(this);
//   };

//   VisibilityAnalysis.prototype._initialize = function() {
//     this._positions = new Float32Array(633);
//     this._indices = new Uint16Array(408);
//     var t = this._indices;
//     var r = 0;
//     t[r++] = 0;
//     t[r++] = 1;
//     t[r++] = 0;
//     t[r++] = 21;
//     t[r++] = 0;
//     t[r++] = 85;
//     t[r++] = 0;
//     t[r++] = 105;
//     for (var i = 0, n = 0; n < 5; ++n) {
//       i++;
//       for (var a = 0; a < 20; ++a) (t[r++] = i++), (t[r++] = i);
//     }
//     i++;
//     for (var s = 0; s < 20; ++s)
//       for (var l = 0; l < 5; ++l) (t[r++] = i), (t[r++] = i++ + 5);
//     var u = this._viewer.scene;
//     var c = u._context;
//     var d = 2048;
//     var h = 2048;
//     if (
//       (defined(this._depthCamera) || (this._depthCamera = new Camera(u)),
//       !defined(this._depthPassState))
//     ) {
//       var f = new Framebuffer({
//         context: c,
//         depthStencilTexture: new Texture({
//           context: c,
//           width: d,
//           height: h,
//           pixelFormat: PixelFormat.DEPTH_STENCIL,
//           pixelDatatype: PixelDatatype.UNSIGNED_INT_24_8
//         })
//       });
//       this._depthPassState = new PassState(c);
//       this._depthPassState.viewport = new BoundingRectangle(0, 0, d, h);
//       this._depthPassState.framebuffer = f;
//     }
//     this._initialized = true;
//   };

//   VisibilityAnalysis.prototype._updateCamera = function() {
//     this._depthCamera.frustum.near = 0.001 * this._distance;
//     this._depthCamera.frustum.far = this._distance;
//     this._depthCamera.frustum.fov = Math.toRadians(this._verticalFov);
//     this._depthCamera.frustum.aspectRatio = this._horizontalFov / this._verticalFov;
//     this._depthCamera.setView({
//       destination: this._viewerPosition,
//       orientation: {
//         heading: Math.toRadians(this._direction),
//         pitch: Math.toRadians(this._pitch)
//       }
//     });
//     this._modelMatrix = this._depthCamera.inverseViewMatrix;
//     this._cameraUpdated = true;
//   };

//   VisibilityAnalysis.prototype._updateHintLine = function(e) {
//     var i;
//     var a;
//     var s;
//     var  d;
//     var  p = this._positions;
//     var  m = Math.toRadians(this._horizontalFov);
//     var v = Math.toRadians(this._verticalFov);
//     var  b = Math.tan(0.5 * m),
//     var  S = Math.tan(0.5 * v);
//     a = this._distance * b;
//     d = this._distance * S;
//     i = -a;
//     s = -d;
//     var w = new Cartesian3(i, s, -this._distance);
//     var  E = new Cartesian3(a, d, 0);
//     Matrix4.multiplyByPoint(this._modelMatrix, w, w);
//     Matrix4.multiplyByPoint(this._modelMatrix, E, E);
//     var x = BoundingSphere.fromCornerPoints(w, E);
//     if (e.cullingVolume.computeVisibility(x) === Intersect.OUTSIDE)
//       return void (this._valid = false);
//     this._valid = true;
//     var P = 0;
//     p[P++] = 0;
//     p[P++] = 0;
//     p[P++] = 0;
//     for (var D, I, M = Math.PI - 0.5 * m, R = m / 4, L = 0; L < 5; ++L) {
//       D = M + L * R;
//       for (
//         var B = d / (this._distance / Math.cos(D)),
//           F = Math.atan(B),
//           U = -F,
//           V = F / 10,
//           z = 0;
//         z < 21;
//         ++z
//       )
//         (I = U + z * V),
//           (p[P++] = this._distance * Math.cos(I) * Math.sin(D)),
//           (p[P++] = this._distance * Math.sin(I)),
//           (p[P++] = this._distance * Math.cos(I) * Math.cos(D));
//     }
//     R = m / 20;
//     for (var G = 0; G < 21; ++G) {
//       D = M + G * R;
//       for (
//         var B = d / (this._distance / Math.cos(D)),
//           F = Math.atan(B),
//           U = -F,
//           V = F / 2,
//           H = 0;
//         H < 5;
//         ++H
//       )
//         (I = U + H * V),
//           (p[P++] = this._distance * Math.cos(I) * Math.sin(D)),
//           (p[P++] = this._distance * Math.sin(I)),
//           (p[P++] = this._distance * Math.cos(I) * Math.cos(D));
//     }
//     var W = e.context;
//     var  j = Buffer.createIndexBuffer({
//         context: W,
//         typedArray: new Uint32Array(this._indices),
//         usage: BufferUsage.STATIC_DRAW,
//         indexDatatype: IndexDatatype.UNSIGNED_INT
//       });
//      var q = Buffer.createVertexBuffer({
//         context: W,
//         typedArray: ComponentDatatype.createTypedArray(ComponentDatatype.FLOAT, this._positions),
//         usage: BufferUsage.STATIC_DRAW
//       });
//     var  Y = [];
//     Y.push({
//       index: 0,
//       vertexBuffer: q,
//       componentDatatype: ComponentDatatype.FLOAT,
//       componentsPerAttribute: 3,
//       normalize: false
//     });
//     var X = new VertexArray({
//       context: W,
//       attributes: Y,
//       indexBuffer: j
//     });
//     if (defined(this._drawLineCommand))
//       this._drawLineCommand.vertexArray.destroy(),
//         (this._drawLineCommand.vertexArray = X),
//         (this._drawLineCommand.modelMatrix = this._modelMatrix),
//         (this._drawLineCommand.boundingVolume = x);
//     else {
//       var Q = ShaderProgram.fromCache({
//           context: W,
//           vertexShaderSource: ViewshedLineVS,
//           fragmentShaderSource: ViewshedLineFS
//         });
//         var Z = RenderState.fromCache({
//           depthTest: {
//             enabled: true
//           }
//         });
//         var K = this;
//         var J = {
//           u_bgColor: function() {
//             return K._lineColor;
//           },
//           u_modelViewMatrix: function() {
//             return W.uniformState.modelView;
//           }
//         };
//       this._drawLineCommand = new DrawCommand({
//         boundingVolume: x,
//         modelMatrix: K._modelMatrix,
//         primitiveType: PrimitiveType.LINES,
//         vertexArray: X,
//         shaderProgram: Q,
//         castShadows: false,
//         receiveShadows: false,
//         uniformMap: J,
//         renderState: Z,
//         pass: Pass.OPAQUE
//       });
//     }
//     this._hintLineUpdated = true;
//   };

//   VisibilityAnalysis.prototype.updateDepthMap = function(e) {
//     if (0 !== this._distance) {
//       this._initialized || this._initialize();
//       this._cameraUpdated || this._updateCamera();
//       var t = this._viewer.scene._frameState;
//       if ((this._hintLineUpdated || this._updateHintLine(t), this._valid)) {
//         Matrix4.multiply(
//           e._camera.workingFrustums[0].projectionMatrix,
//           e._camera.viewMatrix,
//           this._textureViewMatrix
//         );
//           Matrix4.inverse(this._textureViewMatrix, this._textureViewMatrix);
//           Matrix4.multiply(
//             this._depthCamera.viewMatrix,
//             this._textureViewMatrix,
//             this._textureViewMatrix
//           );
//           Matrix4.clone(
//             this._depthCamera.frustum.projectionMatrix,
//             this._textureProjMatrix
//           );
//         var r = new ClearCommand({
//           depth: 1,
//           framebuffer: this._depthPassState.framebuffer
//         });
//         this._viewer.scene.renderDepth(
//           r,
//           this._depthPassState,
//           this._depthCamera
//         );
//       }
//     }
//   };
//   VisibilityAnalysis.prototype.execute = function(e, t) {
//     if (
//       (0 !== this._distance && this._valid && e.draw(this._drawLineCommand, t),
//       !defined(this._parentViewshed))
//     ) {
//       var r = t.viewport.width;
//       var  n = t.viewport.height;
//       if (
//         0 === this._resultTextures.length ||
//         this._resultTextures[0].width != r ||
//         this._resultTextures[0].height != n
//       ) {
//         (this._resultTextures = []), (this._resultFrameBuffer = []);
//         for (
//           var a = new Sampler({
//               minificationFilter: TextureMinificationFilter.NEAREST,
//               magnificationFilter: TextureMagnificationFilter.NEAREST
//             }),
//             s = 0;
//           s < 2;
//           ++s
//         ) {
//           var l = new Texture({
//             context: e,
//             width: r,
//             height: n,
//             pixelFormat: PixelFormat.RGBA,
//             pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
//             sampler: a
//           });
//           this._resultTextures.push(l);
//           var u = new Framebuffer({
//             context: e,
//             colorTextures: [l]
//           });
//           this._resultFrameBuffer.push(u);
//         }
//       }
//       var c = new ClearCommand({
//         color: Color.BLACK,
//         framebuffer: this._resultFrameBuffer[0]
//       });
//       c.execute(e);
//         (this._lastResultTexture = this._resultTextures[0]);
//         this._doAnalysis(this, c, e);
//       for (var s = 0; s < this._childViewsheds.length; ++s)
//         this._doAnalysis(this._childViewsheds[s], c, e);
//       defined(this._mapDrawCommand) || (this._mapDrawCommand = U(this, e)),
//         e.draw(this._mapDrawCommand, t);
//     }
//   };
//   VisibilityAnalysis.prototype._doAnalysis = function(e, t, r) {
//     if (e._valid) {
//       var i =
//         this._lastResultTexture !== this._resultTextures[0]
//           ? this._resultFrameBuffer[0]
//           : this._resultFrameBuffer[1];
//       (t.framebuffer = i);
//         t.execute(r);
//         defined(e._analysisCommand) || (e._analysisCommand = F(e, this, r));
//         (e._analysisCommand.framebuffer = i);
//         r.draw(e._analysisCommand);
//         (this._lastResultTexture = i._colorTextures[0]);
//     }
//   };
//   VisibilityAnalysis.prototype.destroy = function() {
//     return destroyObject(this);
//   };
//   return VisibilityAnalysis;
// });
