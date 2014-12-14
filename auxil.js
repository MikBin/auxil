/**
 *@module auxil
 * Created by Michele Bini on 6/8/14.
 * library of auxiliary routines
 * functions used for logging, switch-case construct alternative and for function memoizing
 */



/**
 *UMD wrapper, it works with commonJS(nodejs), global/namespaced browser side and AMD (RequireJS)
 *
 *@param name {String} name of the module as it will be exposed
 *@param definition {Function} the factory containing the library code
 *@param context {Object} the context where the library is loaded
 *@param dependencies {Array} array of strings of dependencies in amd-like structure
 *@param nameSpace {Object} used only browser side (no amd case) to avoid globals
 *@return {Object} return definition executed in the right context with dependencies resolved
 */
(function(name, definition, context, dependencies, nameSpace) {

    var strName, deps = {};
    if (typeof module === 'object' && module['exports']) {
        if (dependencies && require) {

            /*store dependencies here*/
            for (var i = 0; i < dependencies.length; i++) {
                strName = dependencies[i].split('/');
                strName = strName[strName.length - 1];
                deps[strName] = require(dependencies[i]);
            }
        }
        /*to avoid circular dependencies issues in nodejs, the object pointed by module.exports is passed to the factory*/
        return module['exports'] = definition.call(deps, module['exports']);

    } else if ((typeof context['define'] !== 'undefined') && (typeof context['define'] === 'function') && context['define']['amd']) {
        define(name, (dependencies || []), function() {

            for (var i = 0; i < dependencies.length; ++i) {
                strName = dependencies[i].split('/');
                strName = strName[strName.length - 1];
                deps[strName] = arguments[i];
            }
            return definition.call(deps);
        });
    } else {
        /*context is browser global; if nameSpace is defined, then bind the library to it*/
        if (nameSpace && context[nameSpace]) {
            context[nameSpace][name] = {};
            return context[nameSpace][name] = definition(context[nameSpace][name], nameSpace);
        } else {
            context[name] = {};
            return context[name] = definition(context[name]);
        }
    }
})('auxil', function(myself, nameSpace) {


    /*to avoid circular dependencies issues in nodejs-
     here, we append functions and properties to an already existing object (module.exports) created before that dependencies binding happened;*/
    var auxil = myself || {};

    var _context = this;


    /**
     *@method baseLogFn
     *basic function for auxil.Logger: it is loaded if no other function is provided in config
     *it logs passed object following infos paramter
     *it can log in browser console, nodejs's console or log to file
     *
     *@param o {Object}
     *@param d {Number}
     *@param infos {Objecct}
     *@return {Void} no return
     */
    var baseLogFn = function(o, d, infos) {

        var time = '';
        var id = '';

        if (infos.time) time = 'logTime: ' + (new Date()).toISOString();
        if (infos.id) id = 'env ID: ' + infos.id;

        if (infos.fs && infos.filePath) {
            var objStr = (d > 1 ? JSON.stringify(o) : o.toString());
            var logStr = time + "\n" + id + "\n" + objStr + "\n";
            infos.fs.appendFile(infos.filePath, logStr, function(err) {
                if (err) throw err;
            });
        } else {

            if (time) console.log(time);
            if (id) console.log(id);

            if (infos.util) {
                console.log(infos.util.inspect(o, {
                    showHidden: true,
                    depth: d,
                    colors: true
                }));
            } else { /*browser or node without util*/

                console.log(o);
            }

        }
    }

    /**
     *@method Logger
     *Logger factory to produce a function for debugging
     *a custom logging can be passed in order to log in console/file/database
     *if no function is provided a default one would be used
     *
     *@param Config {Object} it tells whether to log time, process/logger's id, how deep to log an object; it is used to pass a file writer,
     * a file path or a specialized log function
     *@return {Object} object made of a log function set up by using config parameters
     */
    auxil.Logger = function(config) {
        /*when set to false no logging will happen*/
        var debug = 1;
        /*if no depth is passed to the generated function then the default one is used*/
        var defaultDepth = config && !isNaN(config.defaultDepth) ? config.defaultDepth : 0;
        var logFn;
        var param = {
            time: config && config.storeTime ? 1 : 0,
            id: config && config.id ? config.id : false,
            util: config && config.util ? config.util : 0,
            fs: config && config.fs ? config.fs : 0,
            filePath: config && config.filePath ? config.filePath : 0
        };

        /*set up log function, if no one is passed then the default one is used*/
        if (config.logFn && typeof config.logFn === 'function') {
            logFn = config.logFn;
        } else {
            logFn = baseLogFn;
        }

        /*set up the logger object to be returned*/
        var logger = {

            log: function(o, depth) {
                if (debug) {
                    var d = ((typeof depth === 'number') && depth > 0) ? depth : defaultDepth;
                    return logFn(o, d, param);
                } else {
                    return false;
                }
            },
            setDebug: function(val) {
                debug = val ? true : false;
            },
            setDepth: function(d) {
                defaultDepth = !isNaN(d) ? d : 0;
            }

        };

        return logger;
    };


    /**
     *@method caseOf
     *caseOf factory produces a function to be used as switch-case statement
     *
     *@param cases {Object} a listing of function to be executed
     *@return {Function}  this function takes a value in input and executes the corresponding case or the default case
     */
    auxil.caseOf = function(cases) {
        return function(value) {
            var fn;
            if (cases[value]) {
                fn = cases[value];

            } else if (cases['default']) {
                fn = cases['default'];
            } else {
                return 'ERROR no Default value set';
            }

            return fn();
        }
    }


    /**
     *@method memoize
     *memoize creates a function with cache
     *
     *@param fn {Function} function to be memoized
     *@param config {Object} it contains parameters as cache reference,hashing function reference ,size limit (if any), whether to clone output and the cloning function
     *@return {Function} the memoized function
     */
    auxil.memoize = function(fn, config) {
        /*set up the hashing function, if none is provided it uses the default*/
        var keyFn = (config && (typeof config.hashFn === 'function')) ? config.hashFn : function(args) {
            return JSON.stringify(args);
        };
        var slicer = Array.prototype.slice;
        /*set up cache, if no object is provided it creates an empty one*/
        var cache = config && config.cache ? config.cache : {};
        var cacheSize = 0;
        var keepCaching = 1;
        /*check if cache has to be limited in size and set up parameters*/
        var limit = config && !isNaN(config.limit) ? 1 : 0;
        var maxSize = limit && !isNaN(config.limit) ? Math.abs(config.limit) : Math.pow(2, 31);
        /*check if cache hits have to be cloned and set up the cloning function
         *cloning is used in case the orginal function returns objects,
         *this is done because the output could be modified by program flow, resulting in modified object in cache
         *as cached objects are stored by reference in cache and returned by reference
         */
        var clone = config && config.clone ? 1 : 0;
        var cloneFn = clone && confing.cloneFn ? config.cloneFn : function(obj) {
            return JSON.parse(JSON.stringify(obj));
        };

        /*setting up memoized function*/
        var cachedFN = function() {
            var args = slicer.call(arguments);
            var key = keyFn(args);
            var output = cache[key];
            if (output) {
                return clone ? cloneFn(output) : output;
            } else if (keepCaching) {
                output = cache[key] = fn.apply(this, args);
                if (limit) {
                    cacheSize++;
                    keepCaching = cacheSize < maxSize ? 1 : 0;
                }
                return clone ? cloneFn(output) : output;
            } else {
                return fn.apply(this, args);
            }
        };

        return cachedFN;
    }



    var version = 1.0;
    auxil.getVersion = function() {
        return version;
    }

    if (Object.freeze) {

        Object.freeze(auxil);
    }


    return auxil;

}, this, [], this['ßøµŋđ']); /* in main app.js script (browser side only) set this['ßøµŋđ'] = 'nameSpaceToBeUsed-As-Global' if you're using nameSpaces to avoid globals */