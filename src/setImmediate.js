/**********************************************************\
|                                                          |
|                          hprose                          |
|                                                          |
| Official WebSite: http://www.hprose.com/                 |
|                   http://www.hprose.org/                 |
|                                                          |
\**********************************************************/

/**********************************************************\
 *                                                        *
 * setImmediate.js                                        *
 *                                                        *
 * setImmediate for JavaScript.                           *
 *                                                        *
 * LastModified: Feb 20, 2016                             *
 * Author: Ma Bingyao <andot@hprose.com>                  *
 *                                                        *
\**********************************************************/

/* jshint -W067 */
(function(global, undefined) {
    'use strict';
    if (global.setImmediate) return;

    // // @see http://codeforhire.com/2013/09/21/setimmediate-and-messagechannel-broken-on-internet-explorer-10/
    // var notUseNative = (global.navigator && /Trident/.test(global.navigator.userAgent));
    //
    // if (!notUseNative && (global.msSetImmediate || global.setImmediate)) {
    //     if (!global.setImmediate) {
    //         global.setImmediate = global.msSetImmediate;
    //         global.clearImmediate = global.msClearImmediate;
    //     }
    //     return;
    // }

    var doc = global.document;
    var MutationObserver = global.MutationObserver || global.WebKitMutationObserver || global.MozMutationOvserver;
    var polifill = {};
    var nextId = 1;
    var tasks = {};

    function wrap(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            handler.apply(undefined, args);
        };
    }

    function clear(handleId) {
        delete tasks[handleId];
    }

    function run(handleId) {
        var task = tasks[handleId];
        if (task) {
            try {
                task();
            }
            finally {
                clear(handleId);
            }
        }
    }

    function create(args) {
        tasks[nextId] = wrap.apply(undefined, args);
        return nextId++;
    }

    polifill.mutationObserver = function() {
        var queue = [],
            node = doc.createTextNode(''),
            observer = new MutationObserver(function (mutations) {
                while (queue.length > 0) {
                    run(queue.shift());
                }
            });

        observer.observe(node, {"characterData": true});

        return function() {
            var handleId = create(arguments);
            queue.push(handleId);
            node.data = handleId & 1;
            return handleId;
        };
    };

    polifill.messageChannel = function() {
        var channel = new global.MessageChannel();

        channel.port1.onmessage = function(event) {
            run(Number(event.data));
        };

        return function() {
            var handleId = create(arguments);
            channel.port2.postMessage(handleId);
            return handleId;
        };
    };

    polifill.nextTick = function() {
        return function() {
            var handleId = create(arguments);
            global.process.nextTick( wrap( run, handleId ) );
            return handleId;
        };
    };

    polifill.postMessage = function() {
        var queue = [],
            iframe = doc.createElement('iframe');
            iframe.style.display = 'none';
            doc.documentElement.appendChild(iframe);

        var iwin = iframe.contentWindow;
            iwin.document.write('<script>window.onmessage=function(){parent.postMessage(1, "*");};</script>');
            iwin.document.close();

            window.addEventListener('message', function () {
                while (queue.length > 0) {
                    run(queue.shift());
                }
            });
        return function() {
            var handleId = create(arguments);
            queue.push(handleId);
            iwin.postMessage(1, "*");
            return handleId;
        };
    };

    polifill.readyStateChange = function() {
        var html = doc.documentElement;

        return function() {
            var handleId = create(arguments);
            var script = doc.createElement('script');

            script.onreadystatechange = function() {
                run(handleId);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };

            html.appendChild(script);

            return handleId;
        };
    };

    polifill.setTimeout = function() {
        return function() {
            var handleId = create(arguments);
            global.setTimeout( wrap( run, handleId ), 0 );
            return handleId;
        };
    };

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = (attachTo && attachTo.setTimeout ? attachTo : global);

    // Don't get fooled by e.g. browserify environments.
    // For Node.js before 0.9
    if (typeof(global.process) !== 'undefined' &&
        {}.toString.call(global.process) === '[object process]' &&
        !global.process.browser) {
        attachTo.setImmediate = polifill.nextTick();
    }
    // For MutationObserver, where supported
    else if (doc && MutationObserver) {
        attachTo.setImmediate = polifill.mutationObserver();
    }
    // For web workers, where supported
    else if (global.MessageChannel) {
        attachTo.setImmediate = polifill.messageChannel();
    }
    // For IE 6–9
    else if (doc && ('onreadystatechange' in doc.createElement('script'))) {
        attachTo.setImmediate = polifill.readyStateChange();
    }
    // For non-IE modern browsers
    else if (doc && 'postMessage' in global && 'addEventListener' in global) {
        attachTo.setImmediate = polifill.postMessage();
    }
    // For older browsers
    else {
        attachTo.setImmediate = polifill.setTimeout();
    }

    attachTo.msSetImmediate = attachTo.setImmediate;

    attachTo.clearImmediate = clear;
    attachTo.msClearImmediate = clear;
}(function() {
    return this || (1, eval)('this');
}()));