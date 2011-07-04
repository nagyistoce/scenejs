/**
 * @class A scene node that defines morphing of geometry positions
 */
new (function() {

    var canvas;                              // Currently active canvas
    var canvasMorphs = {};                   // Morphs for each canvas
    var currentMorphs = null;                // Morphs for currently active canvas

    var idStack = [];
    var morphStack = [];
    var stackLen = 0;
    var dirty;

    SceneJS_eventModule.addListener(
            SceneJS_eventModule.SCENE_COMPILING,
            function(params) {
                canvas = params.canvas;
                if (!canvasMorphs[canvas.canvasId]) {      // Lazy-create morph map for canvas
                    canvasMorphs[canvas.canvasId] = {};
                }
                currentMorphs = canvasMorphs[canvas.canvasId];
                stackLen = 0;
            });

    SceneJS_eventModule.addListener(
            SceneJS_eventModule.SCENE_RENDERING,
            function(params) {
                if (dirty) {
                    if (stackLen > 0) {

                        /* Get top morph on stack
                         */
                        var morph = morphStack[stackLen - 1];
                        var factor = morph.factor;

                        /* Will hold target frame enclosing factor
                         */
                        var key1;
                        var key2;

                        /* Find the target frame
                         */
                        if (factor <= morph.keys[0]) {

                            /* Clamp to first target frame
                             */
                            factor = morph.keys[0];
                            key1 = 0;
                            key2 = 1;

                        } else {

                            if (factor >= morph.keys[morph.keys.length - 1]) {

                                /* Clamp to last target frame
                                 */
                                factor = morph.keys[morph.keys.length - 1];
                                key1 = morph.keys.length - 2;
                                key2 = morph.keys.length - 1;

                            } else {

                                /* Find target frame enclosing
                                 */
                                for (var i = morph.targets.length - 1; i >= 0; i--) {
                                    if (factor > morph.keys[i]) {
                                        key1 = i;
                                        key2 = i + 1; // Clamping to last ensures this is never out of range
                                        break;
                                    }
                                }
                            }
                        }

                        /* Normalise factor to range [0.0..1.0] for the target frame
                         */
                        var normalizedFactor = (factor - morph.keys[key1]) / (morph.keys[key2] - morph.keys[key1]);
                        SceneJS_renderModule.setMorph(idStack[stackLen - 1], { // Set factor and target frame on shader module
                            factor: normalizedFactor,
                            target1: morph.targets[key1],
                            target2: morph.targets[key2]
                        });

                    } else  { // Set null morph
                        SceneJS_renderModule.setMorph();
                    }
                    dirty = false;
                }
            });

    SceneJS_eventModule.addListener(
            SceneJS_eventModule.RESET,
            function() {
                for (var canvasId in canvasMorphs) {    // Destroy geometries on all canvases
                    if (canvasMorphs.hasOwnProperty(canvasId)) {
                        var morphs = canvasMorphs[canvasId];
                        for (var resource in morphs) {
                            if (morphs.hasOwnProperty(resource)) {
                                var morph = morphs[resource];
                                destroyMorph(morph);
                            }
                        }
                    }
                }
                canvas = null;
                canvasMorphs = {};
                currentMorphs = null;
                stackLen = 0;
            });

    /**
     * Destroys morph, returning true if memory freed, else false
     * where canvas not found and morph was implicitly destroyed
     */
    function destroyMorph(morph) {
        if (document.getElementById(morph.canvas.canvasId)) { // Context won't exist if canvas has disappeared
            var target;
            for (var i = 0, len = morph.targets.length; i < len; i++) {
                target = morph.targets[i];
                if (target.vertexBuf) {
                    target.vertexBuf.destroy();
                }
                if (target.normalBuf) {
                    target.normalBuf.destroy();
                }
                if (target.uvBuf) {
                    target.uvBuf.destroy();
                }
                if (target.uvBuf2) {
                    target.uvBuf2.destroy();
                }
            }
        }
        var morphs = canvasMorphs[morph.canvas.canvasId];
        if (morphs) {
            morphs[morph.resource] = null;
        }
    }

    /**
     * Creates a morph on the active canvas
     * @param resource Resource ID that morph VBOs are mapped to - when null, generated by this module
     * @param source   Data comtaining morph targets - can be stream ID or object containing targets
     * @params options
     * @param callback Callback that returns handle to morph once created
     *
     */
    function createMorphGeometry(resource, source, options, callback) {
        if (!resource) {
            resource = SceneJS._createKeyForMap(currentMorphs, "m");
        }
        if (typeof source == "string") { // Load from stream - http://scenejs.wikispaces.com/MorphGeoLoaderService
            var geoService = SceneJS.Services.getService(SceneJS.Services.MORPH_GEO_LOADER_SERVICE_ID);
            geoService.loadMorphGeometry(source,
                    function(data) {
                        callback(_createMorph(resource, data, options));
                    });
        } else { // Targets specified
            var data = createTypedMorph(source);
            return _createMorph(resource, data, options);
        }
    }

    function createTypedMorph(data) {
        var typedMorph = {
            keys: data.keys,
            targets: []
        };
        for (var i = 0, len = data.targets.length; i < len; i++) {
            typedMorph.targets.push(createTypedArrays(data.targets[i]));
        }
        return typedMorph;
    }

    function createTypedArrays(data) {
        return {
            positions: data.positions ? new Float32Array(data.positions) : undefined,
            normals: data.normals ? new Float32Array(data.normals) : undefined,
            uv: data.uv ? new Float32Array(data.uv) : undefined,
            uv2: data.uv2 ? new Float32Array(data.uv2) : undefined
        };
    }


    function _createMorph(resource, data, options) {

        var context = canvas.context;

        var morph = {
            canvas: canvas,
            resource: resource,
            keys: data.keys,
            targets: []
        };

        try {

            var usage = context.STATIC_DRAW;

            var target;
            var newTarget;

            for (var i = 0, len = data.targets.length; i < len; i++) {
                target = data.targets[i];
                newTarget = {};
                morph.targets.push(newTarget);  // We'll iterate this to destroy targets when we recover from error
                if (target.positions && target.positions.length > 0) {
                    newTarget.vertexBuf = new SceneJS_webgl_ArrayBuffer(context, context.ARRAY_BUFFER,
                            target.positions, target.positions.length, 3, usage);
                }
                if (target.normals && target.normals.length > 0) {
                    newTarget.normalBuf = new SceneJS_webgl_ArrayBuffer(context, context.ARRAY_BUFFER,
                            target.normals, target.normals.length, 3, usage);
                }
                if (target.uv && target.uv.length > 0) {
                    newTarget.uvBuf = new SceneJS_webgl_ArrayBuffer(context, context.ARRAY_BUFFER,
                            target.uv, target.uv.length, 2, usage);
                }
                if (target.uv2 && target.uv2.length > 0) {
                    newTarget.uvBuf2 = new SceneJS_webgl_ArrayBuffer(context, context.ARRAY_BUFFER,
                            target.uv2, target.uv2.length, 2, usage);
                }
            }

            currentMorphs[resource] = morph;

            return { canvasId: canvas.canvasId, resource: resource };

        } catch (e) {

            /* Allocation failure - deallocate all target VBOs
             */
            for (var i = 0, len = morph.targets.length; i < len; i++) {
                target = morph.targets[i];
                if (target.vertexBuf) {
                    target.vertexBuf.destroy();
                }
                if (target.normalBuf) {
                    target.normalBuf.destroy();
                }
                if (target.uvBuf) {
                    target.uvBuf.destroy();
                }
                if (target.uvBuf2) {
                    target.uvBuf2.destroy();
                }
            }
            throw e;
        }
    }

    function destroyMorphGeometry(handle) {
        var morphs = canvasMorphs[handle.canvasId];
        if (!morphs) {  // Canvas must have been destroyed - that's OK, will have destroyed morphs as well
            return;
        }
        var morph = morphs[handle.resource];
        if (!morph) {
            throw  SceneJS_errorModule.fatalError("morph not found: '" + handle.resource + "'");
        }
        destroyMorph(morph);
    }

    function pushMorphGeometry(id, handle, factor) {
        var morph = currentMorphs[handle.resource];
        morph.factor = factor;
        idStack[stackLen] = id;
        morphStack[stackLen] = morph;
        stackLen++;
        dirty = true;
    }

    function popMorphGeometry() {
        stackLen--;
        dirty = true;
    }

    var MorphGeometry = SceneJS.createNodeType("morphGeometry");

    MorphGeometry.prototype._init = function(params) {
        if (params.create instanceof Function) {  // Factory function
            this._create = params.create;
        } else if (params.stream) { // Stream
            this._stream = params.stream;
        } else {
            this._setMorph(params);
        }
        this.attr.factor = params.factor || 0;
        this.attr.clamp = (params.clamp === false) ? false : true;
    };

    MorphGeometry.prototype._setMorph = function(params) {
        var targets = params.targets || [];
        if (targets.length < 2) {
            throw SceneJS_errorModule.fatalError(
                    SceneJS.errors.ILLEGAL_NODE_CONFIG,
                    "morphGeometry node should have at least two targets");
        }
        var keys = params.keys || [];
        if (keys.length != targets.length) {
            throw SceneJS_errorModule.fatalError(
                    SceneJS.errors.ILLEGAL_NODE_CONFIG,
                    "morphGeometry node mismatch in number of keys and targets");
        }

        /* First target's arrays are defaults for where not given on subsequent targets
         */

        var positions;
        var normals;
        var uv;
        var uv2;
        var target;

        for (var i = 0, len = targets.length; i < len; i++) {
            target = targets[i];
            if (!positions && target.positions) {
                positions = target.positions.slice(0);
            }
            if (!normals && target.normals) {
                normals = target.normals.slice(0);
            }
            if (!uv && target.uv) {
                uv = target.uv.slice(0);
            }
            if (!uv2 && target.uv2) {
                uv2 = target.uv2.slice(0);
            }
        }

        for (var i = 0, len = targets.length; i < len; i++) {
            target = targets[i];
            if (!target.positions) {
                target.positions = positions;  // Can be undefined
            }
            if (!target.normals) {
                target.normals = normals;
            }
            if (!target.uv) {
                target.uv = uv;
            }
            if (!target.uv2) {
                target.uv2 = uv2;
            }
        }

        this.attr.keys = keys;
        this.attr.targets = targets;
    };

    MorphGeometry.prototype.getState = function() {
        return this._state;
    };

    MorphGeometry.prototype._changeState = function(newState, params) {
        params = params || {};
        params.oldState = this._state;
        params.newState = newState;
        this._state = newState;
        if (this.listeners["state-changed"]) {
            this._fireEvent("state-changed", params);
        }
    };

    MorphGeometry.prototype.getStream = function() {
        return this._stream;
    };

    MorphGeometry.prototype.setFactor = function(factor) {
        this.attr.factor = factor || 0.0;
    };

    MorphGeometry.prototype.getFactor = function() {
        return this.attr.factor;
    };

    MorphGeometry.prototype._compile = function(traversalContext) {
        this._preCompile(traversalContext);
        this._compileNodes(traversalContext);
        this._postCompile(traversalContext);
    };

    MorphGeometry.prototype._preCompile = function(traversalContext) {
        if (!this._handle) { // VBOs Not created yet
            var options = {
                clamp: this.attr.clamp
            };
            if (this._create) { // Targets supplied via callback
                var params = this._create();
                this._setMorph(params);
                this._handle = createMorphGeometry(this._resource, this.attr, options);

            } else if (this._stream) { // Targets loaded from stream(s)
                var self = this;
                createMorphGeometry(
                        this._resource,
                        this._stream,
                        options,
                        function(handle) {
                            self._handle = handle;

                            /**
                             * Need another compilation to apply freshly-loaded morphGeometry
                             */
                            SceneJS_compileModule.nodeUpdated(self, "loaded");
                        });
            } else { // Arrays
                this._handle = createMorphGeometry(this._resource, this.attr, options);
            }
        }
        if (this._handle) { // Created
            pushMorphGeometry(this.attr.id, this._handle, this.attr.factor);
        }
    };

    MorphGeometry.prototype._postCompile = function(traversalContext) {
        if (this._handle) {
            popMorphGeometry();
        }
    };

    MorphGeometry.prototype._destroy = function() {
        if (this._handle) {
            destroyMorphGeometry(this._handle);
        }
        this._handle = null;
    };

})();