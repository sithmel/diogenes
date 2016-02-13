var Diogenes = require('../src');
var assert = require('chai').assert;

describe('diogenes local/global registry', function () {

  it('must be different if local', function () {
    var registry1 = Diogenes.getRegistry();
    var registry2 = Diogenes.getRegistry();

    assert.notEqual(registry1.services, registry2.services);
  });

  it('must be equal if global', function () {
    var registry1 = Diogenes.getRegistry('default');
    var registry2 = Diogenes.getRegistry('default');

    assert.equal(registry1.services, registry2.services);
  });

});

describe('diogenes merge registries', function () {

  var registry1, registry2, registry3;

  beforeEach(function () {
    registry1 = Diogenes.getRegistry();
    registry2 = Diogenes.getRegistry();
    registry1.service('answer').returns(42);
    registry2.service('question').returns('the answer to life the universe and everything');
    registry1.on(function () {});
    registry2.on(function () {});
    registry3 = registry1.merge(registry2);
  });

  it('must be different from previous registries', function () {
    assert.notEqual(registry1, registry3);
    assert.notEqual(registry2, registry3);
  });

  it('must copy the events', function () {
    assert.equal(registry3.events.size(), 2);
  });

  it('must copy the services', function () {
    assert.equal(Object.keys(registry3.services).length, 2);
  });
});

describe('diogenes', function () {
  var registry,
    isAnything;

  beforeEach(function () {
    registry = Diogenes.getRegistry();
    isAnything = Diogenes.validator();
  });

  describe('init', function () {
    it('must run with right context', function () {
      registry.init([function () {
        assert.equal(registry, this);
      }]);
    });
  });

  it('must return a service in a simple case (1 function)', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      assert.equal(registry.service('hello'), this);
      assert.deepEqual(deps, {});
      next(undefined, 'hello');
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.equal(registry, this);
      assert.deepEqual(dep, 'hello');
      done();
    });
  });

  it('must return undefined (1 function)', function (done) {
    registry.instance({}).run('hello', function (err, dep) {
      assert.equal(registry, this);
      assert.equal(err.message, 'Diogenes: missing dependency: hello');
      assert.instanceOf(err, Error);
      done();
    });
  });

  it('must return an exception if the function fails', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      throw new Error('broken');
      next(undefined, 'hello');
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.equal(registry, this);
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      done();
    });
  });

  it('must return a service in a simple case (2 functions)', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      assert.deepEqual(deps, {});
      next(undefined, 'hello ');
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
      assert.deepEqual(deps, {hello: 'hello '});
      next(undefined, deps.hello + 'world!');
    });

    registry.instance({}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must return an exception if the callback fires twice', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(undefined, 'hello ');
      next(undefined, 'hello ');
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
      next(undefined, deps.hello + 'world!');
    });

    registry.instance({}).run('world', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: a callback has been firing more than once');
      done();
    });
  });

  it('must return a service in a simple case (2 functions) not using next', function (done) {
    registry.service('hello').provides(function (config, deps) {
      assert.deepEqual(deps, {});
      return 'hello ';
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps) {
      assert.deepEqual(deps, {hello: 'hello '});
      return deps.hello + 'world!';
    });

    registry.instance({}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must return a service in a simple case (2 functions) using promises', function (done) {
    registry.service('hello').provides(function (config, deps) {
      assert.deepEqual(deps, {});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve('hello ');
        }, 10);
      });
      return p;
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps) {
      assert.deepEqual(deps, {hello: 'hello '});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve(deps.hello + 'world!');
        }, 10);
      });
      return p;
    });

    registry.instance({}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must unwrap promises automatically', function (done) {
    var getPromise = function (ret) {
      return p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve(ret);
        }, 10);
      });
    };

    registry.service('hello').provides(function (config, deps) {
      assert.deepEqual(deps, {});
      return getPromise(getPromise('hello'));
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.deepEqual(dep, 'hello');
      done();
    });
  });

  it('must propagate an error using promises', function (done) {
    registry.service('hello').provides(function (config, deps) {
      assert.deepEqual(deps, {});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          reject(new Error('broken'));
        }, 10);
      });
      return p;
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps) {
      assert.deepEqual(deps, {hello: 'hello '});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve(deps.hello + 'world!');
        }, 10);
      });
      return p;
    });

    registry.instance({}).run('world', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      done();
    });
  });

  it('must return a service in a simple case (2 functions), dependencies are a function', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      assert.deepEqual(deps, {});
      next(undefined, 'hello ');
    });

    var getDeps = function (config) {
      assert.deepEqual(config, {test: 1});
      return ['hello'];
    };

    registry.service('world').dependsOn(getDeps).provides(function (config, deps, next) {
      assert.deepEqual(deps, {hello: 'hello '});
      next(undefined, deps.hello + 'world!');
    });

    registry.instance({test: 1}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must recognize a circular dependency', function (done) {
    registry.service('hello').dependsOn(['world']).provides(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
      next(undefined, 'world!');
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: circular dependency: hello');
      done();
    });
  });

  it('must recognize a circular dependency (3 services)', function (done) {
    registry.service('A').dependsOn(['C']).provides(function (config, deps, next) {
      next(undefined, undefined);
    });

    registry.service('B').dependsOn(['A']).provides(function (config, deps, next) {
      next(undefined, undefined);
    });

    registry.service('C').dependsOn(['B']).provides(function (config, deps, next) {
      next(undefined, undefined);
    });

    registry.instance({}).run('C', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: circular dependency: C');
      done();
    });
  });

  it('must throw an exception when missing dependency', function (done) {
    registry.service('hello').dependsOn(['world']).provides(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: missing dependency: world');
      done();
    });
  });

  it('must throw an exception when more than one plugin matches', function (done) {
    registry.service('hello').provides(function (config, deps, next) {
      next(undefined, 'hello1');
    });

    registry.service('hello').provides(function (config, deps, next) {
      next(undefined, 'hello2');
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Occamsrazor (get): More than one adapter fits');
      done();
    });
  });

  it('must add a value', function (done) {
    registry.service('hello').returns('hello');

    registry.instance({}).run('hello', function (err, dep) {
      assert.equal(dep, 'hello');
      done();
    });
  });

  it('must read write metadata', function () {
    registry.service('hello').returns('hello', 'hello');
    registry.service('hello').metadata('metadata');
    assert.equal(registry.service('hello').metadata(), 'metadata');
  });

  describe('plugins', function () {
    beforeEach(function () {
      registry.service('hello').returns('hello')
      .provides({greetings: undefined}, function (cfg, deps) {
        return cfg.greetings;
      });

      registry.service('world').dependsOn(['hello']).provides(function (cfg, deps) {
        return deps.hello + ' world';
      })
      .provides({who: /mars/gi}, function (cfg, deps) {
        return deps.hello + ' martians';
      })
      .provides({who: /mars/gi}, {hello: /morning/}, function (cfg, deps) {
        return 'good day martians';
      });
    });

    it('must use right function', function () {
      registry.instance().run('world', function (err, dep) {
        assert.equal(dep, 'hello world');
      });
    });

    it('must use right function using a validator for the config', function () {
      registry.instance({who: 'mars'}).run('world', function (err, dep) {
        assert.equal(dep, 'hello martians');
      });
    });

    it('must use right function using a validator for the config and deps', function () {
      registry.instance({who: 'mars', greetings: 'good morning'}).run('world', function (err, dep) {
        assert.equal(dep, 'good day martians');
      });
    });

  });

  describe('documentation', function () {
    beforeEach(function () {
      registry.service('hello').returns('hello');

      registry.service('world').dependsOn(['hello']).returns('world');
      registry.service('hello').metadata('Metadata');
      registry.service('hello').description('returns the string hello');
      registry.service('world').description('returns the string world');
      registry.service('world');
    });

    it('must read write description', function () {
      assert.equal(registry.service('hello').description(), 'returns the string hello');
      assert.equal(registry.service('world').description(), 'returns the string world');
    });

    it('must create doc object', function () {
      var obj1 = {
        'cached': false,
        'dependencies': [],
        'description': 'returns the string hello',
        'executionOrder': [],
        'manageError': false,
        'metadata': 'Metadata',
        'name': 'hello'
      };
      var obj2 = {
        'cached': false,
        'dependencies': [
          'hello'
        ],
        'description': 'returns the string world',
        'executionOrder': [
          'hello'
        ],
        'manageError': false,
        'metadata': undefined,
        'name': 'world'
      };
      assert.deepEqual(registry.service('hello').infoObj(), obj1);
      assert.deepEqual(registry.service('world').infoObj(),  obj2);
      assert.deepEqual(registry.instance().infoObj(), {hello: obj1, world: obj2});
    });

    it('must create doc', function () {
      var doc1 = 'hello\n=====\nreturns the string hello\n\nMetadata:\n```js\n"Metadata"\n```\n';
      var doc2 = 'world\n=====\nreturns the string world\n\nExecution order:\n* hello\n\nDependencies:\n* hello\n';
      assert.equal(registry.service('hello').info(), doc1);
      assert.equal(registry.service('world').info(),  doc2);
      assert.equal(registry.instance().info(), doc1 + '\n\n' + doc2);
    });
  });

  describe('dfs: 4 functions', function (done) {

    beforeEach(function () {
      /*

      A ----> B
      |     / |
      |    /  |
      |   /   |
      |  /    |
      | /     |
      VV      V
      C ----> D

      */
      registry.service('A').provides(function (config, deps, next) {
        next(undefined, 'A');
      });

      registry.service('B').dependsOn(['A']).provides(function (config, deps, next) {
        next(undefined, deps['A'] + 'B');
      });

      registry.service('C').dependsOn(['A', 'B']).provides(function (config, deps, next) {
        next(undefined, deps['A'] + deps['B'] + 'C');
      });

      registry.service('D').dependsOn(['B', 'C']).provides(function (config, deps, next) {
        next(undefined, deps['B'] + deps['C'] + 'D');
      });
    });

    it('must return leftmost service', function (done) {
      registry.instance({}).run('A', function (err, dep) {
        assert.deepEqual(dep, 'A');
        done();
      });
    });

    it('must return middle service (1)', function (done) {
      registry.instance({}).run('B', function (err, dep) {
        assert.deepEqual(dep, 'AB');
        done();
      });
    });

    it('must return middle service (2)', function (done) {
      registry.instance({}).run('C', function (err, dep) {
        assert.deepEqual(dep, 'AABC');
        done();
      });
    });

    it('must return rightmost service', function (done) {
      registry.instance({}).run('D', function (err, dep) {
        assert.deepEqual(dep, 'ABAABCD');
        done();
      });
    });

    it('must return execution order', function () {
      var list = registry.instance({}).getExecutionOrder('D');
      assert.deepEqual(list, [ 'A', 'B', 'C', 'D' ]);
    });

    it('must replace node', function () {
      registry.remove('D');
      registry.service('D').dependsOn(['A']).provides(function (config, deps, next) {
        next(undefined, deps['A'] + 'D');
      });

      var list = registry.instance({}).getExecutionOrder('D');
      assert.deepEqual(list, [ 'A', 'D' ]);
    });

    it('must run without config', function (done) {
      registry.instance().run('D', function (err, dep) {
        assert.deepEqual(dep, 'ABAABCD');
        done();
      });
    });

    it('must run without config and callback', function (done) {
      registry.instance().run('D');
      setTimeout(function () {
        done();
      }, 20);
    });

    it('must run more than one service', function (done) {
      registry.instance({}).run(['A', 'D'], function (err, deps) {
        assert.deepEqual(deps.A, 'A');
        assert.deepEqual(deps.D, 'ABAABCD');
        done();
      });
    });

    it('must run more than one service, no config', function (done) {
      registry.instance().run(['A', 'D'], function (err, deps) {
        assert.deepEqual(deps.A, 'A');
        assert.deepEqual(deps.D, 'ABAABCD');
        done();
      });
    });

    it('must run more than one service, no config, no callback', function (done) {
      registry.instance().run(['A', 'D']);
      setTimeout(function () {
        done();
      }, 20);
    });
  });

  describe('correct services in the correct order (using the config/plugin)', function () {
    var isReversed;

    beforeEach(function () {
      isReversed = isAnything.match(['reverse']);

      registry.service('hello')
      .provides(function (config, deps, next) {
        next(undefined, 'hello ');
      })
      .dependsOn(isReversed, ['world'])
      .provides(isReversed, function (config, deps, next) {
        next(undefined, deps.world + 'hello!');
      });

      registry.service('world')
      .dependsOn(['hello'])
      .provides(function (config, deps, next) {
        next(undefined, deps.hello + 'world!');
      })
      .dependsOn(isReversed, [])
      .provides(isReversed, function (config, deps, next) {
        next(undefined, 'world ');
      });
    });

    it('must extract the rightmost service', function (done) {
      registry.instance({}).run('world', function (err, dep) {
        assert.deepEqual(dep, 'hello world!');
        done();
      });
    });

    it('must extract the leftmost service', function (done) {
      registry.instance({}).run('hello', function (err, dep) {
        assert.deepEqual(dep, 'hello ');
        done();
      });
    });

    it('must extract the rightmost inverted service', function (done) {
      registry.instance({reverse: true}).run('hello', function (err, dep) {
        assert.deepEqual(dep, 'world hello!');
        done();
      });
    });

    it('must extract the leftmost inverted service', function (done) {
      registry.instance({reverse: true}).run('world', function (err, dep) {
        assert.deepEqual(dep, 'world ');
        done();
      });
    });

  });

  describe('async parallel execution', function (done) {
    var str;

    beforeEach(function () {
      /*

      A      B
      |     /
      |    /
      |   /
      |  /
      | /
      VV
      C

      */

      str = '';

      registry.service('A').provides(function (config, deps, next) {
        setTimeout(function () {
          str += 'A';
          next(undefined, 'A');
        }, 50);
      });

      registry.service('B').provides(function (config, deps, next) {
        setTimeout(function () {
          str += 'B';
          next(undefined, 'B');
        }, 20);
      });

      registry.service('C').dependsOn(['A', 'B']).provides(function (config, deps, next) {
        str += 'C';
        next(undefined, deps.A + deps.B + 'C');
      });

    });

    it('must run service asynchronously', function (done) {
      registry.instance({}).run('C', function (err, dep) {
        assert.equal(str, 'BAC');
        assert.equal(dep, 'ABC');
        done();
      });
    });

    it('must run service synchronously', function (done) {
      registry.instance({}, {limit: 1}).run('C', function (err, dep) {
        assert.equal(str, 'ABC');
        assert.equal(dep, 'ABC');
        done();
      });
    });

    it('must profile the execution', function (done) {
      registry.instance({}, {debug: true}).run('C', function (err, dep, deps, profile) {
        assert.equal(str, 'BAC');
        assert.equal(dep, 'ABC');
        assert(profile.A.delta > 48 && profile.A.delta < 52 );
        assert(profile.B.delta > 18 && profile.B.delta < 22 );
        assert(profile.C.delta >= 0 && profile.C.delta < 2 );

        assert.equal(deps.A, 'A');
        assert.equal(deps.B, 'B');
        assert.equal(deps.C, 'ABC');

        assert(profile.__all__.delta > 48 && profile.A.delta < 52 );
        done();
      });
    });

  });

  describe('from the readme', function (done) {
    var text = ['Diogenes became notorious for his philosophical ',
    'stunts such as carrying a lamp in the daytime, claiming to ',
    'be looking for an honest man.'].join();

    beforeEach(function () {
      registry.service('text').returns(text);

      registry.service('tokens').dependsOn(['text']).provides(function (config, deps, next) {
        next(undefined, deps.text.split(' '));
      });

      registry.service('count').dependsOn(['tokens']).provides(function (config, deps, next) {
        next(undefined, deps.tokens.length);
      });

      registry.service('abstract').dependsOn(['tokens']).provides(function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.tokens.slice(0, len).join(' ') + ellipsis);
      });

      registry.service('paragraph').dependsOn(['text', 'abstract', 'count'])
      .provides(function (config, deps, next) {
        next(undefined, {
          count: deps.count,
          abstract: deps.abstract,
          text: deps.text
        });
      });

      var useAlternativeClamp = Diogenes.validator().match({abstractClamp: 'chars'});

      registry.service('abstract')
      .dependsOn(useAlternativeClamp, ['text'])
      .provides(useAlternativeClamp, function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.text.slice(0, len) + ellipsis);
      });

    });

    it('must return a correct order (readme example)', function () {
      var a = registry.instance({abstractLen: 5, abstractEllipsis: '...'}).getExecutionOrder('paragraph');
      assert.deepEqual(a, ['text', 'tokens', 'abstract', 'count', 'paragraph']);
    });

    it('must work (readme example)', function (done) {
      registry.instance({abstractLen: 5, abstractEllipsis: '...'}).run('paragraph', function (err, p) {
        assert.equal(p.count, 23);
        assert.equal(p.abstract, 'Diogenes became notorious for his...');
        assert.equal(p.text, text);
        done();
      });
    });

    it('must return a correct order (readme example) - alternate version', function () {
      var a = registry.instance({abstractLen: 5, abstractEllipsis: '...', abstractClamp: 'chars'}).getExecutionOrder('paragraph');
      assert.deepEqual(a, ['text', 'abstract', 'tokens', 'count', 'paragraph']);
    });

    it('must work (readme example) - alternate version', function (done) {
      registry.instance({abstractLen: 5, abstractEllipsis: '...', abstractClamp: 'chars'}).run('paragraph', function (err, p) {
        assert.equal(p.count, 23);
        assert.equal(p.abstract, 'Dioge...');
        assert.equal(p.text, text);
        done();
      });
    });
  });

  describe('cache', function () {
    var cached;

    beforeEach(function () {
      var c = 0;
      cached = registry.service('cached').provides(function (config, deps, next) {
        next(undefined, 'hello ' + c++);
      });
    });

    it('must configure cache: default key', function () {
      cached.cacheOn();
      cached._cachePush({}, 'result');
      assert.deepEqual(cached._mainCache._cache, {_default: 'result'});
      assert.equal(cached._mainCache._cacheKeys.length, 1);
      assert.equal(cached._mainCache._cacheKeys[0].key, '_default');
    });

    it('must configure cache: string key', function () {
      cached.cacheOn({key: 'test'});
      cached._cachePush({test: '1'}, 'result1');
      cached._cachePush({test: '2'}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'1': 'result1', '2': 'result2'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
    });

    it('must configure cache: string key/object', function () {
      cached.cacheOn({key: 'test'});
      cached._cachePush({test: [1, 2]}, 'result1');
      cached._cachePush({test: [3, 4]}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'[1,2]': 'result1', '[3,4]': 'result2'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
    });

    it('must configure cache: array key', function () {
      cached.cacheOn({key: ['test', 0]});
      cached._cachePush({test: [1, 2]}, 'result1');
      cached._cachePush({test: [3, 4]}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'1': 'result1', '3': 'result2'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
    });

    it('must configure cache: array key/object', function () {
      cached.cacheOn({key: ['test']});
      cached._cachePush({test: [1, 2]}, 'result1');
      cached._cachePush({test: [3, 4]}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'[1,2]': 'result1', '[3,4]': 'result2'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
    });

    it('must configure cache: func', function () {
      cached.cacheOn({key: function (config) {
        return config.test * 2;
      }});
      cached._cachePush({test: 4}, 'result1');
      cached._cachePush({test: 6}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'8': 'result1', '12': 'result2'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
    });

    it('must configure cache: maxSize', function () {
      cached.cacheOn({key: 'test', maxSize: 2});
      cached._cachePush({test: 1}, 'result1');
      cached._cachePush({test: 2}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'1': 'result1', '2': 'result2'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
      cached._cachePush({test: 3}, 'result3');
      assert.deepEqual(cached._mainCache._cache, {'2': 'result2', '3': 'result3'});
      assert.equal(cached._mainCache._cacheKeys.length, 2);
    });

    it('must configure cache: maxAge', function (done) {
      cached.cacheOn({key: 'test', maxAge: 20});
      cached._cachePush({test: 1}, 'result1');
      assert.deepEqual(cached._mainCache._cache, {'1': 'result1'});
      setTimeout(function () {
        cached._cachePush({test: 2}, 'result2');
        assert.deepEqual(cached._mainCache._cache, {'1': 'result1', '2': 'result2'});
        assert.equal(cached._mainCache._cacheKeys.length, 2);
        setTimeout(function () {
          cached._cachePush({test: 3}, 'result3');
          assert.deepEqual(cached._mainCache._cache, {'2': 'result2', '3': 'result3'});
          assert.equal(cached._mainCache._cacheKeys.length, 2);
          done();
        }, 15);
      }, 10);
    });

    it('must reset/switch off cache', function () {
      cached.cacheOn({key: 'test'});
      cached._cachePush({test: 1}, 'result1');
      cached._cachePush({test: 2}, 'result2');
      assert.deepEqual(cached._mainCache._cache, {'1': 'result1', '2': 'result2'});
      cached.cacheReset();
      assert.equal(cached._mainCache._cacheKeys.length, 0);
      assert.deepEqual(cached._mainCache._cache, {});
      cached.cacheOff();
      assert.isUndefined(cached._mainCache._cacheKeys);
      assert.isUndefined(cached._mainCache._cache);
    });

    it('must run only once', function (done) {
      cached.cacheOn();
      cached.registry().instance({}).run('cached', function (err, dep) {
        assert.equal(dep, 'hello 0');
        cached.registry().instance({}).run('cached', function (err, dep) {
          assert.equal(dep, 'hello 0');
          done();
        });
      });
    });

    it('must pause the cache', function (done) {
      cached.cacheOn();
      cached.registry().instance({}).run('cached', function (err, dep) {
        assert.equal(dep, 'hello 0');
        cached.registry().instance({}).run('cached', function (err, dep) {
          assert.equal(dep, 'hello 0');
          cached.cachePause();
          cached.registry().instance({}).run('cached', function (err, dep) {
            assert.equal(dep, 'hello 1');
            cached.cacheResume();
            cached.registry().instance({}).run('cached', function (err, dep) {
              assert.equal(dep, 'hello 0');
              done();
            });
          });
        });
      });
    });

  });

  describe('events', function (done) {

    beforeEach(function () {
    });

    it('must listen/fire', function (done) {
      registry.on('test', function (s) {
        assert.equal('test', s);
        done();
      });
      registry.trigger('test');
    });

    it('must fire before and after', function (done) {
      var called = [];

      registry.on('success', 'hello', function (type, name, dep, config) {
        called.push(type);
        assert.equal(called.join('-'), 'before-success');
        done();
      });

      registry.on('before', 'hello', function (type, name, config) {
        called.push(type);
      });

      registry.service('hello').provides(function (config, deps, next) {
        next(undefined, 'hello ');
      });

      registry.instance({test: 1}).run('hello', function (err, dep) {});
    });

    it('must fire on deps', function (done) {
      var called = false;

      registry.on('success', 'world', function (type, name, dep, config) {
        assert.equal(name, 'world');
        assert.equal(dep, 'hello world!');
        assert.deepEqual(config, {test:1});
        assert(called);
        done();
      });

      registry.on('success', 'hello', function (type, name, dep, config) {
        assert.equal(name, 'hello');
        assert.equal(dep, 'hello ');
        assert.deepEqual(config, {test:1});
        called = true;
      });

      registry.service('hello').provides(function (config, deps, next) {
        next(undefined, 'hello ');
      });

      registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
        next(undefined, deps.hello + 'world!');
      });

      registry.instance({test: 1}).run('world', function (err, dep) {});
    });

    it('mustn\'t fire success for cached values, but fire cachehit', function (done) {
      var called = 0;
      var cached_called = 0;

      registry.on('success', 'hello', function (type, name, dep, config) {
        assert.equal(name, 'hello');
        assert.equal(dep, 'hello');
        assert.deepEqual(config, {test:1});
        called++;
      });

      registry.on('cachehit', 'hello', function (type, name, dep, config) {
        assert.equal(name, 'hello');
        assert.equal(dep, 'hello');
        assert.deepEqual(config, {test:1});
        cached_called++;
      });

      registry.service('hello').provides(function (config, deps, next) {
        next(undefined, 'hello');
      })
      .cacheOn();

      registry.instance({test: 1}).run('hello', function (err, dep) {
        setTimeout(function () {
          assert.equal(called, 1);
          assert.equal(cached_called, 0);
          registry.instance({test: 1}).run('hello', function (err, dep) {
            setTimeout(function () {
              assert.equal(called, 1);
              assert.equal(cached_called, 1);
              done();
            }, 10);
          });
        }, 10);

      });
    });

    it('must fire error', function (done) {
      registry.on('error', 'hello', function (type, name, err, config) {
        assert.equal(err.message, 'error');
        assert.instanceOf(err, Error);
        assert.deepEqual(config, {test:1});
        done();
      });

      registry.service('hello').provides(function (config, deps, next) {
        next(new Error('error'));
      });

      registry.instance({test: 1}).run('hello', function (err, dep) {});
    });


  });

  describe('onError', function (done) {

    it('must fallback on error', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorReturn(42);

      registry.instance({test: 1}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 42);
        done();
      });
    });

    it('must fallback on error (undefined)', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorReturn(undefined);

      registry.instance({test: 1}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.isUndefined(dep);
        done();
      });
    });

    it('must fallback on error (func)', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorExecute(function (config) {return config.test;});

      registry.instance({test: 1}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 1);
        done();
      });
    });

    it('must keep propagating the error', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorExecute(function (config, err) {
        return err;
      });

      registry.instance({test: 1}).run('hello', function (err, dep) {
        assert.instanceOf(err, Error);
        assert.equal(err.message, 'error');
        done();
      });
    });

    it('must fallback on propagated error', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        next(new Error('error'));
      });

      registry.service('world').dependsOn(['hello']).provides(function (config, deps, next) {
        next(undefined, 'world');
      })
      .onErrorReturn(42);

      registry.instance({test: 1}).run('world', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 42);
        done();
      });
    });

    it('must fallback on last cached value', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        if ('error' in config) {
          next(new Error('error'));
        }
        else {
          next(null, 'ok');
        }
      }).onErrorUseCache();


      registry.instance({}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 'ok');
        registry.instance({'error': true}).run('hello', function (err, dep) {
          assert.isUndefined(err);
          assert.equal(dep, 'ok');
          done();
        });
      });
    });

    it('must fallback on last cached value, cache empty', function (done) {
      registry.service('hello').provides(function (config, deps, next) {
        if ('error' in config) {
          next(new Error('error'));
        }
        else {
          next(null, 'ok');
        }
      }).onErrorUseCache();

      registry.instance({'error': true}).run('hello', function (err, dep) {
        assert.instanceOf(err, Error);
        assert.equal(err.message, 'error');
        done();
      });
    });

  });

  describe('timeout', function () {
    it('must set/get timeout', function () {
      var s = registry.service('service');
      assert.isFalse(s.timeout());
      assert.equal(s.timeout(4), s);
      assert.equal(s.timeout(), 4);
      assert.equal(s.timeout(Infinity), s);
      assert.isFalse(s.timeout());
    });

  });

  describe('retry', function () {
    it('must set/get retry', function () {
      var s = registry.service('service');
      assert.isFalse(s.retry());
      assert.equal(s.retry(4), s);
      assert.equal(s.retry(), 4);
      assert.equal(s.retry(Infinity), s);
      assert.equal(s.retry(), Infinity);
    });

  });
});
