var Diogenes = require('../src/diogenes');
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
    registry1.service('answer').returnsValue(42);
    registry2.service('question').returnsValue('the answer to life the universe and everything');
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


  it('must works service shortcut', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      assert.deepEqual(config, {test: 1});
      next(undefined, 'hello');
    });
    registry.service('hello').run({test: 1}, function (err, dep) {
      assert.deepEqual(dep, 'hello');
      done();
    });
  });

  it('must works registry shortcut', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      assert.deepEqual(config, {test: 1});
      next(undefined, 'hello');
    });
    registry.run('hello', {test: 1}, function (err, dep) {
      assert.deepEqual(dep, 'hello');
      done();
    });
  });

  it('must return a service in a simple case (1 function)', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      assert.equal(registry, this);
      assert.deepEqual(deps, {});
      next(undefined, 'hello');
    });

    registry.graph({}).run('hello', function (err, dep) {
      assert.equal(registry, this);
      assert.deepEqual(dep, 'hello');
      done();
    });
  });


  it('must return undefined (1 function)', function (done) {
    registry.graph({}).run('hello', function (err, dep) {
      assert.equal(registry, this);
      assert.equal(err.message, 'Diogenes: missing dependency: hello');
      assert.instanceOf(err, Error);
      done();
    });
  });

  it('must return an exception if the function fails', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      throw new Error('broken');
      next(undefined, 'hello');
    });

    registry.graph({}).run('hello', function (err, dep) {
      assert.equal(registry, this);
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      done();
    });
  });

  it('must return a service in a simple case (2 functions)', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      assert.deepEqual(deps, {});
      next(undefined, 'hello ');
    });

    registry.service('world').dependsOn(['hello']).returns(function (config, deps, next) {
      assert.deepEqual(deps, {hello: 'hello '});
      next(undefined, deps.hello + 'world!');
    });

    registry.graph({}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must return a service in a simple case (2 functions) not using next', function (done) {
    registry.service('hello').returns(function (config, deps) {
      assert.deepEqual(deps, {});
      return 'hello ';
    });

    registry.service('world').dependsOn(['hello']).returns(function (config, deps) {
      assert.deepEqual(deps, {hello: 'hello '});
      return deps.hello + 'world!';
    });

    registry.graph({}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must return a service in a simple case (2 functions) using promises', function (done) {
    registry.service('hello').returns(function (config, deps) {
      assert.deepEqual(deps, {});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve('hello ');
        }, 10);
      });
      return p;
    });

    registry.service('world').dependsOn(['hello']).returns(function (config, deps) {
      assert.deepEqual(deps, {hello: 'hello '});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve(deps.hello + 'world!');
        }, 10);
      });
      return p;
    });

    registry.graph({}).run('world', function (err, dep) {
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

    registry.service('hello').returns(function (config, deps) {
      assert.deepEqual(deps, {});
      return getPromise(getPromise('hello'));
    });

    registry.graph({}).run('hello', function (err, dep) {
      assert.deepEqual(dep, 'hello');
      done();
    });
  });

  it('must propagate an error using promises', function (done) {
    registry.service('hello').returns(function (config, deps) {
      assert.deepEqual(deps, {});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          reject(new Error('broken'));
        }, 10);
      });
      return p;
    });

    registry.service('world').dependsOn(['hello']).returns(function (config, deps) {
      assert.deepEqual(deps, {hello: 'hello '});
      var p = new Promise(function (resolve, reject) {
        setTimeout(function () {
          resolve(deps.hello + 'world!');
        }, 10);
      });
      return p;
    });

    registry.graph({}).run('world', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'broken');
      done();
    });
  });

  it('must return a service in a simple case (2 functions), dependencies are a function', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      assert.deepEqual(deps, {});
      next(undefined, 'hello ');
    });

    var getDeps = function (config) {
      assert.deepEqual(config, {test: 1});
      return ['hello'];
    };

    registry.service('world').dependsOn(getDeps).returns(function (config, deps, next) {
      assert.deepEqual(deps, {hello: 'hello '});
      next(undefined, deps.hello + 'world!');
    });

    registry.graph({test: 1}).run('world', function (err, dep) {
      assert.deepEqual(dep, 'hello world!');
      done();
    });
  });

  it('must return a service only once', function (done) {
    registry.service('hello').returnsOnce(['special'], function (config, deps, next) {
      next(undefined, 'hello special');
    });

    registry.service('hello').returnsOnce(function (config, deps, next) {
      next(undefined, 'hello');
    });

    registry.graph({special: 1}).run('hello', function (err, dep) {
      assert.deepEqual(dep, 'hello special');
      registry.graph({special: 1}).run('hello', function (err, dep) {
        assert.deepEqual(dep, 'hello');
        done();
      });
    });
  });

  it('must recognize a circular dependency', function (done) {
    registry.service('hello').dependsOn(['world']).returns(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.service('world').dependsOn(['hello']).returns(function (config, deps, next) {
      next(undefined, 'world!');
    });

    registry.graph({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: circular dependency: hello');
      done();
    });
  });

  it('must recognize a circular dependency (3 services)', function (done) {
    registry.service('A').dependsOn(['C']).returns(function (config, deps, next) {
      next(undefined, undefined);
    });

    registry.service('B').dependsOn(['A']).returns(function (config, deps, next) {
      next(undefined, undefined);
    });

    registry.service('C').dependsOn(['B']).returns(function (config, deps, next) {
      next(undefined, undefined);
    });

    registry.graph({}).run('C', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: circular dependency: C');
      done();
    });
  });

  it('must throw an exception when missing dependency', function (done) {
    registry.service('hello').dependsOn(['world']).returns(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.graph({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Diogenes: missing dependency: world');
      done();
    });
  });

  it('must throw an exception when more than one plugin matches', function (done) {
    registry.service('hello').returns(function (config, deps, next) {
      next(undefined, 'hello1');
    });

    registry.service('hello').returns(function (config, deps, next) {
      next(undefined, 'hello2');
    });

    registry.graph({}).run('hello', function (err, dep) {
      assert.instanceOf(err, Error);
      assert.equal(err.message, 'Occamsrazor (get): More than one adapter fits');
      done();
    });
  });

  it('must add a value', function (done) {
    registry.service('hello').returnsValue('hello');

    registry.graph({}).run('hello', function (err, dep) {
      assert.equal(dep, 'hello');
      done();
    });
  });

  it('must add a value (only once)', function (done) {
    registry.service('hello').returnsValueOnce('hello');

    registry.graph({}).run('hello', function (err, dep) {
      assert.equal(dep, 'hello');
      registry.graph({}).run('hello', function (err, dep) {
        assert.equal(err.message, 'Occamsrazor (get): Function not found');
        assert.instanceOf(err, Error);
        done();
      });
    });
  });

  it('must read write metadata', function () {
    registry.service('hello').returnsValue('hello', 'hello');
    registry.service('hello').metadata('metadata');
    assert.equal(registry.service('hello').metadata(), 'metadata');
  });

  describe('plugins', function () {
    beforeEach(function () {
      registry.service('hello').returnsValue('hello')
      .returns({greetings: undefined}, function (cfg, deps) {
        return cfg.greetings;
      });

      registry.service('world').dependsOn(['hello']).returns(function (cfg, deps) {
        return deps.hello + ' world';
      })
      .returns({who: /mars/gi}, function (cfg, deps) {
        return deps.hello + ' martians';
      })
      .returns({who: /mars/gi}, {hello: /morning/}, function (cfg, deps) {
        return 'good day martians';
      });
    });

    it('must use right function', function () {
      registry.graph().run('world', function (err, dep) {
        assert.equal(dep, 'hello world');
      });
    });

    it('must use right function using a validator for the config', function () {
      registry.graph({who: 'mars'}).run('world', function (err, dep) {
        assert.equal(dep, 'hello martians');
      });
    });

    it('must use right function using a validator for the config and deps', function () {
      registry.graph({who: 'mars', greetings: 'good morning'}).run('world', function (err, dep) {
        assert.equal(dep, 'good day martians');
      });
    });

  });

  describe('documentation', function () {
    beforeEach(function () {
      registry.service('hello').returnsValue('hello');

      registry.service('world').dependsOn(['hello']).returnsValue('world');
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
      assert.deepEqual(registry.graph().infoObj(), {hello: obj1, world: obj2});
    });

    it('must create doc', function () {
      var doc1 = 'hello\n=====\nreturns the string hello\n\nMetadata:\n```js\n"Metadata"\n```\n';
      var doc2 = 'world\n=====\nreturns the string world\n\nExecution order:\n* hello\n\nDependencies:\n* hello\n';
      assert.equal(registry.service('hello').info(), doc1);
      assert.equal(registry.service('world').info(),  doc2);
      assert.equal(registry.graph().info(), doc1 + '\n\n' + doc2);
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
      registry.service('A').returns(function (config, deps, next) {
        next(undefined, 'A');
      });

      registry.service('B').dependsOn(['A']).returns(function (config, deps, next) {
        next(undefined, deps['A'] + 'B');
      });

      registry.service('C').dependsOn(['A', 'B']).returns(function (config, deps, next) {
        next(undefined, deps['A'] + deps['B'] + 'C');
      });

      registry.service('D').dependsOn(['B', 'C']).returns(function (config, deps, next) {
        next(undefined, deps['B'] + deps['C'] + 'D');
      });
    });

    it('must return leftmost service', function (done) {
      registry.graph({}).run('A', function (err, dep) {
        assert.deepEqual(dep, 'A');
        done();
      });
    });

    it('must return middle service (1)', function (done) {
      registry.graph({}).run('B', function (err, dep) {
        assert.deepEqual(dep, 'AB');
        done();
      });
    });

    it('must return middle service (2)', function (done) {
      registry.graph({}).run('C', function (err, dep) {
        assert.deepEqual(dep, 'AABC');
        done();
      });
    });

    it('must return rightmost service', function (done) {
      registry.graph({}).run('D', function (err, dep) {
        assert.deepEqual(dep, 'ABAABCD');
        done();
      });
    });

    it('must return execution order', function () {
      var list = registry.graph({}).getExecutionOrder('D');
      assert.deepEqual(list, [ 'A', 'B', 'C', 'D' ]);
    });

    it('must replace node', function () {
      registry.remove('D');
      registry.service('D').dependsOn(['A']).returns(function (config, deps, next) {
        next(undefined, deps['A'] + 'D');
      });

      var list = registry.graph({}).getExecutionOrder('D');
      assert.deepEqual(list, [ 'A', 'D' ]);
    });

    it('must run without config', function (done) {
      registry.graph().run('D', function (err, dep) {
        assert.deepEqual(dep, 'ABAABCD');
        done();
      });
    });

    it('must run without config and callback', function (done) {
      registry.graph().run('D');
      setTimeout(function () {
        done();
      }, 20);
    });

    it('must run more than one service', function (done) {
      registry.graph({}).run(['A', 'D'], function (err, deps) {
        assert.deepEqual(deps.A, 'A');
        assert.deepEqual(deps.D, 'ABAABCD');
        done();
      });
    });

    it('must run more than one service, no config', function (done) {
      registry.graph().run(['A', 'D'], function (err, deps) {
        assert.deepEqual(deps.A, 'A');
        assert.deepEqual(deps.D, 'ABAABCD');
        done();
      });
    });

    it('must run more than one service, no config, no callback', function (done) {
      registry.graph().run(['A', 'D']);
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
      .returns(function (config, deps, next) {
        next(undefined, 'hello ');
      })
      .dependsOn(isReversed, ['world'])
      .returns(isReversed, function (config, deps, next) {
        next(undefined, deps.world + 'hello!');
      });

      registry.service('world')
      .dependsOn(['hello'])
      .returns(function (config, deps, next) {
        next(undefined, deps.hello + 'world!');
      })
      .dependsOn(isReversed, [])
      .returns(isReversed, function (config, deps, next) {
        next(undefined, 'world ');
      });
    });

    it('must extract the rightmost service', function (done) {
      registry.graph({}).run('world', function (err, dep) {
        assert.deepEqual(dep, 'hello world!');
        done();
      });
    });

    it('must extract the leftmost service', function (done) {
      registry.graph({}).run('hello', function (err, dep) {
        assert.deepEqual(dep, 'hello ');
        done();
      });
    });

    it('must extract the rightmost inverted service', function (done) {
      registry.graph({reverse: true}).run('hello', function (err, dep) {
        assert.deepEqual(dep, 'world hello!');
        done();
      });
    });

    it('must extract the leftmost inverted service', function (done) {
      registry.graph({reverse: true}).run('world', function (err, dep) {
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

      registry.service('A').returns(function (config, deps, next) {
        setTimeout(function () {
          str += 'A';
          next(undefined, 'A');
        }, 50);
      });

      registry.service('B').returns(function (config, deps, next) {
        setTimeout(function () {
          str += 'B';
          next(undefined, 'B');
        }, 20);
      });

      registry.service('C').dependsOn(['A', 'B']).returns(function (config, deps, next) {
        str += 'C';
        next(undefined, deps.A + deps.B + 'C');
      });

    });

    it('must run service asynchronously', function (done) {
      registry.graph({}).run('C', function (err, dep) {
        assert.equal(str, 'BAC');
        assert.equal(dep, 'ABC');
        done();
      });
    });

    it('must profile the execution', function (done) {
      registry.graph({}).run('C', function (err, dep, deps, profile) {
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
      registry.service('text').returnsValue(text);

      registry.service('tokens').dependsOn(['text']).returns(function (config, deps, next) {
        next(undefined, deps.text.split(' '));
      });

      registry.service('count').dependsOn(['tokens']).returns(function (config, deps, next) {
        next(undefined, deps.tokens.length);
      });

      registry.service('abstract').dependsOn(['tokens']).returns(function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.tokens.slice(0, len).join(' ') + ellipsis);
      });

      registry.service('paragraph').dependsOn(['text', 'abstract', 'count'])
      .returns(function (config, deps, next) {
        next(undefined, {
          count: deps.count,
          abstract: deps.abstract,
          text: deps.text
        });
      });

      var useAlternativeClamp = Diogenes.validator().match({abstractClamp: 'chars'});

      registry.service('abstract')
      .dependsOn(useAlternativeClamp, ['text'])
      .returns(useAlternativeClamp, function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.text.slice(0, len) + ellipsis);
      });

    });

    it('must return a correct order (readme example)', function () {
      var a = registry.graph({abstractLen: 5, abstractEllipsis: '...'}).getExecutionOrder('paragraph');
      assert.deepEqual(a, ['text', 'tokens', 'abstract', 'count', 'paragraph']);
    });

    it('must work (readme example)', function (done) {
      registry.graph({abstractLen: 5, abstractEllipsis: '...'}).run('paragraph', function (err, p) {
        assert.equal(p.count, 23);
        assert.equal(p.abstract, 'Diogenes became notorious for his...');
        assert.equal(p.text, text);
        done();
      });
    });

    it('must return a correct order (readme example) - alternate version', function () {
      var a = registry.graph({abstractLen: 5, abstractEllipsis: '...', abstractClamp: 'chars'}).getExecutionOrder('paragraph');
      assert.deepEqual(a, ['text', 'abstract', 'tokens', 'count', 'paragraph']);
    });

    it('must work (readme example) - alternate version', function (done) {
      registry.graph({abstractLen: 5, abstractEllipsis: '...', abstractClamp: 'chars'}).run('paragraph', function (err, p) {
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
      cached = registry.service('cached').returns(function (config, deps, next) {
        next(undefined, 'hello ' + c++);
      });
    });

    it('must configure cache: default key', function () {
      cached.cacheOn();
      cached.cachePush({}, 'result');
      assert.deepEqual(cached.cache, {_default: 'result'});
      assert.equal(cached.cacheKeys.length, 1);
      assert.equal(cached.cacheKeys[0].key, '_default');
    });

    it('must configure cache: string key', function () {
      cached.cacheOn({key: 'test'});
      cached.cachePush({test: '1'}, 'result1');
      cached.cachePush({test: '2'}, 'result2');
      assert.deepEqual(cached.cache, {'1': 'result1', '2': 'result2'});
      assert.equal(cached.cacheKeys.length, 2);
    });

    it('must configure cache: string key/object', function () {
      cached.cacheOn({key: 'test'});
      cached.cachePush({test: [1, 2]}, 'result1');
      cached.cachePush({test: [3, 4]}, 'result2');
      assert.deepEqual(cached.cache, {'[1,2]': 'result1', '[3,4]': 'result2'});
      assert.equal(cached.cacheKeys.length, 2);
    });

    it('must configure cache: array key', function () {
      cached.cacheOn({key: ['test', 0]});
      cached.cachePush({test: [1, 2]}, 'result1');
      cached.cachePush({test: [3, 4]}, 'result2');
      assert.deepEqual(cached.cache, {'1': 'result1', '3': 'result2'});
      assert.equal(cached.cacheKeys.length, 2);
    });

    it('must configure cache: array key/object', function () {
      cached.cacheOn({key: ['test']});
      cached.cachePush({test: [1, 2]}, 'result1');
      cached.cachePush({test: [3, 4]}, 'result2');
      assert.deepEqual(cached.cache, {'[1,2]': 'result1', '[3,4]': 'result2'});
      assert.equal(cached.cacheKeys.length, 2);
    });

    it('must configure cache: func', function () {
      cached.cacheOn({key: function (config) {
        return config.test * 2;
      }});
      cached.cachePush({test: 4}, 'result1');
      cached.cachePush({test: 6}, 'result2');
      assert.deepEqual(cached.cache, {'8': 'result1', '12': 'result2'});
      assert.equal(cached.cacheKeys.length, 2);
    });

    it('must configure cache: maxSize', function () {
      cached.cacheOn({key: 'test', maxSize: 2});
      cached.cachePush({test: 1}, 'result1');
      cached.cachePush({test: 2}, 'result2');
      assert.deepEqual(cached.cache, {'1': 'result1', '2': 'result2'});
      assert.equal(cached.cacheKeys.length, 2);
      cached.cachePush({test: 3}, 'result3');
      assert.deepEqual(cached.cache, {'2': 'result2', '3': 'result3'});
      assert.equal(cached.cacheKeys.length, 2);
    });

    it('must configure cache: maxAge', function (done) {
      cached.cacheOn({key: 'test', maxAge: 20});
      cached.cachePush({test: 1}, 'result1');
      assert.deepEqual(cached.cache, {'1': 'result1'});
      setTimeout(function () {
        cached.cachePush({test: 2}, 'result2');
        assert.deepEqual(cached.cache, {'1': 'result1', '2': 'result2'});
        assert.equal(cached.cacheKeys.length, 2);
        setTimeout(function () {
          cached.cachePush({test: 3}, 'result3');
          assert.deepEqual(cached.cache, {'2': 'result2', '3': 'result3'});
          assert.equal(cached.cacheKeys.length, 2);
          done();
        }, 15);
      }, 10);
    });

    it('must reset/switch off cache', function () {
      cached.cacheOn({key: 'test'});
      cached.cachePush({test: 1}, 'result1');
      cached.cachePush({test: 2}, 'result2');
      assert.deepEqual(cached.cache, {'1': 'result1', '2': 'result2'});
      cached.cacheReset();
      assert.equal(cached.cacheKeys.length, 0);
      assert.deepEqual(cached.cache, {});
      cached.cacheOff();
      assert.isUndefined(cached.cacheKeys);
      assert.isUndefined(cached.cache);
    });

    it('must run only once', function (done) {
      cached.cacheOn();
      cached.registry().graph({}).run('cached', function (err, dep) {
        assert.equal(dep, 'hello 0');
        cached.registry().graph({}).run('cached', function (err, dep) {
          assert.equal(dep, 'hello 0');
          done();
        });
      });
    });

    it('must pause the cache', function (done) {
      cached.cacheOn();
      cached.registry().graph({}).run('cached', function (err, dep) {
        assert.equal(dep, 'hello 0');
        cached.registry().graph({}).run('cached', function (err, dep) {
          assert.equal(dep, 'hello 0');
          cached.cachePause();
          cached.registry().graph({}).run('cached', function (err, dep) {
            assert.equal(dep, 'hello 1');
            cached.cacheResume();
            cached.registry().graph({}).run('cached', function (err, dep) {
              assert.equal(dep, 'hello 0');
              done();
            });
          });
        });
      });
    });

    it('must reset all caches', function () {
      cached.cacheOn({key: 'test'});
      cached.cachePush({test: 1}, 'result1');
      cached.cachePush({test: 2}, 'result2');
      assert.deepEqual(cached.cache, {'1': 'result1', '2': 'result2'});
      registry.cacheReset();
      assert.equal(cached.cacheKeys.length, 0);
      assert.deepEqual(cached.cache, {});
      registry.cacheOff();
      assert.isUndefined(cached.cacheKeys);
      assert.isUndefined(cached.cache);
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

    it('must fire on deps', function (done) {
      var called = false;

      registry.on('world', function (name, dep, config) {
        assert.equal(name, 'world');
        assert.equal(dep, 'hello world!');
        assert.deepEqual(config, {test:1});
        assert(called);
        done();
      });

      registry.on('hello', function (name, dep, config) {
        assert.equal(name, 'hello');
        assert.equal(dep, 'hello ');
        assert.deepEqual(config, {test:1});
        called = true;
      });

      registry.service('hello').returns(function (config, deps, next) {
        next(undefined, 'hello ');
      });

      registry.service('world').dependsOn(['hello']).returns(function (config, deps, next) {
        next(undefined, deps.hello + 'world!');
      });

      registry.graph({test: 1}).run('world', function (err, dep) {});
    });

    it('must fire on deps (alternate syntax)', function (done) {
      var called = false;

      registry.service('world').on(function (name, dep, config) {
        assert.equal(name, 'world');
        assert.equal(dep, 'hello world!');
        assert.deepEqual(config, {test:1});
        assert(called);
        done();
      });

      registry.service('hello').on(function (name, dep, config) {
        assert.equal(name, 'hello');
        assert.equal(dep, 'hello ');
        assert.deepEqual(config, {test:1});
        called = true;
      });

      registry.service('hello').returns(function (config, deps, next) {
        next(undefined, 'hello ');
      });

      registry.service('world').dependsOn(['hello']).returns(function (config, deps, next) {
        next(undefined, deps.hello + 'world!');
      });

      registry.graph({test: 1}).run('world', function (err, dep) {});
    });

    it('mustn\'t fire for cached values', function (done) {
      var called = 0;

      registry.service('hello').on(function (name, dep, config) {
        assert.equal(name, 'hello');
        assert.equal(dep, 'hello');
        assert.deepEqual(config, {test:1});
        called++;
      });

      registry.service('hello').returns(function (config, deps, next) {
        next(undefined, 'hello');
      })
      .cacheOn();

      registry.graph({test: 1}).run('hello', function (err, dep) {
        setTimeout(function () {
          assert.equal(called, 1);
          registry.graph({test: 1}).run('hello', function (err, dep) {
            setTimeout(function () {
              assert.equal(called, 1);
              done();
            }, 10);
          });
        }, 10);

      });
    });
  });

  describe('onError', function (done) {

    it('must fallback on error', function (done) {
      registry.service('hello').returns(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorReturn(42);

      registry.graph({test: 1}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 42);
        done();
      });
    });

    it('must fallback on error (undefined)', function (done) {
      registry.service('hello').returns(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorReturn(undefined);

      registry.graph({test: 1}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.isUndefined(dep);
        done();
      });
    });

    it('must fallback on error (func)', function (done) {
      registry.service('hello').returns(function (config, deps, next) {
        next(new Error('error'));
      })
      .onErrorExecute(function (config) {return config.test;});

      registry.graph({test: 1}).run('hello', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 1);
        done();
      });
    });

    it('must fallback on propagated error', function (done) {
      registry.service('hello').returns(function (config, deps, next) {
        next(new Error('error'));
      });

      registry.service('world').dependsOn(['hello']).returns(function (config, deps, next) {
        next(undefined, 'world');
      })
      .onErrorReturn(42);

      registry.graph({test: 1}).run('world', function (err, dep) {
        assert.isUndefined(err);
        assert.equal(dep, 42);
        done();
      });
    });

  });

});
