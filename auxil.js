/**
 *@module auxil
 * Created by Michele Bini on 6/8/14.
 * library of auxiliary routines
 * functions used for logging, switch-case constructor alternative, function memoizing
 */



/**
 *UMD wrapper, works with commonJS(nodejs), global/namespced browser side, AMD (RequireJS)
 *
 *@param name {String} name of the module as it'll be exposed whether it's browser global, exported in commonjs or amd injected
 *@param definition {Function} the factory containing library code
 *@param context {Object} the context where the library is loaded
 *@param dependencies {Array} array of strings of dependencies in amd like structure
 *@param nameSpace {Object} used only browser side (no amd case) to avoid globals
 *@return {Object} return definition executed in the right context with dependencies resolved
 */
(function(name, definition, context, dependencies, nameSpace) {

    if (typeof module === 'object' && module['exports']) {
        if (dependencies && require) {

            /*store dependencies here*/
            var deps = {};
            for (var i = 0; i < dependencies.length; i++) {

                deps[dependencies[i]] = require(dependencies[i]);
            }
        }
        /*to avoid circular dependeincies issue in nodejs pass object pointed by module.exports to the factory without overwriting it by returning a new one*/
        return definition.call(deps, module['exports']);

    } else if ((typeof context['define'] !== 'undefined') && (typeof context['define'] === 'function') && context['define']['amd']) {
        define(name, (dependencies || []), function() {
            /*store dependencies here*/
            var strName, deps = {};

            for (var i = 0; i < dependencies.length; ++i) {
                strName = dependencies[i].split('/');
                strName = strName[strName.length - 1];
                deps[strName] = arguments[i];
            }
            return definition.call(deps);
        });
    } else {
        /*context is browser global, if nameSpace is defined bind the library there*/
        if (nameSpace && context[nameSpace]) {

            context[nameSpace][name] = {};
            return definition(context[nameSpace][name], nameSpace);
        } else {
            context[name] = {};
            return definition(context[name]);
        }
    }
})('auxil', function(myself, nameSpace) {


    /*to avoid circular dependeincies issue in nodejs-
     here we append functions and properties to an already existing object (module.exports) created before dependency requirement happened,
      the same object that some dependency could have in circular reference before we fill it*/
    var auxil = myself || {};

    var _context = this;


    /**
     *@method baseLogFn
     *basic function for auxil.Logger it's loaded if no one is provided in config
     *log passed object following infos paramter
     *can log in browser console, nodejs's console or log to file
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
     *if no function is provided a default one'd be used
     *
     *@param Config {Object} config tell's whether to log time, process/logger's id, how deep to log an object, and used to pass file writer, file path or specialized log function
     *@return {Object}  returned object is made of a log function set up using config paramters and two methods for setting depth and for stopping debugging
     */
    auxil.Logger = function(config) {
        /*when set to false no logging will happen*/
        var debug = 1;
        /*if no depth is passed to the generated function the default one would be used*/
        var defaultDepth = config && !isNaN(config.defaultDepth) ? config.defaultDepth : 0;
        var logFn;
        var param = {
            time: config && config.storeTime ? 1 : 0,
            id: config && config.id ? config.id : false,
            util: config && config.util ? config.util : 0,
            fs: config && config.fs ? config.fs : 0,
            filePath: config && config.filePath ? config.filePath : 0
        };

        /*set up log function, if non is passed the default one would be used*/
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
     *caseOf factory produces a function to be used as switch case statement
     *
     *@param cases {Object} config tell's whether to log time, process/logger's id, how deep to log an object, and used to pass file writer, file path or specialized log function
     *@return {Function} the returned function when passed a value exec the corresponding case or the default case
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
     *memoize create a function with cache
     *
     *@param fn {Function} function to be memoized
     *@param config {Object} contains parameters as cache reference,hashing function reference ,size limit (if any) whether to clone output and/or cloning function
     *@return {Function} the memoized function
     */
    auxil.memoize = function(fn, config) {
        /*set up hashing function, if none prodided use default*/
        var keyFn = (config && (typeof config.hashFn === 'function')) ? config.hashFn : function(args) {
            return JSON.stringify(args);
        };
        var slicer = Array.prototype.slice;
        /*set up cache, if no object is provided create an empty one*/
        var cache = config && config.cache ? config.cache : {};
        var cacheSize = 0;
        var keepCaching = 1;
        /*check if cache have to limited in size and set up parameters*/
        var limit = config && !isNaN(config.limit) ? 1 : 0;
        var maxSize = limit && !isNaN(config.limit) ? Math.abs(config.limit) : Math.pow(2, 31);
        /*check if cache hits have to be cloned and set up cloning function
         *cloning is used in case the orginal function returns objects,
         *this is done because the output could be modified by program flow resulting in modified object in cache
         *as cached objects are stored by reference in cache and returned by reference
         */
        var clone = config && config.clone ? 1 : 0;
        var cloneFn = clone && confing.cloneFn ? config.cloneFn : function(obj) {
            return JSON.parse(JSON.stringify(obj));
        };

        /*setting up momeized function*/
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