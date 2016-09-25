var Diogenes = require('../src');
var assert = require('chai').assert;
var DiogenesError = require('../src/lib/diogenes-error');
var validator = require('occamsrazor-validator');

describe('diogenes merge registries', function () {

  var registry1, registry2, registry3;

  beforeEach(function () {
    registry1 = Diogenes.getRegistry();
    registry2 = Diogenes.getRegistry();
    registry1.service('answer').returnsValue(42);
    registry2.service('question').returnsValue('the answer to life the universe and everything');
    registry3 = registry1.merge(registry2);
  });

  it('must be different from previous registries', function () {
    assert.notEqual(registry1, registry3);
    assert.notEqual(registry2, registry3);
  });

  it('must copy the services', function () {
    assert.equal(Object.keys(registry3.services).length, 2);
  });
});

describe('registry', function () {
  var registry,
    isAnything;

  beforeEach(function () {
    registry = Diogenes.getRegistry();
    isAnything = validator();
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
      assert.instanceOf(err, DiogenesError);
      done();
    });
  });

  it('must return an exception if the function fails', function (done) {
    registry.service('hello').returns(function (config, deps) {
      throw new Error('broken');
      return 'hello';
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
      assert.instanceOf(err, DiogenesError);
      assert.equal(err.message, 'Diogenes: a callback has been firing more than once');
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

    registry.instance({}).run('world', function (err, dep) {
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

    registry.service('hello').returns(function (config, deps) {
      assert.deepEqual(deps, {});
      return getPromise(getPromise('hello'));
    });

    registry.instance({}).run('hello', function (err, dep) {
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
      assert.instanceOf(err, DiogenesError);
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
      assert.instanceOf(err, DiogenesError);
      assert.equal(err.message, 'Diogenes: circular dependency: C');
      done();
    });
  });

  it('must throw an exception when missing dependency', function (done) {
    registry.service('hello').dependsOn(['world']).provides(function (config, deps, next) {
      next(undefined, 'hello ');
    });

    registry.instance({}).run('hello', function (err, dep) {
      assert.instanceOf(err, DiogenesError);
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
    registry.service('hello').returnsValue('hello');

    registry.instance({}).run('hello', function (err, dep) {
      assert.equal(dep, 'hello');
      done();
    });
  });

  describe('plugins', function () {
    beforeEach(function () {
      registry.service('hello').returnsValue('hello')
      .provides({greetings: undefined}, function (cfg, deps) {
        return cfg.greetings;
      });

      registry.service('world').dependsOn(['hello']).returns(function (cfg, deps) {
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

  describe('correct services in the correct order (using the config/plugin)', function () {
    var isReversed;

    beforeEach(function () {
      isReversed = isAnything.has('reverse');

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

  describe('from the readme', function (done) {
    var text = ['Diogenes became notorious for his philosophical ',
    'stunts such as carrying a lamp in the daytime, claiming to ',
    'be looking for an honest man.'].join();

    beforeEach(function () {
      registry.service('text').returnsValue(text);

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

      var useAlternativeClamp = validator().match({abstractClamp: 'chars'});

      registry.service('abstract')
      .dependsOn(useAlternativeClamp, ['text'])
      .provides(useAlternativeClamp, function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.text.slice(0, len) + ellipsis);
      });

    });

    it('must return a correct order (readme example)', function () {
      var a = registry.instance({abstractLen: 5, abstractEllipsis: '...'})
      .getExecutionOrder('paragraph');
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
      var a = registry.instance({abstractLen: 5, abstractEllipsis: '...', abstractClamp: 'chars'})
      .getExecutionOrder('paragraph');
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

  describe('services cache', function () {
    var cached;

    beforeEach(function () {
      var c = 0;
      cached = registry.service('cached').provides(function (config, deps, next) {
        next(undefined, 'hello ' + c++);
      });
    });

    it('must run only once', function (done) {
      cached.cache();
      cached.registry().instance({}).run('cached', function (err, dep) {
        assert.equal(dep, 'hello 0');
        cached.registry().instance({}).run('cached', function (err, dep) {
          assert.equal(dep, 'hello 0');
          done();
        });
      });
    });
  });

});
