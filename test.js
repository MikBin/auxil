$(document).ready(function() {
    /*example of logging to html by custom log function*/
    var log = auxil.Logger({
        'storeTime': true,
        'id': 'testSCript-1',
        'logFn': function(o, d, infos) {
            var time = '';
            var id = '';

            if (infos.time) time = 'logTime: ' + (new Date()).toISOString();
            if (infos.id) id = 'env ID: ' + infos.id;

            var objStr = (d > 1 ? JSON.stringify(o) : o.toString());
            var logStr = $("<pre>" + time + "\n" + id + "\n" + objStr + "</pre>");
            $('body').append(logStr);

        }
    });


    /*recoursive fibonacci to use in memoize*/
    function fibonacci(n) {
        if (n < 2) {
            return 1;
        } else {
            return fibonacci(n - 2) + fibonacci(n - 1);
        }
    }

    /*testing memoize*/
    var tstCache = {};
    var fib = auxil.memoize(fibonacci, {
        limit: 10,
        cache: tstCache
    });


    /*set up for caseof*/
    var cases = {
        '1': function() {
            var n = ~~ (10 * Math.random());
            log.log('fibonacci(' + n + '): ' + fib(n));
        },
        '2': function() {
            var n = ~~ (50 * Math.random());
            log.log('fibonacci(' + n + '): ' + fib(n));
        },
        'default': function() {
            log.log('default');

        }
    };

    /*testing caseOf and memoize method*/
    var caseSwitch = auxil.caseOf(cases);

    for (var i = 0; i < 50; ++i) {
        caseSwitch(~~(Math.random() * 3));
    }

    /*logging cache*/
    log.log('logging cache for fibonacci: ' + JSON.stringify(tstCache));

});