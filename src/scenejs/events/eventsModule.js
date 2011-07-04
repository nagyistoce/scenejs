/**
 * Backend module that defines SceneJS events and provides an interface on the backend context through which
 * backend modules can fire and subscribe to them.
 *
 * Events are actually somewhat more like commands; they are always synchronous, and are often used to decouple the
 * transfer of data between backends, request events in response, and generally trigger some immediate action.
 *
 * Event subscription can optionally be prioritised, to control the order in which the subscriber will be notified of
 * a given event relative to other suscribers. This is useful, for example, when a backend must be the first to handle
 * an INIT, or the last to handle a RESET.
 *
 * @private
 */
var SceneJS_eventModule = new (function() {

    this.ERROR = 0;
    this.INIT = 1;                           // SceneJS framework initialised
    this.RESET = 2;                          // SceneJS framework reset
    this.TIME_UPDATED = 3;                   // System time updated
    this.SCENE_CREATED = 4;                  // Scene has just been created
    this.SCENE_COMPILING = 5;                // Scene about to be traversed
    this.SCENE_COMPILED = 6;              // Scene just been completely traversed
    this.SCENE_DESTROYED = 7;                // Scene just been destroyed
    this.RENDERER_UPDATED = 8;                // Current WebGL context has been updated to the given state
    this.RENDERER_EXPORTED = 9;               // Export of the current WebGL context state
//    this.CANVAS_ACTIVATED = 10;
    this.CANVAS_DEACTIVATED = 11;
    this.VIEWPORT_UPDATED = 12;
    this.GEOMETRY_UPDATED = 13;
    this.GEOMETRY_EXPORTED = 14;
    this.MODEL_TRANSFORM_UPDATED = 15;
    this.MODEL_TRANSFORM_EXPORTED = 16;
    this.PROJECTION_TRANSFORM_UPDATED = 17;
    this.PROJECTION_TRANSFORM_EXPORTED = 18;
    this.VIEW_TRANSFORM_UPDATED = 19;
    this.VIEW_TRANSFORM_EXPORTED = 20;
    this.LIGHTS_UPDATED = 21;
    this.LIGHTS_EXPORTED = 22;
    this.MATERIAL_UPDATED = 23;
    this.MATERIAL_EXPORTED = 24;
    this.TEXTURES_UPDATED = 25;
    this.TEXTURES_EXPORTED = 26;
    this.SHADER_ACTIVATE = 27;
    this.SHADER_ACTIVATED = 28;
    this.SCENE_RENDERING = 29;
    this.SHADER_NEEDS_BOUNDARIES = 30;
    this.FOG_UPDATED = 31;
    this.FOG_EXPORTED = 32;

    this.LOGGING_ELEMENT_ACTIVATED = 37;
    this.PICK_COLOR_EXPORTED = 38;
    this.NODE_CREATED = 39;
    this.NODE_UPDATED = 40;
    this.NODE_DESTROYED = 41;
    this.IMAGEBUFFER_EXPORTED = 42;
    this.CLIP_EXPORTED = 43;
    this.FLAGS_EXPORTED = 44;

    /* Priority queue for each type of event
     */
    var events = new Array(37);

    /**
     * Registers a handler for the given event
     *
     * The handler can be registered with an optional priority number which specifies the order it is
     * called among the other handler already registered for the event.
     *
     * So, with n being the number of commands registered for the given event:
     *
     * (priority <= 0)      - command will be the first called
     * (priority >= n)      - command will be the last called
     * (0 < priority < n)   - command will be called at the order given by the priority
     * @private
     * @param type Event type - one of the values in SceneJS_eventModule
     * @param command - Handler function that will accept whatever parameter object accompanies the event
     * @param priority - Optional priority number (see above)
     */
    this.addListener = function(type, command, priority) {
        var list = events[type];
        if (!list) {
            list = [];
            events[type] = list;
        }
        var handler = {
            command: command,
            priority : (priority == undefined) ? list.length : priority
        };
        for (var i = 0; i < list.length; i++) {
            if (list[i].priority > handler.priority) {
                list.splice(i, 0, handler);
                return;
            }
        }
        list.push(handler);
    };

    /**
     * @private
     */
    this.fireEvent = function(type, params) {
        var list = events[type];
        if (list) {
            if (!params) {
                params = {};
            }
            for (var i = 0; i < list.length; i++) {
                list[i].command(params);
            }
        }
    };
})();


/** <p>Adds a listener to be notified when a given event occurs within SceneJS.</p>
 * <p><b>Supported events</b></p>
 * <p><b><em>error</em></b></p><p>An error has occurred either while defining or rendering a scene. These can be either fatal,
 * or errors that SceneJS can recover from.</p><p>Example:</p><pre><code>
 * SceneJS.bind("error", function(e) {
 *     if (e.exception.message) {
 *         alert("Error: " + e.exception.message);
 *     } else {
 *         alert("Error: " + e.exception);
 *     }
 *  });
 * </pre></code>
 *
 * <p><b><em>reset</em></b></p><p>The SceneJS framework has been reset, where all {@link SceneJS.Scene} instances have
 * been destroyed and resources held for them freed.</p><p>Example:</p><pre><code>
 *  SceneJS.bind(
 *      "reset",
 *      function(e) {
 *          alert("SceneJS has been reset");
 *      });
 * </pre></code>

 * <p><b><em>scene-created</em></b></p><p>A {@link SceneJS.Scene} has been defined.</p><p>Example:</p><pre><code>
 *  SceneJS.bind(
 *      "scene-created",
 *      function(e) {
 *          alert("A new Scene has been created - scene ID: " + e.sceneId);
 *      });
 * </pre></code>
 *
 * <p><b><em>scene-rendering</em></b></p><p>Traversal (render) of a {@link SceneJS.Scene} has just begun.</p><p>Example:</p><pre><code>
 *  SceneJS.bind(
 *      "scene-rendering",
 *      function(e) {
 *          alert("Rendering of a new Scene has just begun - scene ID: " + e.sceneId);
 *      });
 * </pre></code>
 *
 * <p><b><em>canvas-activated</em></b></p><p>A canvas has just been activated for a {@link SceneJS.Scene}, where that
 * node is about to start rendering to it. This will come right after a "scene-rendering" event, which will indicate which
 * {@link SceneJS.Scene} is the one about to do the rendering.</p><p>Example:</p><pre><code>
 *  SceneJS.bind(
 *      "canvas-activated",
 *      function(e) {
 *          var canvas = e.canvas;
 *          var context = e.context;
 *          var canvasId = e.canvasId;
 *          alert("Canvas is about to be rendered to : " + canvasId);
 *      });
 * </pre></code>
 *
 * </pre></code>
 *
 * <p><b><em>scene-rendered</em></b></p><p>A render of a {@link SceneJS.Scene} has completed.</p><p>Example:</p><pre><code>
 *  SceneJS.bind(
 *      "scene-rendered",
 *      function(e) {
 *          alert("Traversal completed for Scene - scene ID: " + e.sceneId);
 *      });
 * </pre></code>
 *
 * <p><b><em>scene-destroyed</em></b></b></p><p>A SceneJS.Scene traversal has been destroyed.</p><p>Example:</p><pre><code>
 *  SceneJS.bind(
 *      "scene-destroyed",
 *      function(e) {
 *          alert("Scene has been destroyed - scene ID: " + e.sceneId);
 *      });
 * </pre></code>
 * @param name Event name
 * @param func Callback function
 */
SceneJS.bind = function(name, func) {
    switch (name) {

        /**
         * @event error
         * Fires when the data cache has changed in a bulk manner (e.g., it has been sorted, filtered, etc.) and a
         * widget that is using this Store as a Record cache should refresh its view.
         * @param {Store} this
         */
        case "error" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.ERROR,
                function(params) {
                    func({
                        code: params.code,
                        errorName: params.errorName,
                        exception: params.exception,
                        fatal: params.fatal
                    });
                });
            break;

        case "reset" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.RESET,
                function() {
                    func();
                });
            break;

        case "scene-created" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.SCENE_CREATED,
                function(params) {
                    func({
                        sceneId : params.sceneId
                    });
                });
            break;

        case "node-created" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.NODE_CREATED,
                function(params) {
                    func({
                        nodeId : params.nodeId,
                        json: params.json
                    });
                });
            break;

        case "node-updated" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.NODE_UPDATED,
                function(params) {
                    func({
                        nodeId : params.nodeId
                    });
                });
            break;

        case "node-destroyed" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.NODE_DESTROYED,
                function(params) {
                    func({
                        nodeId : params.nodeId
                    });
                });
            break;

        case "scene-rendering" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.SCENE_COMPILING,
                function(params) {
                    func({
                        sceneId : params.sceneId
                    });
                });
            break;       

        case "scene-rendered" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.SCENE_COMPILED,
                function(params) {
                    func({
                        sceneId : params.sceneId
                    });
                });
            break;

        case "scene-destroyed" : SceneJS_eventModule.addListener(
                SceneJS_eventModule.SCENE_DESTROYED,
                function(params) {
                    func({
                        sceneId : params.sceneId
                    });
                });
            break;

        default:
            throw SceneJS_errorModule.fatalError("SceneJS.bind - this event type not supported: '" + name + "'");
    }
};

/** @deprecated - use {@link #addListener} instead.
 */
SceneJS.addListener = SceneJS.onEvent = SceneJS.bind;